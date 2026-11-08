// Local development server: serves public/ and runs api/*.js the way Vercel does.
// Records are kept in memory unless Upstash Redis variables are set.
// Run: APP_PASSWORD=test npm run dev
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.env.PORT) || 3000;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      const name = url.pathname.slice(5).replace(/[^a-z-]/g, "");
      const mod = await import(`./api/${name}.js`);
      const handler = mod[req.method];
      if (!handler) { res.writeHead(405).end(); return; }
      const chunks = []; for await (const c of req) chunks.push(c);
      const request = new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const path = normalize(join("public", url.pathname === "/" ? "index.html" : url.pathname));
    if (!path.startsWith("public")) { res.writeHead(403).end(); return; }
    const body = await readFile(path);
    res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }).end(body);
  } catch (e) {
    if (e.code === "ENOENT" || e.code === "ERR_MODULE_NOT_FOUND") { res.writeHead(404).end("Not found"); return; }
    console.error(e); res.writeHead(500).end("Server error");
  }
}).listen(PORT, () => console.log(`Ziggy Rocks running at http://localhost:${PORT}`));
