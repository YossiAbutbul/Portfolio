import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/**
 * The desk set: wood, the cutting mat, and the tools on it. Every tool is a small rigid body on the
 * desk plane, tethered to its home spot by a soft spring. The pointer is a force field: tools
 * shy away from it, lift and turn a little, then settle back. A tap or click gives a short push.
 */

export interface DeskKit {
  tex: (w: number, h: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void) => THREE.CanvasTexture;
  std: (p: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
  geo: <T extends THREE.BufferGeometry>(g: T) => T;
  mesh: (g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], cast?: boolean) => THREE.Mesh;
  SANS: string;
  MONO: string;
  /** Handwriting, for the notebook. Loaded on demand; pages repaint once it arrives. */
  HAND: string;
  /** Texture scale: 1 on desktop, .5 on phones. */
  TEX: number;
  /** Phones are portrait: the tools start closer in so they are on screen. */
  phone: boolean;
  /** Desktop swaps in photographed textures (public/textures) once they arrive. */
  photo: boolean;
}

interface Tool {
  group: THREE.Group;
  shadow: THREE.Mesh;
  /** Collision circles in the tool's local frame: [x, y, r]. */
  circles: [number, number, number][];
  mass: number;
  inertia: number;
  rest: number;
  collide: boolean;
  x: number; y: number; a: number;
  hx: number; hy: number; ha: number;
  vx: number; vy: number; va: number;
  lift: number;
  /** Hover cue, 0..1, eased. */
  near: number;
  /** Entrance: where it starts relative to home, and when (seconds after the reveal) it is let go. */
  enter?: { dx: number; dy: number; at: number };
  /** Parked at its entrance start, waiting for its cue. */
  held: boolean;
  /** Coming in from its entrance: not tethered or kept in bounds until it is close to home. */
  free: boolean;
  /** Pointer hint shown while hovering the tool. */
  hint?: string;
  /** Round tools only roll: they move across their own axis and spin on it, never slide or turn. */
  roll?: { obj: THREE.Object3D; radius: number };
}

export interface Desk {
  group: THREE.Group;
  /** Steps the bodies; returns true while anything is still moving. */
  update: (dt: number, bounds: { w: number; h: number }, obstacles: [number, number, number][]) => boolean;
  /** Tool under the ray, if any. */
  /** A tap or click: tools within reach get pushed away from it. */
  poke: (ray: THREE.Ray) => void;
  /** Pointer over the desk (mouse): nearby tools lift and shy away; null when it leaves. */
  hover: (ray: THREE.Ray | null) => void;
  /** Plays the entrance once the loading sheet lifts: the mug slides in, the notebook slides in
   *  riffling its pages, the pencil rolls in. */
  enter: () => void;
  /** Whether the ray is over something that answers a click (the notebook, the mug). */
  over: (ray: THREE.Ray) => boolean;
  /** What the thing under the ray does, as a short label for the pointer hint; null if nothing. */
  hint: (ray: THREE.Ray) => string | null;
  /** A click on the notebook turns its page, on the mug ripples the coffee; false when it missed both. */
  press: (ray: THREE.Ray) => boolean;
  /** The mug's rim in world space, for the steam drawn over the canvas. */
  mugTop: () => { at: THREE.Vector3; radius: number; fade: number } | null;
}

// Deterministic value noise, so the wood and the mat look the same on every visit.
function makeNoise(seed: number) {
  const perm = new Uint8Array(512);
  let s = seed;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grid = (x: number, y: number) => perm[(perm[x & 255] + y) & 255] / 255;
  const fade = (t: number) => t * t * (3 - 2 * t);
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = grid(xi, yi), b = grid(xi + 1, yi), c = grid(xi, yi + 1), d = grid(xi + 1, yi + 1);
    const u = fade(xf), v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x: number, y: number, oct = 4) => { let t = 0, amp = .5, f = 1; for (let i = 0; i < oct; i++) { t += noise(x * f, y * f) * amp; f *= 2; amp *= .5; } return t; };
  return { noise, fbm, rand: r };
}

