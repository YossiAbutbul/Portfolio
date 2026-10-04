/* Renders the desk's procedural textures (draw.js) once in headless Chrome and saves them as WebP in
   public/textures, so the page loads pictures instead of drawing millions of pixels on startup. Also
   bakes the scene's environment light (three's PMREM of its RoomEnvironment), whose blur shaders took
   seconds to compile on Windows at every visit; see room-env.webp below.
   Run with `npm run bake:textures` (needs Chrome or Edge installed, and the network for the font).
   Set CHROME=/path/to/chrome to pick the browser. */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "..", "public", "textures");
const PORT = 9333;
const root = join(here, "..", "..");

// three is served from node_modules so the page can import it (the environment bake needs it).
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<!doctype html><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>`);
  } else if (path.startsWith("/node_modules/three/") && !path.includes("..") && existsSync(join(root, path))) {
    res.writeHead(200, { "content-type": "text/javascript" });
    res.end(readFileSync(join(root, path)));
  } else { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const page = `http://127.0.0.1:${server.address().port}/`;

const browsers = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const exe = browsers.find((p) => existsSync(p));
if (!exe) throw new Error("No Chrome found; set CHROME to its path.");

const profile = mkdtempSync(join(tmpdir(), "bake-"));
const chrome = spawn(exe, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", page], { stdio: "ignore" });

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page"); } catch {}
  }
  if (!target) throw new Error("Chrome did not start.");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); pending.delete(m.id); };
  const run = (expression) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (m) => {
      if (m.error || m.result.exceptionDetails) reject(new Error(JSON.stringify(m.error ?? m.result.exceptionDetails)));
      else resolve(m.result.result.value);
    });
    ws.send(JSON.stringify({ id: n, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
  });

  // Chrome may still be on its way to the page.
  for (let i = 0; i < 50; i++) {
    try { if (await run(`location.href === ${JSON.stringify(page)} && document.readyState === "complete"`)) break; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  // The mat's ruler numbers are set in Figtree, as on the site.
  await run(`new Promise((ok, fail) => {
    const l = document.createElement("link"); l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Figtree:wght@600;700&display=block";
    l.onload = () => Promise.all([document.fonts.load("600 34px Figtree"), document.fonts.load("700 24px Figtree")]).then(ok, fail);
    l.onerror = () => fail(new Error("font"));
    document.head.append(l);
  })`);
  await run(readFileSync(join(here, "draw.js"), "utf8"));
  const bakes = await run("window.BAKES.map((b) => ({ name: b.name, w: b.w, h: b.h, half: !!b.half }))");

  // In order: they share one noise source, as the desk did.
  for (const [i, b] of bakes.entries()) {
    const url = await run(`(() => { const b = window.BAKES[${i}]; const c = document.createElement("canvas"); c.width = b.w; c.height = b.h; b.draw(c.getContext("2d"), b.w, b.h); return c.toDataURL("image/png"); })()`);
    const png = Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
    await sharp(png).webp({ quality: 88, effort: 6 }).toFile(join(out, `${b.name}.webp`));
    // Phones draw these at half size.
    if (b.half) await sharp(png).resize(b.w / 2, b.h / 2).webp({ quality: 88, effort: 6 }).toFile(join(out, `${b.name}-half.webp`));
    console.log(`${b.name}.webp  ${b.w} x ${b.h}${b.half ? "  (+ half)" : ""}`);
  }
  /* The environment: the PMREM three builds from RoomEnvironment (as scene.ts used to, sigma .04,
     256 per face), read back and stored as RGBE (colour scaled by a shared power of two in the alpha)
     in a lossless WebP. scene.ts decodes it on the GPU into the same 768 x 1024 half-float cube-UV
     target three would have made. Rows are stored bottom-up, as the GPU reads them. */
  const env = await run(`(async () => {
    const THREE = await import("three");
    const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
    const renderer = new THREE.WebGLRenderer();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, .04);
    const { width: w, height: h } = target;
    const out = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: false });
    const encode = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, uniforms: { map: { value: target.texture } },
      vertexShader: "in vec3 position; void main() { gl_Position = vec4(position.xy, 0., 1.); }",
      fragmentShader: "precision highp float; uniform sampler2D map; out vec4 o; void main() { vec3 c = max(texelFetch(map, ivec2(gl_FragCoord.xy), 0).rgb, 0.); float m = max(c.r, max(c.g, c.b)); if (m < 1e-6) { o = vec4(0.); return; } float e = ceil(log2(m)); o = vec4(c / exp2(e), (e + 128.) / 255.); }",
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), encode); quad.frustumCulled = false;
    renderer.setRenderTarget(out); renderer.render(quad, new THREE.Camera());
    const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(out, 0, 0, w, h, px);
    let bin = ""; for (let i = 0; i < px.length; i += 32768) bin += String.fromCharCode(...px.subarray(i, i + 32768));
    return { w, h, data: btoa(bin) };
  })()`);
  await sharp(Buffer.from(env.data, "base64"), { raw: { width: env.w, height: env.h, channels: 4 } }).webp({ lossless: true, effort: 6 }).toFile(join(out, "room-env.webp"));
  console.log(`room-env.webp  ${env.w} x ${env.h}  (RGBE)`);
  ws.close();
} finally {
  server.close();
  chrome.kill();
  await new Promise((r) => setTimeout(r, 500));
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
