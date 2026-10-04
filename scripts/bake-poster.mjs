/* Renders the desk poster (public/textures/poster.webp and poster-phone.webp): the scene's first frame
   as the hero shows it, without the page's words, shown by LaunchStage until the live scene is up.
   Run after `npm run build` (it serves out/), whenever the desk or its framing changes:
   `npm run bake:poster`. Needs Chrome or Edge; set CHROME=/path/to/chrome to pick one. */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "out");
if (!existsSync(join(site, "index.html"))) throw new Error("Build the site first (npm run build).");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".txt": "text/plain" };
const server = createServer((req, res) => {
  let path = join(site, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!path.startsWith(site)) { res.writeHead(403); res.end(); return; }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "index.html");
  if (!existsSync(path)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

const exe = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean).find((p) => existsSync(p));
if (!exe) throw new Error("No Chrome found; set CHROME to its path.");
const PORT = 9334, profile = mkdtempSync(join(tmpdir(), "poster-"));
const chrome = spawn(exe, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) { await new Promise((r) => setTimeout(r, 200)); try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page"); } catch {} }
  if (!target) throw new Error("Chrome did not start.");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const ev = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  await send("Page.enable");
  // Snapshot mode (exact poses, full quality, no entrance), and only the canvas on show.
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    document.documentElement.setAttribute("data-snap", "");
    try { sessionStorage.setItem("launch:seen", "1"); } catch {}
  ` });

  // Desktop: a wide still, so cover sizing crops it the way the camera crops the desk at any shape.
  // Phones: their own layout and lens, a portrait still.
  for (const [name, width, height] of [["poster", 2400, 800], ["poster-phone", 720, 1000]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url });
    let ok = false;
    for (let i = 0; i < 120 && !ok; i++) { await new Promise((r) => setTimeout(r, 250)); ok = await ev(`document.querySelector("canvas[data-ready]")?.dataset.ready === "true"`).catch(() => false); }
    if (!ok) throw new Error("The scene never became ready.");
    // Added late, into the body: React's hydration of the head would drop it.
    await ev(`(() => { const s = document.createElement("style"); s.textContent = "* { visibility: hidden !important; } canvas[data-ready] { visibility: visible !important; transition: none !important; }"; document.body.append(s); })()`);
    await new Promise((r) => setTimeout(r, 2000));
    const shot = await send("Page.captureScreenshot", { format: "png" });
    await sharp(Buffer.from(shot.result.data, "base64")).webp({ quality: 72, effort: 6 }).toFile(join(root, "public", "textures", `${name}.webp`));
    console.log(`${name}.webp  ${width} x ${height}`);
  }
  ws.close();
} finally {
  server.close(); chrome.kill();
  await new Promise((r) => setTimeout(r, 500));
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
