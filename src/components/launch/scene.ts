import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/**
 * The launch scene: YOSSI-1 on a desk, then lifted into a spotlight, turned under a thermal camera,
 * and set back down. Everything is derived from scroll position each frame, so scrolling back
 * reverses it exactly. Sections are found by id; any that are missing are simply skipped.
 */
export interface LaunchScene {
  press: () => void;
  dispose: () => void;
}

export interface SceneHooks {
  /** Called with a short message when a gag wants to say something. */
  say?: (message: string) => void;
  /** Called whenever the device's button is pressed, with the running total. */
  onPress?: (count: number) => void;
  /** The scene decides which backdrop the page should show behind it. */
  onBackdrop?: (backdrop: "desk" | "void" | "thermal") => void;
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Hand the main thread back between setup stages so no single task blocks input or paint for long. */
const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function createLaunchScene(canvas: HTMLCanvasElement, hooks: SceneHooks = {}, signal?: AbortSignal): Promise<LaunchScene | null> {
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" }); }
  catch { return null; }

  // Loop state lives up here: resize() and the font callback can call kick() during setup.
  let last = performance.now(), time = 0, lastBackdrop = "", raf = 0, idleFrames = 0, disposed = false;
  const small = () => innerWidth <= 720;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  // next/font hashes family names, so the canvas has to ask the page what they are.
  const rootStyle = getComputedStyle(document.documentElement);
  const SANS = rootStyle.getPropertyValue("--font-figtree").trim() || "sans-serif";
  const MONO = rootStyle.getPropertyValue("--font-jetbrains").trim() || "monospace";

  // Phones get half-size textures and a smaller shadow map; the scene reads the same at that size.
  const TEX = small() ? .5 : 1;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small() ? 1.25 : 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  camera.position.set(0, 0, 12);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTarget = pmrem.fromScene(room, .04);
  room.dispose(); pmrem.dispose();
  scene.environment = envTarget.texture;
  scene.environmentIntensity = .35;

  // Everything created here is tracked so dispose() can release it.
  const disposables: { dispose: () => void }[] = [envTarget];
  const keep = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };

