import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ico": "image/x-icon",
};
/** Serve only production assets; the same origin also accepts crew WebSockets. */
export async function serveGame(
  req: IncomingMessage,
  res: ServerResponse,
  rooms: number,
) {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  if (pathname === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify({ service: "Outpost Down crew server", rooms }));
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }
  const root = resolve("dist");
  let file: string;
  try {
    file = resolve(
      root,
      "." + decodeURIComponent(pathname === "/" ? "/index.html" : pathname),
    );
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  if (!file.startsWith(root + sep) || file.includes("\0")) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw Error("not a file");
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Content-Length": info.size,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": pathname.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(file)
      .on("error", () => res.destroy())
      .pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found. Build the game with npm run build before hosting.");
  }
}
