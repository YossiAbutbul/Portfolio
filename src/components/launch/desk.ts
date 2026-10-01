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
  function addTool(obj: THREE.Group, o: { x: number; y: number; a: number; rest: number; circles: [number, number, number][]; mass: number; foot: [number, number]; collide?: boolean; roll?: number; onPhone?: [number, number, number] }) {
    const g = new THREE.Group(); g.add(obj); group.add(g);
    const shadow = new THREE.Mesh(padGeo, padMat); shadow.scale.set(o.foot[0], o.foot[1], 1); shadow.position.z = .004; shadow.renderOrder = 1; group.add(shadow);
    const inertia = o.mass * o.circles.reduce((s, [cx, cy, r]) => s + cx * cx + cy * cy + r * r / 2, 0) / Math.max(1, o.circles.length);
    // Phones are portrait, so each tool has its own place there (or a squeezed copy of the desktop one).
    const [x, y, a] = phone ? o.onPhone ?? [o.x * .42, o.y * 1.3, o.a] : [o.x, o.y, o.a];
    tools.push({ group: g, shadow, circles: o.circles, mass: o.mass, inertia: Math.max(.05, inertia), rest: o.rest, collide: o.collide ?? true, x, y, a, hx: x, hy: y, ha: a, vx: 0, vy: 0, va: 0, lift: 0, near: 0, hop: Infinity, roll: o.roll ? { obj, radius: o.roll } : undefined });
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
    addTool(g, { x: 5.2, y: -2.6, a: 2.59, rest: AP, circles: line(6, 2.6, .13).map(([cx, cy, r]) => [cx + .8, cy, r] as [number, number, number]), mass: .3, foot: [4.6, .45], roll: AP, onPhone: [2.9, -2.65, 2.59] });
  }
  { // Coffee mug: glazed stoneware with a cream inside, coffee in it, and a ring it left on the mat.
    const g = new THREE.Group();
    const H2 = 1.0, RO = .52;
    const prof: [number, number][] = [[0, .005], [RO - .06, 0], [RO - .01, .02], [RO, .07], [RO + .01, H2 - .05], [RO, H2], [RO - .025, H2 + .012], [RO - .05, H2], [RO - .055, .14], [RO - .1, .1], [0, .1]];
    const cup = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 72);
    cup.rotateX(Math.PI / 2);
    // Outside glaze vs. the cream inside: split by which side of the wall a vertex is on.
    const cp = cup.attributes.position, cc = new Float32Array(cp.count * 3), glaze = new THREE.Color(0x9d3f27), inside = new THREE.Color(0xeee4d2), cl = new THREE.Color();
    for (let i = 0; i < cp.count; i++) {
      const r = Math.hypot(cp.getX(i), cp.getY(i)), z = cp.getZ(i);
      cl.copy(r < RO - .04 && z > .09 ? inside : glaze); cc.set([cl.r, cl.g, cl.b], i * 3);
    }
    cup.setAttribute("color", new THREE.BufferAttribute(cc, 3)); cup.computeVertexNormals();
    g.add(mesh(geo(cup), std({ vertexColors: true, roughness: .28, envMapIntensity: .7, side: THREE.DoubleSide })));
    const coffee = mesh(geo(new THREE.CircleGeometry(RO - .052, 48)), std({ color: 0x24120a, roughness: .9, envMapIntensity: .15 }), false);
    coffee.position.z = .8; g.add(coffee);
    const handle = mesh(geo(new THREE.TorusGeometry(.26, .065, 18, 40, Math.PI)), std({ color: 0x9d3f27, roughness: .28, envMapIntensity: .7 }));
    handle.rotation.set(Math.PI / 2, 0, -Math.PI / 2); handle.position.set(RO - .01, 0, .52); handle.scale.set(1, 1, 1.15); g.add(handle);
    addTool(g, { x: -2.6, y: -1.8, a: .5, rest: 0, circles: [[0, 0, .56], [.72, 0, .14]], mass: 1.4, foot: [1.5, 1.4], onPhone: [-1.55, 2.1, .5] });
    // The ring it left earlier, printed on the mat (it does not move with the mug).
    const ring = new THREE.Mesh(geo(new THREE.PlaneGeometry(1.25, 1.25)), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: tex(256, 256, (x, w) => {
      x.strokeStyle = "rgba(92,52,22,.3)"; x.lineWidth = 6; x.beginPath(); x.arc(w / 2, w / 2, w * .43, .3, Math.PI * 1.85); x.stroke();
      x.strokeStyle = "rgba(92,52,22,.14)"; x.lineWidth = 3; x.beginPath(); x.arc(w / 2 + 3, w / 2 - 2, w * .41, 0, Math.PI * 2); x.stroke();
    }) }));
    ring.position.set(phone ? -.4 : -.9, phone ? 2.55 : -2.35, .006); ring.renderOrder = 1; group.add(ring);
  }
  { // Ergonomic mouse in the MX Master manner: an asymmetric graphite shell with a low thumb rest
    // flaring out on the left and the palm hump at the back right, a steel wheel deep in its slot,
    // the button split and the seam where the buttons end, a small mode button, a status light, a
    // ridged thumb panel, and the steel thumb wheel with its gesture tab. Local +x is forward, +y is
    // the thumb side.
    const g = new THREE.Group();
    const outline = new THREE.CatmullRomCurve3([
      [1.03, -.47], [1.12, .03], [1.09, .47], [.55, .53], [.28, .52], [.2, .72], [-.07, .93], [-.38, 1.0],
      [-.76, .91], [-.9, .6], [-1.14, .12], [-1.07, -.29], [-.69, -.53], [-.21, -.6], [.34, -.57], [.76, -.53],
    ].map(([x, y]) => new THREE.Vector3(x, y, 0)), true, "centripetal");
    const C = new THREE.Vector2(-.05, .2);
    // Outline radius by angle round C (the outline is star-shaped about C), from dense samples.
    const samples = outline.getSpacedPoints(720).map((p) => ({ a: Math.atan2(p.y - C.y, p.x - C.x), r: Math.hypot(p.x - C.x, p.y - C.y) })).sort((p, q) => p.a - q.a);
    const radiusAt = (a: number) => {
      let i = samples.findIndex((p) => p.a >= a); if (i <= 0) i = i === 0 ? 0 : samples.length - 1;
      const p = samples[(i - 1 + samples.length) % samples.length], q = samples[i];
      const span = Math.atan2(Math.sin(q.a - p.a), Math.cos(q.a - p.a)) || 1, t = Math.atan2(Math.sin(a - p.a), Math.cos(a - p.a)) / span;
      return p.r + (q.r - p.r) * Math.min(1, Math.max(0, t));
    };
    const E = .55, BASE = .035;
    // Peak height over the top: highest at the palm, lower at the buttons, low over the thumb rest.
    const hMax = (x: number, y: number) => .17 + .45 * Math.exp(-(((x + .25) / 1.25) ** 2) - (((y + .08) / .5) ** 2));
    const surfaceZ = (x: number, y: number) => {
      const a = Math.atan2(y - C.y, x - C.x), rho = Math.min(1, Math.hypot(x - C.x, y - C.y) / radiusAt(a));
      const rxy = Math.pow(rho, 1 / E);
      return hMax(x, y) * Math.pow(Math.max(0, 1 - rxy * rxy), .25) + BASE;
    };
    const shell = new THREE.SphereGeometry(1, 160, 96);
    const sp = shell.attributes.position, uv = shell.attributes.uv;
    // Top-down UVs over this box, so the surface detail is painted in plan, like the photo.
    const X0 = -1.2, XW = 2.4, Y0 = -.7, YH = 1.8;
    for (let i = 0; i < sp.count; i++) {
      const u = sp.getX(i), w = sp.getY(i), v = -sp.getZ(i);
      const rxy = Math.hypot(u, v), a = Math.atan2(v, u), R = radiusAt(a) * Math.pow(rxy, E);
      const x = C.x + Math.cos(a) * R, y = C.y + Math.sin(a) * R;
      sp.setXYZ(i, x, y, w > 0 ? hMax(x, y) * Math.pow(w, .5) + BASE : w * .035 + BASE);
      uv.setXY(i, (x - X0) / XW, (y - Y0) / YH);
    }
    shell.computeVertexNormals();
    // Plan drawing: graphite, with the thumb panel darker, ridged in rings round the thumb wheel and
    // edged by a seam.
    const skin = tex(1536, 1152, (c, w, h) => {
      const P = (x: number, y: number): [number, number] => [(x - X0) / XW * w, (1 - (y - Y0) / YH) * h];
      c.fillStyle = "#4b4844"; c.fillRect(0, 0, w, h);
      const panel: [number, number][] = [[.3, .52], [.3, 1.3], [-1.3, 1.3], [-1.3, .62], [-.88, .57], [-.5, .5], [-.1, .49], [.18, .5]];
      c.save(); c.beginPath(); panel.forEach(([x, y], i) => { const [px, py] = P(x, y); if (i) c.lineTo(px, py); else c.moveTo(px, py); }); c.closePath();
      c.fillStyle = "#3b3835"; c.fill(); c.clip();
      const [cx, cy] = P(.12, .75);
      for (let r = 14; r < w * .5; r += 9) { c.strokeStyle = `rgba(0,0,0,${.4 - r / w * .3})`; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); }
      c.restore();
      c.strokeStyle = "#1c1a18"; c.lineWidth = 5; c.beginPath();
      panel.slice(3).concat([[.3, .52]]).forEach(([x, y], i) => { const [px, py] = P(x, y); if (i) c.lineTo(px, py); else c.moveTo(px, py); }); c.stroke();
    });
    // The same drawing doubles as a bump map, so the ridges and seam catch the light.
    const graphite = std({ map: skin, bumpMap: skin, bumpScale: 1.2, roughness: .6, envMapIntensity: .45 });
    g.add(mesh(geo(shell), graphite));
    const seamMat = std({ color: 0x151413, roughness: 1 });
    const onTop = (pts: [number, number][], r: number) => {
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, surfaceZ(x, y) + .003)));
      g.add(mesh(geo(new THREE.TubeGeometry(curve, 64, r, 6)), seamMat, false));
    };
    // Split between the buttons, and the near-straight seam where they end.
    onTop(Array.from({ length: 10 }, (_, i) => [1.1 - i * .085, .03] as [number, number]), .009);
    onTop(Array.from({ length: 13 }, (_, i) => { const y = .5 - i * (1.04 / 12); return [.34 + .03 * Math.cos(y * 2.2), y] as [number, number]; }), .007);
    // Main wheel: big, brushed steel with a knurled tread, set deep in a rounded dark slot.
    const knurl = tex(256, 32, (x, w, h) => { x.fillStyle = "#d4cdc1"; x.fillRect(0, 0, w, h); x.fillStyle = "#6b665e"; for (let i = 0; i < w; i += 5) x.fillRect(i, 0, 2, h); });
    const steel = std({ color: 0xc9c2b6, metalness: 1, roughness: .3, envMapIntensity: .8 });
    const tread = std({ map: knurl, metalness: 1, roughness: .35, envMapIntensity: .8 });
    const wx = .72, wy = .03, wz = surfaceZ(wx, wy);
    const slot = mesh(geo(new RoundedBoxGeometry(.6, .28, .12, 3, .06)), seamMat, false); slot.position.set(wx, wy, wz - .045); g.add(slot);
    const wheel = mesh(geo(new THREE.CylinderGeometry(.2, .2, .16, 64)), [tread, steel, steel]); wheel.position.set(wx, wy, wz - .03); g.add(wheel);
    // Mode button and the status light below it.
    const mode = mesh(geo(new RoundedBoxGeometry(.12, .12, .05, 3, .025)), std({ color: 0x33302d, roughness: .45 }));
    mode.position.set(.15, .03, surfaceZ(.15, .03) + .004); g.add(mode);
    const led = new THREE.Mesh(geo(new THREE.SphereGeometry(.016, 12, 8)), new THREE.MeshBasicMaterial({ color: 0x3dff6e }));
    led.position.set(.0, .03, surfaceZ(0, .03) + .003); g.add(led);
    // Thumb wheel on the left flank: two knurled discs, axis front to back, and the gesture tab below.
    for (const x of [.12, -.01]) {
      const d = mesh(geo(new THREE.CylinderGeometry(.085, .085, .1, 40)), [tread, steel, steel]);
      d.rotation.z = Math.PI / 2; d.position.set(x, .53, surfaceZ(x, .5) - .01); g.add(d);
    }
    const tab = mesh(geo(new THREE.ConeGeometry(.06, .26, 24)), std({ color: 0x5a5651, roughness: .5 }));
    tab.rotation.z = Math.PI / 2; tab.scale.set(1, 1, .6); tab.position.set(-.2, .53, surfaceZ(-.2, .5) - .015); g.add(tab);
    addTool(g, { x: 4.3, y: .55, a: 1.35, rest: 0, circles: [[-.6, -.05, .6], [.25, 0, .6], [.85, 0, .45], [-.4, .7, .35]], mass: .6, foot: [2.6, 1.9], onPhone: [1.3, 2.05, 1.4] });
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
        if (t.roll) {
          // Keep only the motion across the pencil's axis; it cannot slide lengthways or turn.
          const ux = Math.cos(t.ha), uy = Math.sin(t.ha), along = t.vx * ux + t.vy * uy;
          t.vx -= along * ux; t.vy -= along * uy; t.va = 0;
        }
        t.x += t.vx * h; t.y += t.vy * h; t.a += t.va * h;
        // Tethered: a tool may shift a little and turn a little, never wander off.
        const ox = t.x - t.hx, oy = t.y - t.hy, off = Math.hypot(ox, oy), MAX = t.roll ? .4 : .22;
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
      // Rolling tools stay on the mat: the hover cue is the roll itself, not a lift.
      const target = (t.roll ? 0 : t.near * .18) + hop;
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
