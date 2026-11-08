import { protect, json, publicUser } from "../lib/auth.js";
import { list, get, ensureSeeded } from "../lib/store.js";

export const GET = protect(async (request, me) => {
  await ensureSeeded();
  const owner = me.role === "owner";
  const [inventory, cleans, issues, template, people, mylist] = await Promise.all([
    list("inventory"), list("cleans"), list("issues"), get("config", "template"), list("users"), owner ? list("mylist") : [],
  ]);
  return json({
    me: publicUser(me),
    // Everyone ever added, so older records keep their names after someone is removed.
    people: people.map(u => ({ id: u.id, name: u.name, role: u.role, removed: !!u.removed })),
    inventory, cleans,
    issues: issues.filter(i => !i.private || i.createdBy === me.id),
    checklists: template?.checklists || [],
    mylist,
  });
});
