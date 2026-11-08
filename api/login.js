// GET: who is signed in, and whether the owner account still needs setting up.
// POST: {name, password} to sign in; {name, newPassword} for someone's first sign-in (no password yet);
//       {setup: true, appPassword, name, password} to create the owner account the very first time.
// DELETE: sign out.
import { randomBytes } from "node:crypto";
import { appPasswordMatches, checkPassword, hashPassword, goodPassword, normName, findByName, users, saveUser, sessionCookie, clearCookie, currentUser, publicUser, json, slow } from "../lib/auth.js";

export async function GET(request) {
  const me = await currentUser(request);
  if (me) return json({ signedIn: true, me: publicUser(me) });
  return json({ signedIn: false, needsSetup: (await users()).length === 0 });
}

export async function POST(request) {
  if (!process.env.APP_PASSWORD) return json({ error: "The app has no APP_PASSWORD set yet. Add it in Vercel." }, 500);
  let body = {};
  try { body = await request.json(); } catch {}
  const name = normName(body.name);

  if (body.setup) {
    if ((await users()).length) return json({ error: "The owner account already exists. Sign in with your name." }, 409);
    if (!appPasswordMatches(body.appPassword || "")) { await slow(); return json({ error: "That isn't the app password set in Vercel." }, 401); }
    if (!name) return json({ error: "Enter your name." }, 400);
    if (!goodPassword(body.password)) return json({ error: "Choose a password of at least 6 characters." }, 400);
    const owner = { id: randomBytes(8).toString("hex"), name, role: "owner", pass: await hashPassword(body.password), ver: 1, createdAt: Date.now() };
    await saveUser(owner);
    return json({ signedIn: true, me: publicUser(owner) }, 200, { "set-cookie": sessionCookie(owner) });
  }

  if (!name) return json({ error: "Enter your name." }, 400);
  const user = await findByName(name);
  if (!user) { await slow(); return json({ error: "There's no one with that name. Check the spelling, or ask the owner to add you." }, 401); }

  if (!user.pass) {
    if (body.newPassword === undefined) return json({ needsPassword: true, name: user.name });
    if (!goodPassword(body.newPassword)) return json({ error: "Choose a password of at least 6 characters." }, 400);
    user.pass = await hashPassword(body.newPassword); user.ver = (user.ver || 0) + 1;
    await saveUser(user);
    return json({ signedIn: true, me: publicUser(user) }, 200, { "set-cookie": sessionCookie(user) });
  }

  if (!(await checkPassword(body.password || "", user.pass))) { await slow(); return json({ error: "That password isn't right." }, 401); }
  return json({ signedIn: true, me: publicUser(user) }, 200, { "set-cookie": sessionCookie(user) });
}

export async function DELETE() {
  return json({ signedIn: false }, 200, { "set-cookie": clearCookie() });
}
