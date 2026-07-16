import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const redirects = new Map([
  ["/", "/homepage/"],
  ["/homepage", "/homepage/"],
  ["/homepage/index.html", "/homepage/"],
  ["/earlyaccess", "/earlyaccess/"],
  ["/earlyaccess/index.html", "/earlyaccess/"],
]);
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
]);
const publicFiles = new Set([
  "app.js",
  "blank.svg",
  "confirmed.js",
  "index.html",
  "robots.txt",
  "shared.css",
  "styles.css",
]);
const publicDirectories = ["assets/", "earlyaccess/", "homepage/"];
const publicExtensions = new Set([".css", ".html", ".js", ".svg", ".txt", ".webp", ".woff2"]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${host}:${port}`);
    const redirect = redirects.get(url.pathname);
    if (redirect) {
      response.writeHead(307, { location: redirect, "cache-control": "no-store" });
      response.end();
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/early-access") {
      response.writeHead(202, {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      });
      response.end('{"ok":true}');
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      });
      response.end('{"ok":true}');
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/confirm") {
      response.writeHead(303, {
        location: "/earlyaccess/confirmed/?status=invalid",
        "cache-control": "no-store",
      });
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/_vercel/insights/script.js") {
      response.writeHead(204, { "cache-control": "no-store" });
      response.end();
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD" });
      response.end();
      return;
    }

    const decodedPath = decodeURIComponent(url.pathname);
    const relativePath = decodedPath.endsWith("/")
      ? `${decodedPath.slice(1)}index.html`
      : decodedPath.slice(1);
    const filePath = path.resolve(root, relativePath);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403);
      response.end();
      return;
    }
    const publicPath = path.relative(root, filePath).split(path.sep).join("/");
    if (
      !publicFiles.has(publicPath) &&
      !(
        publicDirectories.some((directory) => publicPath.startsWith(directory)) &&
        publicExtensions.has(path.extname(publicPath))
      )
    ) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    const content = await readFile(filePath);
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": contentTypes.get(path.extname(filePath)) || "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`SURGE shareable preview: http://${host}:${port}`);
  console.log("Email is mocked locally; no address is sent or stored.");
});
