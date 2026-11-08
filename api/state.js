import { protect, json } from "../lib/auth.js";
import { list, get, ensureSeeded } from "../lib/store.js";

export const GET = protect(async () => {
  await ensureSeeded();
  const [inventory, cleans, issues, template] = await Promise.all([list("inventory"), list("cleans"), list("issues"), get("config", "template")]);
  return json({ inventory, cleans, issues, checklists: template?.checklists || [] });
});
