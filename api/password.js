// Change your own password: {current, next}
import { protect, json, checkPassword, hashPassword, goodPassword, saveUser, sessionCookie, slow } from "../lib/auth.js";

export const POST = protect(async (request, me) => {
  const { current, next } = await request.json();
  if (!(await checkPassword(current || "", me.pass))) { await slow(); return json({ error: "Your current password isn't right." }, 401); }
  if (!goodPassword(next)) return json({ error: "Choose a new password." }, 400);
  const user = { ...me, pass: await hashPassword(next), ver: (me.ver || 0) + 1 };
  await saveUser(user);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(user) }); // keeps this phone signed in, signs out the others
});