  const sun = new THREE.DirectionalLight(0xffe0bd, 3.2);
  sun.position.set(-5, 6, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(small() ? 1024 : 2048, small() ? 1024 : 2048);

  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 6, bottom: -6, near: 1, far: 30 });
  sun.shadow.bias = -.0004; sun.shadow.radius = 6;
  scene.add(sun, new THREE.HemisphereLight(0xfff1e0, 0x2a1a10, .7));
  const spot = new THREE.SpotLight(0xffd9b0, 0, 30, .45, .8, 1.2);
  spot.position.set(2, 5, 10); scene.add(spot, spot.target);

  function tex(w: number, h: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d")!, w, h);
    const t = keep(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }
  const std = (p: THREE.MeshStandardMaterialParameters) => keep(new THREE.MeshStandardMaterial(p));
  const phys = (p: THREE.MeshPhysicalMaterialParameters) => keep(new THREE.MeshPhysicalMaterial(p));
  const geo = <T extends THREE.BufferGeometry>(g: T) => keep(g);
  function mesh(g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], cast = true) {
    const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o;
  }

  const abandon = () => { disposables.forEach((d) => d.dispose()); renderer.dispose(); return null; };
  await yieldToMain(); if (signal?.aborted) return abandon();

  /* ---------- The desk ---------- */
  const desk = new THREE.Group(); scene.add(desk);
  let seed = 11;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const wood = tex(1024 * TEX, 1024 * TEX, (x, w, h) => {
    x.scale(TEX, TEX); w /= TEX; h /= TEX;
    x.fillStyle = "#7a4a2a"; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const y = rnd() * h;
      x.strokeStyle = `rgba(${40 + rnd() * 40},${20 + rnd() * 20},10,${.08 + rnd() * .12})`;
      x.lineWidth = 1 + rnd() * 3; x.beginPath(); x.moveTo(0, y);
      for (let px = 0; px <= w; px += 32) x.lineTo(px, y + Math.sin(px / 90 + i) * 6);
      x.stroke();
    }
  });
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(2, 2);
  const table = mesh(geo(new THREE.PlaneGeometry(40, 26)), std({ map: wood, roughness: .7 }), false);
  table.position.z = -.06; desk.add(table);

  const MAT_W = 11.2, MAT_H = 7.4;
  const matTex = tex(2240 * TEX, 1480 * TEX, (x, w, h) => {
    x.scale(TEX, TEX); w /= TEX; h /= TEX;
    x.fillStyle = "#2c574a"; x.fillRect(0, 0, w, h);
    const cm = w / 56;
    for (let i = 0; i * cm <= w; i++) { x.strokeStyle = i % 5 ? "rgba(225,240,230,.16)" : "rgba(225,240,230,.34)"; x.lineWidth = i % 5 ? 1.2 : 2.2; x.beginPath(); x.moveTo(i * cm, 0); x.lineTo(i * cm, h); x.stroke(); }
    for (let j = 0; j * cm <= h; j++) { x.strokeStyle = j % 5 ? "rgba(225,240,230,.16)" : "rgba(225,240,230,.34)"; x.lineWidth = j % 5 ? 1.2 : 2.2; x.beginPath(); x.moveTo(0, j * cm); x.lineTo(w, j * cm); x.stroke(); }
    x.fillStyle = "rgba(230,240,232,.7)"; x.font = `22px ${MONO}`;
    for (let i = 5; i * cm < w; i += 5) { x.fillText(String(i), i * cm + 6, 26); x.fillText(String(i), i * cm + 6, h - 12); }
    x.strokeStyle = "rgba(230,240,232,.3)"; x.lineWidth = 2;
    x.beginPath(); x.arc(w * .82, h * .72, h * .16, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.moveTo(w * .1, h * .9); x.lineTo(w * .3, h * .55); x.stroke();
    x.font = `700 26px ${SANS}`; x.fillText("YOSSI-1 · CUTTING MAT · DO NOT SHIP BUGS", 30, h - 46);
  });
  const matSide = std({ color: 0x244a3e, roughness: .9 });
  const mat = mesh(geo(new RoundedBoxGeometry(MAT_W, MAT_H, .05, 2, .02)), [matSide, matSide, matSide, matSide, std({ map: matTex, roughness: .85 }), matSide], false);
  mat.position.set(.9, -.1, -.03); desk.add(mat);

  { // Pencil
    const g = new THREE.Group();
    g.add(mesh(geo(new THREE.CylinderGeometry(.11, .11, 4.2, 6)), std({ color: 0x5b6b3f, roughness: .45 })));
    const tip = mesh(geo(new THREE.ConeGeometry(.11, .45, 6)), std({ color: 0xd9b384, roughness: .8 })); tip.position.y = 2.32; g.add(tip);
    const lead = mesh(geo(new THREE.ConeGeometry(.035, .14, 12)), std({ color: 0x222222, roughness: .4, metalness: .3 })); lead.position.y = 2.6; g.add(lead);
    const ferrule = mesh(geo(new THREE.CylinderGeometry(.115, .115, .3, 24)), std({ color: 0xc9c2b3, metalness: 1, roughness: .3 })); ferrule.position.y = -2.2; g.add(ferrule);
    const rubber = mesh(geo(new THREE.CylinderGeometry(.11, .11, .22, 24)), std({ color: 0xd98a7a, roughness: .8 })); rubber.position.y = -2.45; g.add(rubber);
    g.rotation.z = .62; g.position.set(4.3, 2.2, .12); desk.add(g);
  }
  { // Utility knife
    const g = new THREE.Group();
    g.add(mesh(geo(new RoundedBoxGeometry(3.1, .46, .2, 3, .08)), std({ color: 0xe0852f, roughness: .45 })));
    const grip = mesh(geo(new RoundedBoxGeometry(1.5, .3, .22, 3, .06)), std({ color: 0x2a2320, roughness: .8 })); grip.position.x = -.5; g.add(grip);
    const blade = mesh(geo(new THREE.BoxGeometry(.9, .3, .02)), std({ color: 0xdadada, metalness: 1, roughness: .2 })); blade.position.x = 1.95; g.add(blade);
    const slider = mesh(geo(new RoundedBoxGeometry(.3, .16, .1, 2, .03)), std({ color: 0xcfc8bb, metalness: .8, roughness: .3 })); slider.position.set(.6, 0, .14); g.add(slider);
    g.rotation.z = .55; g.position.set(4.6, -2.6, .12); desk.add(g);
  }
  { // Paperclips
    const pts = [[0, -.5], [0, .45], [.26, .45], [.26, -.62], [-.08, -.62], [-.08, .3], [.16, .3], [.16, -.35]];
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(pts[i][0], pts[i][1], 0), new THREE.Vector3(pts[i + 1][0], pts[i + 1][1], 0)));
    const clipGeo = geo(new THREE.TubeGeometry(path, 64, .022, 8, false));
    const steel = std({ color: 0xd9d6cf, metalness: 1, roughness: .25 });
    const a = mesh(clipGeo, steel); a.position.set(-4.9, 2.4, .03); a.rotation.z = .9; desk.add(a);
    const b = mesh(clipGeo, steel); b.position.set(-4.3, 1.9, .03); b.rotation.z = -.4; desk.add(b);
  }
  { // Eraser
    const e = mesh(geo(new RoundedBoxGeometry(.9, .55, .3, 3, .08)), std({ color: 0xf1ede4, roughness: .9 }));
    e.position.set(-4.6, -2.7, .15); e.rotation.z = .3; desk.add(e);
  }
  { // Sticky note
    const note = tex(512, 512, (x) => {
      x.fillStyle = "#efe2c4"; x.fillRect(0, 0, 512, 512); x.fillStyle = "#3a2c22"; x.font = `600 44px ${SANS}`;
      ["TODO", "✓ find the slow part", "✓ build the fix", "✓ ship it", "☐ say hi"].forEach((l, i) => x.fillText(l, 40, 90 + i * 78));
    });
    const edge = std({ color: 0xe6d6b4 });
    const n = mesh(geo(new THREE.BoxGeometry(1.7, 1.7, .01)), [edge, edge, edge, edge, std({ map: note, roughness: .9 }), edge]);
    n.position.set(-3.6, -.6, .02); n.rotation.z = -.12; desk.add(n);
  }

  // The veil darkens the desk into the spotlit room; its edges match the page backdrop exactly.
  const veilTex = tex(512, 512, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 2);
    g.addColorStop(0, "#3a271b"); g.addColorStop(.55, "#1d1410"); g.addColorStop(1, "#17110e");
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  const veilMat = keep(new THREE.MeshBasicMaterial({ map: veilTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  const veil = new THREE.Mesh(geo(new THREE.PlaneGeometry(60, 40)), veilMat);
  veil.position.z = .3; veil.renderOrder = 1; scene.add(veil);

  await yieldToMain(); if (signal?.aborted) return abandon();

  /* ---------- The device ---------- */
  const device = new THREE.Group(); scene.add(device);
  const W = 3, H = 1.9, D = .75, FRONT = D / 2;
  const shell = phys({ color: 0xe9dfcf, roughness: .5, clearcoat: .3 });
  const accent = phys({ color: 0xc46f35, roughness: .4, clearcoat: .4 });
  const dark = phys({ color: 0x2a221c, roughness: .5 });
  const olive = phys({ color: 0x4d5a36, roughness: .45, clearcoat: .5 });
  const glass = phys({ color: 0x0c0a09, roughness: .1, clearcoat: 1 });
  device.add(mesh(geo(new RoundedBoxGeometry(W, H, D, 6, .22)), shell));
  const sc = document.createElement("canvas"); sc.width = 640; sc.height = 384;
  const sx = sc.getContext("2d")!;
  const screenTex = keep(new THREE.CanvasTexture(sc)); screenTex.colorSpace = THREE.SRGBColorSpace;
  const bezel = mesh(geo(new RoundedBoxGeometry(1.86, 1.16, .04, 3, .06)), glass); bezel.position.set(-.45, .14, FRONT); device.add(bezel);
  const screenMat = keep(new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  const screen = new THREE.Mesh(geo(new THREE.PlaneGeometry(1.72, 1.03)), screenMat); screen.position.set(-.45, .14, FRONT + .023); device.add(screen);
  const knob = new THREE.Group(); knob.position.set(.95, .38, FRONT); device.add(knob);
  const knobBody = mesh(geo(new THREE.CylinderGeometry(.27, .29, .24, 64)), accent); knobBody.rotation.x = Math.PI / 2; knobBody.position.z = .12; knob.add(knobBody);
  const notch = new THREE.Mesh(geo(new THREE.BoxGeometry(.035, .14, .01)), dark); notch.position.set(0, .15, .245); knob.add(notch);
  const button = mesh(geo(new THREE.CylinderGeometry(.22, .22, .14, 64)), olive); button.rotation.x = Math.PI / 2; button.position.set(.95, -.46, FRONT + .07); device.add(button);
  const grille = new THREE.InstancedMesh(geo(new THREE.CircleGeometry(.018, 10)), dark, 60); const m4 = new THREE.Object3D();
  for (let i = 0; i < 60; i++) { m4.position.set(-1.28 + (i % 20) * .088, -.62 - Math.floor(i / 20) * .085, FRONT + .002); m4.updateMatrix(); grille.setMatrixAt(i, m4.matrix); }
  device.add(grille);
  const labelTex = tex(512, 64, (x) => { x.fillStyle = "#8a7c6a"; x.font = `800 34px ${SANS}`; x.fillText("YOSSI-1", 0, 44); x.font = `400 20px ${MONO}`; x.fillText("MODEL YA-26", 200, 43); });
  const label = new THREE.Mesh(geo(new THREE.PlaneGeometry(1.2, .15)), keep(new THREE.MeshBasicMaterial({ transparent: true, map: labelTex })));
  label.position.set(-.73, -.82, FRONT + .002); device.add(label);
  const deviceMeshes: THREE.Mesh[] = [];
  device.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== screen && o !== label) deviceMeshes.push(o as THREE.Mesh); });
  const originals = new Map(deviceMeshes.map((o) => [o, o.material]));

  // Thermal camera: facing and distance from the core, mapped through an ironbow ramp.
  const thermal = keep(new THREE.ShaderMaterial({
    uniforms: { uHeat: { value: 1 }, uTime: { value: 0 } },
    vertexShader: "varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = (modelMatrix * vec4(position,1.)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
    fragmentShader: `uniform float uHeat, uTime; varying vec3 vN; varying vec3 vP;
    vec3 ramp(float t){ t = clamp(t,0.,1.);
      vec3 a = vec3(.10,.03,.25), b = vec3(.55,.07,.55), c = vec3(.92,.22,.18), d = vec3(1.,.66,.16), e = vec3(1.,.96,.72);
      return t < .25 ? mix(a,b,t/.25) : t < .5 ? mix(b,c,(t-.25)/.25) : t < .75 ? mix(c,d,(t-.5)/.25) : mix(d,e,(t-.75)/.25); }
    void main(){ float facing = max(vN.z, 0.); float core = 1. - clamp(length(vP.xy) / 2.2, 0., 1.);
      float t = uHeat * (.35 + .45 * core + .25 * facing) + .12 * facing + .015 * sin(vP.y * 9. + uTime * 2.);
      gl_FragColor = vec4(ramp(t), 1.); }`,
  }));
  let thermalOn = false;
  const setThermal = (on: boolean) => {
    if (on === thermalOn) return; thermalOn = on;
    deviceMeshes.forEach((o) => { o.material = on ? thermal : originals.get(o)!; });
  };

  /* ---------- Screen ---------- */
  const scr = { mode: "boot" as "boot" | "msg" | "heat", text: "", cursor: true };
  let presses = 0, pressT = 0;
  function drawScreen() {
    const x = sx; x.fillStyle = "#0e0b09"; x.fillRect(0, 0, 640, 384);
    x.fillStyle = "#a08c78"; x.font = `400 18px ${MONO}`; x.fillText("YOSSI-1  ·  FW 2.1", 22, 38);
    x.fillStyle = "#f2e6d4"; x.font = `800 58px ${SANS}`;
    (scr.mode === "boot" ? "READY" : scr.text).split("\n").forEach((l, i) => x.fillText(l, 22, 170 + i * 64));
    if (scr.cursor) x.fillRect(22, 300, 26, 6);
    x.fillStyle = "#a08c78"; x.font = `400 18px ${MONO}`;
    x.fillText(scr.mode === "boot" ? "PRESS THE BUTTON  ●" : `SHIPPED: ${presses}`, 22, 356);
    screenTex.needsUpdate = true;
  }
  const show = (mode: typeof scr.mode, text = "") => { scr.mode = mode; scr.text = text; drawScreen(); };
  drawScreen();
  document.fonts?.ready.then(() => { if (!disposed) drawScreen(); });
  const LINES = ["SHIPPING…", "BUILT\nEND TO END", "3 DAYS\n→ 8 MIN", "NO TOAST\nWAS HARMED", "READY"];
  function press() {
    presses++; pressT = 1;
    let t = LINES[(presses - 1) % LINES.length];
    if (presses === 8) t = "YOU CAN\nSTOP NOW";
    if (presses === 13) t = "FINE.\nKEEP GOING";
    if (presses === 25) { t = "ACHIEVEMENT:\nPERSISTENT"; hooks.say?.("25 presses. Same energy goes into debugging."); }
    show("msg", t);
    hooks.onPress?.(presses);
    kick();
  }

  /* ---------- Scroll choreography ---------- */
  const byId = (id: string) => document.getElementById(id);
  const prog = (el: HTMLElement | null) => { if (!el) return 0; const r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight)); };
  const rect = (el: HTMLElement | null) => el?.getBoundingClientRect() ?? { top: Infinity, bottom: Infinity } as DOMRect;
  const heat = byId("launch-heat") as HTMLInputElement | null;
  let heatManual = false;
  const onHeat = () => { heatManual = true; kick(); };
  heat?.addEventListener("input", onHeat);

  type Pose = { x: number; y: number; z: number; rx: number; ry: number; rz: number; s: number; veil: number; spot: number; show: number };
  const cur: Pose = { x: 0, y: 0, z: FRONT, rx: 0, ry: 0, rz: 0, s: small() ? .72 : 1, veil: 0, spot: 0, show: 1 };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e: PointerEvent) => { pointer.tx = e.clientX / innerWidth * 2 - 1; pointer.ty = e.clientY / innerHeight * 2 - 1; kick(); };
  addEventListener("pointermove", onPointer, { passive: true });

  function choreograph() {
    const intro = byId("intro"), ships = byId("ships"), work = byId("work"), therm = byId("thermal"), pressSec = byId("press"), after = byId("changelog");
    const vh = innerHeight, mob = small(), base = mob ? .72 : 1;
    const t: Pose = { x: 0, y: 0, z: FRONT, rx: 0, ry: 0, rz: 0, s: base, veil: 0, spot: 0, show: 1 };
    let backdrop: "desk" | "void" | "thermal" = "desk", thermalMode = false;
    if (rect(intro).top > 0) {
      // On the desk.
    } else if (rect(ships).top > 0) {
      const p = prog(intro);
      t.veil = smooth(0, .3, p); t.spot = t.veil;
      t.z = lerp(FRONT, 2.4, smooth(.05, .5, p)); t.rx = lerp(0, -.35, smooth(.1, .6, p));
      t.ry = lerp(0, Math.PI * 2 - .5, smooth(.1, 1, p)); t.rz = lerp(0, .08, p); t.s = base * lerp(1, .92, p);
      backdrop = p > .3 ? "void" : "desk";
      intro?.querySelectorAll<HTMLElement>("[data-fade]").forEach((el) => el.toggleAttribute("data-off", p < .35));
    } else if (rect(work).top > vh * .2) {
      const p = prog(ships);
      t.veil = 1; t.spot = 1; t.z = 2.4; t.rx = -.35 + Math.sin(p * Math.PI) * .2; t.ry = -.5 + p * Math.PI; t.rz = .08; t.s = mob ? .62 : .92;
      t.show = 1 - smooth(.82, .98, p); backdrop = "void";
    } else if (rect(therm).top > vh * .4) {
      t.veil = 1; t.show = 0; t.z = 2.4; t.s = .2; backdrop = "void";
    } else if (rect(pressSec).top > vh * .4) {
      const p = prog(therm); thermalMode = true; backdrop = "thermal";
      t.veil = 1; t.z = 2; t.rx = -.25; t.ry = -.6 + p * 1.4; t.rz = .05; t.s = mob ? .66 : .95;
      if (heat && !heatManual) heat.value = String(Math.round(smooth(.15, .85, p) * 100));
    } else {
      const p = prog(pressSec);
      t.veil = 1 - smooth(0, .3, p); t.spot = t.veil;
      t.z = lerp(2.2, FRONT, smooth(0, .35, p)); t.rx = lerp(-.3, 0, smooth(0, .35, p)); t.ry = lerp(.8, 0, smooth(0, .35, p));
      backdrop = t.veil > .5 ? "void" : "desk";
    }
    if (rect(after).top < vh * .6) t.show = 0;
    return { t, backdrop, thermalMode };
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.fov = small() ? 44 : 30; camera.updateProjectionMatrix();
    kick();
  }
  addEventListener("resize", resize); resize();

  function frame(now: number) {
    raf = 0;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const still = reduce.matches;
    if (!still) time += dt;
    const { t, backdrop, thermalMode } = choreograph();
    if (backdrop !== lastBackdrop) { lastBackdrop = backdrop; hooks.onBackdrop?.(backdrop); }
    const k = still ? 1 : 1 - Math.exp(-dt * 5);
    let moving = 0;
    (Object.keys(cur) as (keyof Pose)[]).forEach((key) => { const next = lerp(cur[key], t[key], k); moving += Math.abs(next - cur[key]); cur[key] = next; });
    pointer.x = lerp(pointer.x, pointer.tx, 1 - Math.exp(-dt * 4)); pointer.y = lerp(pointer.y, pointer.ty, 1 - Math.exp(-dt * 4));
    moving += Math.abs(pointer.tx - pointer.x) + Math.abs(pointer.ty - pointer.y);
    const lifted = clamp((cur.z - FRONT) / 1.5);
    device.position.set(cur.x, cur.y + (still ? 0 : Math.sin(time * 1.2) * .04 * lifted), cur.z);
    device.rotation.set(cur.rx + pointer.y * .12 * (.3 + lifted), cur.ry + pointer.x * .25 * (.3 + lifted), cur.rz);
    device.scale.setScalar(Math.max(.0001, cur.s * cur.show));
    device.visible = cur.show > .02;
    veilMat.opacity = cur.veil;
    // Fully dark: drop the veil and the desk, so the canvas is transparent and the page shows through.
    veil.visible = desk.visible = cur.veil < .985;
    spot.intensity = cur.spot * 90; sun.intensity = 3.2 * (1 - cur.veil * .8);
    canvas.style.opacity = cur.show < .05 && cur.veil > .98 ? "0" : "1";
    setThermal(thermalMode);
    const heatValue = heat ? +heat.value : 0;
    thermal.uniforms.uHeat.value = 1 - heatValue / 100; thermal.uniforms.uTime.value = time;
    if (thermalMode && scr.mode !== "heat") show("heat", "4,320 MIN\n→ 8 MIN");
    else if (!thermalMode && scr.mode === "heat") show(presses ? "msg" : "boot", "READY");
    pressT = Math.max(0, pressT - dt * 5);
    button.position.z = FRONT + .07 - Math.sin(pressT * Math.PI) * .06;
    renderer.render(scene, camera);
    // Keep going while anything is still easing, the device is floating, or a gag is animating;
    // otherwise stop until scroll, pointer or resize wakes it.
    const floating = !still && lifted > .05 && device.visible;
    idleFrames = moving > .0005 || floating || pressT > 0 || thermalMode ? 0 : idleFrames + 1;
    if (idleFrames < 30 && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && !disposed) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  addEventListener("scroll", kick, { passive: true });
  const onVisibility = () => { if (!document.hidden) kick(); };
  document.addEventListener("visibilitychange", onVisibility);
  const blink = window.setInterval(() => { if (scr.mode !== "heat" && !document.hidden) { scr.cursor = !scr.cursor; drawScreen(); kick(); } }, 530);

  await yieldToMain(); if (signal?.aborted) return abandon();
  // Paint the first frame now, not on the next animation frame: rAF never fires in a background tab.
  frame(performance.now());

  return {
    press,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf); clearInterval(blink);
      removeEventListener("pointermove", onPointer); removeEventListener("resize", resize); removeEventListener("scroll", kick);
      document.removeEventListener("visibilitychange", onVisibility);
      heat?.removeEventListener("input", onHeat);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
