// Shared-password login. The session cookie is an expiry time signed with a key derived
// from APP_PASSWORD, so changing the password signs everyone out.
import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const COOKIE = "zr_session";
const MAX_AGE = 60 * 60 * 24 * 90; // 90 days

function signingKey() {
  const pw = process.env.APP_PASSWORD;
  if (!pw) throw new Error("APP_PASSWORD is not set");
  return createHash("sha256").update("ziggy-rocks:" + pw).digest();
}
const sign = value => createHmac("sha256", signingKey()).update(value).digest("base64url");

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function passwordMatches(input) {
  const pw = process.env.APP_PASSWORD;
  return !!pw && safeEqual(createHash("sha256").update(String(input)).digest("hex"), createHash("sha256").update(pw).digest("hex"));
}

export function sessionCookie() {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export function isSignedIn(request) {
  try {
    const raw = (request.headers.get("cookie") || "").split(/;\s*/).find(c => c.startsWith(COOKIE + "="));
    if (!raw) return false;
    const [exp, sig] = raw.slice(COOKIE.length + 1).split(".");
    return !!exp && !!sig && safeEqual(sig, sign(exp)) && Number(exp) > Date.now() / 1000;
  } catch { return false; }
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

// Wraps a handler so it only runs for signed-in people.
export const protect = handler => async request => {
  if (!isSignedIn(request)) return json({ error: "Sign in to continue." }, 401);
  try { return await handler(request); }
  catch (e) { console.error(e); return json({ error: "Something went wrong on the server. Try again." }, 500); }
};
