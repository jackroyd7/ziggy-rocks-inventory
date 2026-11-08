// POST: upload one JPEG/PNG/WebP photo (raw body, already resized by the browser). DELETE ?url=: remove one.
import { put, del } from "@vercel/blob";
import { protect, json } from "../lib/auth.js";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export const POST = protect(async request => {
  const type = (request.headers.get("content-type") || "").split(";")[0];
  if (!TYPES[type]) return json({ error: "Photos must be JPEG, PNG or WebP." }, 415);
  const body = Buffer.from(await request.arrayBuffer());
  if (!body.length) return json({ error: "The photo was empty." }, 400);
  if (body.length > 4_000_000) return json({ error: "That photo is too large." }, 413);
  if (!hasBlob()) return json({ url: `data:${type};base64,${body.toString("base64")}` }); // local development only
  const blob = await put(`photos/${Date.now()}.${TYPES[type]}`, body, { access: "public", contentType: type, addRandomSuffix: true });
  return json({ url: blob.url });
});

export const DELETE = protect(async request => {
  const url = new URL(request.url).searchParams.get("url") || "";
  if (hasBlob() && /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(url)) await del(url);
  return json({ ok: true });
});
