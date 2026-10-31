import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = resolve(root, relativePath);
  if (file !== root && !file.startsWith(root + sep)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  response.setHeader("Content-Type", contentTypes[extname(file).toLowerCase()] ?? "application/octet-stream");
  createReadStream(file)
    .on("error", () => {
      if (!response.headersSent) response.writeHead(404);
      response.end("Not found");
    })
    .pipe(response);
});

server.listen(5173, "127.0.0.1", () => {
  console.log("ALOHOMORA preview: http://127.0.0.1:5173/");
});
