// Create, change or delete one record: {op: "set" | "update" | "delete", collection, id, data}
// The server records who created and last changed each record.
import { protect, json } from "../lib/auth.js";
import { COLLECTIONS, get, set, update, remove } from "../lib/store.js";

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const OWNER_ONLY = new Set(["config", "mylist"]);

export const POST = protect(async (request, me) => {
  const { op, collection, id, data } = await request.json();
  if (!COLLECTIONS.includes(collection) || !ID.test(id || "")) return json({ error: "Unknown record." }, 400);
  if (OWNER_ONLY.has(collection) && me.role !== "owner") return json({ error: "Only the owner can change that." }, 403);
  if ((op === "set" || op === "update") && (typeof data !== "object" || data === null || Array.isArray(data))) return json({ error: "Missing data." }, 400);
  if (JSON.stringify(data || {}).length > 200_000) return json({ error: "That record is too large." }, 413);

  const existing = await get(collection, id);
  // Private issues behave as if they don't exist for anyone but their author.
  if (existing?.private && existing.createdBy !== me.id) return json({ error: "That record no longer exists." }, 404);
  const now = Date.now();

  if (op === "set") {
    const rec = { ...data, createdBy: existing?.createdBy ?? me.id, createdAt: existing?.createdAt ?? data.createdAt ?? now };
    if (existing) Object.assign(rec, { updatedBy: me.id, updatedAt: now });
    if (collection === "issues") rec.private = !!data.private && me.role === "owner" && rec.createdBy === me.id;
    await set(collection, id, rec);
  } else if (op === "update") {
    if (!existing) return json({ error: "That record no longer exists." }, 404);
    const patch = { ...data, updatedBy: me.id, updatedAt: now };
    delete patch.createdBy; delete patch.createdAt;
    if (collection === "issues" && "private" in patch) patch.private = !!patch.private && me.role === "owner" && existing.createdBy === me.id;
    await update(collection, id, patch);
  } else if (op === "delete") {
    await remove(collection, id);
  } else return json({ error: "Unknown change." }, 400);
  return json({ ok: true });
});
