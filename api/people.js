// Owner only. GET: everyone. POST {op: "add", name, role} | {op: "reset", id} | {op: "remove", id} | {op: "rename", id, name}
import { randomBytes } from "node:crypto";
import { protect, json, users, saveUser, findByName, normName, publicUser } from "../lib/auth.js";
import { get } from "../lib/store.js";

export const GET = protect(async () => json({ people: (await users()).map(publicUser) }), { ownerOnly: true });

export const POST = protect(async (request, me) => {
  const { op, id, name: rawName, role } = await request.json();
  const name = normName(rawName);
  if (op === "add") {
    if (!name) return json({ error: "Enter a name." }, 400);
    if (await findByName(name)) return json({ error: `There's already someone called ${name}.` }, 409);
    const u = { id: randomBytes(8).toString("hex"), name, role: role === "owner" ? "owner" : "staff", pass: null, ver: 1, createdAt: Date.now(), addedBy: me.id };
    await saveUser(u);
    return json({ person: publicUser(u) });
  }
  const u = id && (await get("users", id));
  if (!u || u.removed) return json({ error: "That person no longer exists." }, 404);
  const person = { id, ...u };
  if (op === "reset") { person.pass = null; person.ver = (person.ver || 0) + 1; }
  else if (op === "remove") {
    if (id === me.id) return json({ error: "You can't remove yourself." }, 400);
    person.removed = true; person.pass = null; person.ver = (person.ver || 0) + 1;
  } else if (op === "rename") {
    if (!name) return json({ error: "Enter a name." }, 400);
    const clash = await findByName(name); if (clash && clash.id !== id) return json({ error: `There's already someone called ${name}.` }, 409);
    person.name = name;
  } else return json({ error: "Unknown change." }, 400);
  await saveUser(person);
  return json({ person: publicUser(person) });
}, { ownerOnly: true });
