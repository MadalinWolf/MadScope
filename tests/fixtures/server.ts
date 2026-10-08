import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

export function startFixtureServer(
  rootDir: string,
  port = 0,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url?.split("?")[0] ?? "/");
    let file = join(rootDir, urlPath);
    if (urlPath.endsWith("/")) file = join(file, "index.html");
    if (!existsSync(file)) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
    });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      const p = typeof addr === "object" && addr ? addr.port : port;
      resolve({
        url: `http://127.0.0.1:${p}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}