export function buildDesk(kit: DeskKit): Desk {
  const { tex, std, geo, mesh, SANS, MONO, HAND, TEX, phone, photo } = kit;
  const group = new THREE.Group();
  const N = makeNoise(7);

  /* ---------- Wood table: planks with warped grain, a colour shift per plank, dark seams ---------- */
  // The table's finish, tried one at a time: the generated planks' colour (base + grain range, RGB)
  // and the tint laid over the photographed oak on desktop.
  type Finish = { kind: "wood" | "concrete" | "terrazzo"; base: number[]; range: number[]; tint: number };
  const FINISHES: Record<string, Finish> = {
    oak: { kind: "wood", base: [172, 112, 56], range: [48, 38, 26], tint: 0xf2dcc0 },
    walnut: { kind: "wood", base: [74, 46, 30], range: [46, 30, 18], tint: 0x8a5e40 },
    concrete: { kind: "concrete", base: [150, 138, 124], range: [34, 30, 26], tint: 0xffffff },
    terrazzo: { kind: "terrazzo", base: [214, 202, 184], range: [14, 12, 10], tint: 0xffffff },
    blackAsh: { kind: "wood", base: [30, 26, 23], range: [36, 30, 26], tint: 0x3f3631 },
  };
  const FINISH = FINISHES.blackAsh;
  const W = Math.round(2048 * TEX), H = Math.round(2048 * TEX);
  const woodData = (() => {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d")!; const img = x.createImageData(W, H);
    const bump = new Uint8ClampedArray(W * H);
    const plank = H / 4;
    if (FINISH.kind === "terrazzo") {
      // Terrazzo: a warm stone base with a little cloud in it, then chips in the site's palette from
      // big shards down to fine flecks. Polished flat, so the relief map stays level.
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const t = Math.min(1, Math.max(0, .5 + N.fbm(px / W * 5, py / H * 5, 3) * .6));
        const i = (py * W + px) * 4;
        img.data[i] = FINISH.base[0] + t * FINISH.range[0]; img.data[i + 1] = FINISH.base[1] + t * FINISH.range[1]; img.data[i + 2] = FINISH.base[2] + t * FINISH.range[2]; img.data[i + 3] = 255;
        bump[py * W + px] = 128;
      }
      x.putImageData(img, 0, 0);
      const chips = ["#c46f35", "#d98a4e", "#4d5a36", "#6b7a4a", "#3a2418", "#5a3a26", "#efe5d2", "#a89a86"];
      const k = W / 2048;
      for (const [count, min, max] of [[260, 14, 34], [900, 6, 14], [5200, 1.5, 5]] as [number, number, number][]) {
        for (let n = 0; n < count; n++) {
          const cx = N.rand() * W, cy = N.rand() * H, r = (min + N.rand() * (max - min)) * k, sides = 4 + Math.floor(N.rand() * 4), rot = N.rand() * Math.PI;
          x.fillStyle = chips[Math.floor(N.rand() * chips.length)]; x.globalAlpha = .82 + N.rand() * .18;
          x.beginPath();
          for (let j = 0; j < sides; j++) { const a = rot + j / sides * Math.PI * 2, rr = r * (.55 + N.rand() * .55); if (j) x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); else x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
          x.closePath(); x.fill();
        }
      }
      x.globalAlpha = 1;
      return { canvas: c, bump };
    }
    if (FINISH.kind === "concrete") {
      // Micro-cement: soft cloudy mottling, faint trowel sweeps, and tiny dark pores.
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const u = px / W * 6, v = py / H * 6;
        const cloud = N.fbm(u * .9, v * .9, 4) * .55 + N.fbm(u * 3.2, v * 3.2, 3) * .25;
        const sweep = Math.sin((u * .8 + v * .35 + N.fbm(u * .5, v * .5, 2) * 2.2) * 5) * .06;
        const grit = N.noise(u * 160, v * 160) * .08;
        const t = Math.min(1, Math.max(0, .5 + cloud + sweep + grit - .35));
        const pore = N.rand() < .0016 ? .55 : 1;
        const i = (py * W + px) * 4;
        img.data[i] = (FINISH.base[0] + t * FINISH.range[0]) * pore; img.data[i + 1] = (FINISH.base[1] + t * FINISH.range[1]) * pore; img.data[i + 2] = (FINISH.base[2] + t * FINISH.range[2]) * pore; img.data[i + 3] = 255;
        bump[py * W + px] = 128 + (grit * 300 + sweep * 200) * (pore < 1 ? -2 : 1);
      }
      x.putImageData(img, 0, 0);
      return { canvas: c, bump };
    }
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
        img.data[i] = (FINISH.base[0] + t * FINISH.range[0]) * seam; img.data[i + 1] = (FINISH.base[1] + t * FINISH.range[1]) * seam; img.data[i + 2] = (FINISH.base[2] + t * FINISH.range[2]) * seam; img.data[i + 3] = 255;
        bump[py * W + px] = 255 * (1 - grain * .6 - fine) * seam;
      }
    }
    x.putImageData(img, 0, 0);
    return { canvas: c, bump };
  })();
  const woodMap = new THREE.CanvasTexture(woodData.canvas); woodMap.colorSpace = THREE.SRGBColorSpace;
  const woodBump = tex(W, H, (x) => { const img = x.createImageData(W, H); for (let i = 0; i < W * H; i++) { const b = woodData.bump[i]; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255; } x.putImageData(img, 0, 0); });
  for (const t of [woodMap, woodBump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2.2, 1.4); t.anisotropy = 8; }
  const table = mesh(geo(new THREE.PlaneGeometry(40, 26)), std({ map: woodMap, bumpMap: woodBump, bumpScale: FINISH.kind === "wood" ? 2.2 : .7, roughness: { wood: .78, concrete: .88, terrazzo: .42 }[FINISH.kind] }), false);
  table.position.z = -.06; group.add(table);

  // Desktop: photographed oak (Poly Haven oak_veneer_01, CC0) replaces the generated wood once loaded.
  const loader = new THREE.TextureLoader();
  const photoTex = (url: string, color: boolean, repeat: [number, number], rotate = 0) => {
    const t = loader.load(url, () => { (table.material as THREE.Material).needsUpdate = true; });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
    if (rotate) { t.center.set(.5, .5); t.rotation = rotate; }
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  if (photo && FINISH.kind === "wood") {
    const m = table.material as THREE.MeshStandardMaterial;
    const rep: [number, number] = [2.4, 1.6];
    m.map = photoTex("/textures/oak-color.webp", true, rep, Math.PI / 2);
    m.normalMap = photoTex("/textures/oak-normal.webp", false, rep, Math.PI / 2); m.normalScale.set(.8, .8);
    m.roughnessMap = photoTex("/textures/oak-rough.webp", false, rep, Math.PI / 2); m.roughness = 1;
    m.bumpMap = null; m.color.set(FINISH.tint); m.needsUpdate = true;
  }

  /* ---------- Cutting mat: grid, rulers, speckle, a little wear, and old cut marks ---------- */
  const MAT_W = 11.2, MAT_H = 7.4;
  const matTex = tex(Math.round(2240 * TEX), Math.round(1480 * TEX), (x, w, h) => {
    x.scale(TEX, TEX); w /= TEX; h /= TEX;
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
  });
  const matBump = tex(512, 340, (x, w, h) => { for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${N.rand() > .5 ? 255 : 0},${N.rand() > .5 ? 255 : 0},${N.rand() > .5 ? 255 : 0},.18)`; x.fillRect(N.rand() * w, N.rand() * h, 1, 1); } x.globalCompositeOperation = "destination-over"; x.fillStyle = "#808080"; x.fillRect(0, 0, w, h); });
  matBump.wrapS = matBump.wrapT = THREE.RepeatWrapping; matBump.repeat.set(4, 4);
  const matSide = std({ color: 0x2c5039, roughness: .9 });
  const mat = mesh(geo(new RoundedBoxGeometry(MAT_W, MAT_H, .05, 2, .02)), [matSide, matSide, matSide, matSide, std({ map: matTex, bumpMap: matBump, bumpScale: .9, roughness: 1 }), matSide], false);
  mat.position.set(1.9, .45, -.03); mat.rotation.z = -.07; group.add(mat);
  // Desktop: the mat keeps its printed colour and grid, with photographed surface relief (Poly Haven
  // linoleum_brown, CC0) tiled small, so it reads as a real matte plastic sheet.
  if (photo) {
    const top = (mat.material as THREE.Material[])[4] as THREE.MeshStandardMaterial;
    top.normalMap = photoTex("/textures/mat-normal.webp", false, [7, 4.6]); top.normalScale.set(.45, .45);
    top.roughnessMap = photoTex("/textures/mat-rough.webp", false, [7, 4.6]); top.roughness = 1;
    top.bumpMap = null; top.needsUpdate = true;
  }

  /* ---------- Contact shadow: a soft dark pad under each tool, the thing that makes objects sit ---------- */
  const padTex = tex(128, 128, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(.55, "rgba(0,0,0,.22)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const padMat = new THREE.MeshBasicMaterial({ map: padTex, transparent: true, depthWrite: false, toneMapped: false });
  const padGeo = geo(new THREE.PlaneGeometry(1, 1));

  const tools: Tool[] = [];
  // Seconds since the entrance began; -1 until it does (and for good, if it never does).
  let enterT = -1;
  // The notebook is not a loose tool: it stays put and answers hover and clicks with its pages.
  // The mug is static too; a click on it ripples the coffee.
  let mug: { over: (ray: THREE.Ray) => boolean; press: (ray: THREE.Ray) => boolean; update: (dt: number) => boolean; top: () => { at: THREE.Vector3; radius: number; fade: number } } | null = null;
  let notebook: { over: (ray: THREE.Ray) => boolean; hint: (ray: THREE.Ray) => string | null; hover: (ray: THREE.Ray | null) => void; press: (ray: THREE.Ray) => boolean; update: (dt: number) => boolean; enter: () => void } | null = null;
  function addTool(obj: THREE.Group, o: { x: number; y: number; a: number; rest: number; circles: [number, number, number][]; mass: number; foot: [number, number]; collide?: boolean; roll?: number; onPhone?: [number, number, number]; enter?: [dx: number, dy: number, at: number]; hint?: string }) {
    const g = new THREE.Group(); g.add(obj); group.add(g);
    const shadow = new THREE.Mesh(padGeo, padMat); shadow.scale.set(o.foot[0], o.foot[1], 1); shadow.position.z = .004; shadow.renderOrder = 1; group.add(shadow);
    const inertia = o.mass * o.circles.reduce((s, [cx, cy, r]) => s + cx * cx + cy * cy + r * r / 2, 0) / Math.max(1, o.circles.length);
    // Phones are portrait, so each tool has its own place there (or a squeezed copy of the desktop one).
    const [x, y, a] = phone ? o.onPhone ?? [o.x * .42, o.y * 1.3, o.a] : [o.x, o.y, o.a];
    tools.push({ group: g, shadow, circles: o.circles, mass: o.mass, inertia: Math.max(.05, inertia), rest: o.rest, collide: o.collide ?? true, x, y, a, hx: x, hy: y, ha: a, vx: 0, vy: 0, va: 0, lift: 0, near: 0, held: false, free: false, hint: o.hint, enter: o.enter && { dx: o.enter[0], dy: o.enter[1], at: o.enter[2] }, roll: o.roll ? { obj, radius: o.roll } : undefined });
  }
  const line = (n: number, len: number, r: number): [number, number, number][] => Array.from({ length: n }, (_, i) => [-len / 2 + len * i / (n - 1), 0, r]);

  { // Pencil, built the way one is made: a hexagonal painted barrel, sharpened by a cone cutting
    // through it, which is what leaves the scalloped paint edge, bare wood with grain, a graphite
    // point, a gold stamp on the top face, a crimped ferrule and an eraser.
    const AP = .1, CR = AP / Math.cos(Math.PI / 6); // hex apothem and corner radius
    const Y0 = -1.2, CUT = 1.62, TIP = 2.62;          // barrel start, where the cone starts, the point: a used pencil
    const hexR = (th: number) => {
      // Facets centred on +z (the face the camera sees), corners rounded off a little like real paint.
      const f = ((th - Math.PI / 2 + Math.PI / 6) % (Math.PI / 3) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6;
      return Math.min(AP / Math.cos(f), CR * .965);
    };
    const coneR = (y: number) => y <= CUT ? Infinity : CR * Math.pow((TIP - y) / (TIP - CUT), 1.08);
    const ys: number[] = [Y0, Y0];
    for (let y = Y0 + .25; y < CUT - .1; y += .25) ys.push(y);
    for (let y = CUT - .1; y < TIP; y += .008) ys.push(y);
    ys.push(TIP);
    // A unit-radius lathe whose radius is then set per vertex from the hex and the cone.
    const pencilGeo = geo(new THREE.LatheGeometry(ys.map((y, i) => new THREE.Vector2(i === 0 || i === ys.length - 1 ? 0 : 1, y)), 120));
    const pos = pencilGeo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    const paint = new THREE.Color(0x2c3322), woodA = new THREE.Color(0xe2c497), woodB = new THREE.Color(0xc9a06c), lead = new THREE.Color(0x2a2a2c);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), unit = Math.hypot(x, z);
      const th = Math.atan2(z, x), hr = hexR(th), cr = coneR(y), r = unit * Math.min(hr, cr);
      if (unit > 0) pos.setXYZ(i, x / unit * r, y, z / unit * r);
      if (cr < .03) c.copy(lead);
      else if (cr < hr) c.copy(woodA).lerp(woodB, .5 + .5 * Math.sin(th * 9 + y * 2.3 + Math.sin(th * 23) * .8) * .6);
      else c.copy(paint);
      col.set([c.r, c.g, c.b], i * 3);
    }
    pencilGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    pencilGeo.computeVertexNormals();
    const g = new THREE.Group();
    // Centre the pencil (eraser to point) on the tool's origin; its length runs along x once turned.
    const body = new THREE.Group(); body.rotation.z = -Math.PI / 2; body.position.x = -(Y0 - .6 + TIP) / 2; g.add(body);
    body.add(mesh(pencilGeo, std({ vertexColors: true, roughness: .5, envMapIntensity: .6 })));
    // Gold foil stamp on the face toward the camera, running along the barrel.
    const stamp = mesh(geo(new THREE.PlaneGeometry(1.9, .1)), new THREE.MeshStandardMaterial({ transparent: true, metalness: .8, roughness: .35, color: 0xd8b25a, map: tex(1024, 54, (x) => { x.fillStyle = "#fff"; x.font = `700 34px ${MONO}`; x.fillText("ABUTBUL  ·  HB  ·  No. 2", 10, 40); }) }), false);
    stamp.rotation.z = Math.PI / 2; stamp.position.set(0, .1, AP + .002); body.add(stamp);
    // Ferrule: crimped metal with two raised bands, then the eraser.
    const fProf: [number, number][] = [[0, Y0 + .02], [.107, Y0 + .02], [.107, Y0 - .06], [.113, Y0 - .08], [.113, Y0 - .1], [.105, Y0 - .12], [.105, Y0 - .2], [.113, Y0 - .22], [.113, Y0 - .24], [.107, Y0 - .26], [.107, Y0 - .34], [0, Y0 - .34]];
    body.add(mesh(geo(new THREE.LatheGeometry(fProf.map(([r, y]) => new THREE.Vector2(r, y)), 48)), std({ color: 0xc8b383, metalness: .95, roughness: .3, envMapIntensity: .7 })));
    const eProf: [number, number][] = [[0, Y0 - .33], [.1, Y0 - .33], [.1, Y0 - .5], [.094, Y0 - .55], [.075, Y0 - .58], [.04, Y0 - .595], [0, Y0 - .6]];
    body.add(mesh(geo(new THREE.LatheGeometry(eProf.map(([r, y]) => new THREE.Vector2(r, y)), 40)), std({ color: 0xd48a7e, roughness: .9 })));
    addTool(g, { x: -5.2, y: -2.35, a: .55, rest: AP, circles: line(6, 2.6, .13).map(([cx, cy, r]) => [cx + .8, cy, r] as [number, number, number]), mass: .3, foot: [4.6, .45], roll: AP, onPhone: [-2.9, -2.65, .55], enter: [2.8 * Math.sin(.55), -2.8 * Math.cos(.55), .85], hint: "Push to roll" });
  }
  { // Coffee mug: glazed stoneware with a cream inside, coffee in it, and a ring it left on the mat.
    const g = new THREE.Group();
    const H2 = 1.2, RO = .52;
    const prof: [number, number][] = [[0, .005], [RO - .06, 0], [RO - .01, .02], [RO, .07], [RO + .01, H2 - .05], [RO, H2], [RO - .025, H2 + .012], [RO - .05, H2], [RO - .055, .14], [RO - .1, .1], [0, .1]];
    const cup = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 72);
    cup.rotateX(Math.PI / 2);
    // Outside glaze vs. the cream inside: split by which side of the wall a vertex is on.
    const cp = cup.attributes.position, cc = new Float32Array(cp.count * 3), glaze = new THREE.Color(0x3f6283), inside = new THREE.Color(0xeee4d2), cl = new THREE.Color();
    for (let i = 0; i < cp.count; i++) {
      const r = Math.hypot(cp.getX(i), cp.getY(i)), z = cp.getZ(i);
      cl.copy(r < RO - .04 && z > .09 ? inside : glaze); cc.set([cl.r, cl.g, cl.b], i * 3);
    }
    cup.setAttribute("color", new THREE.BufferAttribute(cc, 3)); cup.computeVertexNormals();
    g.add(mesh(geo(cup), std({ vertexColors: true, roughness: .28, envMapIntensity: .7, side: THREE.DoubleSide })));
    // Coffee: a disc of rings so it can ripple. A click drops a "stone" where it lands; each drop
    // sends out a ring that fades as it travels, and the surface catches the light as it moves.
    const CR = RO - .052;
    const surface = new THREE.RingGeometry(0, CR, 72, 28);
    const sp = surface.attributes.position, flat = Float32Array.from(sp.array as Float32Array);
    const coffeeTex = tex(512, 512, (x, w, h) => {
      const gr = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, "#0d0603"); gr.addColorStop(.6, "#170a04"); gr.addColorStop(.86, "#2a1408"); gr.addColorStop(.95, "#6b4122"); gr.addColorStop(1, "#9a6a3e");
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
      // Crema: a thin ring of tiny pale bubbles at the rim; the middle stays dark.
      for (let i = 0; i < 500; i++) {
        const a = N.rand() * Math.PI * 2, r = (.86 + N.rand() * .14) * w / 2;
        x.fillStyle = `rgba(200,150,100,${.12 + N.rand() * .2})`;
        x.beginPath(); x.arc(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, .6 + N.rand() * 1.6, 0, Math.PI * 2); x.fill();
      }
    });
    const coffee = mesh(geo(surface), std({ map: coffeeTex, roughness: .32, envMapIntensity: .25 }), false);
    coffee.position.z = H2 - .22; g.add(coffee);
    const drops: { x: number; y: number; t: number; a: number }[] = [];
    const ripple = (dt: number) => {
      for (const d of drops) d.t += dt;
      while (drops.length && drops[0].t > 3) drops.shift();
      for (let i = 0; i < sp.count; i++) {
        const vx = flat[i * 3], vy = flat[i * 3 + 1];
        let h = 0;
        for (const d of drops) {
          const r = Math.hypot(vx - d.x, vy - d.y), front = d.t * .32, u = r - front;
          h += d.a * Math.exp(-d.t * 1.6) * Math.sin(u * 46) * Math.exp(-(u * u) / .012);
        }
        // Calm at the rim, where the cup holds the coffee still.
        sp.setZ(i, h * Math.min(1, (CR - Math.hypot(vx, vy)) / .05));
      }
      sp.needsUpdate = true; surface.computeVertexNormals();
      return drops.length > 0;
    };
    // Teaspoon: only its handle shows, rising out of the coffee near the middle and leaning out over
    // the rim; the bowl is under the surface. It turns on the cup's axis, so a stir is a turn of this group.
    const spoon = new THREE.Group(); g.add(spoon);
    const steelSpoon = std({ color: 0xcfcac2, metalness: 1, roughness: .28, envMapIntensity: .8 });
    const SZ = H2 - .22;
    // From below the surface, standing fairly upright and leaning just past the rim.
    const from = new THREE.Vector3(.12, 0, SZ - .35), to = new THREE.Vector3(.64, 0, SZ + 1.35);
    // Where the handle meets the coffee: the stir's ripples start there.
    const SR = from.x + (to.x - from.x) * (-from.z + SZ) / (to.z - from.z);
    // The handle is a thin flat strip, as on a real teaspoon: a narrow neck widening into a rounded
    // paddle at the end, edges softened by a small bevel. Its broad face turns toward the camera.
    const len = from.distanceTo(to);
    const outline = new THREE.Shape();
    const neck = .026, paddle = .085, swell = len * .52, end = len - paddle;
    outline.moveTo(-neck, 0);
    outline.lineTo(-neck, swell);
    outline.bezierCurveTo(-neck, swell + (end - swell) * .45, -paddle, end - (end - swell) * .25, -paddle, end);
    outline.absarc(0, end, paddle, Math.PI, 0, true);
    outline.bezierCurveTo(paddle, end - (end - swell) * .25, neck, swell + (end - swell) * .45, neck, swell);
    outline.lineTo(neck, 0);
    outline.closePath();
    const strip = new THREE.ExtrudeGeometry(outline, { depth: .012, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 3, curveSegments: 24 });
    strip.translate(0, 0, -.006);
    const stem = mesh(geo(strip), steelSpoon);
    // Length along from→to, width across the cup's tangent, so the flat face looks up and outward.
    const along = to.clone().sub(from).normalize(), across = new THREE.Vector3(0, 1, 0), face = new THREE.Vector3().crossVectors(across, along);
    stem.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, along, face));
    stem.position.copy(from); spoon.add(stem);
    // Set once the mug's own turn is known (below): the rest angle is chosen on screen, not on the cup.
    let spoonRest = 0;
    // A stir, the way a hand does it: two calm turns with a soft start and stop, the handle tipping a
    // little as it goes round, and small ripples trailing from where it meets the coffee.
    let stir = -1, trail = 0;
    const STIR = 4, TURNS = 2;
    const stirring = (dt: number) => {
      stir += dt;
      const t = Math.min(1, stir / STIR), e = (1 - Math.cos(t * Math.PI)) / 2;
      spoon.rotation.z = spoonRest + e * Math.PI * 2 * TURNS;
      const sway = Math.sin(t * Math.PI) * .06;
      spoon.rotation.x = Math.sin(stir * 3.1) * sway; spoon.rotation.y = Math.cos(stir * 2.3) * sway;
      trail -= dt;
      if (trail <= 0 && t < .95) {
        trail = .1;
        const a = spoon.rotation.z;
        drops.push({ x: Math.cos(a) * SR, y: Math.sin(a) * SR, t: 0, a: .0035 });
      }
      if (t >= 1) { stir = -1; spoon.rotation.set(0, 0, spoonRest); }
    };
    const rim = new THREE.Vector3();
    mug = {
      press(ray) {
        raycaster.ray.copy(ray);
        if (!raycaster.intersectObject(g, true).length) return false;
        if (stir < 0) { stir = 0; trail = 0; }
        return true;
      },
      over(ray) { raycaster.ray.copy(ray); return raycaster.intersectObject(g, true).length > 0; },
      update(dt) {
        let busy = false;
        if (enterT >= 0 && enterT < 1.7) { mugAt(backOut(Math.min(1, Math.max(0, (enterT - .2) / 1.1)))); busy = true; }
        else if (enterT >= 1.7 && g.position.x !== MX) mugAt(1);
        if (stir >= 0) { stirring(dt); busy = true; }
        return (drops.length ? ripple(dt) : false) || busy;
      },
      // Where the steam leaves the cup, in world space, the cup's radius there, and how much steam
      // to show (none until the mug has landed after its entrance).
      top: () => {
        coffee.getWorldPosition(rim); rim.z += .2;
        return { at: rim, radius: CR * g.scale.x, fade: enterT < 0 ? 1 : Math.min(1, Math.max(0, (enterT - 1.3) / .9)) };
      },
    };
    const handle = mesh(geo(new THREE.TorusGeometry(.26, .065, 18, 40, Math.PI)), std({ color: 0x3f6283, roughness: .28, envMapIntensity: .7 }));
    handle.rotation.set(Math.PI / 2, 0, -Math.PI / 2); handle.position.set(RO - .01, 0, .52); handle.scale.set(1, 1, 1.15); g.add(handle);
    // Modelled small and scaled up to a real small mug, about 6 cm across next to the pencil.
    g.scale.setScalar(1.6);
    // Static for now: it sits where it is, with its own contact shadow.
    const [MX, MY, MA] = phone ? [-1.45, 2.35, .5] : [4.95, 2.2, 2.4];
    // The spoon rests leaning toward the upper right of the screen, where a right hand leaves it,
    // whatever way the mug itself is turned.
    spoonRest = .35 - MA; spoon.rotation.z = spoonRest;
    g.position.set(MX, MY, 0); g.rotation.z = MA; group.add(g);
    const mugPad = new THREE.Mesh(padGeo, padMat); mugPad.scale.set(2.5, 2.3, 1); mugPad.position.set(MX, MY, .004); mugPad.rotation.z = MA; mugPad.renderOrder = 1; group.add(mugPad);
    // Entrance: slides in from beyond the top right corner and settles with a small overshoot.
    const mugAt = (e: number) => {
      const k = 1 - e;
      g.position.set(MX + 3 * k, MY + 2.6 * k, 0); g.rotation.z = MA + .7 * k;
      mugPad.position.set(g.position.x, g.position.y, .004); mugPad.rotation.z = g.rotation.z;
    };
    const backOut = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
    // The ring it left earlier, printed on the mat (it does not move with the mug).
    const ring = new THREE.Mesh(geo(new THREE.PlaneGeometry(2, 2)), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: tex(256, 256, (x, w) => {
      x.strokeStyle = "rgba(92,52,22,.3)"; x.lineWidth = 6; x.beginPath(); x.arc(w / 2, w / 2, w * .43, .3, Math.PI * 1.85); x.stroke();
      x.strokeStyle = "rgba(92,52,22,.14)"; x.lineWidth = 3; x.beginPath(); x.arc(w / 2 + 3, w / 2 - 2, w * .41, 0, Math.PI * 2); x.stroke();
    }) }));
    ring.position.set(phone ? -.3 : 3.3, phone ? 1.2 : 2.15, .006); ring.renderOrder = 1; group.add(ring);
  }
  { // Open pocket notebook (A7, to scale with the pencil). It stays put. Hovering a page lifts it
    // toward the pointer; a click turns it, forward on the right page and back on the left. The
    // spreads are rough thinking about the featured projects: notes on the left, a sketch on the right.
    const nb = new THREE.Group(); group.add(nb);
    const PW = 2.05, PH = 2.9, T = .1;
    const [NX, NY, NA] = phone ? [1.25, 2.55, -.1] : [4.4, -.35, -.18];
    nb.position.set(NX, NY, 0); nb.rotation.z = NA;
    const pad = new THREE.Mesh(padGeo, padMat); pad.scale.set(PW * 2 + .9, PH + .8, 1); pad.position.set(NX, NY, .004); pad.rotation.z = NA; pad.renderOrder = 1; group.add(pad);
    // Height of the page surface at distance d from the spine: low at the gutter, rising to the edge.
    const top = (d: number) => .035 + T * (.3 + .7 * (1 - Math.exp(-d / .22))) - .015 * Math.pow(d / PW, 6);
    const cover = mesh(geo(new RoundedBoxGeometry(PW * 2 + .14, PH + .14, .035, 2, .014)), std({ color: 0x1f1d1b, roughness: .7 }));
    cover.position.z = .018; nb.add(cover);

    /* Pages are drawn into four reusable canvases (left, right, and the two faces of the turning
       sheet) in a 1024-wide space. Each page has its own seeded wobble, so redrawing the same page
       gives the same strokes. */
    type Pen = { line: (pts: [number, number][], w?: number) => void; curve: (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) => void; text: (s: string, x: number, y: number, size?: number) => void; box: (x: number, y: number, w: number, h: number) => void; ring: (x: number, y: number, r: number) => void; arrow: (x0: number, y0: number, x1: number, y1: number) => void; x: CanvasRenderingContext2D };
    type Page = (p: Pen) => void;
    const SCALE = phone ? .5 : .75, CW = 1024, CH = 1448;
    const page = () => tex(Math.round(CW * SCALE), Math.round(CH * SCALE), () => {});
    const paint = (t: THREE.CanvasTexture, draw: Page, seed: number) => {
      let st = seed * 2654435761 >>> 0;
      const rnd = () => { st = (st + 0x6d2b79f5) >>> 0; let r = Math.imul(st ^ (st >>> 15), 1 | st); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
      const c = t.image as HTMLCanvasElement, x = c.getContext("2d")!;
      x.setTransform(c.width / CW, 0, 0, c.height / CH, 0, 0);
      const ink = "#22305e";
      x.fillStyle = "#f1eadb"; x.fillRect(0, 0, CW, CH);
      x.fillStyle = "rgba(60,62,90,.3)";
      for (let py = 60; py < CH - 30; py += 44) for (let px = 52; px < CW - 30; px += 44) { x.beginPath(); x.arc(px, py, 2.6, 0, Math.PI * 2); x.fill(); }
      const j = (v: number, a = 4) => v + (rnd() - .5) * a;
      // Every stroke goes down twice, a touch apart, the way a quick pen sketch does.
      const line = (pts: [number, number][], w = 4.5) => {
        x.strokeStyle = ink; x.lineCap = x.lineJoin = "round";
        for (let pass = 0; pass < 2; pass++) {
          x.lineWidth = pass ? w * .6 : w; x.globalAlpha = pass ? .55 : 1; x.beginPath();
          pts.forEach(([px, py], i) => { if (i) x.lineTo(j(px), j(py)); else x.moveTo(j(px), j(py)); });
          x.stroke();
        }
        x.globalAlpha = 1;
      };
      const curve = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) => {
        const pts: [number, number][] = [];
        for (let i = 0; i <= 16; i++) { const t2 = i / 16, u = 1 - t2; pts.push([u * u * x0 + 2 * u * t2 * cx + t2 * t2 * x1, u * u * y0 + 2 * u * t2 * cy + t2 * t2 * y1]); }
        line(pts);
      };
      const text = (s: string, px: number, py: number, size = 88) => {
        x.save(); x.translate(px, py); x.rotate((rnd() - .5) * .04);
        x.fillStyle = ink; x.font = `700 ${size}px ${HAND}`; x.fillText(s, 0, 0); x.restore();
      };
      // Boxes overshoot at the corners; nobody closes a box neatly when thinking.
      const box = (bx: number, by: number, bw: number, bh: number) => {
        line([[bx - 12, by], [bx + bw + 10, by + 3]]); line([[bx + bw, by - 10], [bx + bw - 3, by + bh + 12]]);
        line([[bx + bw + 8, by + bh], [bx - 10, by + bh - 2]]); line([[bx + 2, by + bh + 10], [bx, by - 12]]);
      };
      const ring = (cx: number, cy: number, r: number) => {
        const pts: [number, number][] = [];
        for (let i = 0; i <= 26; i++) { const a = -.4 + i / 24 * Math.PI * 2; pts.push([cx + Math.cos(a) * r * (1 + (rnd() - .5) * .06), cy + Math.sin(a) * r * (1 + (rnd() - .5) * .06)]); }
        line(pts);
      };
      const arrow = (x0: number, y0: number, x1: number, y1: number) => {
        line([[x0, y0], [x1, y1]]);
        const a = Math.atan2(y1 - y0, x1 - x0);
        line([[x1 - Math.cos(a - .5) * 32, y1 - Math.sin(a - .5) * 32], [x1, y1], [x1 - Math.cos(a + .5) * 32, y1 - Math.sin(a + .5) * 32]]);
      };
      draw({ line, curve, text, box, ring, arrow, x });
      x.setTransform(1, 0, 0, 1, 0, 0);
      t.needsUpdate = true;
    };
    // Notes page for a project: the name, a few dashes of what it does, one line worth underlining,
    // and the stack in small. Facts only from content/projects.ts.
    const notes = (title: string, lines: string[], key: string, stack: string): Page => (p) => {
      p.text(title, 90, 200, 112); p.line([[86, 232], [96 + title.length * 50, 226]], 4);
      lines.forEach((l, i) => { p.line([[100, 380 + i * 140], [140, 378 + i * 140]], 5); p.text(l, 170, 400 + i * 140, 86); });
      p.text(key, 100, 1050, 88); p.line([[96, 1080], [110 + key.length * 36, 1074]], 4);
      p.text(stack, 92, 1330, 58);
    };
    const spreads: { left: Page; right: Page }[] = [
      { // The day's list and the system it adds up to.
        left: ((p) => {
          p.text("today", 90, 200, 112); p.line([[86, 232], [370, 226]], 4);
          ([["data model", true], ["API", true], ["UI states", true], ["tests", false], ["deploy", false]] as [string, boolean][]).forEach(([s, done], i) => {
            const y = 400 + i * 150; p.box(100, y - 56, 56, 56);
            if (done) p.line([[106, y - 30], [126, y - 6], [176, y - 84]], 6);
            p.text(s, 200, y, 90);
          });
          p.text("check empty states", 100, 1240, 84);
        }),
        right: ((p) => {
          p.box(100, 170, 290, 140); p.text("client", 150, 265, 92);
          p.arrow(290, 330, 450, 480);
          p.box(420, 500, 240, 140); p.text("API", 490, 595, 92);
          p.arrow(540, 660, 540, 830);
          p.box(420, 850, 240, 140); p.text("DB", 505, 945, 92);
          p.text("cron?", 740, 260, 84); p.line([[720, 236], [930, 226]], 6);
          p.text("cache?", 700, 1120, 76);
        }),
      },
      {
        left: notes("Test Console", ["PA tests", "load pull", "RF sweeps"], "was 3 days, now ~8 min", "React · FastAPI · PyVISA · BLE"),
        right: ((p) => {
          p.text("test console", 90, 170, 92);
          p.box(100, 330, 230, 130); p.text("UI", 180, 420, 88);
          p.arrow(340, 395, 450, 395);
          p.box(460, 330, 300, 130); p.text("FastAPI", 490, 420, 84);
          p.arrow(610, 470, 610, 640);
          p.box(460, 650, 300, 130); p.text("PyVISA", 495, 740, 84);
          p.arrow(610, 790, 610, 960);
          p.text("instruments", 455, 1040, 84);
          p.text("BLE", 150, 740, 80); p.arrow(250, 715, 450, 715);
        }),
      },
      {
        left: notes("OPlanner", [".ics import", "courses, deadlines", "exams"], "import, don't retype", "React · Firebase Auth · Firestore"),
        right: ((p) => {
          p.text("oplanner", 90, 170, 92);
          // The calendar file, dog-eared.
          p.line([[120, 300], [300, 300], [360, 360], [360, 560], [120, 560], [120, 300]]); p.line([[300, 300], [300, 360], [360, 360]]);
          p.text(".ics", 165, 470, 84);
          p.arrow(390, 430, 560, 430);
          p.box(590, 320, 330, 240);
          [0, 1, 2].forEach((k) => p.line([[600, 390 + k * 60], [910, 390 + k * 60]], 3));
          p.text("term", 680, 650, 80);
        }),
      },
      {
        left: notes("Pipeline CPU", ["5 stages", "one cycle per step", "hazards, stalls"], "draw forwarding", "React · TypeScript · Vite"),
        right: ((p) => {
          p.text("pipeline", 90, 170, 92);
          ["IF", "ID", "EX", "MEM", "WB"].forEach((s, i) => { p.box(70 + i * 182, 420, 150, 140); p.text(s, 92 + i * 182, 510, s.length > 2 ? 62 : 80); });
          // Forwarding: from MEM back into EX.
          p.curve(690, 580, 600, 760, 500, 590); p.arrow(520, 640, 500, 580);
          p.text("fwd", 560, 820, 80);
          p.ring(250, 960, 70); p.text("stall?", 360, 985, 80);
        }),
      },
      {
        left: notes("Current Logger", ["TX bursts", "battery tests", "trigger on current"], "stop when peak drops", "Python · N6781A · SCPI · WebSocket"),
        right: ((p) => {
          p.text("current logger", 90, 170, 92);
          p.line([[120, 300], [120, 1060], [930, 1060]], 4);
          p.text("I", 70, 340, 80); p.text("t", 920, 1130, 80);
          const pts: [number, number][] = [[120, 1000]];
          [0, 1, 2, 3].forEach((k) => { const x0 = 200 + k * 180, hgt = 600 - k * 140; pts.push([x0, 1000], [x0 + 12, 1000 - hgt], [x0 + 70, 1000 - hgt], [x0 + 82, 1000]); });
          pts.push([930, 1000]); p.line(pts);
          p.x.setLineDash([18, 14]); p.line([[120, 680], [930, 680]], 3); p.x.setLineDash([]);
          p.text("trigger", 780, 650, 72);
          p.arrow(820, 480, 760, 600); p.text("stop", 790, 450, 80);
        }),
      },
      {
        left: notes("AlgorithmX", ["9 graph algorithms", "step-by-step playback", "compare side by side"], "show the queue", "TypeScript · React · Cloudflare Workers"),
        right: ((p) => {
          p.text("algorithmx", 90, 170, 92);
          const nodes: [number, number][] = [[260, 360], [580, 320], [820, 560], [260, 720], [560, 760]];
          ([[0, 1], [0, 3], [1, 2], [1, 4], [3, 4], [2, 4]] as [number, number][]).forEach(([a, b]) => p.line([nodes[a], nodes[b]], 4));
          nodes.forEach(([nx, ny], i) => { p.x.fillStyle = "#f1eadb"; p.x.beginPath(); p.x.arc(nx, ny, 60, 0, Math.PI * 2); p.x.fill(); p.ring(nx, ny, 60); p.text(String(i + 1), nx - 16, ny + 26, 80); });
          p.text("BFS / DFS / Dijkstra", 120, 1020, 76);
          p.text("play / step / back", 120, 1180, 76);
        }),
      },
      {
        left: notes("ToastTurn", ["whose turn", "log each turn", "all phones at home"], "sync", "React · Firestore · PWA"),
        right: ((p) => {
          p.text("toastturn", 90, 170, 92);
          // Two phones, kept in sync.
          p.box(120, 330, 250, 460); p.box(640, 330, 250, 460);
          p.text("turn?", 160, 520, 80); p.text("turn?", 680, 520, 80);
          p.arrow(400, 520, 610, 520); p.arrow(610, 620, 400, 620);
          p.text("sync", 450, 700, 76);
          p.text("one button", 120, 1000, 76);
          p.text("offline?", 120, 1160, 76);
        }),
      },
    ];
    const n = spreads.length, mod = (i: number) => ((i % n) + n) % n;
    const pageOf = (s: number, side: "left" | "right") => spreads[mod(s)][side];
    const seedOf = (s: number, side: "left" | "right") => mod(s) * 2 + (side === "left" ? 1 : 2);
    const put = (t: THREE.CanvasTexture, s: number, side: "left" | "right") => paint(t, pageOf(s, side), seedOf(s, side));
    /* Each side has its own turning sheet lying on top of it, so both can move at once and hover
       never has to repaint. Under the right sheet is the next spread's right page; under the left
       sheet, the previous spread's left page. Only a finished turn repaints. */
    const underLeft = page(), underRight = page();
    const rFront = page(), rBack = page(), lFront = page(), lBack = page();
    rBack.channel = lBack.channel = 1;
    let cur = 0;
    const paintAll = () => {
      put(underRight, cur + 1, "right"); put(underLeft, cur - 1, "left");
      put(rFront, cur, "right"); put(rBack, cur + 1, "left");
      put(lBack, cur, "left"); put(lFront, cur - 1, "right");
    };
    paintAll();

    // Page blocks under each half, cut to the page curve.
    const blockMat = std({ color: 0xe8dfcc, roughness: .9, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      const prof = new THREE.Shape(); prof.moveTo(0, .035); prof.lineTo(PW, .035);
      for (let i = 24; i >= 0; i--) { const d = PW * i / 24; prof.lineTo(d, top(d)); }
      const block = new THREE.ExtrudeGeometry(prof, { depth: PH, bevelEnabled: false, curveSegments: 1 });
      block.rotateX(Math.PI / 2); block.translate(0, PH / 2, 0);
      if (side < 0) block.scale(-1, 1, 1);
      nb.add(mesh(geo(block), blockMat));
    }
    const sheetGeo = (side: number) => {
      const s = new THREE.PlaneGeometry(PW, PH, 32, 1), sp = s.attributes.position;
      for (let i = 0; i < sp.count; i++) { const d = sp.getX(i) + PW / 2; sp.setXYZ(i, side * d, sp.getY(i), top(d) + .001); }
      if (side < 0) { const uv = s.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); s.index!.array.reverse(); }
      s.computeVertexNormals(); return geo(s);
    };
    const pageMat = (map: THREE.Texture, side: THREE.Side = THREE.FrontSide) => std({ map, roughness: .92, side });
    nb.add(mesh(sheetGeo(-1), pageMat(underLeft), false));
    nb.add(mesh(sheetGeo(1), pageMat(underRight), false));
    // A turning sheet: a right-hand page on its front, the left-hand page it becomes on its back
    // (uv1, mirrored so it reads correctly once over). phi is 0 lying on the right, PI on the left.
    const makeSheet = (front: THREE.CanvasTexture, back: THREE.CanvasTexture, rest: number, lag: number) => {
      const geom = new THREE.PlaneGeometry(PW, PH, 32, 1);
      const tuv = geom.attributes.uv, uv1 = new Float32Array(tuv.count * 2);
      for (let i = 0; i < tuv.count; i++) { uv1[i * 2] = 1 - tuv.getX(i); uv1[i * 2 + 1] = tuv.getY(i); }
      geom.setAttribute("uv1", new THREE.BufferAttribute(uv1, 2));
      const pos = geom.attributes.position, flat = Float32Array.from(pos.array as Float32Array);
      geo(geom);
      nb.add(mesh(geom, pageMat(front), false));
      nb.add(mesh(geom, pageMat(back, THREE.BackSide), false));
      const sh = { phi: rest, target: rest, rest, shape() {
        const up = sh.phi !== sh.rest ? .003 : 0; // a moving sheet rides just above the one at rest
        for (let i = 0; i < pos.count; i++) {
          const d = flat[i * 3] + PW / 2, y = flat[i * 3 + 1];
          // The outer part lags a little behind the spine, so the sheet curls as it turns.
          const f = sh.phi + lag * .22 * Math.sin(sh.phi) * (d / PW) * Math.min(sh.phi, Math.PI - sh.phi);
          pos.setXYZ(i, d * Math.cos(f), y, top(d) + .004 + up + d * Math.sin(f) * .96);
        }
        pos.needsUpdate = true; geom.computeVertexNormals();
      } };
      sh.shape();
      return sh;
    };
    const right = makeSheet(rFront, rBack, 0, -1), left = makeSheet(lFront, lBack, Math.PI, 1);
    let turning = 0;
    // A page lifts most where you would take hold of it, at its outer edge, and hardly at all by the
    // spine, so crossing from one page to the other is a gentle hand-over.
    const lift = (d: number) => .04 + .5 * Math.pow(Math.min(1, d / PW), 1.6);

    // Pointer in the notebook's own frame, from a ray onto the page height.
    const pagePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(top(PW / 2)));
    const local = (ray: THREE.Ray) => {
      if (!ray.intersectPlane(pagePlane, hitPoint)) return null;
      const dx = hitPoint.x - NX, dy = hitPoint.y - NY, c = Math.cos(-NA), s = Math.sin(-NA);
      const lx = dx * c - dy * s, ly = dx * s + dy * c;
      return Math.abs(lx) < PW + .1 && Math.abs(ly) < PH / 2 + .1 ? { lx, ly } : null;
    };
    // The handwriting font loads on demand; repaint once it is in.
    document.fonts?.load(`700 80px ${HAND}`).then(paintAll).catch(() => {});
    notebook = {
      over: (ray) => !!local(ray),
      hint: (ray) => { const p = local(ray); return p ? (p.lx >= 0 ? "Click to turn page" : "Click to go back") : null; },
      hover(ray) {
        if (turning) return;
        const p = ray && local(ray);
        right.target = p && p.lx > .05 ? lift(p.lx) : 0;
        left.target = p && p.lx < -.05 ? Math.PI - lift(-p.lx) : Math.PI;
      },
      press(ray) {
        const p = local(ray);
        if (!p) return false;
        if (turning) return true;
        turning = p.lx >= 0 ? 1 : -1;
        if (turning > 0) { right.target = Math.PI; left.target = Math.PI; } else { left.target = 0; right.target = 0; }
        return true;
      },
      // Entrance: slides in from beyond the bottom right corner, open on the first spread.
      enter() {},
      update(dt) {
        let moving = false;
        if (enterT >= 0 && enterT < 1.9) {
          const e = 1 - Math.pow(1 - Math.min(1, Math.max(0, (enterT - .35) / 1.2)), 3), k = 1 - e;
          nb.position.set(NX + 3.6 * k, NY - 3.6 * k, 0); nb.rotation.z = NA - .35 * k;
          pad.position.set(nb.position.x, nb.position.y, .004); pad.rotation.z = nb.rotation.z;
          moving = true;
        } else if (enterT >= 1.9 && nb.position.x !== NX) { nb.position.set(NX, NY, 0); nb.rotation.z = NA; pad.position.set(NX, NY, .004); pad.rotation.z = NA; }
        for (const sh of [right, left]) {
          if (Math.abs(sh.target - sh.phi) < .0005) { if (sh.phi !== sh.target) { sh.phi = sh.target; sh.shape(); } continue; }
          sh.phi += (sh.target - sh.phi) * (1 - Math.exp(-dt * (turning ? 7 : 10)));
          sh.shape(); moving = true;
        }
        const done = turning > 0 ? right.phi > Math.PI - .01 : turning < 0 ? left.phi < .01 : false;
        if (done) {
          // Landed: the revealed spread becomes current, and both sheets go back to lying flat.
          cur = mod(cur + turning); turning = 0; paintAll();
          right.phi = right.target = 0; left.phi = left.target = Math.PI;
          right.shape(); left.shape();
        }
        return moving;
      },
    };
    // Gutter shadow and the elastic band.
    const gutter = new THREE.Mesh(geo(new THREE.PlaneGeometry(.3, PH)), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: tex(64, 8, (x, w, h) => {
      const gr = x.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "rgba(40,30,20,0)"); gr.addColorStop(.5, "rgba(40,30,20,.35)"); gr.addColorStop(1, "rgba(40,30,20,0)"); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    }) }));
    gutter.position.z = top(0) + .008; gutter.renderOrder = 2; nb.add(gutter);
    const band = mesh(geo(new THREE.BoxGeometry(.06, PH + .16, .014)), std({ color: 0x141312, roughness: .6 }));
    band.position.set(PW + .03, 0, .042); nb.add(band);
  }
  /* ---------- Physics ---------- */
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -.15);
  const hitPoint = new THREE.Vector3();
  const pointer = { x: 0, y: 0, vx: 0, vy: 0, t: 0, on: false };

  const worldOf = (t: Tool, lx: number, ly: number) => { const c = Math.cos(t.a), s = Math.sin(t.a); return [t.x + lx * c - ly * s, t.y + lx * s + ly * c]; };

  function update(dt: number, bounds: { w: number; h: number }, obstacles: [number, number, number][]) {
    let moving = false;
    const sub = 3, h = dt / sub;
    if (enterT >= 0) {
      enterT += dt;
      for (const t of tools) if (t.held && t.enter && enterT >= t.enter.at) { t.held = false; t.free = true; }
    }
    for (let step = 0; step < sub; step++) {
      for (const t of tools) {
        if (t.held) continue;
        // Home: a soft spring back to where the tool was laid out.
        const da = Math.atan2(Math.sin(t.ha - t.a), Math.cos(t.ha - t.a));
        t.vx += (t.hx - t.x) * 30 * h; t.vy += (t.hy - t.y) * 30 * h; t.va += da * 30 * h;
        // The pointer pushes a tool away from the point of it that is nearest, so an off-centre
        // approach turns it as well as moving it. Directly over a tool, it lifts and slides aside.
        if (pointer.on) {
          let best: [number, number, number, number] | null = null;
          for (const [cx, cy, r] of t.circles) {
            const [wx, wy] = worldOf(t, cx, cy);
            const d = Math.hypot(wx - pointer.x, wy - pointer.y) - r;
            if (!best || d < best[2]) best = [wx, wy, d, r];
          }
          if (best && best[2] < 1.4) {
            const [wx, wy, d] = best;
            let dx = wx - pointer.x, dy = wy - pointer.y, len = Math.hypot(dx, dy);
            // Right on top of the tool there is no "away", so push it sideways off its own axis.
            if (len < .05) { dx = -Math.sin(t.a); dy = Math.cos(t.a); len = 1; }
            const f = Math.pow(1 - Math.max(0, d) / 1.4, 2) * 14;
            const fx = dx / len * f, fy = dy / len * f;
            t.vx += fx * h; t.vy += fy * h;
            t.va += ((wx - t.x) * fy - (wy - t.y) * fx) / t.inertia * t.mass * .5 * h;
          }
        }
        // Sliding friction on the mat.
        t.vx *= Math.exp(-h * 9); t.vy *= Math.exp(-h * 9); t.va *= Math.exp(-h * 9);
        if (t.roll) {
          // Keep only the motion across the pencil's axis; it cannot slide lengthways or turn.
          const ux = Math.cos(t.ha), uy = Math.sin(t.ha), along = t.vx * ux + t.vy * uy;
          t.vx -= along * ux; t.vy -= along * uy; t.va = 0;
        }
        t.x += t.vx * h; t.y += t.vy * h; t.a += t.va * h;
        // Tethered: a tool may shift a little and turn a little, never wander off.
        const ox = t.x - t.hx, oy = t.y - t.hy, off = Math.hypot(ox, oy), MAX = t.roll ? .4 : .22;
        if (t.free) { if (off < MAX) t.free = false; continue; }
        if (off > MAX) { t.x = t.hx + ox / off * MAX; t.y = t.hy + oy / off * MAX; t.vx *= .3; t.vy *= .3; }
        const oa = Math.atan2(Math.sin(t.a - t.ha), Math.cos(t.a - t.ha));
        if (Math.abs(oa) > .09) { t.a = t.ha + Math.sign(oa) * .09; t.va *= .3; }
      }
      // Tool against tool, and against the device and the edges of the view.
      for (let i = 0; i < tools.length; i++) {
        const A = tools[i]; if (!A.collide || A.held || A.free) continue;
        for (const [ax, ay, ar] of A.circles) {
          const [wx, wy] = worldOf(A, ax, ay);
          for (let j = i + 1; j < tools.length; j++) {
            const B = tools[j]; if (!B.collide || B.held || B.free) continue;
            for (const [bx, by, br] of B.circles) {
              const [vx, vy] = worldOf(B, bx, by);
              const dx = vx - wx, dy = vy - wy, d = Math.hypot(dx, dy), pen = ar + br - d;
              if (pen <= 0 || d < 1e-5) continue;
              const nx = dx / d, ny = dy / d, im = 1 / A.mass + 1 / B.mass;
              A.x -= nx * pen * (1 / A.mass) / im; A.y -= ny * pen * (1 / A.mass) / im;
              B.x += nx * pen * (1 / B.mass) / im; B.y += ny * pen * (1 / B.mass) / im;
              const rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
              if (rv < 0) { const j2 = -(1.3) * rv / im; A.vx -= j2 * nx / A.mass; A.vy -= j2 * ny / A.mass; B.vx += j2 * nx / B.mass; B.vy += j2 * ny / B.mass; A.va -= j2 * .15 / A.inertia; B.va += j2 * .15 / B.inertia; }
            }
          }
          for (const [ox, oy, or] of obstacles) {
            const dx = wx - ox, dy = wy - oy, d = Math.hypot(dx, dy), pen = ar + or - d;
            if (pen <= 0 || d < 1e-5) continue;
            const nx = dx / d, ny = dy / d; A.x += nx * pen; A.y += ny * pen;
            const rv = A.vx * nx + A.vy * ny; if (rv < 0) { A.vx -= 1.4 * rv * nx; A.vy -= 1.4 * rv * ny; A.va += (ax * ny - ay * nx) * rv * .6; }
          }
        }
      }
      for (const t of tools) {
        if (t.held || t.free) continue;
        for (const [cx, cy, r] of t.circles) {
          const [wx, wy] = worldOf(t, cx, cy);
          const ex = Math.max(0, Math.abs(wx) + r - bounds.w) * Math.sign(wx), ey = Math.max(0, Math.abs(wy) + r - bounds.h) * Math.sign(wy);
          if (ex) { t.x -= ex; if (t.vx * ex > 0) t.vx *= -.4; }
          if (ey) { t.y -= ey; if (t.vy * ey > 0) t.vy *= -.4; }
        }
      }
    }
    for (const t of tools) {
      // Hover cue: lift a little when the pointer is within reach.
      let close = 0;
      if (pointer.on) for (const [cx, cy, r] of t.circles) { const [wx, wy] = worldOf(t, cx, cy); close = Math.max(close, 1 - Math.max(0, Math.hypot(pointer.x - wx, pointer.y - wy) - r) / .6); }
      t.near += (Math.max(0, close) - t.near) * (1 - Math.exp(-dt * 10));
      // Rolling tools stay on the mat: the hover cue is the roll itself, not a lift.
      const target = t.roll ? 0 : t.near * .18;
      t.lift += (target - t.lift) * (1 - Math.exp(-dt * 14));
      t.group.position.set(t.x, t.y, t.rest + t.lift);
      t.group.rotation.z = t.a;
      if (t.roll) {
        // Rolled distance across the axis turns into spin about it (no slipping).
        const across = (t.x - t.hx) * -Math.sin(t.ha) + (t.y - t.hy) * Math.cos(t.ha);
        t.roll.obj.rotation.x = -across / t.roll.radius;
      }
      t.shadow.position.set(t.x + t.lift * .35, t.y - t.lift * .35, .004);
      t.shadow.rotation.z = t.a;
      const spread = 1 + t.lift * 1.4;
      t.shadow.scale.x = Math.abs(t.shadow.scale.x) / (t.shadow.userData.spread || 1) * spread; t.shadow.scale.y = Math.abs(t.shadow.scale.y) / (t.shadow.userData.spread || 1) * spread; t.shadow.userData.spread = spread;
      if (Math.abs(t.vx) + Math.abs(t.vy) + Math.abs(t.va) > .002 || Math.abs(t.lift - target) > .002 || t.held || t.free) moving = true;
    }
    pointer.vx *= Math.exp(-dt * 10); pointer.vy *= Math.exp(-dt * 10);
    const paging = notebook?.update(dt) ?? false;
    const rippling = mug?.update(dt) ?? false;
    return moving || paging || rippling || pointer.on || (enterT >= 0 && enterT < 3);
  }

  return {
    group,
    update,
    poke(ray) {
      raycaster.ray.copy(ray); if (!raycaster.ray.intersectPlane(plane, hitPoint)) return;
      for (const t of tools) {
        const dx = t.x - hitPoint.x, dy = t.y - hitPoint.y, d = Math.hypot(dx, dy);
        if (d > 2.2 || d < 1e-4) continue;
        const k = (1 - d / 2.2) * 2.2;
        t.vx += dx / d * k; t.vy += dy / d * k; t.va += (Math.random() - .5) * k * .8;
      }
    },
    enter() {
      if (enterT >= 0) return;
      enterT = 0;
      for (const t of tools) if (t.enter) { t.x = t.hx + t.enter.dx; t.y = t.hy + t.enter.dy; t.vx = t.vy = t.va = 0; t.held = true; }
      notebook?.enter();
    },
    over: (ray) => (notebook?.over(ray) || mug?.over(ray)) ?? false,
    hint(ray) {
      const n = notebook?.hint(ray); if (n) return n;
      if (mug?.over(ray)) return "Click to stir";
      raycaster.ray.copy(ray);
      for (const t of tools) if (t.hint && raycaster.intersectObject(t.group, true).length) return t.hint;
      return null;
    },
    mugTop: () => mug?.top() ?? null,
    press: (ray) => (notebook?.press(ray) || mug?.press(ray)) ?? false,
    hover(ray) {
      notebook?.hover(ray);
      if (!ray) { pointer.on = false; return; }
      raycaster.ray.copy(ray); if (!raycaster.ray.intersectPlane(plane, hitPoint)) return;
      const now = performance.now() / 1000, dt = Math.min(.1, Math.max(.001, now - pointer.t));
      if (pointer.on) { pointer.vx = (hitPoint.x - pointer.x) / dt; pointer.vy = (hitPoint.y - pointer.y) / dt; }
      pointer.x = hitPoint.x; pointer.y = hitPoint.y; pointer.t = now; pointer.on = true;
    },
  };
}
