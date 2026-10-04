import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * The desk set: wood, the cutting mat, and the tools on it. Every tool is a small rigid body on the
 * desk plane, tethered to its home spot by a soft spring. The pointer is a force field: tools
 * shy away from it, lift and turn a little, then settle back. A tap or click gives a short push.
 */

export interface DeskKit {
  tex: (w: number, h: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void) => THREE.CanvasTexture;
  std: (p: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
  geo: <T extends THREE.BufferGeometry>(g: T) => T;
  /** Tracks anything else the scene must dispose of (the loaded textures). */
  keep: <T extends { dispose: () => void }>(x: T) => T;
  mesh: (g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], cast?: boolean) => THREE.Mesh;
  SANS: string;
  MONO: string;
  /** Handwriting, for the notebook. Loaded on demand; pages repaint once it arrives. */
  HAND: string;
  /** Phones are portrait: the tools start closer in so they are on screen. */
  phone: boolean;
  /** Desktop swaps in photographed textures (public/textures) once they arrive. */
  photo: boolean;
  /** Uploads a texture to the GPU at a quiet moment (so a photo arriving mid-scroll does not stall). */
  upload?: (t: THREE.Texture) => void;
}

/** A project as the More work notebook and its hologram show it. */
export interface MoreWork {
  title: string;
  year: number;
  role: string;
  wip?: boolean;
  summary: string;
  stack: string[];
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
  /** More work. The notebook leaves its spot for the middle of the table, grows, and shows these
   *  projects, its pages turned by scroll, with a hologram standing over it. enter 0..1 is the move,
   *  rise 0..1 the hologram, u the spread (0 the contents, k the k-th project, fractions mid-turn).
   *  null puts it back on the desk as it was. */
  book: (state: { enter: number; rise: number; u: number } | null) => void;
  /** The projects for More work (read once from the section). */
  setMoreWork: (list: MoreWork[]) => void;
  /** Shows (true) or hides again (false) the parts that start hidden (the wall and, unless told
   *  otherwise, the hologram), so the scene can compile their shaders before they are first needed. */
  prewarm: (wall: boolean, holo?: boolean) => void;
  /** The wall behind the desk, seen only as the camera comes down for More work: rise is how far down
   *  the camera has come (0 overhead, the wall off; 1 low). It never moves itself. */
  setWall: (rise: number) => void;
  /** Builds the wall (once; it starts empty) and returns its group, still hidden. setWall builds it
   *  on the spot if it is needed before then. */
  buildWall: () => THREE.Object3D;
  /** The mug's rim in world space, for the steam drawn over the canvas. */
  mugTop: () => { at: THREE.Vector3; radius: number; fade: number } | null;
  /** Settles once every picture the desk loads has arrived (or failed). */
  loaded: Promise<void>;
}

