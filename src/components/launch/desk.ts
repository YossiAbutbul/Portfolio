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
  /** Seconds until this tool's one-off hop; negative once done. */
  hop: number;
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
  /** Starts the one-off staggered hop that shows the tools are loose. */
  hop: () => void;
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
  const { tex, std, geo, mesh, SANS, MONO, TEX, phone, photo } = kit;
  const group = new THREE.Group();
  const N = makeNoise(7);

  /* ---------- Wood table: planks with warped grain, a colour shift per plank, dark seams ---------- */
  const W = Math.round(2048 * TEX), H = Math.round(2048 * TEX);
  const woodData = (() => {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d")!; const img = x.createImageData(W, H);
    const bump = new Uint8ClampedArray(W * H);
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
        img.data[i] = (172 + t * 48) * seam; img.data[i + 1] = (112 + t * 38) * seam; img.data[i + 2] = (56 + t * 26) * seam; img.data[i + 3] = 255;
        bump[py * W + px] = 255 * (1 - grain * .6 - fine) * seam;
      }
    }
    x.putImageData(img, 0, 0);
    return { canvas: c, bump };
  })();
  const woodMap = new THREE.CanvasTexture(woodData.canvas); woodMap.colorSpace = THREE.SRGBColorSpace;
  const woodBump = tex(W, H, (x) => { const img = x.createImageData(W, H); for (let i = 0; i < W * H; i++) { const b = woodData.bump[i]; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255; } x.putImageData(img, 0, 0); });
  for (const t of [woodMap, woodBump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2.2, 1.4); t.anisotropy = 8; }
  const table = mesh(geo(new THREE.PlaneGeometry(40, 26)), std({ map: woodMap, bumpMap: woodBump, bumpScale: 2.2, roughness: .78 }), false);
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
  if (photo) {
    const m = table.material as THREE.MeshStandardMaterial;
    const rep: [number, number] = [2.4, 1.6];
    m.map = photoTex("/textures/oak-color.webp", true, rep, Math.PI / 2);
    m.normalMap = photoTex("/textures/oak-normal.webp", false, rep, Math.PI / 2); m.normalScale.set(.8, .8);
    m.roughnessMap = photoTex("/textures/oak-rough.webp", false, rep, Math.PI / 2); m.roughness = 1;
    m.bumpMap = null; m.color.set(0xf2dcc0); m.needsUpdate = true;
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
  function addTool(obj: THREE.Group, o: { x: number; y: number; a: number; rest: number; circles: [number, number, number][]; mass: number; foot: [number, number]; collide?: boolean }) {
    const g = new THREE.Group(); g.add(obj); group.add(g);
    const shadow = new THREE.Mesh(padGeo, padMat); shadow.scale.set(o.foot[0], o.foot[1], 1); shadow.position.z = .004; shadow.renderOrder = 1; group.add(shadow);
    const inertia = o.mass * o.circles.reduce((s, [cx, cy, r]) => s + cx * cx + cy * cy + r * r / 2, 0) / Math.max(1, o.circles.length);
    const x = phone ? o.x * .42 : o.x, y = phone ? o.y * 1.3 : o.y;
    tools.push({ group: g, shadow, circles: o.circles, mass: o.mass, inertia: Math.max(.05, inertia), rest: o.rest, collide: o.collide ?? true, x, y, a: o.a, hx: x, hy: y, ha: o.a, vx: 0, vy: 0, va: 0, lift: 0, near: 0, hop: Infinity });
  }
  const line = (n: number, len: number, r: number): [number, number, number][] => Array.from({ length: n }, (_, i) => [-len / 2 + len * i / (n - 1), 0, r]);

  { // Pencil: hexagonal barrel, printed name, sharpened tip, ferrule and eraser
    const g = new THREE.Group();
    const paint = std({ color: 0x55653b, roughness: .58 });
    const barrel = mesh(geo(new THREE.CylinderGeometry(.11, .11, 4.2, 6)), paint); barrel.rotation.y = Math.PI / 6; g.add(barrel);
    const print = mesh(geo(new THREE.PlaneGeometry(1.6, .07)), new THREE.MeshBasicMaterial({ transparent: true, map: tex(512, 24, (x) => { x.fillStyle = "#d9c79a"; x.font = `700 18px ${SANS}`; x.fillText("HB · SHIP IT · ABUTBUL", 4, 18); }) }), false);
    print.rotation.set(0, 0, Math.PI / 2); print.position.set(0, -.4, .096); g.add(print);
    const tip = mesh(geo(new THREE.ConeGeometry(.11, .45, 6)), std({ color: 0xdcb88a, roughness: .85 })); tip.position.y = 2.32; tip.rotation.y = Math.PI / 6; g.add(tip);
    const lead = mesh(geo(new THREE.ConeGeometry(.036, .14, 12)), std({ color: 0x262626, roughness: .35, metalness: .4 })); lead.position.y = 2.6; g.add(lead);
    const ferrule = mesh(geo(new THREE.CylinderGeometry(.117, .117, .32, 24)), std({ color: 0xcfc7b4, metalness: 1, roughness: .28 })); ferrule.position.y = -2.22; g.add(ferrule);
    const rubber = mesh(geo(new THREE.CylinderGeometry(.11, .1, .24, 24)), std({ color: 0xd88b7b, roughness: .85 })); rubber.position.y = -2.5; g.add(rubber);
    g.rotation.z = -Math.PI / 2; // lie along x
    addTool(g, { x: 3.9, y: 2.4, a: .22, rest: .11, circles: line(7, 5, .13), mass: .4, foot: [5.4, .5] });
  }
  { // Utility knife: ribbed grip, snap blade, slider
    const g = new THREE.Group();
    g.add(mesh(geo(new RoundedBoxGeometry(3.1, .46, .2, 3, .08)), std({ color: 0xe08a34, roughness: .62 })));
    const grip = mesh(geo(new RoundedBoxGeometry(1.5, .32, .22, 3, .06)), std({ color: 0x262120, roughness: .85 })); grip.position.x = -.5; g.add(grip);
    const ribs = new THREE.InstancedMesh(geo(new THREE.BoxGeometry(.03, .3, .03)), std({ color: 0x1a1716, roughness: .8 }), 12); const m = new THREE.Object3D();
    for (let i = 0; i < 12; i++) { m.position.set(-1.15 + i * .11, 0, .12); m.updateMatrix(); ribs.setMatrixAt(i, m.matrix); } ribs.castShadow = true; g.add(ribs);
    const blade = mesh(geo(new THREE.BoxGeometry(.9, .3, .02)), std({ color: 0xe4e4e4, metalness: 1, roughness: .16 })); blade.position.x = 1.95; g.add(blade);
    for (let i = 0; i < 5; i++) { const s = mesh(geo(new THREE.BoxGeometry(.006, .3, .022)), std({ color: 0x9a9a9a, metalness: 1, roughness: .3 }), false); s.position.x = 1.6 + i * .16; s.rotation.z = .5; g.add(s); }
    const slider = mesh(geo(new RoundedBoxGeometry(.3, .16, .1, 2, .03)), std({ color: 0xcfc8bb, metalness: .8, roughness: .3 })); slider.position.set(.6, 0, .14); g.add(slider);
    addTool(g, { x: 3.9, y: -2.2, a: .5, rest: .1, circles: [...line(6, 3.6, .25)], mass: .6, foot: [4, .9] });
  }
  { // SMA torque wrench: rubber grip, chrome shaft, the break-over joint, and the 8 mm open jaw
    const g = new THREE.Group();
    const chrome = std({ color: 0x9a9a98, metalness: 1, roughness: .48, envMapIntensity: .45 });
    const grip = mesh(geo(new RoundedBoxGeometry(1.7, .36, .28, 4, .12)), std({ color: 0x1d1c1c, roughness: .9 })); grip.position.x = -1.1; g.add(grip);
    const rings = new THREE.InstancedMesh(geo(new THREE.BoxGeometry(.035, .38, .3)), std({ color: 0x111111, roughness: .95 }), 9); const m = new THREE.Object3D();
    for (let i = 0; i < 9; i++) { m.position.set(-1.8 + i * .17, 0, 0); m.updateMatrix(); rings.setMatrixAt(i, m.matrix); } rings.castShadow = true; g.add(rings);
    const shaft = mesh(geo(new RoundedBoxGeometry(1.2, .2, .14, 3, .05)), chrome); shaft.position.x = .3; g.add(shaft);
    const joint = mesh(geo(new THREE.CylinderGeometry(.15, .15, .2, 32)), chrome); joint.rotation.x = Math.PI / 2; joint.position.x = .95; g.add(joint);
    // Head with an open hex jaw.
    const head = new THREE.Shape(); head.absarc(0, 0, .34, .55, Math.PI * 2 - .55, false);
    const jaw = .16; head.lineTo(.34, -jaw / 1.2); head.lineTo(.06, -jaw); head.lineTo(-.06, 0); head.lineTo(.06, jaw); head.lineTo(.34, jaw / 1.2);
    const headGeo = geo(new THREE.ExtrudeGeometry(head, { depth: .09, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 2 }));
    headGeo.translate(0, 0, -.045);
    const headMesh = mesh(headGeo, chrome); headMesh.position.x = 1.38; g.add(headMesh);
    const neck = mesh(geo(new RoundedBoxGeometry(.3, .22, .1, 2, .04)), chrome); neck.position.x = 1.12; g.add(neck);
    const decal = mesh(geo(new THREE.PlaneGeometry(1.0, .12)), new THREE.MeshBasicMaterial({ transparent: true, map: tex(512, 64, (x) => { x.fillStyle = "#3a3a3a"; x.font = `700 34px ${MONO}`; x.fillText("SMA · 8 IN-LB", 8, 46); }) }), false);
    decal.position.set(.3, 0, .072); g.add(decal);
    addTool(g, { x: -2.2, y: -1.95, a: .1, rest: .14, circles: [[-1.7, 0, .2], [-1.1, 0, .2], [-.5, 0, .2], [.1, 0, .15], [.6, 0, .15], [1.38, 0, .36]], mass: .9, foot: [3.9, 1] });
  }
  { // Paperclip: one wire, three straights and three round bends, nested like the real thing
    const p = new THREE.Path();
    p.moveTo(.07, .22); p.lineTo(.07, -.36);
    p.absarc(0, -.36, .07, 0, Math.PI, true);
    p.lineTo(-.07, .42);
    p.absarc(.035, .42, .105, Math.PI, 0, true);
    p.lineTo(.14, -.46);
    p.absarc(0, -.46, .14, 0, Math.PI, true);
    p.lineTo(-.14, .26);
    const pts = p.getPoints(40).map((v) => new THREE.Vector3(v.x * 1.25, v.y * 1.25, 0));
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal", .1);
    const clipGeo = geo(new THREE.TubeGeometry(curve, 240, .014, 10, false));
    const steel = std({ color: 0xc9c7c2, metalness: 1, roughness: .38 });
    const g = new THREE.Group(); g.add(mesh(clipGeo, steel));
    addTool(g, { x: -4.4, y: -.8, a: .6, rest: .016, circles: [[0, -.3, .2], [0, .25, .2]], mass: .05, foot: [.55, 1.35] });
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
    for (let step = 0; step < sub; step++) {
      for (const t of tools) {
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
        t.x += t.vx * h; t.y += t.vy * h; t.a += t.va * h;
        // Tethered: a tool may shift a little and turn a little, never wander off.
        const ox = t.x - t.hx, oy = t.y - t.hy, off = Math.hypot(ox, oy), MAX = .22;
        if (off > MAX) { t.x = t.hx + ox / off * MAX; t.y = t.hy + oy / off * MAX; t.vx *= .3; t.vy *= .3; }
        const oa = Math.atan2(Math.sin(t.a - t.ha), Math.cos(t.a - t.ha));
        if (Math.abs(oa) > .09) { t.a = t.ha + Math.sign(oa) * .09; t.va *= .3; }
      }
      // Tool against tool, and against the device and the edges of the view.
      for (let i = 0; i < tools.length; i++) {
        const A = tools[i]; if (!A.collide) continue;
        for (const [ax, ay, ar] of A.circles) {
          const [wx, wy] = worldOf(A, ax, ay);
          for (let j = i + 1; j < tools.length; j++) {
            const B = tools[j]; if (!B.collide) continue;
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
      // One hop each when the desk first appears, staggered, so touch users see the tools are loose.
      let hop = 0;
      if (t.hop > -1) { t.hop -= dt; if (t.hop < 0 && t.hop > -.45) hop = Math.sin(-t.hop / .45 * Math.PI) * .22; }
      const target = t.near * .18 + hop;
      t.lift += (target - t.lift) * (1 - Math.exp(-dt * 14));
      t.group.position.set(t.x, t.y, t.rest + t.lift);
      t.group.rotation.z = t.a;
      t.shadow.position.set(t.x + t.lift * .35, t.y - t.lift * .35, .004);
      t.shadow.rotation.z = t.a;
      const spread = 1 + t.lift * 1.4;
      t.shadow.scale.x = Math.abs(t.shadow.scale.x) / (t.shadow.userData.spread || 1) * spread; t.shadow.scale.y = Math.abs(t.shadow.scale.y) / (t.shadow.userData.spread || 1) * spread; t.shadow.userData.spread = spread;
      if (Math.abs(t.vx) + Math.abs(t.vy) + Math.abs(t.va) > .002 || Math.abs(t.lift - target) > .002 || (t.hop > -.5 && t.hop < 5)) moving = true;
    }
    pointer.vx *= Math.exp(-dt * 10); pointer.vy *= Math.exp(-dt * 10);
    return moving || pointer.on;
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
    hop() { tools.forEach((t, i) => { if (t.hop === Infinity) t.hop = .35 + i * .16; }); },
    hover(ray) {
      if (!ray) { pointer.on = false; return; }
      raycaster.ray.copy(ray); if (!raycaster.ray.intersectPlane(plane, hitPoint)) return;
      const now = performance.now() / 1000, dt = Math.min(.1, Math.max(.001, now - pointer.t));
      if (pointer.on) { pointer.vx = (hitPoint.x - pointer.x) / dt; pointer.vy = (hitPoint.y - pointer.y) / dt; }
      pointer.x = hitPoint.x; pointer.y = hitPoint.y; pointer.t = now; pointer.on = true;
    },
  };
}
