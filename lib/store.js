// Record storage. Uses Upstash Redis on Vercel; falls back to memory for local development.
import { Redis } from "@upstash/redis";
import { SEED_CHECKLISTS, SEED_ISSUES } from "./seed.js";

export const COLLECTIONS = ["inventory", "cleans", "issues", "config"];

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

function memoryStore() {
  const g = globalThis.__zrMemory ||= new Map();
  const hash = key => g.get(key) || g.set(key, new Map()).get(key);
  return {
    async hgetall(key) { const h = hash(key); return h.size ? Object.fromEntries([...h].map(([k, v]) => [k, structuredClone(v)])) : null; },
    async hget(key, field) { const v = hash(key).get(field); return v === undefined ? null : structuredClone(v); },
    async hset(key, obj) { for (const [k, v] of Object.entries(obj)) hash(key).set(k, structuredClone(v)); return 1; },
    async hdel(key, field) { return hash(key).delete(field) ? 1 : 0; },
    async setnx(key, value) { if (g.has("str:" + key)) return 0; g.set("str:" + key, value); return 1; },
  };
}

export const usingMemory = !(url && token);
const redis = usingMemory ? memoryStore() : new Redis({ url, token });
const key = c => `zr:${c}`;

export async function list(collection) {
  const all = (await redis.hgetall(key(collection))) || {};
  return Object.entries(all).map(([id, data]) => ({ id, ...(typeof data === "string" ? JSON.parse(data) : data) }));
}
export async function get(collection, id) {
  const v = await redis.hget(key(collection), id);
  return v == null ? null : typeof v === "string" ? JSON.parse(v) : v;
}
export async function set(collection, id, data) { await redis.hset(key(collection), { [id]: data }); }
export async function update(collection, id, patch) {
  const cur = await get(collection, id);
  if (!cur) return null;
  const next = { ...cur, ...patch };
  await set(collection, id, next);
  return next;
}
export async function remove(collection, id) { await redis.hdel(key(collection), id); }

// First run: load the changeover checklists and the issues from the owner-to-guest doc.
export async function ensureSeeded() {
  if (!(await redis.setnx("zr:seeded", "1"))) return;
  await set("config", "template", { checklists: SEED_CHECKLISTS });
  for (const issue of SEED_ISSUES) { const { id, ...data } = issue; await set("issues", id, data); }
}
