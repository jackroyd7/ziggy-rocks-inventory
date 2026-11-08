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
  const comment = { id: randomBytes(6).toString("hex"), by: me.id, at: new Date().toISOString(), text: body };
  await update(collection, issueId, { comments: [...comments, comment], updatedBy: me.id, updatedAt: Date.now() });
  return json({ comment });
});
