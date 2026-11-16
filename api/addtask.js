// Add a task to a changeover that's under way, and to its checklist so future changeovers include it.
// POST {cleanId, room, task}. Anyone signed in can do this.
import { randomBytes } from "node:crypto";
import { protect, json } from "../lib/auth.js";
import { get, set, update } from "../lib/store.js";

const clean = s => String(s || "").trim().replace(/\s+/g, " ");

export const POST = protect(async (request, me) => {
  const body = await request.json();
  const room = clean(body.room).slice(0, 60), task = clean(body.task).slice(0, 300);
  if (!room) return json({ error: "Choose a room." }, 400);
  if (!task) return json({ error: "Type the task." }, 400);
  const co = typeof body.cleanId === "string" && (await get("cleans", body.cleanId));
  if (!co) return json({ error: "That changeover no longer exists." }, 404);
  if (co.finishedAt) return json({ error: "That changeover is finished. Reopen it to add tasks." }, 409);

  const same = t => t.room.toLowerCase() === room.toLowerCase() && t.task.toLowerCase() === task.toLowerCase();
  const tasks = Array.isArray(co.tasks) ? co.tasks : [];
  if (!tasks.some(same)) await update("cleans", body.cleanId, { tasks: [...tasks, { room, task, done: false, addedBy: me.id }], updatedBy: me.id, updatedAt: Date.now() });

  // Save it to the checklist this changeover was started from.
  const template = (await get("config", "template")) || { checklists: [] };
  const list = template.checklists.find(c => (co.checklistId && c.id === co.checklistId) || c.name === co.type);
  let savedToChecklist = false;
  if (list) {
    if (!list.tasks.some(same)) { list.tasks.push({ id: randomBytes(6).toString("hex"), room, task, addedBy: me.id }); await set("config", "template", template); }
    savedToChecklist = true;
  }
  return json({ ok: true, savedToChecklist, checklist: list?.name || null });
});
