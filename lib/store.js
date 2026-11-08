// Record storage. Uses whichever database Vercel has connected:
//   Neon Postgres (DATABASE_URL or POSTGRES_URL), or Upstash Redis (KV_REST_API_URL / UPSTASH_REDIS_REST_URL).
// With neither, records are kept in memory (local development only).
import { neon } from "@neondatabase/serverless";
import { Redis } from "@upstash/redis";
import { SEED_CHECKLISTS, SEED_ISSUES } from "./seed.js";

export const COLLECTIONS = ["inventory", "cleans", "issues", "config"];

const pgUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const parse = v => (v == null ? null : typeof v === "string" ? JSON.parse(v) : v);

function postgres() {
  const sql = neon(pgUrl);
  let ready;
  const init = () => (ready ||= Promise.all([
    sql.query(`create table if not exists records (
      collection text not null, id text not null, data jsonb not null, updated_at timestamptz not null default now(),
      primary key (collection, id))`),
    sql.query("create table if not exists photos (id text primary key, type text not null, data text not null, created_at timestamptz not null default now())"),
  ]));
  return {
    async all(c) { await init(); return (await sql.query("select id, data from records where collection = $1", [c])).map(r => [r.id, r.data]); },
    async get(c, id) { await init(); return (await sql.query("select data from records where collection = $1 and id = $2", [c, id]))[0]?.data ?? null; },
    async put(c, id, data) {
      await init();
      await sql.query("insert into records (collection, id, data) values ($1, $2, $3::jsonb) on conflict (collection, id) do update set data = excluded.data, updated_at = now()", [c, id, JSON.stringify(data)]);
    },
    async patch(c, id, patch) {
      await init();
      return (await sql.query("update records set data = data || $3::jsonb, updated_at = now() where collection = $1 and id = $2 returning data", [c, id, JSON.stringify(patch)]))[0]?.data ?? null;
    },
    async del(c, id) { await init(); await sql.query("delete from records where collection = $1 and id = $2", [c, id]); },
    async once(key) { await init(); return (await sql.query("insert into records (collection, id, data) values ('meta', $1, '{}') on conflict do nothing returning id", [key])).length > 0; },
    async putPhoto(id, type, b64) { await init(); await sql.query("insert into photos (id, type, data) values ($1, $2, $3)", [id, type, b64]); },
    async getPhoto(id) { await init(); return (await sql.query("select type, data from photos where id = $1", [id]))[0] ?? null; },
    async delPhoto(id) { await init(); await sql.query("delete from photos where id = $1", [id]); },
  };
}

function redis() {
  const r = new Redis({ url: redisUrl, token: redisToken });
  const k = c => `zr:${c}`;
  return {
    async all(c) { return Object.entries((await r.hgetall(k(c))) || {}).map(([id, v]) => [id, parse(v)]); },
    async get(c, id) { return parse(await r.hget(k(c), id)); },
    async put(c, id, data) { await r.hset(k(c), { [id]: data }); },
    async patch(c, id, patch) { const cur = parse(await r.hget(k(c), id)); if (!cur) return null; const next = { ...cur, ...patch }; await r.hset(k(c), { [id]: next }); return next; },
    async del(c, id) { await r.hdel(k(c), id); },
    async once(key) { return (await r.setnx(`zr:${key}`, "1")) === 1; },
    async putPhoto(id, type, b64) { await r.set(`zr:photo:${id}`, { type, data: b64 }); },
    async getPhoto(id) { return parse(await r.get(`zr:photo:${id}`)); },
    async delPhoto(id) { await r.del(`zr:photo:${id}`); },
  };
}

function memory() {
  const g = (globalThis.__zrMemory ||= new Map());
  const h = c => g.get(c) || g.set(c, new Map()).get(c);
  return {
    async all(c) { return [...h(c)].map(([id, v]) => [id, structuredClone(v)]); },
    async get(c, id) { const v = h(c).get(id); return v ? structuredClone(v) : null; },
    async put(c, id, data) { h(c).set(id, structuredClone(data)); },
    async patch(c, id, patch) { const cur = h(c).get(id); if (!cur) return null; const next = { ...cur, ...structuredClone(patch) }; h(c).set(id, next); return next; },
    async del(c, id) { h(c).delete(id); },
    async once(key) { if (h("meta").has(key)) return false; h("meta").set(key, {}); return true; },
    async putPhoto(id, type, b64) { h("photos").set(id, { type, data: b64 }); },
    async getPhoto(id) { return h("photos").get(id) ?? null; },
    async delPhoto(id) { h("photos").delete(id); },
  };
}

export const backend = pgUrl ? "postgres" : redisUrl && redisToken ? "redis" : "memory";
const db = backend === "postgres" ? postgres() : backend === "redis" ? redis() : memory();

export const list = async c => (await db.all(c)).map(([id, data]) => ({ id, ...data }));
export const get = (c, id) => db.get(c, id);
export const set = (c, id, data) => db.put(c, id, data);
export const update = (c, id, patch) => db.patch(c, id, patch);
export const remove = (c, id) => db.del(c, id);
// Photos, when Vercel Blob isn't connected: kept in the database as base64.
export const savePhoto = (id, type, b64) => db.putPhoto(id, type, b64);
export const loadPhoto = id => db.getPhoto(id);
export const removePhoto = id => db.delPhoto(id);

// First run: load the changeover checklists and the issues from the owner-to-guest doc.
export async function ensureSeeded() {
  if (!(await db.once("seeded"))) return;
  await set("config", "template", { checklists: SEED_CHECKLISTS });
  for (const { id, ...data } of SEED_ISSUES) await set("issues", id, data);
}
