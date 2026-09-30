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

  { // Pencil: one turned surface, so barrel, sharpened wood and graphite flow into each other
    // like a real pencil, coloured along its length rather than built from separate parts.
    const K = 1, R = .105 * K; // K thickens the whole profile evenly
    const profile: [number, number][] = [
      [0, -2.36], [.04, -2.355], [.075, -2.34], [.095, -2.315], [.104, -2.28], [R, -2.24],
      [R, 1.78], [.1, 1.86], [.082, 2.0], [.062, 2.16], [.044, 2.3], [.032, 2.4],
      [.024, 2.47], [.014, 2.55], [.006, 2.6], [0, 2.62],
    ];
    // Dense rows where the paint meets the wood, so the colour change follows the scallop instead of
    // being smeared into spikes across long triangles.
    const rows: THREE.Vector2[] = [];
    profile.forEach(([r, y], i) => {
      const v = new THREE.Vector2(r === .105 ? R : r * K, y), next = profile[i + 1];
      rows.push(v);
      if (!next || y < 1.7 || y > 2.05) return;
      const n = Math.ceil((next[1] - y) / .008), w = new THREE.Vector2(next[0] === .105 ? R : next[0] * K, next[1]);
      for (let k = 1; k < n; k++) rows.push(v.clone().lerp(w, k / n));
    });
    const pencilGeo = geo(new THREE.LatheGeometry(rows, 96));
    const pos = pencilGeo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    const paint = new THREE.Color(0x2c3322), band = new THREE.Color(0xc9a878), wood = new THREE.Color(0xdcbd8e), lead = new THREE.Color(0x2b2a28);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), r = Math.hypot(pos.getX(i), pos.getZ(i));
      if (y > 2.43 || (y > 1.8 && r < .03 * K)) c.copy(lead);
      // A round pencil sharpens to a clean ring where the paint ends.
      else if (y > 1.8) c.copy(y < 1.87 ? paint : wood);
      else if (y < -2.0 && y > -2.14) c.copy(band);
      else c.copy(paint);
      col.set([c.r, c.g, c.b], i * 3);
    }
    pencilGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    pencilGeo.computeVertexNormals();
    const g = new THREE.Group();
    const body = mesh(pencilGeo, std({ vertexColors: true, roughness: .72 }));
    body.rotation.z = -Math.PI / 2; g.add(body);
    addTool(g, { x: 3.9, y: 2.4, a: .22, rest: R, circles: line(7, 4.8, .13), mass: .3, foot: [5.1, .45] });
  }
  { // Box cutter, built like a real snap-off knife: a tapered orange body, a rubber overmould over
    // the back half, a brushed steel channel with the thumb slider running in its slot, a steel nose
    // guide, a blade with a bright ground edge and snap lines, and a dark end cap.
    const g = new THREE.Group();
    const L = 3.1, back = .29, front = .23, nose = L / 2;
    const orange = std({ color: 0xe57a22, roughness: .5, envMapIntensity: .5 });
    const rubber = std({ color: 0x242120, roughness: .92 });
    const steel = std({ color: 0xb4b4b2, metalness: 1, roughness: .38, envMapIntensity: .55 });
    const darkSteel = std({ color: 0x5c5c5a, metalness: 1, roughness: .5, envMapIntensity: .4 });

    // Body: wider at the grip, tapering to the nose, the nose cut back at an angle.
    const body = new THREE.Shape();
    body.moveTo(-L / 2 + .2, -back);
    body.lineTo(nose - .2, -front);
    body.quadraticCurveTo(nose - .06, -front, nose - .04, -front + .08);
    body.lineTo(nose - .22, front);
    body.lineTo(-L / 2 + .2, back);
    body.quadraticCurveTo(-L / 2, back, -L / 2, back - .2);
    body.lineTo(-L / 2, -back + .2);
    body.quadraticCurveTo(-L / 2, -back, -L / 2 + .2, -back);
    const bodyGeo = geo(new THREE.ExtrudeGeometry(body, { depth: .14, bevelEnabled: true, bevelThickness: .055, bevelSize: .05, bevelSegments: 6, curveSegments: 20 }));
    bodyGeo.translate(0, 0, -.07);
    g.add(mesh(bodyGeo, orange));

    // Rubber overmould: a raised pad over the back half, with fine cross ribs for the thumb.
    const pad = new THREE.Shape();
    const px0 = -L / 2 + .16, px1 = -.05, pw = back - .07, pr = .14;
    pad.moveTo(px0 + pr, -pw); pad.lineTo(px1, -pw + .03); pad.quadraticCurveTo(px1 + .08, 0, px1, pw - .03); pad.lineTo(px0 + pr, pw);
    pad.quadraticCurveTo(px0, pw, px0, pw - pr); pad.lineTo(px0, -pw + pr); pad.quadraticCurveTo(px0, -pw, px0 + pr, -pw);
    const padGeo = geo(new THREE.ExtrudeGeometry(pad, { depth: .02, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 3, curveSegments: 12 }));
    const padMesh = mesh(padGeo, rubber); padMesh.position.z = .1; g.add(padMesh);
    const ribs = new THREE.InstancedMesh(geo(new RoundedBoxGeometry(.028, pw * 1.5, .02, 1, .008)), rubber, 16);
    const m = new THREE.Object3D();
    for (let i = 0; i < 16; i++) { m.position.set(px0 + .2 + i * .075, 0, .145); m.updateMatrix(); ribs.setMatrixAt(i, m.matrix); }
    ribs.castShadow = true; g.add(ribs);

    // Steel channel along the front half, with the dark slot the slider rides in.
    const chan = mesh(geo(new RoundedBoxGeometry(nose - .3 - px1, .3, .03, 2, .012)), steel);
    chan.position.set((px1 + nose - .3) / 2 + .02, 0, .125); g.add(chan);
    const slot = mesh(geo(new THREE.BoxGeometry(nose - .5 - px1, .045, .01)), std({ color: 0x141312, roughness: 1 }), false);
    slot.position.set((px1 + nose - .5) / 2 + .1, 0, .142); g.add(slot);
    // Slider: a ridged thumb button sitting proud of the channel.
    const slider = mesh(geo(new RoundedBoxGeometry(.36, .22, .09, 3, .035)), rubber); slider.position.set(.32, 0, .18); g.add(slider);
    for (let i = 0; i < 5; i++) { const rdg = mesh(geo(new RoundedBoxGeometry(.03, .2, .03, 1, .01)), rubber); rdg.position.set(.2 + i * .06, 0, .23); g.add(rdg); }

    // Steel nose guide that the blade slides out of.
    const guide = mesh(geo(new RoundedBoxGeometry(.3, front * 2 + .02, .24, 3, .04)), darkSteel); guide.position.set(nose - .26, 0, -.005); g.add(guide);
    const screw = mesh(geo(new THREE.CylinderGeometry(.045, .045, .02, 20)), steel); screw.rotation.x = Math.PI / 2; screw.position.set(nose - .26, 0, .12); g.add(screw);

    // Blade: extended past the nose, point forward, ground edge along the bottom, snap lines parallel
    // to the tip.
    const bh = .17, tipRun = .22, ext = .62;
    const bs = new THREE.Shape(); bs.moveTo(0, -bh); bs.lineTo(ext + tipRun, -bh); bs.lineTo(ext, bh); bs.lineTo(0, bh);
    const blade = mesh(geo(new THREE.ExtrudeGeometry(bs, { depth: .012, bevelEnabled: false })), std({ color: 0xd4d4d2, metalness: .95, roughness: .26, envMapIntensity: .6 }));
    blade.position.set(nose - .15, 0, .02); g.add(blade);
    const edge = mesh(geo(new THREE.BoxGeometry(ext + tipRun - .02, .035, .004)), std({ color: 0xf2f2f0, metalness: 1, roughness: .12 }), false);
    edge.position.set(nose - .15 + (ext + tipRun) / 2 - .01, -bh + .02, .034); g.add(edge);
    const ang = Math.atan2(2 * bh, -tipRun), len = Math.hypot(2 * bh, tipRun);
    for (let i = 1; i <= 2; i++) {
      const sl = mesh(geo(new THREE.BoxGeometry(len, .007, .004)), std({ color: 0x6f6f6d, roughness: .5 }), false);
      sl.rotation.z = ang; sl.position.set(nose - .15 + ext + tipRun / 2 - i * .2, 0, .034); g.add(sl);
    }

    // End cap with the snapper slot.
    const cap = mesh(geo(new RoundedBoxGeometry(.18, back * 2 + .03, .27, 3, .07)), rubber); cap.position.set(-L / 2 + .04, 0, 0); g.add(cap);
    const capSlot = mesh(geo(new THREE.BoxGeometry(.02, .3, .01)), std({ color: 0x0c0b0b, roughness: 1 }), false); capSlot.position.set(-L / 2 + .04, 0, .137); g.add(capSlot);

    addTool(g, { x: 3.9, y: -2.2, a: .5, rest: .13, circles: [...line(6, 3.6, .28)], mass: .6, foot: [4.3, 1] });
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