export function buildDesk(kit: DeskKit): Desk {
  const { tex, std, geo, keep, mesh, SANS, MONO, HAND, phone, photo, upload } = kit;
  const group = new THREE.Group();

  /* Every picture the desk shows is a file in public/textures: photographed (Poly Haven, CC0) or
     drawn once ahead of time by scripts/bake-textures (the generated wood, the mat's print, the
     coffee, the wall). Nothing is painted pixel by pixel on the main thread at startup. */
  /* Decoded off the main thread where the browser can (ImageBitmap; Safari keeps the plain loader,
     as its bitmaps ignore the flip), then uploaded at a quiet moment, so a 2K picture landing while
     someone scrolls is not a stall. */
  const loader = new THREE.TextureLoader();
  const bitmaps = typeof createImageBitmap === "function" && !/^((?!chrome|android).)*safari/i.test(navigator.userAgent) ? new THREE.ImageBitmapLoader().setOptions({ imageOrientation: "flipY" }) : null;
  const arrivals: Promise<void>[] = [];
  const picture = (url: string, color: boolean, repeat: [number, number] = [1, 1], rotate = 0) => {
    let t: THREE.Texture;
    arrivals.push(new Promise<void>((done) => {
      const landed = () => { upload?.(t); done(); };
      if (bitmaps) {
        t = new THREE.Texture(); t.flipY = false;
        bitmaps.load(url, (bmp) => { t.image = bmp; t.needsUpdate = true; landed(); }, undefined, () => done());
      } else t = loader.load(url, landed, undefined, () => done());
    }));
    t!.wrapS = t!.wrapT = THREE.RepeatWrapping; t!.repeat.set(...repeat); t!.anisotropy = 8;
    if (rotate) { t!.center.set(.5, .5); t!.rotation = rotate; }
    // The baked maps were canvases, which the scene marked sRGB (relief included); kept so they shade
    // exactly as before.
    if (color) t!.colorSpace = THREE.SRGBColorSpace;
    return keep(t!);
  };

  /* ---------- Wood table ---------- */
  // Desktop: photographed oak (oak_veneer_01) tinted to black ash. Phones: generated black ash planks
  // (baked at the size phones drew them), each repeat mirrored since they do not tile.
  const table = mesh(geo(new THREE.PlaneGeometry(40, 26)), photo ? std({ color: 0x3f3631, roughness: 1 }) : std({ bumpScale: 2.2, roughness: .78 }), false);
  {
    const m = table.material as THREE.MeshStandardMaterial;
    if (photo) {
      const rep: [number, number] = [2.4, 1.6];
      m.map = picture("/textures/oak-color.webp", true, rep, Math.PI / 2);
      m.normalMap = picture("/textures/oak-normal.webp", false, rep, Math.PI / 2); m.normalScale.set(.8, .8);
      m.roughnessMap = picture("/textures/oak-rough.webp", false, rep, Math.PI / 2);
    } else {
      m.map = picture("/textures/wood-color.webp", true, [2.2, 1.4]);
      m.bumpMap = picture("/textures/wood-bump.webp", true, [2.2, 1.4]);
      for (const t of [m.map, m.bumpMap]) t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    }
  }
  table.position.z = -.06; group.add(table);

  /* ---------- Cutting mat: grid, rulers, speckle, a little wear, and old cut marks ---------- */
  const MAT_W = 11.2, MAT_H = 7.4;
  const matTex = picture(phone ? "/textures/mat-print-half.webp" : "/textures/mat-print.webp", true);
  matTex.wrapS = matTex.wrapT = THREE.ClampToEdgeWrapping;
  const matSide = std({ color: 0x2c5039, roughness: .9 });
  const matTop = std({ map: matTex, roughness: 1 });
  const mat = mesh(geo(new RoundedBoxGeometry(MAT_W, MAT_H, .05, 2, .02)), [matSide, matSide, matSide, matSide, matTop, matSide], false);
  mat.position.set(1.9, .45, -.03); mat.rotation.z = -.07; group.add(mat);
  // Desktop: the mat keeps its printed colour and grid, with photographed surface relief (Poly Haven
  // linoleum_brown, CC0) tiled small, so it reads as a real matte plastic sheet. Phones: a speckle.
  if (photo) {
    matTop.normalMap = picture("/textures/mat-normal.webp", false, [7, 4.6]); matTop.normalScale.set(.45, .45);
    matTop.roughnessMap = picture("/textures/mat-rough.webp", false, [7, 4.6]);
  } else {
    matTop.bumpMap = picture("/textures/mat-bump.webp", true, [4, 4]); matTop.bumpScale = .9;
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
  const notebookParts: THREE.Object3D[] = [];
  // The mug's group and shadow, so More work can move it aside on phones (it would stand in front of
  // the wall there).
  let mugRig: { g: THREE.Object3D; pad: THREE.Object3D; x: number; y: number; s: number; aside?: boolean } | null = null;
  let notebookOn = true;
  // The pencil, so More work can bring it forward on phones (and put it back after).
  let pencil: Tool | null = null, pencilHome: [number, number] = [0, 0];
  let notebook: { over: (ray: THREE.Ray) => boolean; hint: (ray: THREE.Ray) => string | null; hover: (ray: THREE.Ray | null) => void; press: (ray: THREE.Ray) => boolean; update: (dt: number) => boolean; enter: () => void; book: Desk["book"]; setMoreWork: Desk["setMoreWork"]; prewarm: (on: boolean) => void } | null = null;
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
    // point, a gold stamp on the top face, and a plain painted end (no eraser).
    const AP = .1, CR = AP / Math.cos(Math.PI / 6); // hex apothem and corner radius
    const Y0 = -2, CUT = 1.62, TIP = 2.62;            // barrel start, where the cone starts, the point: a fairly new pencil
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
    // Its painted end stays where the shorter pencil it was had it (half under the hero's card), so the
    // extra length shows, the point reaching further out onto the mat; its length runs along x once
    // turned.
    const body = new THREE.Group(); body.rotation.z = -Math.PI / 2; body.position.x = -(-1.2 + TIP) / 2 - 1.2 - Y0; g.add(body);
    body.add(mesh(pencilGeo, std({ vertexColors: true, roughness: .5, envMapIntensity: .6 })));
    // Gold foil stamp on the face toward the camera, running along the barrel.
    const stamp = mesh(geo(new THREE.PlaneGeometry(1.9, .1)), new THREE.MeshStandardMaterial({ transparent: true, metalness: .8, roughness: .35, color: 0xd8b25a, map: tex(1024, 54, (x) => { x.fillStyle = "#fff"; x.font = `700 34px ${MONO}`; x.fillText("ABUTBUL  ·  HB  ·  No. 2", 10, 40); }) }), false);
    stamp.rotation.z = Math.PI / 2; stamp.position.set(0, .1, AP + .002); body.add(stamp);
    addTool(g, { x: -4.1, y: -2.2, a: .55, rest: AP, circles: line(8, 3.4, .13).map(([cx, cy, r]) => [cx + .9, cy, r] as [number, number, number]), mass: .36, foot: [5.3, .45], roll: AP, onPhone: [-2.45, -1.38, .06], enter: [2.8 * Math.sin(.55), -2.8 * Math.cos(.55), .85], hint: "Push to roll" });
    pencil = tools[tools.length - 1]; pencilHome = [pencil.hx, pencil.hy];
  }

  /* The eraser: a white vinyl block in a printed card sleeve, lying still on the desk (not one of the
     pushable tools, and it does not lift on hover; the hint says what it does). A click flips it: a
     hop and a full turn about its long side, landing as it was. It arrives with the desk's entrance,
     rolling in end over end from the left. */
  let eraser: { hit: (ray: THREE.Ray) => boolean; press: (ray: THREE.Ray) => boolean; update: (dt: number) => boolean; enter: () => void; aside: (e: number) => void } | null = null;
  {
    const L = .88, W = .34, H = .17, SL = L * .56;
    const g = new THREE.Group();
    g.add(mesh(geo(new RoundedBoxGeometry(L, W, H, 3, .035)), std({ color: 0xf3f1ea, roughness: .78 })));
    // The sleeve's two printed faces (the box's +z and -z), its long sides in the band colour.
    const BLUE = "#2a4f8f";
    const front = tex(512, 356, (x, w, h) => {
      x.fillStyle = "#f4f1e8"; x.fillRect(0, 0, w, h);
      x.fillStyle = BLUE; x.fillRect(0, 0, w * .42, h);
      x.fillStyle = BLUE; x.font = `700 40px ${MONO}`; x.textAlign = "left"; x.fillText("VINYL", w * .48, h * .36);
      x.font = `500 26px ${MONO}`; x.fillText("for graphite", w * .48, h * .58);
      x.fillRect(w * .48, h * .72, w * .44, 4);
    });
    const back = tex(512, 356, (x, w, h) => {
      x.fillStyle = "#f4f1e8"; x.fillRect(0, 0, w, h);
      x.fillStyle = BLUE; x.fillRect(0, 0, w, h * .14); x.fillRect(0, h * .86, w, h * .14);
      // A barcode, seeded so it is the same every visit.
      let s = 7; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
      x.fillStyle = "#1c1c1c"; for (let px = w * .14; px < w * .86;) { const bw = 3 + Math.floor(r() * 3) * 3; if (r() > .4) x.fillRect(px, h * .26, bw, h * .36); px += bw + 3; }
      x.font = `500 24px ${MONO}`; x.textAlign = "center"; x.fillText("0 12345 67890 5", w / 2, h * .74);
    });
    const band = std({ color: 0x2a4f8f, roughness: .6 });
    g.add(mesh(geo(new THREE.BoxGeometry(SL, W + .008, H + .008)), [band, band, band, band, std({ map: front, roughness: .6 }), std({ map: back, roughness: .6 })]));
    const [EX, EY, EA] = phone ? [-1.7, .95, .2] : [-4.3, .45, -.3];
    const holder = new THREE.Group(); holder.position.set(EX, EY, H / 2); holder.rotation.z = EA; holder.add(g); group.add(holder);
    let flip = -1, roll = -1;
    // The roll in: from off the left edge, end over end along its own length (about its short
    // axis), two full turns, landing face up where it lies.
    const ROLL_D = 4.6, ROLL_TURNS = 2, ROLL_AT = .35, ROLL_S = 1.3;
    const rollPose = (e: number) => {
      const back = (1 - e) * ROLL_D, a = -(1 - e) * ROLL_TURNS * Math.PI * 2;
      holder.position.set(EX - Math.cos(EA) * back, EY - Math.sin(EA) * back, H / 2);
      // Rocking over an edge, its centre rides as high as the box's reach in that pose.
      g.rotation.y = a; g.position.z = (L / 2) * Math.abs(Math.sin(a)) + (H / 2) * Math.abs(Math.cos(a)) - H / 2;
    };
    eraser = {
      enter() { roll = -ROLL_AT; rollPose(0); },
      // Phones' More work brings the book to where the eraser lies: it slides to the open mat right of
      // the pencil's point, below the book (e: 0 at home, 1 there).
      aside(e) {
        const [AX, AY, AA] = [1.35, -1.45, .3];
        holder.position.set(EX + (AX - EX) * e, EY + (AY - EY) * e, H / 2); holder.rotation.z = EA + (AA - EA) * e;
      },
      hit: (ray) => { raycaster.ray.copy(ray); return raycaster.intersectObject(holder, true).length > 0; },
      press(ray) { if (!eraser!.hit(ray)) return false; if (flip < 0) flip = 0; return true; },
      update(dt) {
        if (roll !== -1) {
          // A short wait (roll below zero), then the roll itself, eased to a stop.
          roll = Math.min(1, roll + dt / ROLL_S);
          rollPose(1 - Math.pow(1 - Math.max(0, roll), 3));
          if (roll >= 1) roll = -1;
          return true;
        }
        if (flip < 0) return false;
        flip = Math.min(1, flip + dt / .8);
        const e = flip < .5 ? 2 * flip * flip : 1 - Math.pow(-2 * flip + 2, 2) / 2;
        // Lifted clear of the desk while it turns (a corner reaches further than the half-height). Its
        // shadow is the scene's own, cast by the light (a contact pad shows as a pale box on the wood).
        g.rotation.x = e * Math.PI * 2; g.position.z = Math.sin(flip * Math.PI) * .45;
        if (flip >= 1) { flip = -1; g.rotation.x = 0; g.position.z = 0; }
        return true;
      },
    };
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
    // Dark in the middle, a ring of crema at the rim (baked).
    const coffeeTex = picture("/textures/coffee.webp", true);
    coffeeTex.wrapS = coffeeTex.wrapT = THREE.ClampToEdgeWrapping;
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
    const from = new THREE.Vector3(.12, 0, SZ - .35), to = new THREE.Vector3(.7, 0, SZ + .78);
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
    const strip = new THREE.ExtrudeGeometry(outline, { depth: .012, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 2, curveSegments: 10 });
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
        else if (enterT >= 1.7 && g.position.x !== MX && !mugRig?.aside) mugAt(1);
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
    const [MX, MY, MA] = phone ? [-1.55, 2.6, .5] : [4.95, 2.2, 2.4];
    // The spoon rests leaning toward the upper right of the screen, where a right hand leaves it,
    // whatever way the mug itself is turned.
    spoonRest = .35 - MA; spoon.rotation.z = spoonRest;
    g.position.set(MX, MY, 0); g.rotation.z = MA; group.add(g);
    const mugPad = new THREE.Mesh(padGeo, padMat); mugPad.scale.set(2.5, 2.3, 1); mugPad.position.set(MX, MY, .004); mugPad.rotation.z = MA; mugPad.renderOrder = 1; group.add(mugPad);
    mugRig = { g, pad: mugPad, x: MX, y: MY, s: g.scale.x };
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
    ring.position.set(phone ? .45 : 3.3, phone ? 1.05 : 2.15, .006); ring.renderOrder = 1; group.add(ring);
  }
  { // Open pocket notebook (A7, to scale with the pencil). It stays put. Hovering a page lifts it
    // toward the pointer; a click turns it, forward on the right page and back on the left. The
    // spreads are rough thinking about the featured projects: notes on the left, a sketch on the right.
    const nb = new THREE.Group(); group.add(nb); notebookParts.push(nb);
    const PW = 2.05, PH = 2.9, T = .15;
    const [NX, NY, NA] = phone ? [1.5, 2.55, -.1] : [4.4, -.35, -.18];
    nb.position.set(NX, NY, 0); nb.rotation.z = NA;
    const pad = new THREE.Mesh(padGeo, padMat); pad.scale.set(PW * 2 + .9, PH + .8, 1); pad.position.set(NX, NY, .004); pad.rotation.z = NA; pad.renderOrder = 1; group.add(pad); notebookParts.push(pad);
    // Height of the page surface at distance d from the spine: low at the gutter, rising to the edge.
    const top = (d: number) => .035 + T * (.3 + .7 * (1 - Math.exp(-d / .22))) - .015 * Math.pow(d / PW, 6);
    const cover = mesh(geo(new RoundedBoxGeometry(PW * 2 + .14, PH + .14, .035, 2, .014)), std({ color: 0x1f1d1b, roughness: .7 }));
    cover.position.z = .018; nb.add(cover);

    /* Pages are drawn into four reusable canvases (left, right, and the two faces of the turning
       sheet) in a 1024-wide space. Each page has its own seeded wobble, so redrawing the same page
       gives the same strokes. */
    type Pen = { line: (pts: [number, number][], w?: number) => void; curve: (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) => void; text: (s: string, x: number, y: number, size?: number) => void; box: (x: number, y: number, w: number, h: number) => void; ring: (x: number, y: number, r: number) => void; arrow: (x0: number, y0: number, x1: number, y1: number) => void; x: CanvasRenderingContext2D };
    type Page = (p: Pen) => void;
    // Desktop draws pages at full size: in More work the notebook is the subject, filling the table.
    const SCALE = phone ? .5 : 1, CW = 1024, CH = 1448;
    const page = () => tex(Math.round(CW * SCALE), Math.round(CH * SCALE), () => {});
    const paintInto = (c: HTMLCanvasElement, draw: Page, seed: number) => {
      let st = seed * 2654435761 >>> 0;
      const rnd = () => { st = (st + 0x6d2b79f5) >>> 0; let r = Math.imul(st ^ (st >>> 15), 1 | st); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
      const x = c.getContext("2d")!;
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
    };
    /* Drawing a page by hand (hundreds of jittered strokes and handwriting) is the costly part, so
       each page is drawn once into its own canvas and kept; showing it in a slot is then a copy and
       an upload, and a slot already showing that page does nothing at all. More work's pages are
       drawn ahead of time, in idle moments (see setMoreWork). */
    const drawn = new Map<string, HTMLCanvasElement>();
    const pageCanvas = (key: string, draw: Page, seed: number) => {
      let c = drawn.get(key);
      if (!c) {
        c = document.createElement("canvas"); c.width = Math.round(CW * SCALE); c.height = Math.round(CH * SCALE);
        paintInto(c, draw, seed); drawn.set(key, c);
      }
      return c;
    };
    const showIn = (t: THREE.CanvasTexture, key: string, draw: Page, seed: number) => {
      if (t.userData.page === key) return;
      const c = pageCanvas(key, draw, seed), x = (t.image as HTMLCanvasElement).getContext("2d")!;
      x.drawImage(c, 0, 0); t.userData.page = key; t.needsUpdate = true;
    };
    // Notes page for a project: the name, a few dashes of what it does, one line worth underlining,
    // and the stack in small. Facts only from content/projects.ts.
    const notes = (title: string, lines: string[], key: string, stack: string): Page => (p) => {
      p.text(title, 90, 200, 112); p.line([[86, 232], [96 + title.length * 50, 226]], 4);
      lines.forEach((l, i) => { p.line([[100, 380 + i * 140], [140, 378 + i * 140]], 5); p.text(l, 170, 400 + i * 140, 86); });
      p.text(key, 100, 1050, 88); p.line([[96, 1080], [110 + key.length * 36, 1074]], 4);
      p.text(stack, 92, 1330, 58);
    };
    const deskSpreads: { left: Page; right: Page }[] = [
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
    /* More work: a contents spread, then one per project. Notes on the left (what it is, in its
       own words from content/projects.ts, and the stack ticked off); the stack sketched as boxes on
       the right. */
    const wrap = (text: string, max: number) => {
      const lines: string[] = [];
      for (const word of text.split(/\s+/)) {
        const last = lines[lines.length - 1];
        if (last && (last + " " + word).length <= max) lines[lines.length - 1] = last + " " + word; else lines.push(word);
      }
      return lines;
    };
    const cut = (text: string, max: number) => text.length > max ? text.slice(0, max - 1) + "…" : text;
    const moreSpreads = (list: MoreWork[]): { left: Page; right: Page }[] => [
      {
        left: (p) => {
          p.text("more work", 90, 230, 128); p.line([[86, 262], [560, 254]], 5);
          wrap("Smaller, older, or still going. Each one runs, and each one taught me something.", 26).forEach((l, i) => p.text(l, 100, 440 + i * 112, 74));
          p.text("turn the page", 480, 1320, 72); p.arrow(870, 1290, 960, 1290);
        },
        right: (p) => {
          p.text("contents", 90, 210, 104); p.line([[86, 240], [470, 234]], 4);
          list.forEach((e, i) => {
            const y = 420 + i * 170;
            p.text(cut(e.title, 20), 100, y, 74);
            p.x.setLineDash([6, 16]); p.line([[110 + Math.min(20, e.title.length) * 33, y - 8], [830, y - 10]], 3); p.x.setLineDash([]);
            p.text(String(i + 1).padStart(2, "0"), 860, y, 74);
          });
        },
      },
      ...list.map((e, i): { left: Page; right: Page } => ({
        left: (p) => {
          p.text(`${String(i + 1).padStart(2, "0")} · ${e.year}${e.wip ? " · still going" : ""}`, 96, 150, 56);
          const size = e.title.length > 18 ? 82 : 104;
          p.text(e.title, 90, 290, size); p.line([[86, 322], [100 + Math.min(e.title.length * size * .44, 880), 314]], 5);
          wrap(e.summary, 31).slice(0, 6).forEach((l, k) => p.text(l, 100, 450 + k * 98, 62));
          e.stack.slice(0, 4).forEach((item, k) => {
            const y = 1100 + k * 92; p.box(100, y - 50, 48, 48); p.line([[106, y - 28], [124, y - 6], [168, y - 76]], 6);
            p.text(cut(item, 22), 190, y, 64);
          });
        },
        right: (p) => {
          p.text(cut(e.role.toLowerCase(), 26), 520, 150, 56);
          const boxes = e.stack.slice(0, 3), xs = [120, 320, 170];
          boxes.forEach((item, k) => {
            const label = cut(item, 14), w = Math.min(640, 90 + label.length * 40), x = xs[k], y = 300 + k * 330;
            p.box(x, y, w, 150); p.text(label, x + 40, y + 102, 80);
            if (k < boxes.length - 1) p.arrow(x + w / 2, y + 165, xs[k + 1] + 120, y + 315);
          });
          p.ring(780, 1250, 60); p.text("ships", 640, 1360, 64);
        },
      })),
    ];
    let spreads = deskSpreads, more: MoreWork[] | null = null, mode: "desk" | "more" = "desk";
    const mod = (i: number) => { const n = spreads.length; return ((i % n) + n) % n; };
    const pageOf = (s: number, side: "left" | "right") => spreads[mod(s)][side];
    const seedOf = (s: number, side: "left" | "right") => mod(s) * 2 + (side === "left" ? 1 : 2) + (mode === "more" ? 100 : 0);
    const keyOf = (s: number, side: "left" | "right") => `${mode}:${mod(s)}:${side}`;
    const put = (t: THREE.CanvasTexture, s: number, side: "left" | "right") => showIn(t, keyOf(s, side), pageOf(s, side), seedOf(s, side));
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
      if (side < 0) {
        // Mirrored for the left half. Mirroring reverses the triangles' winding, which turns the block
        // inside out (lit and shadowed as if seen from behind: a dark, noisy edge), so put it back.
        block.scale(-1, 1, 1);
        for (const attr of Object.values(block.attributes) as THREE.BufferAttribute[]) {
          const a = attr.array, n = attr.itemSize;
          for (let t = 0; t < attr.count; t += 3) for (let k = 0; k < n; k++) { const i1 = (t + 1) * n + k, i2 = (t + 2) * n + k, v = a[i1]; a[i1] = a[i2]; a[i2] = v; }
        }
      }
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
    document.fonts?.load(`700 80px ${HAND}`).then(() => {
      drawn.clear(); for (const t of [underLeft, underRight, rFront, rBack, lFront, lBack]) t.userData.page = "";
      paintAll(); if (holoAt >= 0) drawHolo(holoAt);
    }).catch(() => {});

    /* ---------- More work: the hologram ----------
       Built once, hidden until More work. It is projected from the middle of the book, the spine: a
       cool blue glow on the paper there, a wedge of light up to a panel leaning a touch toward the
       camera, scanlines drifting over it, motes rising through the beam, and a point light throwing
       blue onto the pages. Additive and unlit, over smoked glass. A turning page passes through the
       beam, as it would through light. */
    const holo = new THREE.Group(); holo.position.set(0, 0, top(0) + .01); holo.visible = false; nb.add(holo);
    let holoWas = false;
    const HW = 2.4, HH = .95, HZ = 1.15;
    const additive = (map: THREE.Texture | null, extra: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, ...extra });
    const holoTex = tex(1024, 432, () => {});
    const panelMat = additive(holoTex);
    const lean = new THREE.Group(); lean.position.z = HZ; lean.rotation.x = Math.PI / 2 - .22; holo.add(lean);
    // Smoked glass behind the light, so the hologram reads against the pale wall as well as the dark.
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x050d18, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const glass = new THREE.Mesh(geo(new THREE.PlaneGeometry(HW * .98, HH * .96)), glassMat); glass.position.set(0, HH / 2, -.006); lean.add(glass);
    const panel = new THREE.Mesh(geo(new THREE.PlaneGeometry(HW, HH)), panelMat); panel.position.y = HH / 2; lean.add(panel);
    const scanTex = tex(4, 64, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = "rgba(140,210,255,.55)"; x.fillRect(0, 0, w, 6); x.fillStyle = "rgba(140,210,255,.12)"; x.fillRect(0, 30, w, 3); });
    scanTex.wrapS = scanTex.wrapT = THREE.RepeatWrapping; scanTex.repeat.set(1, 26);
    const scanMat = additive(scanTex);
    const scan = new THREE.Mesh(geo(new THREE.PlaneGeometry(HW, HH)), scanMat); scan.position.set(0, HH / 2, .004); lean.add(scan);
    // The wedge of light: an open cone, narrow at the paper, flattened front to back.
    const beamTex = tex(8, 128, (x, w, h) => { const g = x.createLinearGradient(0, h, 0, 0); g.addColorStop(0, "rgba(120,200,255,.8)"); g.addColorStop(.35, "rgba(100,180,255,.24)"); g.addColorStop(1, "rgba(100,180,255,.06)"); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    const beamGeo = new THREE.CylinderGeometry(HW * .46, .05, HZ + .06, 40, 1, true); beamGeo.rotateX(Math.PI / 2); beamGeo.translate(0, 0, (HZ + .06) / 2);
    const beamMat = additive(beamTex);
    const beam = new THREE.Mesh(geo(beamGeo), beamMat); beam.scale.y = .3; holo.add(beam);
    const dotTex = tex(64, 64, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, "rgba(200,236,255,1)"); g.addColorStop(.4, "rgba(90,170,255,.45)"); g.addColorStop(1, "rgba(90,170,255,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    const sourceMat = additive(dotTex);
    const source = new THREE.Mesh(geo(new THREE.PlaneGeometry(1.2, 1.2)), sourceMat); source.position.set(0, 0, .006); holo.add(source);
    const MOTES = 80, motePos = new Float32Array(MOTES * 3), moteSeed = Array.from({ length: MOTES }, () => [Math.random() * 2 - 1, Math.random() * 2 - 1, .25 + Math.random() * .6, Math.random()]);
    const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({ map: dotTex, size: .07, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, sizeAttenuation: true });
    holo.add(new THREE.Points(geo(moteGeo), moteMat));
    // Present from the start (at zero) so switching it on never recompiles the lit materials.
    const holoLight = new THREE.PointLight(0x7cc4ff, 0, 9, 2); holoLight.position.set(0, -.6, .9); holo.add(holoLight);

    let holoAt = -1, flick = 0, rise = 0, clock = 0;
    function drawHolo(k: number) {
      holoAt = k;
      const c = holoTex.image as HTMLCanvasElement, x = c.getContext("2d")!, w = c.width, h = c.height;
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h);
      x.strokeStyle = "rgba(150,215,255,.95)"; x.fillStyle = "rgba(215,240,255,1)"; x.lineWidth = 5;
      x.shadowColor = "rgba(60,150,255,.95)"; x.shadowBlur = 22;
      // Corner brackets and a faint frame.
      const m = 16, L = 64;
      ([[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]] as const).forEach(([cx, cy, sx, sy]) => { x.beginPath(); x.moveTo(cx + sx * L, cy); x.lineTo(cx, cy); x.lineTo(cx, cy + sy * L); x.stroke(); });
      x.globalAlpha = .25; x.lineWidth = 2; x.strokeRect(m + 10, m + 10, w - 2 * m - 20, h - 2 * m - 20); x.globalAlpha = 1;
      const e = k > 0 && more ? more[k - 1] : null;
      const kicker = e ? `${e.wip ? "IN PROGRESS" : "SHIPPED"}  ·  ${e.year}  ·  ${String(k).padStart(2, "0")}/${String(more!.length).padStart(2, "0")}` : "ALSO SHIPPED";
      const name = (e ? e.title : "More work").toUpperCase();
      x.font = `600 30px ${MONO}`; x.fillText(kicker, 64, 104);
      let size = 112; x.font = `800 ${size}px ${SANS}`;
      while (x.measureText(name).width > w - 128 && size > 48) { size -= 4; x.font = `800 ${size}px ${SANS}`; }
      x.fillText(name, 60, 112 + size);
      x.font = `500 30px ${MONO}`;
      if (e) {
        x.fillText(cut(e.role, 54), 64, 180 + size);
        let cx = 64; const cy = 230 + size;
        for (const item of e.stack.slice(0, 4)) {
          const label = cut(item, 18), tw = x.measureText(label).width + 36;
          if (cx + tw > w - 60) break;
          x.lineWidth = 3; x.beginPath(); x.roundRect(cx, cy - 34, tw, 48, 24); x.stroke();
          x.fillText(label, cx + 18, cy); cx += tw + 16;
        }
      } else if (more) {
        const years = more.map((p) => p.year);
        x.fillText(`${more.length} projects  ·  ${Math.min(...years)}–${Math.max(...years)}`, 64, 180 + size);
      }
      holoTex.needsUpdate = true;
      flick = 1;
    }
    function updateHolo(dt: number) {
      clock += dt;
      flick = Math.max(0, flick - dt * 2.4);
      const shimmer = .9 + .06 * Math.sin(clock * 7.3) + .04 * Math.sin(clock * 17.1);
      const jitter = flick > 0 && Math.random() < flick * .6 ? .3 : 1;
      panelMat.opacity = rise * shimmer * jitter;
      glassMat.opacity = rise * .62;
      scanMat.opacity = rise * .35; scanTex.offset.y = (clock * .35) % 1;
      beamMat.opacity = rise * (.75 + .1 * Math.sin(clock * 5));
      sourceMat.opacity = rise * .9;
      moteMat.opacity = rise * .8;
      holoLight.intensity = rise * 7 * shimmer;
      for (let i = 0; i < MOTES; i++) {
        const sd = moteSeed[i];
        sd[3] = (sd[3] + dt * sd[2] * .45) % 1;
        const t2 = sd[3], spread = .05 + t2 * HW * .44;
        motePos[i * 3] = sd[0] * spread; motePos[i * 3 + 1] = sd[1] * spread * .3; motePos[i * 3 + 2] = t2 * (HZ + HH * .9);
      }
      moteGeo.attributes.position.needsUpdate = true;
      return rise > .01;
    }

    /* ---------- More work: the move and the scroll-turned pages ---------- */
    // Phones: the book further back (higher on the narrow screen, clear of the caption card and the
    // pencil), a little bigger, and its hologram larger so it can be read.
    const S = phone ? .72 : 1.18, BX = phone ? 0 : .9, BY = phone ? .45 : -1.15, BA = -.035, HS = phone ? 1.8 : 1;
    const HOLD = .45;
    const lerpN = (a: number, b: number, t2: number) => a + (b - a) * t2;
    function book(state: { enter: number; rise: number; u: number } | null) {
      if (!state || !more) {
        if (mode === "desk") return;
        mode = "desk"; spreads = deskSpreads; cur = 0; paintAll();
        right.phi = right.target = 0; left.phi = left.target = Math.PI; right.shape(); left.shape();
        nb.position.set(NX, NY, 0); nb.rotation.z = NA; nb.scale.setScalar(1);
        pad.position.set(NX, NY, .004); pad.rotation.z = NA; pad.scale.set(PW * 2 + .9, PH + .8, 1);
        holo.visible = false; holoLight.intensity = 0; rise = 0; holoAt = -1;
        eraser?.aside(0);
        if (mugRig) { mugRig.aside = false; mugRig.g.position.x = mugRig.pad.position.x = mugRig.x; mugRig.g.position.y = mugRig.pad.position.y = mugRig.y; mugRig.g.scale.setScalar(mugRig.s); mugRig.pad.scale.set(2.5, 2.3, 1); }
        if (pencil) { pencil.hx = pencilHome[0]; pencil.hy = pencilHome[1]; pencil.group.scale.setScalar(1); pencil.shadow.scale.set(5.3, .45, 1); }
        notebookOn = true;
        return;
      }
      if (mode === "desk") { mode = "more"; spreads = moreSpreads(more); cur = -1; notebookOn = false; hover(null); }
      // Its place for More work (set while the room is still dark, so it is simply there).
      const e = state.enter, sc = lerpN(1, S, e);
      nb.position.set(lerpN(NX, BX, e), lerpN(NY, BY, e), 0);
      nb.rotation.z = lerpN(NA, BA, e); nb.scale.setScalar(sc);
      pad.position.set(nb.position.x, nb.position.y, .004); pad.rotation.z = nb.rotation.z; pad.scale.set((PW * 2 + .9) * sc, (PH + .8) * sc, 1);
      // Pages: rest on each spread, then turn, eased; the turn is the right sheet going over.
      const last = spreads.length - 1, u = Math.min(last, Math.max(0, state.u));
      const i = Math.min(last - 1, Math.floor(u)), m = Math.min(1, Math.max(0, (u - i - HOLD / 2) / (1 - HOLD))), f = m * m * (3 - 2 * m);
      if (cur !== i) { cur = i; paintAll(); }
      right.phi = right.target = f * Math.PI; right.shape();
      if (left.phi !== Math.PI) { left.phi = left.target = Math.PI; left.shape(); }
      // The hologram: rises once the book has landed, and shows the spread lying open.
      rise = state.rise; holo.visible = rise > .005; holo.scale.set(HS, HS, HS * Math.max(.001, rise));
      // Phones: the mug, smaller, stands back at the left edge, out of the way of the book and the
      // wall; the pencil comes forward, smaller, in front of the book.
      if (phone) eraser?.aside(e);
      if (phone && mugRig) {
        // Scales are relative to the mug's own (it is modelled small and scaled up).
        const x = mugRig.x + (-1.7 - mugRig.x) * e, y = mugRig.y + (3.4 - mugRig.y) * e, k = 1 - (1 - .62 / mugRig.s) * e;
        mugRig.aside = true;
        mugRig.g.position.x = mugRig.pad.position.x = x; mugRig.g.position.y = mugRig.pad.position.y = y;
        mugRig.g.scale.setScalar(mugRig.s * k); mugRig.pad.scale.set(2.5 * k, 2.3 * k, 1);
      } else if (mugRig) {
        // Desktop: the mug stays where it is, a little smaller, so the wall and the book lead.
        const k = 1 - .2 * e;
        mugRig.aside = true;
        mugRig.g.scale.setScalar(mugRig.s * k); mugRig.pad.scale.set(2.5 * k, 2.3 * k, 1);
      }
      if (phone && pencil) {
        pencil.hx = -1.95; pencil.hy = -1.5;
        pencil.group.scale.setScalar(.72); pencil.shadow.scale.set(5.3 * .72, .45 * .72, 1);
      }
      const open = Math.round(u);
      if (open !== holoAt) drawHolo(open);
    }
    const hover = (ray: THREE.Ray | null) => notebook?.hover(ray);
    notebook = {
      book,
      // Shown for a compile and then put back exactly as it was (it may be on show at the time).
      prewarm(on) { if (on) { holoWas = holo.visible; holo.visible = true; } else holo.visible = holoWas; },
      setMoreWork(list) {
        more = list;
        // Draw every More work page ahead of time, one per idle moment, so turning a page later is only
        // a copy. The pages are keyed as they will be shown (mode "more").
        const ahead = moreSpreads(list), jobs: (() => void)[] = [];
        ahead.forEach((sp, i) => (["left", "right"] as const).forEach((side) => jobs.push(() => {
          pageCanvas(`more:${i}:${side}`, sp[side], i * 2 + (side === "left" ? 1 : 2) + 100);
        })));
        // A page takes a few milliseconds to draw: wait for idle moments with room for it.
        if (typeof requestIdleCallback !== "function") { const tick = () => { const job = jobs.shift(); if (job) { job(); setTimeout(tick, 80); } }; setTimeout(tick, 80); return; }
        // The wait counts from the last page drawn, so short idle moments cannot starve it for good.
        let since = performance.now();
        const tick = (d: IdleDeadline) => {
          if (d.timeRemaining() < 12 && !d.didTimeout && performance.now() - since < 3000) { requestIdleCallback(tick, { timeout: 3000 }); return; }
          since = performance.now();
          const job = jobs.shift(); if (!job) return; job();
          if (jobs.length) requestIdleCallback(tick, { timeout: 3000 });
        };
        requestIdleCallback(tick, { timeout: 3000 });
      },
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
        if (mode === "more") return updateHolo(dt);
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

  /* ---------- The wall behind the desk (More work only) ----------
     Seen only from the low camera, and it stands still: it is switched on as the camera starts to
     come down, so the transition is just the camera moving. Pale plaster, so the dark desk and everything on the wall stand
     out against it; a pegboard with a coiled cable, screwdrivers and sticky notes; a shelf lit from
     underneath with a bench scope, a dev board, an antenna and a plant; a clock telling the real time.
     Everything on it plays: hover nudges, a click sets it going (see the gadgets list below). */
  const wall = new THREE.Group(); wall.visible = false; group.add(wall);
  const WY = 5, wallRise: { v: number; light?: THREE.PointLight } = { v: -1 };
  // A gadget answers hover and clicks; update steps it and says whether it is still moving.
  type Gadget = { obj: THREE.Object3D; hint: string; press: () => void; hover?: () => void; update: (dt: number) => boolean };
  const gadgets: Gadget[] = [];
  // A thing hanging from (or standing on) a pivot that swings about the wall's normal, on a spring.
  const swinger = (pivot: THREE.Object3D, hint: string, o: { k?: number; damp?: number; kick?: number; axis?: "y" | "x"; nudge?: number } = {}): Gadget => {
    const st = { a: 0, w: 0 }, k = o.k ?? 18, damp = o.damp ?? 1.6, axis = o.axis ?? "y";
    return {
      obj: pivot, hint,
      press() { st.w += (Math.random() < .5 ? -1 : 1) * (o.kick ?? 4.5); },
      hover() { if (Math.abs(st.w) < .3) st.w += (Math.random() - .5) * (o.nudge ?? 1.6); },
      update(dt) {
        st.w += (-k * st.a - damp * st.w) * dt; st.a += st.w * dt;
        pivot.rotation[axis] = st.a;
        return Math.abs(st.a) > .002 || Math.abs(st.w) > .002;
      },
    };
  };
  let clockHands: { h: THREE.Object3D; m: THREE.Object3D } | null = null;
  let clockSpin = 0;
  /* The wall is a hundred-odd small pieces, and three's per-object work for each one, every frame,
     was what slowed More work on slow phones. Nothing on it moves except the gadgets, so the pieces
     that share a material (and shadow settings and vertex layout) are merged into one mesh each, in
     place; what stays separate stops recomputing its transform every frame. Gadgets keep their own
     pieces (they move, and the pointer finds them by their objects); hidden, see-through, instanced and
     mirrored pieces are left as they are. */
  function freezeWall() {
    wall.updateMatrixWorld(true);
    const toWall = wall.matrixWorld.clone().invert(), at = new THREE.Matrix4();
    const moving = new Set<THREE.Object3D>();
    for (const g of gadgets) g.obj.traverse((o) => moving.add(o));
    const shown = (o: THREE.Object3D | null) => { for (; o && o !== wall; o = o.parent) if (!o.visible) return false; return true; };
    const sets = new Map<string, { mat: THREE.Material; cast: boolean; receive: boolean; parts: THREE.BufferGeometry[]; from: THREE.Mesh[] }>();
    wall.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || moving.has(m) || Array.isArray(m.material) || m.material.transparent || m.renderOrder || !shown(m) || m.matrixWorld.determinant() < 0) return;
      const g = m.geometry, key = [m.material.uuid, m.castShadow, m.receiveShadow, Object.keys(g.attributes).sort().join(), !!g.index].join("|");
      let set = sets.get(key);
      if (!set) sets.set(key, set = { mat: m.material, cast: m.castShadow, receive: m.receiveShadow, parts: [], from: [] });
      set.parts.push(g.clone().applyMatrix4(at.multiplyMatrices(toWall, m.matrixWorld))); set.from.push(m);
    });
    for (const set of sets.values()) {
      const merged = set.parts.length > 1 ? mergeGeometries(set.parts) : null;
      set.parts.forEach((g) => g.dispose());
      if (!merged) continue;
      const one = new THREE.Mesh(geo(merged), set.mat); one.castShadow = set.cast; one.receiveShadow = set.receive;
      for (const m of set.from) m.removeFromParent();
      wall.add(one);
    }
    // Everything left that does not move keeps the transform it has.
    wall.traverse((o) => { if (o !== wall && !moving.has(o)) { o.updateMatrix(); o.matrixAutoUpdate = false; } });
  }

  /* Built on approach (see scene.ts: as the projects come into view, or in idle time a few seconds
     after the opening), not with the desk: it is the biggest part of the set and nobody sees it until
     More work. Until then the group is empty and hidden, so it adds nothing to the startup shaders. */
  let wallBuilt = false, wallWas = false;
  function buildWall() {
    if (wallBuilt) return wall;
    wallBuilt = true;
    {
      const plaster = picture("/textures/plaster.webp", true);
      plaster.wrapS = plaster.wrapT = THREE.ClampToEdgeWrapping;
      // The room's lights reach this wall unevenly (the sun is behind it, the window patch and the
      // shadow frusta end partway up), which split it into bands. It carries its own soft, even light
      // instead: the plaster texture as its glow, and no shadows thrown onto it.
      const face = mesh(geo(new THREE.PlaneGeometry(40, 10)), std({ map: plaster, emissiveMap: plaster, emissive: 0xffffff, emissiveIntensity: .55, roughness: .95 }), false);
      face.receiveShadow = false;
      face.rotation.x = Math.PI / 2; face.position.set(0, WY, 4.94); wall.add(face);
      const skirting = mesh(geo(new THREE.BoxGeometry(40, .12, .36)), std({ color: 0x6b4a32, roughness: .55 }));
      skirting.position.set(0, WY - .06, .12); wall.add(skirting);

      // Pegboard on the left, with what hangs on it. Phones leave it out: there is room for the shelf
      // and the clock only.
      const pb = new THREE.Group(); wall.add(pb); pb.visible = !phone;
      const pegTex = picture("/textures/pegboard.webp", true);
      if (!phone) pegTex.wrapS = pegTex.wrapT = THREE.ClampToEdgeWrapping;
      const edgeMat = std({ color: 0x8d6b48 });
      // Box faces run +x, -x, +y, -y, +z, -z; the side facing the room (and the camera) is -y.
      const board = mesh(geo(new THREE.BoxGeometry(6.2, .07, 2.4)), [edgeMat, edgeMat, edgeMat, std({ map: pegTex, roughness: .85 }), edgeMat, edgeMat]);
      board.position.set(phone ? -.7 : -4.1, WY - .05, phone ? 2.5 : 2.35); pb.add(board);
      if (phone) { board.scale.set(1.5 / 6.2, 1, 1.8 / 2.4); pegTex.repeat.set(1.5 / 6.2, 1.8 / 2.4); }
      const pegMat = std({ color: 0x9a9a9a, metalness: .8, roughness: .3 });
      const peg = (x: number, z: number) => { const o = mesh(geo(new THREE.CylinderGeometry(.025, .025, .22, 8)), pegMat); o.position.set(x, WY - .19, z); pb.add(o); };
      // A coil of cable, two loops hanging on a peg: it swings.
      const [CX, CZ] = phone ? [-1.15, 3.1] : [-6.2, 3.15];
      const coil = new THREE.Group(); coil.position.set(CX, WY - .2, CZ); pb.add(coil); peg(CX, CZ);
      if (phone) coil.scale.setScalar(.7);
      const cableMat = std({ color: 0xc4552c, roughness: .45 });
      [[0, 0], [.07, -.06]].forEach(([dx, dz]) => { const c = mesh(geo(new THREE.TorusGeometry(.42, .045, 12, 56)), cableMat); c.rotation.x = Math.PI / 2; c.position.set(dx, 0, -.4 + dz); coil.add(c); });
      gadgets.push(swinger(coil, "Click to swing the cable", { k: 9, damp: .9 }));
      // Screwdrivers, hanging handle-up from their pegs: they swing.
      ([[0xb3361f, -5.1, -.75], [0xd39a3c, -4.8, -.55], [0x2e5a49, -4.5, -.35]] as [number, number, number][]).forEach(([color, dx, px]) => {
        const x = phone ? px : dx;
        const sd = new THREE.Group(); sd.position.set(x, WY - .16, phone ? 3.25 : 3.28); pb.add(sd);
        const handle = mesh(geo(new THREE.CylinderGeometry(.07, .06, .42, 16)), std({ color, roughness: .4 }));
        handle.rotation.x = Math.PI / 2; handle.position.z = -.23; sd.add(handle);
        const shaft = mesh(geo(new THREE.CylinderGeometry(.018, .018, .55, 8)), std({ color: 0xbfc3c7, metalness: .9, roughness: .25 }));
        shaft.rotation.x = Math.PI / 2; shaft.position.z = -.72; sd.add(shaft);
        gadgets.push(swinger(sd, "Click to knock it", { k: 14, damp: 1.1 }));
      });
      // A steel rule across the bottom of the board.
      const rule = mesh(geo(new THREE.BoxGeometry(2.6, .02, .14)), std({ color: 0xc9ccd0, metalness: .85, roughness: .3 }));
      if (phone) { rule.scale.x = .5; rule.position.set(-.7, WY - .12, 1.8); pb.add(rule); peg(-1.25, 1.91); peg(-.15, 1.91); }
      else { rule.position.set(-4.4, WY - .12, 1.55); pb.add(rule); peg(-5.5, 1.66); peg(-3.3, 1.66); }
      // Sticky notes, in the notebook's hand: working notes from a range test, not slogans. Pinned at the
      // top, they flap away from the wall. Phones have room for two, lower on the smaller board.
      type Doodle = (c: CanvasRenderingContext2D, w: number, h: number) => void;
      // Each note is a quick sketch in pen: a LoRa chirp with its frequency ramp, the log visualizer's
      // to-do list, and the path a packet takes.
      const ink = (c: CanvasRenderingContext2D, wd = 5) => { c.strokeStyle = c.fillStyle = "#2a2a3a"; c.lineWidth = wd; c.lineCap = c.lineJoin = "round"; };
      const chirp: Doodle = (c, w) => {
        ink(c, 4);
        c.beginPath();
        for (let px = 0; px <= 196; px++) { const u = px / 196, y = 92 - 38 * Math.sin(Math.PI * 2 * (1.5 * u + 4 * u * u)); if (px) c.lineTo(30 + px, y); else c.moveTo(30 + px, y); }
        c.stroke();
        // The same chirp as frequency over time: ramps that wrap round, three symbols.
        c.beginPath(); c.moveTo(28, 150); c.lineTo(28, 222); c.lineTo(w - 24, 222); c.stroke();
        ink(c, 5); c.beginPath();
        for (let i = 0; i < 3; i++) { const x0 = 36 + i * 62; c.moveTo(x0, 212); c.lineTo(x0 + 58, 160); if (i < 2) c.lineTo(x0 + 62, 212); }
        c.stroke();
      };
      const todo: Doodle = (c) => {
        ink(c, 4); c.font = `700 46px ${HAND}`; c.textAlign = "left";
        [["parser", true], ["charts", true], ["export", false]].forEach(([word, done], i) => {
          const y = 62 + i * 68;
          c.strokeRect(30, y - 26, 30, 30);
          if (done) { c.beginPath(); c.moveTo(34, y - 12); c.lineTo(44, y); c.lineTo(66, y - 34); c.stroke(); }
          c.fillText(word as string, 78, y + 2);
        });
      };
      const flow: Doodle = (c) => {
        ink(c, 4); c.font = `700 40px ${HAND}`; c.textAlign = "center";
        const node = (cx: number, cy: number, label: string) => { c.strokeRect(cx - 46, cy - 26, 92, 48); c.fillText(label, cx, cy + 12); };
        const arrow = (x0: number, y0: number, x1: number, y1: number) => {
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
          const a = Math.atan2(y1 - y0, x1 - x0); c.beginPath(); c.moveTo(x1 - 13 * Math.cos(a - .5), y1 - 13 * Math.sin(a - .5)); c.lineTo(x1, y1); c.lineTo(x1 - 13 * Math.cos(a + .5), y1 - 13 * Math.sin(a + .5)); c.stroke();
        };
        node(70, 66, "node"); node(186, 66, "gw"); node(186, 190, "web");
        arrow(118, 64, 138, 64); arrow(186, 94, 186, 160);
        // Radio waves off the node's antenna.
        for (const r of [12, 22]) { c.beginPath(); c.arc(70, 40, r, -Math.PI * .8, -Math.PI * .2); c.stroke(); }
      };
      const notes: [Doodle, number][] = [[chirp, 0xf2d36b], [todo, 0xf0a7a0], [flow, 0xbfe3a8]];
      ((phone ? [[...notes[0], -.95, 2.3, .08], [...notes[1], -.35, 2.25, -.1]] : [[...notes[0], -3.2, 3.05, .08], [...notes[1], -2.3, 2.78, -.1], [...notes[2], -2.9, 2.2, .05]]) as [Doodle, number, number, number, number][]).forEach(([doodle, color, x, z, a]) => {
        const paint: Doodle = (c, w, h) => { c.fillStyle = "#" + color.toString(16).padStart(6, "0"); c.fillRect(0, 0, w, h); doodle(c, w, h); };
        const t = tex(256, 256, paint);
        // The handwriting arrives later than the wall is built: draw the note again once it has.
        document.fonts?.load(`700 46px ${HAND}`).then(() => { const cv = t.image as HTMLCanvasElement; paint(cv.getContext("2d")!, cv.width, cv.height); t.needsUpdate = true; }).catch(() => {});
        const hinge = new THREE.Group(); hinge.position.set(x, WY - .1, z + .275); hinge.rotation.y = a; pb.add(hinge);
        const flap = new THREE.Group(); hinge.add(flap);
        const note = mesh(geo(new THREE.PlaneGeometry(.55, .55)), std({ map: t, roughness: .9, side: THREE.DoubleSide }), false);
        note.rotation.x = Math.PI / 2; note.position.z = -.275; flap.add(note);
        // Flapping lifts the note off the wall (about its top edge), never into it.
        const g = swinger(flap, "Click to flick it", { k: 30, damp: 2.4, kick: 6, axis: "x", nudge: 2 });
        const step = g.update;
        g.update = (dt) => { const m = step(dt); flap.rotation.x = -Math.abs(flap.rotation.x); return m; };
        gadgets.push(g);
      });

      // Shelf on the right, lit from underneath.
      const wood = std({ color: 0x5b3b24, roughness: .55 });
      // Phones: a short shelf under the clock, right of the board.
      const SX = phone ? .45 : 3.9, SW = phone ? 2.1 : 6.4, SZ = phone ? 2.3 : 1.9;
      const shelf = mesh(geo(new THREE.BoxGeometry(SW, .7, .09)), wood); shelf.position.set(SX, WY - .35, SZ); wall.add(shelf);
      (phone ? [-.5, 1.4] : [1.2, 6.6]).forEach((x) => { const b = mesh(geo(new THREE.BoxGeometry(.08, .55, .45)), std({ color: 0x1d1d1d, metalness: .6, roughness: .4 })); b.position.set(x, WY - .28, SZ - .25); wall.add(b); });
      const strip = new THREE.Mesh(geo(new THREE.BoxGeometry(SW - .4, .05, .02)), new THREE.MeshBasicMaterial({ color: 0xffc48a, toneMapped: false }));
      strip.position.set(SX, WY - .55, SZ - .06); wall.add(strip);
      // Present from the start (at zero) so raising the wall never recompiles the lit materials.
      const stripLight = new THREE.PointLight(0xffb070, 0, 7, 2); stripLight.position.set(SX, WY - 1.1, SZ - .3); wall.add(stripLight);
      wallRise.light = stripLight;
      const SH = SZ + .05; // the shelf's top
      /* A bench scope, drawn after a real two-channel DSO: a screen with the instrument's own interface
         (status bar, dotted graticule, channel and trigger markers, scale and measurement readouts), a
         front panel with soft keys, knobs and BNC inputs, and (desktop) a probe on channel 1 clipped to
         the dev board beside it. A click cycles what it is measuring. The case is 1.7 wide, .62 deep,
         .95 tall; its front face is at y = -.31 (toward the camera). */
      const SCR_W = 768, SCR_H = 464;
      const scopeTex = tex(SCR_W, SCR_H, () => {});
      let trace = 0;
      const MODES = [
        { label: "RING-DOWN", time: "50.0µs", ch1: "1.00V", ch2: "", trig: .15, level: .5, meas: ["Freq 18.0kHz", "Vpp 6.02V", "τ 22.1µs"] },
        { label: "CLK 1kHz", time: "200µs", ch1: "1.00V", ch2: "1.00V", trig: .45, level: .5, meas: ["Freq 1.000kHz", "Vpp 4.12V", "Rise 18.0ns"] },
        { label: "NOISE FLOOR", time: "1.00µs", ch1: "5.00mV", ch2: "", trig: .5, level: .2, meas: ["Vrms 2.91mV", "Vpp 19.6mV", "Mean 0.04mV"] },
        { label: "LoRa TX", time: "500µs", ch1: "500mV", ch2: "2.00V", trig: .2, level: .8, meas: ["Width 3.12ms", "Vpp 5.04V", "SF7 125kHz"] },
      ];
      const drawTrace = () => {
        const x = (scopeTex.image as HTMLCanvasElement).getContext("2d")!, w = SCR_W, h = SCR_H, m = MODES[trace];
        // Seeded, so a mode looks the same every time it comes round.
        let seed = 11 + trace * 97;
        const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
        const n = (a: number) => (rnd() + rnd() + rnd() - 1.5) / 1.5 * a;
        const gx = 24, gy = 34, gw = 720, gh = 376, dx = gw / 10, dy = gh / 8;
        const X = (t: number) => gx + t * gw, Y = (v: number) => gy + gh / 2 - v * dy;
        x.setLineDash([]); x.globalAlpha = 1;
        x.fillStyle = "#050607"; x.fillRect(0, 0, w, h);
        // Status bar: run state, timebase, sample rate, memory depth, trigger.
        x.fillStyle = "#16181a"; x.fillRect(0, 0, w, 28);
        x.fillStyle = "#2fd16b"; x.beginPath(); x.roundRect(6, 5, 52, 19, 3); x.fill();
        x.fillStyle = "#04140a"; x.font = `700 13px ${MONO}`; x.fillText("RUN", 18, 19);
        x.fillStyle = "#e8e8e8"; x.font = `500 13px ${MONO}`;
        x.fillText(`H ${m.time}`, 70, 19); x.fillText("Sa 1.00GSa/s", 170, 19); x.fillText("D 14.0Mpts", 300, 19);
        const unit = m.ch1.replace(/[\d.]+/, ""), lvl = (m.level * Number.parseFloat(m.ch1)).toFixed(2);
        x.fillStyle = "#ff9b2f"; x.fillText(`T ↑ CH1 ${lvl}${unit}`, 560, 19);
        // Graticule: dotted divisions, the centre lines with fifth-division ticks, a frame.
        x.strokeStyle = "rgba(150,150,150,.38)"; x.lineWidth = 1; x.setLineDash([1, 4]);
        for (let i = 1; i < 10; i++) { x.beginPath(); x.moveTo(X(i / 10) + .5, gy); x.lineTo(X(i / 10) + .5, gy + gh); x.stroke(); }
        for (let j = 1; j < 8; j++) { x.beginPath(); x.moveTo(gx, gy + j * dy + .5); x.lineTo(gx + gw, gy + j * dy + .5); x.stroke(); }
        x.setLineDash([]); x.strokeStyle = "rgba(170,170,170,.55)";
        for (let i = 0; i <= 50; i++) { const px = gx + i * dx / 5 + .5, k = i % 5 ? 3 : 5; x.beginPath(); x.moveTo(px, Y(0) - k); x.lineTo(px, Y(0) + k); x.stroke(); }
        for (let j = 0; j <= 40; j++) { const py = gy + j * dy / 5 + .5, k = j % 5 ? 3 : 5; x.beginPath(); x.moveTo(X(.5) - k, py); x.lineTo(X(.5) + k, py); x.stroke(); }
        x.strokeStyle = "rgba(170,170,170,.6)"; x.strokeRect(gx + .5, gy + .5, gw, gh);
        // A trace: a soft wide pass for the glow, then the sharp line.
        const plot = (f: (t: number) => number, color: string, glow: string, alpha = 1) => {
          const pts: [number, number][] = [];
          for (let px = 0; px <= gw; px++) pts.push([gx + px, Y(Math.max(-4.2, Math.min(4.2, f(px / gw))))]);
          x.save(); x.beginPath(); x.rect(gx, gy, gw, gh); x.clip(); x.globalAlpha = alpha; x.lineJoin = "round";
          for (const [lw, c] of [[5, glow], [1.6, color]] as const) {
            x.strokeStyle = c; x.lineWidth = lw; x.beginPath();
            pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke();
          }
          x.restore();
        };
        const Y1 = "#ffe14a", Y1G = "rgba(255,225,74,.22)", C2 = "#35d6f0", C2G = "rgba(53,214,240,.22)";
        // Each channel's ground level, in divisions.
        const g1 = trace === 1 || trace === 3 ? 1.6 : 0, g2 = -2.2;
        if (trace === 0) {
          // A struck resonator: flat until the trigger, then a decaying ring.
          plot((t) => { const u = t - m.trig; return (u < 0 ? 0 : 3 * Math.sin(Math.PI * 2 * 9 * u) * Math.exp(-u * 4.5)) + n(.04); }, Y1, Y1G);
        } else if (trace === 1) {
          // A 1 kHz clock with a real edge (rise time, overshoot, ringing) and its RC-filtered copy on CH2.
          const edge = (t: number) => { const p = (t * 2 + .05) % 1; return p < .5 ? { L: 1, te: p } : { L: -1, te: p - .5 }; };
          plot((t) => { const { L, te } = edge(t); return g1 + L * (1 - 2 * Math.exp(-te * 140) * Math.cos(te * 260)) + n(.03); }, Y1, Y1G);
          plot((t) => { const { L, te } = edge(t); return g2 + L * .9 * (1 - 2 * Math.exp(-te * 9)) + n(.02); }, C2, C2G);
        } else if (trace === 2) {
          // The noise floor, with persistence: earlier sweeps stay faintly on screen.
          for (let k = 0; k < 7; k++) plot(() => n(.7), Y1, Y1G, .16);
          plot(() => n(.7), Y1, Y1G);
        } else {
          // A LoRa packet: up-chirps (each sweeping up through the band, then wrapping) on a short ramp,
          // with the radio's TX-enable line on CH2.
          const end = .86;
          const env = (t: number) => Math.max(0, Math.min(1, (t - m.trig) / .02, (end - t) / .02));
          plot((t) => {
            if (t < m.trig || t > end) return g1 + n(.03);
            const u = ((t - m.trig) % .08) / .08;
            return g1 + 2.2 * env(t) * Math.sin(Math.PI * 2 * (3 * u + 3 * u * u)) + n(.04);
          }, Y1, Y1G);
          plot((t) => (t > m.trig - .015 && t < end + .015 ? g2 + .9 : g2 - .9) + n(.02), C2, C2G);
        }
        // Markers: channel ground levels on the left, the trigger level on the right, the trigger
        // position along the top.
        const tag = (px: number, py: number, color: string, text: string, left: boolean) => {
          const s = left ? 1 : -1;
          x.fillStyle = color; x.beginPath();
          x.moveTo(px, py - 8); x.lineTo(px + s * 14, py - 8); x.lineTo(px + s * 20, py); x.lineTo(px + s * 14, py + 8); x.lineTo(px, py + 8);
          x.closePath(); x.fill();
          x.fillStyle = "#000"; x.font = `700 12px ${MONO}`; x.fillText(text, left ? px + 3 : px - 13, py + 4);
        };
        tag(2, Y(g1), Y1, "1", true);
        if (m.ch2) tag(2, Y(g2), C2, "2", true);
        tag(w - 2, Y(g1 + m.level), "#ff9b2f", "T", false);
        x.fillStyle = "#ff9b2f"; x.beginPath(); x.moveTo(X(m.trig) - 7, gy); x.lineTo(X(m.trig) + 7, gy); x.lineTo(X(m.trig), gy + 9); x.closePath(); x.fill();
        // The channel's label, as the instrument lets you set one.
        x.fillStyle = Y1; x.font = `600 13px ${MONO}`; x.fillText(m.label, gx + 8, gy + 18);
        // Bottom bar: channel scales, then the measurements.
        x.fillStyle = "#16181a"; x.fillRect(0, h - 46, w, 46);
        const chip = (px: number, color: string, num: string, text: string) => {
          x.fillStyle = color; x.beginPath(); x.roundRect(px, h - 38, 18, 18, 2); x.fill();
          x.fillStyle = "#000"; x.font = `700 12px ${MONO}`; x.fillText(num, px + 5, h - 24);
          x.strokeStyle = color; x.lineWidth = 1; x.strokeRect(px + 18.5, h - 37.5, 82, 17);
          x.fillStyle = color; x.font = `500 12px ${MONO}`; x.fillText(text, px + 25, h - 24);
        };
        chip(8, Y1, "1", `${m.ch1} DC`);
        if (m.ch2) chip(118, C2, "2", `${m.ch2} DC`);
        x.fillStyle = "#d8d8d8"; x.font = `500 13px ${MONO}`;
        m.meas.forEach((s, i) => x.fillText(s, 250 + i * 172, h - 24));
        x.fillStyle = "#7b7f84"; x.font = `500 11px ${MONO}`; x.fillText("Measure · CH1", 250, h - 8);
        scopeTex.needsUpdate = true;
      };
      drawTrace();
      const scope = new THREE.Group(); scope.position.set(phone ? .1 : 2.5, WY - .45, SH); wall.add(scope);
      if (phone) scope.scale.setScalar(.72);
      const scase = mesh(geo(new RoundedBoxGeometry(1.7, .62, .95, 3, .05)), std({ color: 0x3a3d41, roughness: .55, metalness: .25 })); scase.position.z = .475; scope.add(scase);
      // A carry handle folded back over the top.
      const handle = mesh(geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(-.66, .26, .95), new THREE.Vector3(-.66, .02, .975), new THREE.Vector3(-.5, -.04, .98),
        new THREE.Vector3(.5, -.04, .98), new THREE.Vector3(.66, .02, .975), new THREE.Vector3(.66, .26, .95),
      ]), 40, .018, 8)), std({ color: 0x1d1f21, roughness: .5 })); scope.add(handle);
      // The front face: the printed panel (section frames, labels, the screen's bezel, the coloured rings
      // round the inputs) is a texture; the controls themselves are geometry on top of it.
      const FW = 1.62, FH = .88, FZ = .475, FT = FZ + FH / 2;
      const panelTex = tex(1024, 556, (x, w, h) => {
        const P = (px: number, pz: number): [number, number] => [(px + FW / 2) / FW * w, (FT - pz) / FH * h];
        const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#3a3e42"); g.addColorStop(1, "#2c2f32");
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,255,255,${.01 + (i % 7) * .002})`; x.fillRect(0, (i * 37) % h, w, 1); }
        // The screen's bezel.
        const [sx0, sy0] = P(-.8, .845), [sx1, sy1] = P(.2, .215);
        x.fillStyle = "#0c0d0e"; x.beginPath(); x.roundRect(sx0, sy0, sx1 - sx0, sy1 - sy0, 10); x.fill();
        x.fillStyle = "#c9ccd0"; x.font = `600 15px ${SANS}`; x.fillText("DSO 2104", ...P(-.79, .875));
        x.fillStyle = "#8d9296"; x.font = `500 12px ${MONO}`; x.fillText("100 MHz  ·  1 GSa/s  ·  4 CH", ...P(-.6, .875));
        x.fillText("DIGITAL STORAGE OSCILLOSCOPE", ...P(-.12, .875));
        // Sections on the right, framed and titled.
        const frame = (a: number, b: number, c: number, d: number, title: string) => {
          const [x0, y0] = P(a, b), [x1, y1] = P(c, d);
          x.strokeStyle = "rgba(200,205,210,.32)"; x.lineWidth = 1.5; x.beginPath(); x.roundRect(x0, y0, x1 - x0, y1 - y0, 6); x.stroke();
          if (!title) return;
          x.font = `600 11px ${MONO}`; const tw = x.measureText(title).width;
          x.fillStyle = "#383c40"; x.fillRect(x0 + 8, y0 - 7, tw + 8, 12); x.fillStyle = "#b9bec3"; x.fillText(title, x0 + 12, y0 + 4);
        };
        frame(.3, .86, .79, .755, "MENU");
        frame(.3, .735, .47, .555, "");
        frame(.5, .735, .66, .555, "HORIZONTAL");
        frame(.68, .735, .79, .555, "TRIGGER");
        frame(.3, .535, .79, .21, "VERTICAL");
        x.fillStyle = "#a9aeb3"; x.font = `500 10px ${MONO}`;
        ([["Measure", .35, .775], ["Acquire", .43, .775], ["Cursor", .51, .775], ["Display", .59, .775], ["RUN/STOP", .675, .775], ["SINGLE", .76, .775],
          ["SCALE", .555, .575], ["POS", .63, .575], ["LEVEL", .735, .575], ["MATH", .655, .455], ["REF", .655, .375], ["AUTO", .745, .455], ["CLEAR", .745, .375],
          ["CH1", .37, .225], ["CH2", .53, .225], ["EXT", .67, .225]] as [string, number, number][])
          .forEach(([s, a, b]) => { const [px, py] = P(a, b); x.fillText(s, px - x.measureText(s).width / 2, py); });
        { const [px, py] = P(.78, .055); x.fillText("1kHz 3V", px - 30, py); }
        // Coloured rings round the channel inputs and their scale knobs.
        for (const [a, b, c, r] of [[.37, .12, "#ffe14a", 28], [.53, .12, "#35d6f0", 28], [.37, .33, "#ffe14a", 34], [.53, .33, "#35d6f0", 34]] as [number, number, string, number][]) {
          const [px, py] = P(a, b); x.strokeStyle = c; x.lineWidth = 3; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.stroke();
        }
        // Power and USB, bottom left.
        x.fillStyle = "#8d9296"; x.font = `500 10px ${MONO}`; x.fillText("POWER", ...P(-.785, .045)); x.fillText("USB", ...P(-.6, .045));
        const [ux, uy] = P(-.62, .14); x.fillStyle = "#111"; x.fillRect(ux, uy, 34, 14); x.fillStyle = "#555"; x.fillRect(ux + 5, uy + 4, 24, 5);
      });
      const faceMesh = mesh(geo(new THREE.PlaneGeometry(FW, FH)), std({ map: panelTex, roughness: .6, metalness: .1 }), false);
      faceMesh.rotation.x = Math.PI / 2; faceMesh.position.set(0, -.311, FZ); scope.add(faceMesh);
      const sscreen = new THREE.Mesh(geo(new THREE.PlaneGeometry(.94, .568)), new THREE.MeshBasicMaterial({ map: scopeTex, toneMapped: false }));
      sscreen.rotation.x = Math.PI / 2; sscreen.position.set(-.3, -.313, .53); scope.add(sscreen);
      // Controls. They face the camera (-y), and cylinders already run along y.
      const knobMat = std({ color: 0x1a1b1d, roughness: .45 }), capMat = std({ color: 0x2c2e31, roughness: .35, metalness: .2 });
      const markMat = std({ color: 0xd8dade, roughness: .5 });
      const knob = (a: number, b: number, r: number) => {
        const k = new THREE.Group(); k.position.set(a, -.311, b); scope.add(k);
        const body = mesh(geo(new THREE.CylinderGeometry(r * .96, r, .05, 32)), knobMat, false); body.position.y = -.025; k.add(body);
        const cap = mesh(geo(new THREE.CylinderGeometry(r * .8, r * .8, .012, 32)), capMat, false); cap.position.y = -.056; k.add(cap);
        const mark = mesh(geo(new THREE.BoxGeometry(r * .12, .006, r * .55)), markMat, false); mark.position.set(0, -.062, r * .45); k.add(mark);
        return k;
      };
      const keyMat = std({ color: 0x55595e, roughness: .5 });
      const key = (a: number, b: number, wd = .062, hg = .034, mat: THREE.Material = keyMat) => {
        const k = mesh(geo(new RoundedBoxGeometry(wd, .022, hg, 2, .008)), mat, false); k.position.set(a, -.322, b); scope.add(k); return k;
      };
      const multi = knob(.385, .645, .05);
      knob(.555, .645, .04); knob(.63, .645, .028); knob(.735, .645, .04);
      knob(.37, .33, .042); knob(.53, .33, .042); knob(.37, .45, .026); knob(.53, .45, .026);
      [.35, .43, .51, .59].forEach((a) => key(a, .805));
      key(.675, .805, .07, .036, new THREE.MeshBasicMaterial({ color: 0x35d16b, toneMapped: false }));
      key(.76, .805, .07, .036, std({ color: 0x6b5a2e, roughness: .5 }));
      [[.655, .48], [.655, .4], [.745, .48], [.745, .4]].forEach(([a, b]) => key(a, b, .056, .03));
      // Soft keys down the right of the screen, and the power key.
      [.76, .65, .54, .43, .32].forEach((b) => key(.245, b, .05, .05));
      const power = mesh(geo(new THREE.CylinderGeometry(.03, .03, .02, 24)), keyMat, false); power.position.set(-.74, -.32, .1); scope.add(power);
      // BNC inputs: a flange, the barrel, the insulator, and the two bayonet studs.
      const metal = std({ color: 0xcfd3d8, roughness: .25, metalness: .95 }), insul = std({ color: 0xe8e2d4, roughness: .6 });
      const bnc = (a: number, b: number) => {
        const g = new THREE.Group(); g.position.set(a, -.311, b); scope.add(g);
        const flange = mesh(geo(new THREE.CylinderGeometry(.042, .042, .01, 6)), metal, false); flange.position.y = -.005; g.add(flange);
        const barrel = mesh(geo(new THREE.CylinderGeometry(.027, .027, .06, 24, 1, true)), metal, false); barrel.position.y = -.035; g.add(barrel);
        const ins = mesh(geo(new THREE.CylinderGeometry(.02, .02, .05, 20)), insul, false); ins.position.y = -.03; g.add(ins);
        for (const s of [-1, 1]) { const stud = mesh(geo(new THREE.CylinderGeometry(.006, .006, .02, 8)), metal, false); stud.rotation.z = Math.PI / 2; stud.position.set(s * .033, -.05, 0); g.add(stud); }
      };
      bnc(.37, .12); bnc(.53, .12); bnc(.67, .12);
      // The probe-compensation tabs.
      for (const a of [.76, .8]) { const tab = mesh(geo(new THREE.BoxGeometry(.016, .03, .03)), metal, false); tab.position.set(a, -.326, .12); scope.add(tab); }
      let scopeBump = 0;
      gadgets.push({
        obj: scope, hint: "Click to change the trace",
        press() { trace = (trace + 1) % MODES.length; drawTrace(); scopeBump = 1; },
        update(dt) { scopeBump = Math.max(0, scopeBump - dt * 4); multi.rotation.y = trace * 1.2 + scopeBump; scope.position.z = SH + Math.sin(scopeBump * Math.PI) * .03; return scopeBump > 0; },
      });
      /* A dev board leaning on the wall: a small LoRa node, 1.0 wide and .72 tall, its front face toward
         the camera (-y). The printed side (solder mask over copper pour, routed traces, vias, pads and
         the silkscreen) is a texture; the parts on it are geometry. Its TX LED flashes when clicked; the
         scope's probe hooks onto its TP1 test point. */
      const BW = 1.0, BH = .72;
      const pcbTex = tex(1024, 737, (x, w, h) => {
        const P = (a: number, b: number): [number, number] => [(a + BW / 2) / BW * w, (BH / 2 - b) / BH * h];
        const S = w / BW; // texture pixels per unit
        // Solder mask, with the ground pour under it a shade lighter.
        x.fillStyle = "#17532f"; x.fillRect(0, 0, w, h);
        x.fillStyle = "#1d6339"; x.beginPath(); x.roundRect(18, 18, w - 36, h - 36, 14); x.fill();
        // Traces, routed at 45°: each is cut out of the pour (the clearance), then laid in copper.
        const traces: [number, number][][] = [
          // MCU to the left header.
          [[.01, .03], [-.06, .03], [-.12, -.03], [-.39, -.03], [-.42, -.06]],
          [[.01, .0], [-.05, .0], [-.09, -.04], [-.09, -.1], [-.39, -.1], [-.42, -.13]],
          [[.01, -.03], [-.03, -.07], [-.03, -.16], [-.39, -.16], [-.42, -.19]],
          // MCU to the right header.
          [[.15, .06], [.26, .06], [.3, .1], [.39, .1], [.42, .13]],
          [[.15, .02], [.3, .02], [.34, -.02], [.39, -.02], [.42, -.05]],
          [[.15, -.02], [.26, -.02], [.29, -.05], [.29, -.11], [.39, -.11], [.42, -.14]],
          // MCU to the radio under the can (SPI).
          [[.04, .05], [.04, .09], [.0, .13], [-.03, .13]],
          [[.08, .05], [.08, .11], [.03, .16], [-.03, .16]],
          [[.12, .05], [.12, .13], [.07, .18], [.07, .21], [-.03, .21]],
          // USB to the MCU, as a pair.
          [[-.07, -.33], [-.07, -.26], [.03, -.16], [.03, -.09]],
          [[-.03, -.33], [-.03, -.27], [.07, -.17], [.07, -.09]],
          // To the LEDs and the buttons.
          [[.15, .04], [.22, .11], [.32, .11], [.33, .12]],
          [[.15, -.06], [.17, -.08], [.17, -.24]],
          [[.13, -.09], [.13, -.16], [.27, -.16], [.28, -.17], [.28, -.24]],
          // Regulator to the 3V3 rail and the test point.
          [[-.2, -.18], [-.2, -.22], [-.27, -.22]],
          [[-.24, -.12], [-.31, -.12], [-.36, -.07], [-.39, -.07]],
        ];
        const path = (pts: [number, number][]) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(...P(a, b)) : x.moveTo(...P(a, b)))); };
        x.lineCap = "round"; x.lineJoin = "round";
        for (const t of traces) { path(t); x.strokeStyle = "#17532f"; x.lineWidth = 15; x.stroke(); }
        for (const t of traces) { path(t); x.strokeStyle = "#36a463"; x.lineWidth = 8; x.stroke(); }
        // The 50 Ω RF line from the radio to the antenna connector, wide, fenced with ground vias.
        const rf: [number, number][] = [[-.04, .2], [.12, .2], [.18, .26], [.27, .26], [.3, .29], [.3, .33]];
        path(rf); x.strokeStyle = "#17532f"; x.lineWidth = 30; x.stroke();
        path(rf); x.strokeStyle = "#3aab68"; x.lineWidth = 14; x.stroke();
        const via = (a: number, b: number, r = 6) => {
          const [px, py] = P(a, b);
          x.fillStyle = "#c9a54b"; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
          x.fillStyle = "#0d2416"; x.beginPath(); x.arc(px, py, r * .45, 0, Math.PI * 2); x.fill();
        };
        for (let i = 0; i <= 8; i++) { const a = -.02 + i * .016; via(a, .245, 4.5); via(a, .155, 4.5); }
        [[.25, .3], [.22, .22], [.33, .27]].forEach(([a, b]) => via(a, b, 4.5));
        // Vias at the bends, and stitching the pour.
        for (const t of traces) { const [a, b] = t[t.length - 1]; if (Math.abs(a) < .38) via(a, b); }
        for (let a = -.36; a <= .37; a += .12) for (const b of [.31, -.3]) via(a, b, 4);
        // Pads: the QFN under the MCU, and the header rows down each side (pin 1 square).
        { const [cx, cy] = P(.08, -.02), half = .085 * S; x.fillStyle = "#d4b05a";
          for (let i = 0; i < 9; i++) { const o = -half * .8 + i * half * .2; x.fillRect(cx + o - 3, cy - half - 8, 6, 12); x.fillRect(cx + o - 3, cy + half - 4, 6, 12); x.fillRect(cx - half - 8, cy + o - 3, 12, 6); x.fillRect(cx + half - 4, cy + o - 3, 12, 6); } }
        for (const a of [-.45, .45]) for (let i = 0; i < 14; i++) {
          const [px, py] = P(a, .3 - i * .046);
          x.fillStyle = "#d4b05a"; if (i === 0) x.fillRect(px - 11, py - 11, 22, 22); else { x.beginPath(); x.arc(px, py, 11, 0, Math.PI * 2); x.fill(); }
          x.fillStyle = "#0b1a10"; x.beginPath(); x.arc(px, py, 5, 0, Math.PI * 2); x.fill();
        }
        // Mounting holes, plated.
        for (const [a, b] of [[-.455, .325], [.455, .325], [-.455, -.325], [.455, -.325]]) {
          const [px, py] = P(a, b); x.fillStyle = "#d4b05a"; x.beginPath(); x.arc(px, py, 19, 0, Math.PI * 2); x.fill();
          x.fillStyle = "#0b0b0b"; x.beginPath(); x.arc(px, py, 10, 0, Math.PI * 2); x.fill();
        }
        // Small parts (0603 resistors black, capacitors tan), with their tinned ends.
        const smd = (a: number, b: number, cap: boolean, vert = false) => {
          const [px, py] = P(a, b), lw = vert ? 10 : 20, lh = vert ? 20 : 10;
          x.fillStyle = cap ? "#b89468" : "#1e1e1e"; x.fillRect(px - lw / 2, py - lh / 2, lw, lh);
          x.fillStyle = "#cfd2d4";
          if (vert) { x.fillRect(px - lw / 2, py - lh / 2, lw, 4); x.fillRect(px - lw / 2, py + lh / 2 - 4, lw, 4); }
          else { x.fillRect(px - lw / 2, py - lh / 2, 4, lh); x.fillRect(px + lw / 2 - 4, py - lh / 2, 4, lh); }
        };
        ([[-.02, .07, true], [-.02, .04, true], [.18, .07, false], [.18, -.06, true, true], [.21, -.06, true, true], [.25, .14, false], [.25, .18, false],
          [-.13, -.24, true], [-.13, -.27, true], [-.27, -.27, true, true], [.0, -.22, false, true], [.11, -.22, false, true], [.36, .06, false], [-.33, .02, true, true]] as [number, number, boolean, boolean?][])
          .forEach(([a, b, c, v]) => smd(a, b, c, v));
        // The test point the probe hooks onto.
        via(-.3, -.22, 11);
        // Silkscreen: part outlines, designators, pin names, the board's name.
        x.strokeStyle = "#e9efe9"; x.fillStyle = "#e9efe9"; x.lineWidth = 2.5;
        const box = (a: number, b: number, bw: number, bh: number) => { const [px, py] = P(a - bw / 2, b + bh / 2); x.strokeRect(px, py, bw * S, bh * S); };
        box(-.17, .1, .3, .24); box(.08, -.02, .19, .19); box(-.05, -.355, .14, .07); box(.22, .02, .1, .06); box(-.2, -.15, .11, .1);
        box(.17, -.28, .09, .09); box(.28, -.28, .09, .09);
        for (const a of [-.45, .45]) box(a, -.003, .055, .66);
        { const [px, py] = P(.08 - .095, -.02 + .095); x.beginPath(); x.arc(px - 8, py - 8, 4, 0, Math.PI * 2); x.fill(); }
        x.font = `600 15px ${MONO}`;
        ([["U1", -.02, -.1], ["U2 SX1262", -.3, .245], ["Y1", .19, .07], ["U3", -.25, -.08], ["J1", .37, .31], ["J2 USB", -.15, -.3], ["RST", .14, -.36], ["BOOT", .24, -.36],
          ["TP1", -.36, -.25], ["TX", .39, .21], ["PWR", .39, .155], ["3V3", -.4, .335], ["GND", .36, .335]] as [string, number, number][])
          .forEach(([s, a, b]) => x.fillText(s, ...P(a, b)));
        x.font = `500 11px ${MONO}`;
        const pins = ["3V3", "GND", "IO1", "IO2", "IO3", "IO4", "SDA", "SCL", "TX", "RX", "A0", "A1", "EN", "VIN"];
        pins.forEach((s, i) => { const [lx, ly] = P(-.415, .3 - i * .046); x.fillText(s, lx, ly + 4); const [rx, ry] = P(.36, .3 - i * .046); x.fillText(pins[13 - i], rx, ry + 4); });
        x.font = `700 22px ${SANS}`; x.fillText("LoRa NODE", ...P(-.08, -.25)); x.font = `500 13px ${MONO}`; x.fillText("rev B  ·  868/915 MHz", ...P(-.08, -.285));
      });
      const pcbMat = std({ color: 0x2d4a32, roughness: .7 });
      const pcb = mesh(geo(new THREE.BoxGeometry(BW, .03, BH)), [pcbMat, pcbMat, pcbMat, std({ map: pcbTex, roughness: .42 }), pcbMat, pcbMat]);
      pcb.rotation.x = -.28; pcb.position.set(4.35, WY - .2, SH + .38); wall.add(pcb);
      // The parts on the board. Its front face is at y = -.015; each part sits on it.
      {
        const part = (g: THREE.BufferGeometry, m: THREE.Material, a: number, depth: number, b: number) => {
          const p = mesh(geo(g), m, false); p.position.set(a, -.015 - depth / 2, b); pcb.add(p); return p;
        };
        const black = std({ color: 0x151515, roughness: .45 }), gold = std({ color: 0xd4aa52, roughness: .3, metalness: .9 });
        part(new THREE.BoxGeometry(.14, .012, .14), black, .08, .012, -.02); // MCU
        part(new THREE.BoxGeometry(.28, .03, .22), metal, -.17, .03, .1); // the radio's shield can
        part(new THREE.BoxGeometry(.24, .002, .18), std({ color: 0xb9bdc2, roughness: .45, metalness: .8 }), -.17, .032, .1); // its lid, a touch duller
        part(new RoundedBoxGeometry(.08, .02, .035, 2, .008), metal, .22, .02, .02); // crystal
        part(new THREE.BoxGeometry(.07, .016, .06), black, -.2, .016, -.15); // regulator
        part(new THREE.BoxGeometry(.06, .006, .022), metal, -.2, .006, -.105); // its tab
        part(new RoundedBoxGeometry(.1, .034, .06, 2, .012), metal, -.05, .034, -.345); // USB-C
        for (const a of [.17, .28]) { part(new THREE.BoxGeometry(.07, .022, .07), metal, a, .022, -.28); part(new THREE.CylinderGeometry(.018, .018, .02, 16), black, a, .062, -.28); }
        // The antenna connector at the top edge: a gold SMA, standing up.
        const sma = new THREE.Group(); sma.position.set(.3, -.04, .36); pcb.add(sma);
        const hex = mesh(geo(new THREE.CylinderGeometry(.034, .034, .03, 6)), gold, false); hex.rotation.x = Math.PI / 2; hex.position.z = .015; sma.add(hex);
        const barrel = mesh(geo(new THREE.CylinderGeometry(.022, .022, .07, 20)), gold, false); barrel.rotation.x = Math.PI / 2; barrel.position.z = .065; sma.add(barrel);
        // Pin headers down each side: the black strip, and the pins through it (one instanced mesh).
        const pinGeo = geo(new THREE.BoxGeometry(.008, .07, .008));
        const pinsMesh = new THREE.InstancedMesh(pinGeo, gold, 28); const m4 = new THREE.Matrix4();
        [-.45, .45].forEach((a, s) => {
          part(new THREE.BoxGeometry(.034, .03, .65), black, a, .03, -.003);
          for (let i = 0; i < 14; i++) pinsMesh.setMatrixAt(s * 14 + i, m4.makeTranslation(a, -.05, .3 - i * .046));
        });
        pcb.add(pinsMesh);
        // The test point: a wire loop for the probe's hook.
        const loop = mesh(geo(new THREE.TorusGeometry(.016, .0035, 6, 18)), metal, false); loop.position.set(-.3, -.03, -.205); loop.rotation.y = Math.PI / 2; pcb.add(loop);
        // The power LED, always on.
        part(new THREE.BoxGeometry(.04, .02, .025), new THREE.MeshBasicMaterial({ color: 0x39ff6a, toneMapped: false }), .36, .02, .14);
      }
      // No room for the dev board or the antenna on a phone's shelf.
      pcb.visible = !phone;
      // The scope's channel 1 probe: a lead from its BNC, looping down over the shelf's edge and back up
      // to a probe hooked onto the board's lower edge. Desktop only, like the board.
      if (!phone) {
        scope.updateMatrix(); pcb.updateMatrix();
        const inScope = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c).applyMatrix4(scope.matrix);
        const onBoard = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c).applyMatrix4(pcb.matrix);
        const clip = onBoard(-.3, -.02, -.22), out = new THREE.Vector3(0, -.85, -.45).normalize();
        const tail = clip.clone().addScaledVector(out, .26);
        const plug = inScope(.37, -.39, .12);
        const lead = new THREE.CatmullRomCurve3([
          plug, inScope(.37, -.47, .1), inScope(.42, -.55, -.12), inScope(.62, -.5, -.42),
          new THREE.Vector3(tail.x - .35, WY - .82, SH - .3), new THREE.Vector3(tail.x - .12, WY - .74, SH - .02),
          new THREE.Vector3(tail.x - .05, WY - .64, SH + .03), tail.clone().addScaledVector(out, .05), tail,
        ]);
        const leadMat = std({ color: 0x1b1c1e, roughness: .6 });
        wall.add(mesh(geo(new THREE.TubeGeometry(lead, 120, .013, 8)), leadMat));
        // The cable's BNC plug on the scope, with its strain relief.
        const plugG = new THREE.Group(); plugG.position.copy(plug); wall.add(plugG);
        const shell = mesh(geo(new THREE.CylinderGeometry(.031, .031, .05, 24)), metal); shell.position.y = .02; plugG.add(shell);
        const boot = mesh(geo(new THREE.CylinderGeometry(.016, .026, .06, 16)), leadMat); boot.position.y = -.03; plugG.add(boot);
        // The probe: a grey body with a coloured band, and a sprung hook at the tip.
        const probe = new THREE.Group(); probe.position.copy(tail); probe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), out.clone().negate()); wall.add(probe);
        const pBody = mesh(geo(new THREE.CylinderGeometry(.024, .02, .2, 20)), std({ color: 0x5c6066, roughness: .45 })); pBody.position.y = .1; probe.add(pBody);
        const band = mesh(geo(new THREE.CylinderGeometry(.0245, .0245, .02, 20)), std({ color: 0xffd23a, roughness: .5 })); band.position.y = .05; probe.add(band);
        const nose = mesh(geo(new THREE.CylinderGeometry(.01, .018, .05, 16)), std({ color: 0x2a2c2f, roughness: .5 })); nose.position.y = .225; probe.add(nose);
        const hook = mesh(geo(new THREE.TorusGeometry(.012, .003, 6, 16, Math.PI * 1.4)), metal); hook.position.y = .255; hook.rotation.y = Math.PI / 2; probe.add(hook);
      }
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x3a0d08, toneMapped: false });
      const led = new THREE.Mesh(geo(new THREE.BoxGeometry(.04, .02, .025)), ledMat); led.position.set(.36, -.025, .2); pcb.add(led);
      let blink = 0;
      gadgets.push({
        obj: pcb, hint: "Click to flash it",
        press() { blink = 2.4; },
        update(dt) { blink = Math.max(0, blink - dt); ledMat.color.setHex(blink > 0 && Math.floor(blink * 6) % 2 === 0 ? 0xff3b1f : 0x3a0d08); return blink > 0; },
      });
      // An antenna on a small base: it springs side to side.
      const abase = mesh(geo(new THREE.BoxGeometry(.32, .32, .14)), std({ color: 0x222222, roughness: .5 })); abase.position.set(5.3, WY - .4, SH + .07); wall.add(abase); abase.visible = !phone;
      const mast = new THREE.Group(); mast.position.set(5.3, WY - .4, SH + .14); wall.add(mast); mast.visible = !phone;
      const rod = mesh(geo(new THREE.CylinderGeometry(.014, .02, 1.3, 10)), std({ color: 0x1a1a1a, roughness: .4 })); rod.rotation.x = Math.PI / 2; rod.position.z = .65; mast.add(rod);
      const tip = mesh(geo(new THREE.SphereGeometry(.035, 12, 8)), std({ color: 0x1a1a1a, roughness: .4 })); tip.position.z = 1.3; mast.add(tip);
      gadgets.push(swinger(mast, "Click to twang it", { k: 60, damp: 1.4, kick: 7 }));
      // A plant: its leaves sway when touched.
      const pot = mesh(geo(new THREE.CylinderGeometry(.2, .15, .34, 24)), std({ color: 0xc46f35, roughness: .7 })); pot.rotation.x = Math.PI / 2; pot.position.set(phone ? 1.15 : 6.2, WY - .4, SH + .17); wall.add(pot);
      const crown = new THREE.Group(); crown.position.set(phone ? 1.15 : 6.2, WY - .4, SH + .32); wall.add(crown);
      const leafMat = std({ color: 0x4d6b36, roughness: .7 });
      for (let i = 0; i < 7; i++) {
        const leaf = mesh(geo(new THREE.SphereGeometry(.16, 12, 8)), leafMat); leaf.scale.set(.55, .55, 1.6);
        const a = i / 7 * Math.PI * 2; leaf.rotation.set(Math.cos(a) * .5, Math.sin(a) * .5, 0);
        leaf.position.set(Math.cos(a) * .1, Math.sin(a) * .1, .2); crown.add(leaf);
      }
      gadgets.push(swinger(crown, "Click to ruffle it", { k: 22, damp: 2, kick: 3 }));
      // A clock over the middle, telling the real time; a click sends its hands round once.
      const clock = new THREE.Group(); clock.position.set(phone ? -1.1 : .9, WY - .08, phone ? 3.35 : 2.95); clock.rotation.x = Math.PI / 2; wall.add(clock);
      const dial = tex(256, 256, (x, w) => {
        x.fillStyle = "#fbf6ec"; x.beginPath(); x.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#2a2420";
        for (let i = 0; i < 12; i++) { x.save(); x.translate(w / 2, w / 2); x.rotate(i / 12 * Math.PI * 2); x.fillRect(-3, -w / 2 + 12, 6, i % 3 ? 14 : 26); x.restore(); }
      });
      clock.add(mesh(geo(new THREE.CircleGeometry(.5, 48)), std({ map: dial, roughness: .6 }), false));
      const rim = mesh(geo(new THREE.TorusGeometry(.52, .045, 12, 48)), std({ color: 0x1d1d1d, roughness: .4 })); clock.add(rim);
      const hand = (len: number, w: number) => { const g = new THREE.Group(); const m = new THREE.Mesh(geo(new THREE.PlaneGeometry(w, len)), new THREE.MeshBasicMaterial({ color: 0x1d1a18 })); m.position.set(0, len / 2 - .04, .01); g.add(m); clock.add(g); return g; };
      clockHands = { h: hand(.28, .045), m: hand(.4, .03) };
      gadgets.push({
        obj: clock, hint: "Click to wind it",
        press() { clockSpin += Math.PI * 2; },
        update(dt) {
          if (!clockHands) return false;
          clockSpin = Math.max(0, clockSpin - dt * Math.max(1.5, clockSpin * 2.2));
          const now = new Date(), m = now.getMinutes() + now.getSeconds() / 60, h = (now.getHours() % 12) + m / 60;
          clockHands.m.rotation.z = -m / 60 * Math.PI * 2 - clockSpin * 12; clockHands.h.rotation.z = -h / 12 * Math.PI * 2 - clockSpin;
          return clockSpin > 0;
        },
      });
    }
    // Everything on the wall is built at desk scale; real bench gear is bigger than a mug, so it is all
    // scaled up together about the foot of the wall (the plaster and skirting stay as they are).
    {
      const GS = 1.35, rig = new THREE.Group();
      [...wall.children].slice(2).forEach((c) => rig.add(c));
      rig.scale.setScalar(GS); rig.position.set(0, WY * (1 - GS), -.55); wall.add(rig);
    }
    freezeWall();
    return wall;
  }
  // The gadget under a ray, while the wall is up.
  const gadgetAt = (ray: THREE.Ray) => {
    if (wallRise.v < .95) return null;
    raycaster.ray.copy(ray);
    let best: Gadget | null = null, bestD = Infinity;
    const shown = (o: THREE.Object3D | null): boolean => !o || (o.visible && shown(o.parent));
    for (const g of gadgets) { if (!shown(g.obj)) continue; const hit = raycaster.intersectObject(g.obj, true)[0]; if (hit && hit.distance < bestD) { bestD = hit.distance; best = g; } }
    return best;
  };
  let hovered: Gadget | null = null;

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
    let playing = false;
    if (wall.visible) for (const g of gadgets) playing = g.update(dt) || playing;
    const flipping = eraser?.update(dt) ?? false;
    return moving || flipping || paging || rippling || playing || pointer.on || (enterT >= 0 && enterT < 3);
  }

  return {
    group,
    loaded: Promise.all(arrivals).then(() => {}),
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
      eraser?.enter();
      for (const t of tools) if (t.enter) { t.x = t.hx + t.enter.dx; t.y = t.hy + t.enter.dy; t.vx = t.vy = t.va = 0; t.held = true; }
      notebook?.enter();
    },
    over: (ray) => ((notebookOn && notebook?.over(ray)) || mug?.over(ray) || eraser?.hit(ray) || !!gadgetAt(ray)) ?? false,
    hint(ray) {
      const n = notebookOn ? notebook?.hint(ray) : null; if (n) return n;
      if (mug?.over(ray)) return "Click to stir";
      if (eraser?.hit(ray)) return "Click to flip";
      const g = gadgetAt(ray); if (g) return g.hint;
      raycaster.ray.copy(ray);
      for (const t of tools) if (t.hint && raycaster.intersectObject(t.group, true).length) return t.hint;
      return null;
    },
    mugTop: () => mug?.top() ?? null,
    book: (state) => notebook?.book(state),
    // The wall (and the hologram) are shown for a compile and then put back exactly as they were: the
    // compile can run while More work is on screen (opened straight at #more-work), and forcing them
    // hidden then left the wall gone for good.
    prewarm(on, holo = on) {
      if (on) { wallWas = wall.visible; wall.visible = true; if (holo) notebook?.prewarm(true); }
      else { wall.visible = wallWas; notebook?.prewarm(false); }
    },
    buildWall,
    setWall(rise) {
      if (Math.abs(rise - wallRise.v) < .0005) return;
      wallRise.v = rise;
      // Reached before it was built on approach (a jump straight to More work): build it now.
      if (rise > .002) buildWall();
      wall.visible = rise > .002;
      // The wall stands still; only the camera moves. It is simply there from the moment the camera
      // starts to come down (from straight overhead it would only block the view, so it is off then).
      if (wallRise.light) wallRise.light.intensity = rise * 9;
      for (const g of gadgets) g.update(0);
    },
    setMoreWork: (list) => notebook?.setMoreWork(list),
    press: (ray) => {
      if ((notebookOn && notebook?.press(ray)) || mug?.press(ray) || eraser?.press(ray)) return true;
      const g = gadgetAt(ray); if (g) { g.press(); return true; }
      return false;
    },
    hover(ray) {
      if (notebookOn) notebook?.hover(ray);
      // Moving onto a gadget nudges it once.
      const g = ray ? gadgetAt(ray) : null;
      if (g && g !== hovered) g.hover?.();
      hovered = g;
      if (!ray) { pointer.on = false; return; }
      raycaster.ray.copy(ray); if (!raycaster.ray.intersectPlane(plane, hitPoint)) return;
      const now = performance.now() / 1000, dt = Math.min(.1, Math.max(.001, now - pointer.t));
      if (pointer.on) { pointer.vx = (hitPoint.x - pointer.x) / dt; pointer.vy = (hitPoint.y - pointer.y) / dt; }
      pointer.x = hitPoint.x; pointer.y = hitPoint.y; pointer.t = now; pointer.on = true;
    },
  };
}
