// Photos. Stored in Vercel Blob when it's connected, otherwise in the app's database.
// POST: upload one JPEG/PNG/WebP photo (raw body, already resized by the browser).
// GET ?id=: show a photo kept in the database (signed-in people only).
// DELETE ?url=: remove one.
import { randomBytes } from "node:crypto";
import { put, del } from "@vercel/blob";
import { protect, json, isSignedIn } from "../lib/auth.js";
import { savePhoto, loadPhoto, removePhoto } from "../lib/store.js";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
// Blob can be connected with a read-write token (any variable name, since Vercel lets you pick a prefix)
// or, on newer stores, with BLOB_STORE_ID and Vercel's built-in identity.
const blobToken = () => process.env.BLOB_READ_WRITE_TOKEN || Object.values(process.env).find(v => typeof v === "string" && v.startsWith("vercel_blob_rw_"));
const hasBlob = () => !!(blobToken() || process.env.BLOB_STORE_ID);
const blobOpts = () => (blobToken() ? { token: blobToken() } : {});
const ID = /^[a-f0-9]{32}$/;

export const POST = protect(async request => {
  const type = (request.headers.get("content-type") || "").split(";")[0];
  if (!TYPES[type]) return json({ error: "Photos must be JPEG, PNG or WebP." }, 415);
  const body = Buffer.from(await request.arrayBuffer());
  if (!body.length) return json({ error: "The photo was empty." }, 400);
  if (body.length > 4_000_000) return json({ error: "That photo is too large." }, 413);
  if (hasBlob()) {
    try {
      const blob = await put(`photos/${Date.now()}.${TYPES[type]}`, body, { access: "public", contentType: type, addRandomSuffix: true, ...blobOpts() });
      return json({ url: blob.url });
    } catch (e) { console.error("Blob upload failed, keeping the photo in the database instead:", e?.message || e); }
  }
  const id = randomBytes(16).toString("hex");
  await savePhoto(id, type, body.toString("base64"));
  return json({ url: `/api/photo?id=${id}` });
});

export async function GET(request) {
  if (!isSignedIn(request)) return new Response("Sign in to see photos.", { status: 401 });
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!ID.test(id)) return new Response("Not found", { status: 404 });
  const photo = await loadPhoto(id);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(photo.data, "base64"), {
    headers: { "content-type": TYPES[photo.type] ? photo.type : "application/octet-stream", "cache-control": "private, max-age=31536000, immutable" },
  });
}

export const DELETE = protect(async request => {
  const url = new URL(request.url).searchParams.get("url") || "";
  const local = url.match(/^\/api\/photo\?id=([a-f0-9]{32})$/);
  if (local) await removePhoto(local[1]);
  else if (hasBlob() && /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(url)) await del(url, blobOpts()).catch(e => console.error("Blob delete failed:", e?.message || e));
  return json({ ok: true });
});
