import { passwordMatches, sessionCookie, clearCookie, isSignedIn, json } from "../lib/auth.js";

export async function GET(request) {
  return json({ signedIn: isSignedIn(request) });
}

export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  if (!process.env.APP_PASSWORD) return json({ error: "The app has no password set yet. Add APP_PASSWORD in Vercel." }, 500);
  if (!passwordMatches(body.password || "")) {
    await new Promise(r => setTimeout(r, 800)); // slow down guessing
    return json({ error: "That password isn't right." }, 401);
  }
  return json({ signedIn: true }, 200, { "set-cookie": sessionCookie() });
}

export async function DELETE() {
  return json({ signedIn: false }, 200, { "set-cookie": clearCookie() });
}
