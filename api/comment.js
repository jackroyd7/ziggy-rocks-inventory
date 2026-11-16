// Comments on an issue or a changeover. POST {collection: "issues" | "cleans", id, text} adds one;
// POST {collection, id, remove: commentId} deletes your own (the owner can delete any).
// ({issueId} is still accepted for issues.) Private issues stay invisible to everyone but their author.
import { randomBytes } from "node:crypto";
import { protect, json } from "../lib/auth.js";
import { get, update } from "../lib/store.js";

export const POST = protect(async (request, me) => {
  const body0 = await request.json();
  const { text, remove } = body0;
  const collection = body0.issueId ? "issues" : body0.collection;
  const issueId = body0.issueId || body0.id;
  if (!["issues", "cleans"].includes(collection)) return json({ error: "Comments only go on issues and changeovers." }, 400);
  const issue = typeof issueId === "string" && (await get(collection, issueId));
  if (!issue || (issue.private && issue.createdBy !== me.id)) return json({ error: "That record no longer exists." }, 404);
  const comments = Array.isArray(issue.comments) ? issue.comments : [];
  if (remove) {
    const c = comments.find(x => x.id === remove);
    if (!c) return json({ ok: true });
    if (c.by !== me.id && me.role !== "owner") return json({ error: "You can only delete your own comments." }, 403);
    await update(collection, issueId, { comments: comments.filter(x => x.id !== remove) });
    return json({ ok: true });
  }
  const body = String(text || "").trim().slice(0, 2000);
  if (!body) return json({ error: "Write a comment first." }, 400);
  // The phone picks the comment's id and time, so a comment written offline keeps its time,
  // and sending the same comment twice (after a dropped connection) only saves it once.
  const id = /^[A-Za-z0-9]{6,32}$/.test(body0.cid || "") ? body0.cid : randomBytes(6).toString("hex");
  if (comments.some(c => c.id === id)) return json({ comment: comments.find(c => c.id === id) });
  const when = Date.parse(body0.at);
  const at = new Date(Number.isFinite(when) && when <= Date.now() + 5 * 60e3 ? when : Date.now()).toISOString();
  const comment = { id, by: me.id, at, text: body };
  await update(collection, issueId, { comments: [...comments, comment], updatedBy: me.id, updatedAt: Date.now() });
  return json({ comment });
});
