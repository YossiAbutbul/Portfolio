/* The desk's procedural textures, drawn exactly as the scene used to draw them at startup (desk.ts),
   now run once in a headless browser by bake-textures.mjs and saved to public/textures. Plain browser
   JavaScript: it defines window.BAKES. Edit a texture here, then run `npm run bake:textures`. */

// Deterministic value noise, so the wood and the mat look the same on every bake.
function makeNoise(seed) {
  const perm = new Uint8Array(512);
  let s = seed;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grid = (x, y) => perm[(perm[x & 255] + y) & 255] / 255;
  const fade = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = grid(xi, yi), b = grid(xi + 1, yi), c = grid(xi, yi + 1), d = grid(xi + 1, yi + 1);
    const u = fade(xf), v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y, oct = 4) => { let t = 0, amp = .5, f = 1; for (let i = 0; i < oct; i++) { t += noise(x * f, y * f) * amp; f *= 2; amp *= .5; } return t; };
  return { noise, fbm, rand: r };
}

const SANS = "Figtree, sans-serif";

// One noise source shared in this order (wood, mat, mat relief, coffee), as the desk drew them.
const N = makeNoise(7);

// The black ash planks (only phones draw them; desktop has the photographed oak), at the 1024 the phone drew: warped grain, a colour shift per plank, dark seams. Colour and relief come
// out of one pass, so both are drawn together and handed out separately.
const FINISH = { base: [30, 26, 23], range: [36, 30, 26] };
let wood = null;
function woodPass(W, H) {
  if (wood) return wood;
  const color = new ImageData(W, H), bump = new ImageData(W, H);
  const plank = H / 4;
  for (let py = 0; py < H; py++) {
    const pi = Math.floor(py / plank), shade = [0, .06, -.04, .03][pi % 4];
    for (let px = 0; px < W; px++) {
      const u = px / W * 6, v = py / H * 24;
      const warp = N.fbm(u * .6 + pi * 7, v * .08, 3) * 4;
      const grain = Math.sin((v + warp) * 9 + pi * 3) * .5 + .5;
      const fine = N.noise(u * 90, v * 4) * .18 + N.noise(u * 240, v * 9) * .08;
      const t = Math.min(1, Math.max(0, grain * .55 + fine + N.fbm(u * 2, v * .5, 2) * .3 + shade));
      const seam = (py % plank) < 2 ? .7 : 1;
      const i = (py * W + px) * 4;
      color.data[i] = (FINISH.base[0] + t * FINISH.range[0]) * seam; color.data[i + 1] = (FINISH.base[1] + t * FINISH.range[1]) * seam; color.data[i + 2] = (FINISH.base[2] + t * FINISH.range[2]) * seam; color.data[i + 3] = 255;
      bump.data[i] = bump.data[i + 1] = bump.data[i + 2] = 255 * (1 - grain * .6 - fine) * seam; bump.data[i + 3] = 255;
    }
  }
  return (wood = { color, bump });
}

