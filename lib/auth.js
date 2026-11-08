// Sign-in. Each person has their own account (name + password). The session cookie names the
// account and is signed with a key derived from APP_PASSWORD, so changing APP_PASSWORD signs
// everyone out. Resetting someone's password or removing them also ends their sessions.
import { createHmac, createHash, timingSafeEqual, scrypt as scryptCb, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { list, get, set } from "./store.js";

const scrypt = promisify(scryptCb);
const COOKIE = "zr_session";
const MAX_AGE = 60 * 60 * 24 * 90; // 90 days

function signingKey() {
  const secret = process.env.SESSION_SECRET || process.env.APP_PASSWORD;
  if (!secret) throw new Error("APP_PASSWORD is not set");
  return createHash("sha256").update("ziggy-rocks:" + secret).digest();
}
const sign = value => createHmac("sha256", signingKey()).update(value).digest("base64url");
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// The shared APP_PASSWORD is only used once now: to create the first (owner) account.
export function appPasswordMatches(input) {
  const pw = process.env.APP_PASSWORD;
  const h = s => createHash("sha256").update(String(s)).digest("hex");
  return !!pw && safeEqual(h(input), h(pw));
}

export async function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await scrypt(String(pw), salt, 32)).toString("hex")}`;
}
export async function checkPassword(pw, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  return safeEqual((await scrypt(String(pw), salt, 32)).toString("hex"), hash);
}
export const goodPassword = pw => typeof pw === "string" && pw.length <= 200; // empty is allowed

// People
export const normName = n => String(n || "").trim().replace(/\s+/g, " ").slice(0, 40);
export const publicUser = u => ({ id: u.id, name: u.name, role: u.role, hasPassword: !!u.pass });
export async function users() { return (await list("users")).filter(u => !u.removed); }
export async function findByName(name) {
  const n = normName(name).toLowerCase();
  return (await users()).find(u => u.name.toLowerCase() === n) || null;
}
export async function saveUser(u) { const { id, ...data } = u; await set("users", id, data); }

// Sessions
export function sessionCookie(user) {
  const value = `${user.id}.${user.ver || 0}.${Math.floor(Date.now() / 1000) + MAX_AGE}`;
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `${COOKIE}=${value}.${sign(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export async function currentUser(request) {
  try {
    const raw = (request.headers.get("cookie") || "").split(/;\s*/).find(c => c.startsWith(COOKIE + "="));
    if (!raw) return null;
    const parts = raw.slice(COOKIE.length + 1).split(".");
    if (parts.length !== 4) return null;
    const [id, ver, exp, sig] = parts;
    if (!safeEqual(sig, sign(`${id}.${ver}.${exp}`)) || Number(exp) < Date.now() / 1000) return null;
    const u = await get("users", id);
    if (!u || u.removed || String(u.ver || 0) !== ver) return null;
    return { id, ...u };
  } catch { return null; }
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

// Wraps a handler so it only runs for signed-in people (or only the owner): handler(request, user)
export const protect = (handler, { ownerOnly = false } = {}) => async request => {
  const user = await currentUser(request);
  if (!user) return json({ error: "Sign in to continue." }, 401);
  if (ownerOnly && user.role !== "owner") return json({ error: "Only the owner can do that." }, 403);
  try { return await handler(request, user); }
  catch (e) { console.error(e); return json({ error: "Something went wrong on the server. Try again." }, 500); }
};

export const slow = () => new Promise(r => setTimeout(r, 700)); // slows down password guessing
