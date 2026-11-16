// Tick or untick one task on a changeover: {cleanId, i, room, task, done, doneAt}.
// Changing one task at a time (rather than saving the whole list) means two people ticking
// the same changeover, even offline, never undo each other's ticks.
import { protect, json } from "../lib/auth.js";
import { get, update } from "../lib/store.js";

export const POST = protect(async (request, me) => {
  const { cleanId, i, room, task, done, doneAt } = await request.json();
  const co = typeof cleanId === "string" && (await get("cleans", cleanId));
  if (!co) return json({ error: "That changeover no longer exists." }, 404);
  const tasks = Array.isArray(co.tasks) ? co.tasks : [];
  const match = t => t && t.room === room && t.task === task;
  const idx = match(tasks[i]) ? i : tasks.findIndex(match);
  if (idx < 0) return json({ error: "That task is no longer on this changeover." }, 404);
  const when = Date.parse(doneAt);
  const at = done ? new Date(Number.isFinite(when) && when <= Date.now() + 5 * 60e3 ? when : Date.now()).toISOString() : null;
  tasks[idx] = { ...tasks[idx], done: !!done, doneAt: at, doneBy: done ? me.id : null };
  await update("cleans", cleanId, { tasks, updatedBy: me.id, updatedAt: Date.now() });
  return json({ ok: true });
});