window.BAKES = [
  { name: "wood-color", w: 1024, h: 1024, draw: (x, w, h) => x.putImageData(woodPass(w, h).color, 0, 0) },
  { name: "wood-bump", w: 1024, h: 1024, draw: (x, w, h) => x.putImageData(woodPass(w, h).bump, 0, 0) },
  // The cutting mat: grid, rulers, speckle, a little wear, and old cut marks.
  { name: "mat-print", w: 2240, h: 1480, half: true, draw: (x, w, h) => {
    x.fillStyle = "#3a6448"; x.fillRect(0, 0, w, h);
    // Uneven tone from years of use.
    for (let i = 0; i < 900; i++) {
      const px = N.rand() * w, py = N.rand() * h, r = 40 + N.rand() * 160;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      const light = N.rand() > .5;
      g.addColorStop(0, light ? "rgba(90,140,120,.035)" : "rgba(10,30,24,.05)"); g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    for (let i = 0; i < 26000; i++) { x.fillStyle = N.rand() > .5 ? "rgba(210,235,225,.06)" : "rgba(0,20,14,.08)"; x.fillRect(N.rand() * w, N.rand() * h, 1.6, 1.6); }
    // A printed border carries the rulers; the grid sits inside it, like a real self-healing mat.
    const m = 96, gw = w - m * 2, gh = h - m * 2, cells = 50, cm = gw / cells;
    x.strokeStyle = "rgba(238,228,206,.5)"; x.lineWidth = 2.4; x.strokeRect(m, m, gw, gh);
    for (let i = 0; i <= cells; i++) { const px = m + i * cm; x.strokeStyle = i % 5 ? "rgba(238,228,206,.2)" : "rgba(238,228,206,.42)"; x.lineWidth = i % 5 ? 1.2 : 2.2; x.beginPath(); x.moveTo(px, m); x.lineTo(px, h - m); x.stroke(); }
    for (let j = 0; j * cm <= gh + .5; j++) { const py = m + j * cm; x.strokeStyle = j % 5 ? "rgba(238,228,206,.2)" : "rgba(238,228,206,.42)"; x.lineWidth = j % 5 ? 1.2 : 2.2; x.beginPath(); x.moveTo(m, py); x.lineTo(w - m, py); x.stroke(); }
    // Ruler ticks and numbers in the border, bottom and left, in the mat's cream ink.
    x.strokeStyle = "rgba(238,228,206,.75)"; x.fillStyle = "rgba(240,230,210,.85)"; x.font = `600 34px ${SANS}`; x.textAlign = "center";
    for (let i = 0; i <= cells * 2; i++) { const px = m + i * cm / 2, len = i % 10 === 0 ? 26 : i % 2 === 0 ? 16 : 9; x.lineWidth = 1.6; x.beginPath(); x.moveTo(px, h - m); x.lineTo(px, h - m + len); x.stroke(); }
    for (let i = 0; i <= cells; i += 2) x.fillText(String(i * 5), m + i * cm, h - m + 66);
    x.textAlign = "right"; x.textBaseline = "middle";
    const rows = Math.floor(gh / cm);
    for (let j = 0; j <= rows * 2; j++) { const py = h - m - j * cm / 2, len = j % 10 === 0 ? 26 : j % 2 === 0 ? 16 : 9; x.beginPath(); x.moveTo(m, py); x.lineTo(m - len, py); x.stroke(); }
    for (let j = 0; j <= rows; j += 2) { x.save(); x.translate(m - 44, h - m - j * cm); x.rotate(-Math.PI / 2); x.textAlign = "center"; x.fillText(String(j * 5), 0, 0); x.restore(); }
    x.textAlign = "left"; x.textBaseline = "alphabetic";
    // Old knife cuts: thin pale scratches.
    for (let i = 0; i < 70; i++) {
      const px = N.rand() * w, py = N.rand() * h, len = 30 + N.rand() * 180, ang = (N.rand() - .5) * .6 + (N.rand() > .5 ? 0 : Math.PI / 2);
      x.strokeStyle = `rgba(200,230,215,${.05 + N.rand() * .09})`; x.lineWidth = .8; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len); x.stroke();
    }
    x.font = `700 24px ${SANS}`; x.fillStyle = "rgba(240,230,210,.45)"; x.fillText("SELF-HEALING · 3 PLY · A3", w - 470, h - 34);
  } },
  // Speckled relief for the mat (phones; desktop uses the photographed linoleum).
  { name: "mat-bump", w: 512, h: 340, draw: (x, w, h) => { for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${N.rand() > .5 ? 255 : 0},${N.rand() > .5 ? 255 : 0},${N.rand() > .5 ? 255 : 0},.18)`; x.fillRect(N.rand() * w, N.rand() * h, 1, 1); } x.globalCompositeOperation = "destination-over"; x.fillStyle = "#808080"; x.fillRect(0, 0, w, h); } },
  // The coffee in the mug, with a ring of crema at the rim.
  { name: "coffee", w: 512, h: 512, draw: (x, w, h) => {
    const gr = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "#0d0603"); gr.addColorStop(.6, "#170a04"); gr.addColorStop(.86, "#2a1408"); gr.addColorStop(.95, "#6b4122"); gr.addColorStop(1, "#9a6a3e");
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      const a = N.rand() * Math.PI * 2, r = (.86 + N.rand() * .14) * w / 2;
      x.fillStyle = `rgba(200,150,100,${.12 + N.rand() * .2})`;
      x.beginPath(); x.arc(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, .6 + N.rand() * 1.6, 0, Math.PI * 2); x.fill();
    }
  } },
  // The More work wall's plaster.
  { name: "plaster", w: 512, h: 128, draw: (x, w, h) => {
    const N = makeNoise(41);
    const img = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const n = N.fbm(i / w * 40, j / h * 10, 4), k = (j * w + i) * 4;
      img.data[k] = 214 + n * 22; img.data[k + 1] = 204 + n * 20; img.data[k + 2] = 186 + n * 18; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
  } },
  // The pegboard on that wall.
  { name: "pegboard", w: 1024, h: 360, draw: (x, w, h) => {
    x.fillStyle = "#a9835a"; x.fillRect(0, 0, w, h);
    x.fillStyle = "rgba(60,40,22,.85)";
    const step = w / 38;
    for (let py = step / 2; py < h; py += step) for (let px = step / 2; px < w; px += step) { x.beginPath(); x.arc(px, py, step * .16, 0, Math.PI * 2); x.fill(); }
  } },
];
