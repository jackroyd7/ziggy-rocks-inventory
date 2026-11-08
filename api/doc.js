// Create, change or delete one record: {op: "set" | "update" | "delete", collection, id, data}
import { protect, json } from "../lib/auth.js";
import { COLLECTIONS, set, update, remove } from "../lib/store.js";

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export const POST = protect(async request => {
  const { op, collection, id, data } = await request.json();
  if (!COLLECTIONS.includes(collection) || !ID.test(id || "")) return json({ error: "Unknown record." }, 400);
  if ((op === "set" || op === "update") && (typeof data !== "object" || data === null || Array.isArray(data))) return json({ error: "Missing data." }, 400);
  if (JSON.stringify(data || {}).length > 200_000) return json({ error: "That record is too large." }, 413);
  if (op === "set") await set(collection, id, data);
  else if (op === "update") { if (!(await update(collection, id, data))) return json({ error: "That record no longer exists." }, 404); }
  else if (op === "delete") await remove(collection, id);
  else return json({ error: "Unknown change." }, 400);
  return json({ ok: true });
});
