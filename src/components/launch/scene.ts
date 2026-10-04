import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { buildDesk, type MoreWork } from "./desk";

/**
 * The launch scene: the device on a desk, then lifted into a spotlight and turned through the dark;
 * at the end the lights come back up on the desk, without it, for the notebook of more work. Everything is derived from scroll position each frame, so scrolling back
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
  /** Setup progress from 0 to 1, for the loading screen. */
  onProgress?: (value: number) => void;
  /** The scene decides which backdrop the page should show behind it. */
  onBackdrop?: (backdrop: "desk" | "void") => void;
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
  // Checking every shader for errors makes the browser finish compiling it on the spot (the main
  // thread waits); in production the parallel compile below is left to finish in the background.
  if (process.env.NODE_ENV === "production") renderer.debug.checkShaderErrors = false;

  // Loop state lives up here: resize() and the font callback can call kick() during setup.
  let composer: { render: () => void; setSize: (w: number, h: number) => void; setPixelRatio: (r: number) => void } | null = null;
  let last = performance.now(), time = 0, lastBackdrop = "", raf = 0, idleFrames = 0, disposed = false;
  // No frame until every shader has compiled: a frame drawn mid-setup (the cursor blink, a resize, the
  // fonts arriving all ask for one) would compile them all synchronously and freeze the page.
  let ready = false;
  const small = () => innerWidth <= 720;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  // next/font hashes family names, so the canvas has to ask the page what they are.
  const rootStyle = getComputedStyle(document.documentElement);
  const SANS = rootStyle.getPropertyValue("--font-figtree").trim() || "sans-serif";
  const MONO = rootStyle.getPropertyValue("--font-jetbrains").trim() || "monospace";
  const HAND = rootStyle.getPropertyValue("--font-caveat").trim() || "cursive";

  /* Pixel ratio, high tier and low (see Adaptive quality). Desktop: 1.25 at most (more costs fill rate
     an integrated GPU does not have, and its composer multisamples), 1 when it steps down. Phones:
     their screens are 2 to 3x, and 1.25 looked soft, so up to 2; they have no composer and draw only
     when something moves. A phone that cannot keep up steps back to 1.25. */
  const PIXELS = small() ? { high: 2, low: 1.25 } : { high: 1.25, low: 1 };
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, PIXELS.high));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  // Filtered shadows at 512: soft enough for a window light, a quarter of the memory and fill of the
  // 1024 variance maps, and no blur passes. (three r185 folds PCFSoftShadowMap into this one.)
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // The set is static between moves: shadow maps are redrawn only on frames where something that casts
  // one has moved or shown/hidden (see frame()), not every frame.
  renderer.shadowMap.autoUpdate = false;
  // Some drivers (ANGLE on Direct3D) attach harmless precision notes to every compiled program, which
  // three prints as warnings. Only speak up when a program actually fails to link.
  renderer.debug.onShaderError = (gl, program, vs, fs) => {
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    console.error("Shader failed to link:", gl.getProgramInfoLog(program), gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs));
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  camera.position.set(0, 0, 12);
  /* The environment light: three's PMREM of its RoomEnvironment, baked by scripts/bake-textures as
     RGBE and decoded here on the GPU into the same cube-UV target three would have built. Building it
     live compiled blur shaders that held the page for a second or more on integrated GPUs. Shaders
     only need the target's shape, so the scene compiles while the picture is still on its way. */
  const envTarget = new THREE.WebGLRenderTarget(768, 1024, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false, colorSpace: THREE.LinearSRGBColorSpace });
  envTarget.texture.mapping = THREE.CubeUVReflectionMapping;
  scene.environment = envTarget.texture;
  const envArrived = new Promise<void>((done) => {
    const decode = (map: THREE.Texture) => {
      map.flipY = false; map.minFilter = map.magFilter = THREE.NearestFilter; map.generateMipmaps = false; map.needsUpdate = true;
      const rgbe = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3, uniforms: { map: { value: map } },
        vertexShader: "in vec3 position; void main() { gl_Position = vec4(position.xy, 0., 1.); }",
        fragmentShader: "precision highp float; uniform sampler2D map; out vec4 o; void main() { vec4 e = texelFetch(map, ivec2(gl_FragCoord.xy), 0); o = vec4(e.a > 0. ? e.rgb * exp2(round(e.a * 255.) - 128.) : vec3(0.), 1.); }",
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rgbe); quad.frustumCulled = false;
      if (!disposed) { renderer.setRenderTarget(envTarget); renderer.render(quad, new THREE.Camera()); renderer.setRenderTarget(null); }
      rgbe.dispose(); quad.geometry.dispose(); map.dispose();
      done();
    };
    // Unpremultiplied and unconverted: the alpha channel is the exponent, not coverage.
    if (typeof createImageBitmap === "function" && !/^((?!chrome|android).)*safari/i.test(navigator.userAgent))
      new THREE.ImageBitmapLoader().setOptions({ premultiplyAlpha: "none", colorSpaceConversion: "none" }).load("/textures/room-env.webp", (bmp) => decode(new THREE.Texture(bmp)), undefined, () => done());
    else new THREE.TextureLoader().load("/textures/room-env.webp", decode, undefined, () => done());
  });
  // Low: a bright studio reflection is what made everything read as glossy plastic.
  scene.environmentIntensity = .13;
  hooks.onProgress?.(.25);
  await yieldToMain(); if (signal?.aborted) { envTarget.dispose(); renderer.dispose(); return null; }

  // Everything created here is tracked so dispose() can release it.
  const disposables: { dispose: () => void }[] = [envTarget];
  const keep = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };

  const sunExtras: THREE.Light[] = [];

  // The window pane's light, dimmed out for More work: its straight edge would cut across the wall.
  let paneLight: THREE.SpotLight | null = null;
  // Present from the start (at zero) so More work never recompiles the lit materials by adding it.
  const wallFill = new THREE.DirectionalLight(0xfff0dc, 0);
  wallFill.position.set(1, -12, 7); wallFill.target.position.set(0, 5, 1.5);
  // Late-afternoon daylight: a warm sun with real direction, a modest fill so shadows keep their
  // depth, and the window light below carrying the dappled pattern.
  const SUN = 1.65;
  const sun = new THREE.DirectionalLight(0xffd2a2, SUN);
  sun.position.set(-5, 6, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);

  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 6, bottom: -6, near: 1, far: 30 });
  sun.shadow.bias = -.0006; sun.shadow.radius = 5.5;
  scene.add(sun, new THREE.HemisphereLight(0xffe4c8, 0x3a2414, .4), wallFill, wallFill.target);
  // Late sun through a window: a spot light carrying a blurred pane pattern across the desk.
  if (!small()) {
    const panes = document.createElement("canvas"); panes.width = panes.height = 256;
    // Light through a window with a plant in it: bright panes broken up by soft leaf shadows.
    const pc = panes.getContext("2d")!; pc.fillStyle = "#000"; pc.fillRect(0, 0, 256, 256); pc.filter = "blur(7px)"; pc.fillStyle = "#fff";
    for (const [px, py] of [[20, 20], [134, 20], [20, 134], [134, 134]]) pc.fillRect(px, py, 102, 102);
    pc.fillStyle = "#000"; let ls = 5; const lr = () => { ls = (Math.imul(ls, 1664525) + 1013904223) >>> 0; return ls / 4294967296; };
    for (let i = 0; i < 26; i++) { pc.beginPath(); pc.ellipse(120 + (lr() - .5) * 200, 60 + lr() * 150, 8 + lr() * 18, 4 + lr() * 8, lr() * Math.PI, 0, Math.PI * 2); pc.fill(); }
    const paneTex = new THREE.CanvasTexture(panes); paneTex.colorSpace = THREE.SRGBColorSpace; disposables.push(paneTex);
    const windowLight = new THREE.SpotLight(0xffc285, 115, 40, .55, .6, 1.2);
    windowLight.position.set(-9, 7, 11); windowLight.target.position.set(1.5, -1, 0);
    windowLight.map = paneTex; windowLight.castShadow = true; windowLight.shadow.mapSize.set(512, 512); windowLight.shadow.radius = 6.5; windowLight.shadow.bias = -.0006;
    scene.add(windowLight, windowLight.target);
    sunExtras.push(windowLight); paneLight = windowLight;
  }
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

  /* three polls each compileAsync on a timer, reading the materials' programs: releasing them while a
     poll is pending makes it throw. Compiles are tracked, and the release waits for them to settle. */
  const compiling = new Set<Promise<unknown>>();
  const compile = (...args: Parameters<THREE.WebGLRenderer["compileAsync"]>) => {
    const p = renderer.compileAsync(...args).catch(() => {});
    compiling.add(p); void p.then(() => compiling.delete(p));
    return p;
  };
  const release = () => {
    disposed = true;
    const free = () => { disposables.forEach((d) => d.dispose()); renderer.dispose(); };
    if (compiling.size) void Promise.all(compiling).then(free); else free();
  };
  const abandon = () => { release(); return null; };
  await yieldToMain(); if (signal?.aborted) return abandon();

  /* ---------- The desk ---------- */
  /* Background preparation (texture uploads, drawing More work's pages) runs in idle time only: a
     job runs when the browser has at least ~10 ms to spare (or has waited long enough), one per idle
     moment. afterOpening holds it until the page has been revealed and the entrance has played. */
  const idleQueue = (job: () => boolean) => {
    if (typeof requestIdleCallback !== "function") { const tick = () => { if (!disposed && job()) setTimeout(tick, 50); }; setTimeout(tick, 50); return; }
    // The wait is counted from when the job was queued: asking again with a fresh timeout would starve
    // it for good while the desk animates (every idle moment between frames is short).
    let since = performance.now();
    const tick = (d: IdleDeadline) => {
      if (disposed) return;
      if (d.timeRemaining() < 10 && !d.didTimeout && performance.now() - since < 2500) { requestIdleCallback(tick, { timeout: 2500 }); return; }
      since = performance.now();
      if (job()) requestIdleCallback(tick, { timeout: 2500 });
    };
    requestIdleCallback(tick, { timeout: 2500 });
  };
  const afterOpening = (run: () => void) => {
    const go = () => window.setTimeout(() => { if (!disposed) run(); }, 2500);
    if (document.documentElement.hasAttribute("data-entering") || !document.querySelector("[data-launch-loader]")) go();
    else window.addEventListener("launch:revealed", go, { once: true });
  };
  const quiet = (cb: () => void) => (typeof requestIdleCallback === "function" ? requestIdleCallback(cb, { timeout: 1000 }) : setTimeout(cb, 30));
  const deskSet = buildDesk({ tex, std, geo, keep, mesh, SANS, MONO, HAND, phone: small(), photo: !small(), upload: (t) => quiet(() => { if (!disposed) renderer.initTexture(t); }) });
  const desk = deskSet.group; scene.add(desk);
  hooks.onProgress?.(.6);
  await yieldToMain(); if (signal?.aborted) return abandon();

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
  // How high the device has risen off the desk by the time the hero has scrolled away.
  const LIFT = 2;
  // The device is drawn at 90% of its modelled size in every pose.
  const SIZE = .9;
  // The device is drawn in its own pass on top of the desk (see the composer and frame()).
  const DEVICE_LAYER = 1;
  const shell = phys({ color: 0xe6dccb, roughness: .66, sheen: .2, sheenRoughness: .8 });
  // Plain standard materials shade these exactly as physical ones did (they use nothing physical);
  // the shell keeps its sheen and the glass its clearcoat.
  const accent = std({ color: 0xc8692c, roughness: .55, envMapIntensity: .35 });
  const dark = std({ color: 0x2a221c, roughness: .5 });
  const olive = std({ color: 0x4d5a36, roughness: .6, envMapIntensity: .35 });
  const glass = phys({ color: 0x0c0a09, roughness: .1, clearcoat: 1 });
  device.add(mesh(geo(new RoundedBoxGeometry(W, H, D, 6, .22)), shell));
  // Drawn at twice its 640 x 384 layout size so the small type stays sharp on the screen.
  const sc = document.createElement("canvas"); sc.width = 1280; sc.height = 768;
  const sx = sc.getContext("2d")!;
  const screenTex = keep(new THREE.CanvasTexture(sc)); screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = 8;
  const bezel = mesh(geo(new RoundedBoxGeometry(1.86, 1.16, .04, 3, .06)), glass); bezel.position.set(-.45, .14, FRONT); device.add(bezel);
  const screenMat = keep(new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  const screen = new THREE.Mesh(geo(new THREE.PlaneGeometry(1.72, 1.03)), screenMat); screen.position.set(-.45, .14, FRONT + .023); device.add(screen);
  // The blinking cursor is its own little mesh on the screen (the 26 x 6 bar at 22, 290 of the screen's
  // 640 x 384 layout), so a blink only shows or hides it: no repaint and re-upload of the screen.
  const cursorMat = keep(new THREE.MeshBasicMaterial({ toneMapped: false }));
  const cursor = new THREE.Mesh(geo(new THREE.PlaneGeometry(26 / 640 * 1.72, 6 / 384 * 1.03)), cursorMat);
  cursor.position.set(-.45 - .86 + 35 / 640 * 1.72, .14 + .515 - 293 / 384 * 1.03, FRONT + .024); device.add(cursor);
  const knob = new THREE.Group(); knob.position.set(.95, .38, FRONT); device.add(knob);
  const knobBody = mesh(geo(new THREE.CylinderGeometry(.27, .29, .24, 64)), accent); knobBody.rotation.x = Math.PI / 2; knobBody.position.z = .12; knob.add(knobBody);
  const notch = new THREE.Mesh(geo(new THREE.BoxGeometry(.035, .14, .01)), dark); notch.position.set(0, .15, .245); knob.add(notch);
  const button = mesh(geo(new THREE.CylinderGeometry(.22, .22, .14, 64)), olive); button.rotation.x = Math.PI / 2; button.position.set(.95, -.46, FRONT + .07); device.add(button);
  const grille = new THREE.InstancedMesh(geo(new THREE.CircleGeometry(.018, 10)), dark, 60); const m4 = new THREE.Object3D();
  for (let i = 0; i < 60; i++) { m4.position.set(-1.28 + (i % 20) * .088, -.62 - Math.floor(i / 20) * .085, FRONT + .002); m4.updateMatrix(); grille.setMatrixAt(i, m4.matrix); }
  device.add(grille);
  // Contact shadow under the device while it lies on the desk: what makes it sit rather than hover.
  const devicePadTex = tex(256, 160, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); g.addColorStop(0, "rgba(0,0,0,.7)"); g.addColorStop(.6, "rgba(0,0,0,.35)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const devicePad = new THREE.Mesh(geo(new THREE.PlaneGeometry(W * 1.25, H * 1.35)), keep(new THREE.MeshBasicMaterial({ map: devicePadTex, transparent: true, depthWrite: false, toneMapped: false })));
  devicePad.position.z = .006; devicePad.renderOrder = 1; scene.add(devicePad);


  /* ---------- Screen ---------- */
  // The device's spec sheet is about its maker: one entry per press, round and round.
  const SPECS: [title: string, detail: string][] = [
    ["BSc\nSTUDENT", "COMPUTER SCIENCE  ·  THE OPEN UNIVERSITY"],
    ["INOVATION\nWITH AI", "AUTOMATE MANUAL PROCESSES"],
    ["END\nTO END", "UI  ·  API  ·  DATA  ·  DEVICES"],
    ["FULL\nSTACK", "PYTHON  ·  FASTAPI  ·  REACT  ·  TS"],
    ["RF &\nWIRELESS", "BLE  ·  LORA  ·  LTE  ·  SPECTRUM"],
  ];
  let presses = 0, pressT = 0, spec = 0;
  let introAt = -1, lean = 0;
  // The knob tunes the screen's ink: turned away from upright, the text takes on a hue that follows
  // the knob round; a click on the knob turns it back upright and the ink back to plain cream.
  let inkRef = 0, inkKey = 0;
  const ink = (light: number) => {
    const d = knobA - inkRef;
    if (Math.abs(d) < .02) return light > 80 ? "#f2e6d4" : "#cdbca6";
    const hue = ((-d / (Math.PI * 2)) * 360 % 360 + 360 + 30) % 360, sat = Math.min(1, Math.abs(d) / (Math.PI / 6)) * 85;
    return `hsl(${hue.toFixed(0)} ${sat.toFixed(0)}% ${light}%)`;
  };
  let held = false, btnDepth = 0, knobA = 0, knobT = 0;
  const DETENT = Math.PI / 12;
  function drawScreen() {
    const x = sx; x.setTransform(2, 0, 0, 2, 0, 0); x.fillStyle = "#0e0b09"; x.fillRect(0, 0, 640, 384);
    x.fillStyle = "#a08c78"; x.font = `400 18px ${MONO}`; x.fillText("YOSSI ABUTBUL  ·  FW 2.1", 22, 38);
    const [title, detail] = SPECS[spec];
    x.fillStyle = ink(88); x.font = `800 58px ${SANS}`;
    title.split("\n").forEach((l, i) => x.fillText(l, 22, 140 + i * 64));
    x.fillStyle = ink(84); x.font = `600 22px ${MONO}`;
    if (detail) x.fillText(detail, 22, 262);
    cursorMat.color.setStyle(ink(88).replace(/hsl\((\S+) (\S+) (\S+)\)/, "hsl($1, $2, $3)"));
    x.fillStyle = "#a08c78"; x.font = `400 18px ${MONO}`;
    x.fillText(`SPEC ${String(spec + 1).padStart(2, "0")}/${String(SPECS.length).padStart(2, "0")}   ·   PRESS ●`, 22, 356);
    screenTex.needsUpdate = true;
  }
  drawScreen();
  document.fonts?.ready.then(() => { if (!disposed) drawScreen(); });
  function press() {
    presses++; pressT = 1;
    spec = presses % SPECS.length;
    if (presses === 25) hooks.say?.("25 presses. Same energy goes into debugging.");
    drawScreen();
    hooks.onPress?.(presses);
    kick();
  }

  /* ---------- Scroll choreography ---------- */
  // The low camera's angle above the table.
  const LOW_ELEV = THREE.MathUtils.degToRad(20);
  // The More work projects, read once from the section (it carries them as JSON for the scene).
  let moreList: MoreWork[] | null = null;
  const moreWork = () => {
    if (!moreList) {
      try { moreList = JSON.parse(byId("more-work")?.dataset.projects ?? "[]") as MoreWork[]; } catch { moreList = []; }
      deskSet.setMoreWork(moreList);
    }
    return moreList;
  };
  const byId = (id: string) => document.getElementById(id);
  const prog = (el: HTMLElement | null) => { if (!el) return 0; const r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight)); };
  const rect = (el: HTMLElement | null) => el?.getBoundingClientRect() ?? { top: Infinity, bottom: Infinity } as DOMRect;

  // low: 0 looks down at the desk from above; 1 is the low camera across the table for More work.
  // crane: extra height for the camera, so More work opens as a crane shot coming down onto the desk.
  type Pose = { x: number; y: number; z: number; rx: number; ry: number; rz: number; s: number; veil: number; spot: number; show: number; spin: number; low: number; crane: number };
  const cur: Pose = { x: 0, y: 0, z: FRONT, rx: 0, ry: 0, rz: 0, s: small() ? .72 : 1, veil: 0, spot: 0, show: 1, spin: 0, low: 0, crane: 0 };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  // The pointer only matters while the canvas is on show; the target is kept either way.
  const onPointer = (e: PointerEvent) => { pointer.tx = e.clientX / innerWidth * 2 - 1; pointer.ty = e.clientY / innerHeight * 2 - 1; if (canvas.style.opacity !== "0") kick(); };
  addEventListener("pointermove", onPointer, { passive: true });

  function choreograph() {
    const intro = byId("intro"), ships = byId("ships"), work = byId("work"), book = byId("more-work"), after = byId("experience");
    const vh = innerHeight, mob = small(), base = mob ? .72 : 1;
    // Approaching More work (the projects about to come into view, a few screens before it): get its
    // wall ready now. Anywhere past that point counts too.
    if (rect(work).top < vh * 1.5) prepareWall();
    const t: Pose = { x: 0, y: 0, z: FRONT, rx: 0, ry: 0, rz: 0, s: base, veil: 0, spot: 0, show: 1, spin: 0, low: 0, crane: 0 };
    let backdrop: "desk" | "void" = "desk";
    // Each beat's words show only inside that beat's own stretch, decided afresh every frame, so a
    // beat sliding into view from below (or left behind above) never shows its words early or late.
    let introOn = false, shipsOn = false, bookOn = false;
    let book_: { enter: number; rise: number; u: number } | null = null;
    if (rect(intro).top > 0) {
      // On the desk. The room goes dark while the hero's words leave and the hero scrolls away, so the
      // next beat opens straight in the dark rather than on an empty desk.
      const q = clamp(1 - rect(intro).top / vh);
      // The device rises off the table toward the camera, a step ahead of the dark, so it clears the
      // veil and stays bright and sharp while the desk falls away out of focus behind it.
      t.z = lerp(FRONT, LIFT, smooth(0, .85, q));
      t.veil = smooth(.08, .85, q); t.spot = t.veil;
      // The desk turns a few degrees under the rising device, like a camera drifting round it.
      t.spin = -.075 * smooth(0, 1, q);
      backdrop = t.veil > .7 ? "void" : "desk";
      // (The next beat's words stay off here: they wait until the room has gone dark and the device lifts.)
    } else if (rect(ships).top > 0) {
      const p = prog(intro);
      t.veil = 1; t.spot = 1;
      // A slow 3D tumble, like Oryzo's coaster: it tips back to show its edge and depth, turning a
      // little on its face as it goes, then settles into the angle the next beat starts from.
      const tip = smooth(.05, .55, p), settle = smooth(.5, 1, p);
      t.z = lerp(LIFT, 2.4, smooth(.05, .5, p));
      t.rx = -1.15 * tip + .8 * settle;
      t.ry = -.5 * smooth(.1, 1, p) + .35 * Math.sin(Math.PI * p);
      t.rz = .08 * p + .5 * Math.sin(Math.PI * smooth(0, 1, p));
      t.s = base * lerp(1, .92, p);
      backdrop = "void";
      introOn = p >= .35;
    } else if (rect(work).top > vh * .2) {
      const p = prog(ships);
      t.veil = 1; t.spot = 1; t.z = 2.4; t.rx = -.35 + Math.sin(p * Math.PI) * .2; t.ry = -.5 + p * Math.PI; t.rz = .08; t.s = mob ? .62 : .92;
      t.show = 1 - smooth(.82, .98, p); backdrop = "void";
      shipsOn = p >= .08 && p <= .92;
    } else if (rect(book).top > vh) {
      t.veil = 1; t.show = 0; t.z = 2.4; t.s = .2; backdrop = "void";
    } else {
      /* More work. As the section rises into view (q 0 to 1) the lights come up on the desk, the
         notebook already in its place, while the camera cranes down from high above and tilts low
         across the table, the desk turning a little under it; the hologram rises as it settles. So
         by the time the section pins (where the nav's "More work" lands) the shot is complete, and
         scrolling on only turns the pages. The device stays away. */
      const q = clamp(1 - rect(book).top / vh), p = prog(book);
      t.veil = 1 - smooth(.05, .7, q); t.spot = t.veil;
      t.crane = (1 - smooth(0, .8, q)) * 7;
      t.spin = -.16 * (1 - smooth(0, .9, q));
      t.show = 0; t.s = .2;
      backdrop = t.veil > .5 ? "void" : "desk";
      bookOn = true;
      t.low = smooth(.25, 1, q);
      book_ = { enter: 1, rise: smooth(.8, 1, q), u: p * moreWork().length };
    }
    if (rect(after).top < vh * .6) t.show = 0;
    ([[intro, introOn], [ships, shipsOn]] as const).forEach(([beat, on]) =>
      beat?.querySelectorAll<HTMLElement>("[data-fade]").forEach((el) => el.toggleAttribute("data-off", !on)));
    // The giant word crosses the ships beat from right to left, behind the device. It travels past its
    // own box and then some: the tight letter-spacing lets the last glyph (the full stop) hang outside
    // the box, so stopping at the box's width left the dot on screen at the left edge.
    const word = byId("launch-word");
    if (word) {
      const r = rect(ships), onScreen = r.top < vh && r.bottom > 0;
      word.style.opacity = onScreen ? "1" : "0";
      if (onScreen) word.style.transform = `translate3d(${lerp(innerWidth, -word.offsetWidth - word.offsetHeight * .35, prog(ships))}px, 0, 0)`;
    }
    // Reduced motion lists More work as a page instead; the desk's notebook stays put.
    deskSet.book(bookOn && !reduce.matches ? book_ : null);
    // The notebook's pages turn with scroll while the pose stands still: their shadows must follow.
    const pages = book_ ? `${book_.rise.toFixed(4)}|${book_.u.toFixed(4)}` : "";
    return { t, backdrop, hero: rect(intro).top > 0, pages };
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    composer?.setPixelRatio(renderer.getPixelRatio()); composer?.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.fov = small() ? 44 : 30; camera.updateProjectionMatrix();
    kick();
  }
  addEventListener("resize", resize); resize();

  /* ---------- Adaptive quality ---------- */
  /* For two seconds once the desk is first on show, the loop is kept running and the frame rate
     measured. Under 50 fps (an integrated GPU driving a big window), the scene steps down: the
     composer and its ambient occlusion go (desktop), and the pixel ratio drops to its low tier. The desk's shaders for
     drawing straight to the screen are compiled first, in the background, and the switch waits for
     them, so stepping down never stalls a frame. Measured once per visit; a hidden tab measures again
     when it comes back. */
  let probe: { from: number; until: number; frames: number } | null = null, probed = false, reprobe = false;
  function startProbe() {
    // Snapshots (data-snap) always show the full quality.
    if (probed || probe || disposed || document.documentElement.hasAttribute("data-snap")) return;
    reprobe = false;
    // The first few frames after a reveal carry one-off work (texture uploads); they are not counted.
    const now = performance.now(); probe = { from: now + 400, until: now + 2400, frames: 0 };
    kick();
  }
  function measure(now: number) {
    const p = probe!;
    if (document.hidden) { probe = null; reprobe = true; return; }
    if (now >= p.from) p.frames++;
    if (now < p.until) return;
    probe = null; probed = true;
    const fps = p.frames / ((now - p.from) / 1000);
    if (fps < 50) void stepDown();
  }
  async function stepDown() {
    if (composer) {
      // Every state the page shows, compiled for the screen rather than the composer's buffer.
      for (const set of ["desk", "wall", "wall+holo"] as const) await compileFor(set, null);
      if (disposed) return;
      composer = null; composerTarget = null;
      disposeComposer?.(); disposeComposer = null;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, PIXELS.low));
    resize();
  }

  // What the shadow maps were last drawn with; stale until the first frame draws them.
  let shadowsShown = "", shadowsStale = true, lastPages = "";
  // The device bobs on its own once lifted out of the desk.
  const floatingNow = () => !(reduce.matches || document.documentElement.hasAttribute("data-snap")) && lean > .05 && device.visible;

  function frame() {
    // One clock for everything: rAF timestamps and performance.now() disagree by up to a frame.
    const now = performance.now();
    raf = 0;
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    if (probe) measure(now);
    // <html data-snap> (set by the screenshot harness) skips easing so captures show the exact pose.
    const still = reduce.matches || document.documentElement.hasAttribute("data-snap");
    if (!still) time += dt;
    const { t, backdrop, hero, pages } = choreograph();
    if (pages !== lastPages) { lastPages = pages; shadowsStale = true; }
    if (backdrop !== lastBackdrop) { lastBackdrop = backdrop; hooks.onBackdrop?.(backdrop); }
    const k = still ? 1 : 1 - Math.exp(-dt * 5);
    let moving = 0, moved = 0;
    (Object.keys(cur) as (keyof Pose)[]).forEach((key) => {
      const next = lerp(cur[key], t[key], k), d = Math.abs(next - cur[key]);
      moving += d; cur[key] = next;
      // The veil, the spotlight and the crane change what is lit and seen, not where anything stands.
      if (key !== "veil" && key !== "spot" && key !== "crane") moved += d;
    });
    const px = pointer.x, py = pointer.y;
    pointer.x = lerp(pointer.x, pointer.tx, 1 - Math.exp(-dt * 4)); pointer.y = lerp(pointer.y, pointer.ty, 1 - Math.exp(-dt * 4));
    moving += Math.abs(pointer.tx - pointer.x) + Math.abs(pointer.ty - pointer.y);
    moved += (Math.abs(pointer.x - px) + Math.abs(pointer.y - py)) * lean;
    const lifted = clamp((cur.z - FRONT) / 1.5);
    // The desk is playable only while it is lit and the device is lying on it.
    // Playable whenever it is lit and the device is either lying on it or gone (More work).
    const onDesk = desk.visible && cur.veil < .05 && (lifted < .03 || cur.show < .05);
    const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), halfW = halfH * camera.aspect;
    const obstacles: [number, number, number][] = onDesk && cur.show > .5 ? [-1, 0, 1].map((k) => [cur.x + k * .95 * cur.s * SIZE, cur.y, .95 * cur.s * SIZE] as [number, number, number]) : [];
    // The mat is the edge: tools can be nudged partly out of frame, and their home spring brings them back.
    const edge = { w: 6.2, h: 4.2 };
    const deskMoving = desk.visible ? deskSet.update(dt, edge, obstacles) : false;
    if (!onDesk) { deskSet.hover(null); showHint(null); }
    canvas.style.pointerEvents = onDesk ? "auto" : "none";
    // Lying on the desk, and while it rises through the hero, the device ignores the pointer so the
    // lift stays clean; from the next beat on it leans toward the pointer and floats, eased in.
    lean = lerp(lean, hero ? 0 : lifted, 1 - Math.exp(-dt * 3));
    // Scaled down, it is lowered by what it lost, so lying on the desk it still rests on the mat.
    device.position.set(cur.x, cur.y + (still ? 0 : Math.sin(time * 1.2) * .04 * lean), cur.z - FRONT * (1 - SIZE * cur.s));
    device.rotation.set(cur.rx + pointer.y * .12 * lean, cur.ry + pointer.x * .25 * lean, cur.rz);
    device.scale.setScalar(Math.max(.0001, cur.s * cur.show * SIZE));
    devicePad.visible = desk.visible && lifted < .5; devicePad.position.set(cur.x + .08, cur.y - .1, .006); devicePad.scale.setScalar(cur.s * SIZE); (devicePad.material as THREE.MeshBasicMaterial).opacity = 1 - lifted * 2;
    device.visible = cur.show > .02;
    veilMat.opacity = cur.veil;
    // Fully dark: drop the veil and the desk, so the canvas is transparent and the page shows through.
    desk.visible = cur.veil < .985;
    // Fully clear, the veil is dropped too: invisible as it is, the ambient-occlusion pass still sees
    // it as a solid sheet, and from More work's low camera it would slice across the wall as a band
    // and shade everything under it.
    veil.visible = cur.veil > .003 && cur.veil < .985;
    desk.rotation.z = cur.spin;
    // The dark has to cover everything on the desk evenly, the tall mug and the spoon standing out of
    // it included: the device is drawn in its own pass on top (every screen), so the veil can sit
    // above all of them.
    veil.position.z = 3.4;
    spot.intensity = cur.spot * 90; sun.intensity = SUN * (1 - cur.veil * .8);
    sunExtras.forEach((l) => { l.visible = desk.visible; });
    if (paneLight) paneLight.intensity = 115 * (1 - cur.low);
    // More work: the sun stands behind the wall, so a soft light from the camera's side fills its face.
    wallFill.intensity = 2.2 * cur.low; wallFill.visible = desk.visible;
    // Nothing to see (the device gone in the dark): the canvas is hidden and nothing is drawn.
    const unseen = cur.show < .05 && cur.veil > .98;
    canvas.style.opacity = unseen ? "0" : "1";
    pressT = Math.max(0, pressT - dt * 5);
    // The button stays down while it is held, then springs back; a press from elsewhere dips it once.
    btnDepth = lerp(btnDepth, held ? 1 : 0, 1 - Math.exp(-dt * (held ? 40 : 18)));
    button.position.z = FRONT + .07 - Math.max(btnDepth, Math.sin(pressT * Math.PI)) * .06;
    knobA = lerp(knobA, knobT, 1 - Math.exp(-dt * 20));
    knob.rotation.z = knobA;
    // Repaint the screen as the knob changes its ink (in small steps, not every frame).
    const key = Math.round((knobA - inkRef) * 40);
    if (key !== inkKey) { inkKey = key; drawScreen(); }
    const controlsMoving = held || btnDepth > .002 || Math.abs(knobT - knobA) > .001;
    // Redraw the shadow maps only when something that casts one moved, or the set of visible casters
    // or shadowing lights changed. The camera moving needs none: the lights' shadow cameras are fixed.
    const shown = `${desk.visible}|${device.visible}|${paneLight?.visible}`;
    if (moved > 1e-5 || floatingNow() || pressT > 0 || controlsMoving || deskMoving || shown !== shadowsShown || shadowsStale) {
      renderer.shadowMap.needsUpdate = true; shadowsShown = shown; shadowsStale = false;
    }
    // Over the desk the camera stands a little toward the viewer and looks down at the device, a
    // gentle symmetric tilt (the desk reads as a trapezoid, no roll); it straightens to square on as
    // the room goes dark, so every later pose is shot straight.
    const tilt = 1 - cur.veil;
    // More work drops the camera to LOW_ELEV above the table, the same 12 units out, after craning
    // down from cur.crane units higher.
    camera.position.set(0, lerp(-2.4 * tilt, -12 * Math.cos(LOW_ELEV), cur.low), lerp(12 + .25 * tilt, 12 * Math.sin(LOW_ELEV), cur.low) + cur.crane);
    camera.up.set(0, 1, 0);
    // From the low camera it looks a little up, over the book, so the wall behind the desk fills the
    // top of the frame instead of more table.
    camera.lookAt(0, 1.2 * cur.low, 1 * cur.low);
    deskSet.setWall(cur.low);
    placeSteam();
    if (unseen) { /* hidden: skip drawing */ }
    else if (composer && desk.visible) {
      camera.layers.disable(DEVICE_LAYER);
      composer.render();
      camera.layers.enable(DEVICE_LAYER);
    } else if (desk.visible) {
      // Phones: the desk (and the veil) first, then the device alone on top, depth cleared between.
      camera.layers.disable(DEVICE_LAYER);
      renderer.render(scene, camera);
      const mask = camera.layers.mask, auto = renderer.autoClear, shadows = renderer.shadowMap.autoUpdate;
      camera.layers.mask = phoneDeviceMask.mask;
      renderer.autoClear = false; renderer.shadowMap.autoUpdate = false;
      renderer.clearDepth();
      renderer.render(scene, camera);
      renderer.autoClear = auto; renderer.shadowMap.autoUpdate = shadows;
      camera.layers.mask = mask; camera.layers.enable(DEVICE_LAYER);
    } else renderer.render(scene, camera);
    // Keep going while anything is still easing, the device is floating, or a gag is animating;
    // otherwise stop until scroll, pointer or resize wakes it.
    const floating = floatingNow();
    idleFrames = moving > .0005 || floating || pressT > 0 || controlsMoving || deskMoving || probe ? 0 : idleFrames + 1;
    if (idleFrames < 30 && !document.hidden) raf = requestAnimationFrame(frame);
  }
  // Waking from idle restarts the clock; a kick while already running must not, or dt collapses to 0.
  /** One frame, for a change that is over at once (the cursor blinking): the loop does not keep running. */
  function renderOnce() { if (!raf && !disposed && ready) { last = performance.now(); idleFrames = 29; raf = requestAnimationFrame(frame); } }
  function kick() { if (!raf && !disposed && ready) { if (idleFrames >= 30) last = performance.now(); raf = requestAnimationFrame(frame); } }
  addEventListener("scroll", kick, { passive: true });

  /* ---------- Pointer hint ---------- */
  // A dotted ring with a label that follows the mouse over the desk and says what the thing under it
  // does. The system cursor stays as it is; null hides the hint.
  const hintEl = document.getElementById("launch-hint");
  let hintText = "", hintW = 0, hintH = 0, hintSide = "", hintDy = 0;
  function showHint(text: string | null, x = 0, y = 0) {
    if (!hintEl) return;
    if (!text) { if (hintText) { hintText = ""; hintEl.dataset.on = "false"; } return; }
    if (text !== hintText) {
      if (!hintEl.firstChild) hintEl.append(document.createElement("span"));
      hintText = text; hintEl.firstChild!.textContent = text; hintEl.dataset.on = "true";
      // Measured once per label (not per move), to keep it on screen below.
      const label = hintEl.firstChild as HTMLElement; hintW = label.offsetWidth; hintH = label.offsetHeight;
    }
    // The label sits right of the pointer; near the right edge it moves to the left so it is never
    // cut off by the window, and near the top or bottom it slides back inside.
    const side = x + 24 + hintW + 12 > innerWidth ? "left" : "right";
    if (side !== hintSide) { hintSide = side; hintEl.dataset.side = side; }
    const dy = Math.round(clamp(y, hintH / 2 + 8, innerHeight - hintH / 2 - 8) - y);
    if (dy !== hintDy) { hintDy = dy; hintEl.style.setProperty("--dy", `${dy}px`); }
    hintEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  /* ---------- Steam ---------- */
  // The steam is CSS over the canvas (it never stops moving, and the scene should be free to go
  // idle); here it is only pinned to the mug's rim on screen and faded with the desk.
  const steamEl = document.getElementById("launch-steam");
  const steamP = new THREE.Vector3(), steamQ = new THREE.Vector3();
  let steamWas = "";
  function placeSteam() {
    if (!steamEl) return;
    const top = deskSet.mugTop(), on = desk.visible && top ? Math.max(0, 1 - cur.veil * 3) * top.fade : 0;
    let next = `0|${on}`;
    if (top && on > 0) {
      camera.updateMatrixWorld();
      steamP.copy(top.at).project(camera); steamQ.copy(top.at).setX(top.at.x + top.radius).project(camera);
      const x = (steamP.x + 1) / 2 * innerWidth, y = (1 - steamP.y) / 2 * innerHeight, w = Math.abs(steamQ.x - steamP.x) / 2 * innerWidth * 2;
      next = `${x.toFixed(1)}|${y.toFixed(1)}|${w.toFixed(1)}|${on.toFixed(2)}`;
      if (next !== steamWas) { steamEl.style.transform = `translate3d(${x}px, ${y}px, 0)`; steamEl.style.setProperty("--steam-w", `${w}px`); }
    }
    if (next !== steamWas) { steamEl.style.opacity = String(on); steamWas = next; }
  }

  /* ---------- Playing with the desk ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  // The device sits on its own layer (drawn in its own pass); the pointer has to see it.
  ray.layers.enable(DEVICE_LAYER);
  const rayAt = (x: number, y: number) => { const r = canvas.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray; };
  // The desk reacts to the pointer; a tap or click gives the nearby tools a push. Nothing is dragged,
  // so touch never has to fight the page's own scrolling.
  // The device's own controls come first: the button clicks down and presses, the knob turns.
  const control = (x: number, y: number) => {
    rayAt(x, y);
    const hit = ray.intersectObjects([button, knobBody], false)[0]?.object;
    return hit === button ? "button" : hit === knobBody ? "knob" : null;
  };
  const knobScreen = new THREE.Vector3();
  const knobAngleAt = (x: number, y: number) => {
    knob.getWorldPosition(knobScreen).project(camera);
    const r = canvas.getBoundingClientRect();
    return Math.atan2(y - (r.top + (1 - knobScreen.y) / 2 * r.height), x - (r.left + (knobScreen.x + 1) / 2 * r.width));
  };
  let turning: { id: number; angle: number; travel: number } | null = null;
  const onDown = (e: PointerEvent) => {
    const c = control(e.clientX, e.clientY);
    if (c === "button") { held = true; press(); canvas.setPointerCapture(e.pointerId); }
    else if (c === "knob") {
      turning = { id: e.pointerId, angle: knobAngleAt(e.clientX, e.clientY), travel: 0 };
      canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing";
    } else if (!deskSet.press(rayAt(e.clientX, e.clientY))) deskSet.poke(rayAt(e.clientX, e.clientY));
    kick();
  };
  const onMove = (e: PointerEvent) => {
    if (turning && e.pointerId === turning.id) {
      // Follow the pointer round the knob's centre; screen y runs down, so clockwise is negative z.
      if (e.pointerType === "mouse") showHint("Drag to rotate", e.clientX, e.clientY);
      const a = knobAngleAt(e.clientX, e.clientY);
      let d = a - turning.angle; d = Math.atan2(Math.sin(d), Math.cos(d));
      turning.angle = a; turning.travel += Math.abs(d); knobT -= d; knobA = knobT;
      kick(); return;
    }
    if (e.pointerType !== "mouse") return;
    const c = control(e.clientX, e.clientY);
    const ray = c ? null : rayAt(e.clientX, e.clientY);
    canvas.style.cursor = c === "button" || (ray && deskSet.over(ray)) ? "pointer" : c === "knob" ? "grab" : "";
    showHint(c === "button" ? "Click to press" : c === "knob" ? "Drag to rotate" : ray ? deskSet.hint(ray) : null, e.clientX, e.clientY);
    deskSet.hover(ray); kick();
  };
  const onUp = (e: PointerEvent) => {
    if (held) { held = false; kick(); }
    if (turning && e.pointerId === turning.id) {
      // A click without a drag puts it back upright (the short way round) and the ink back to cream;
      // after a drag it settles on the nearest detent.
      if (turning.travel < .05 && e.type === "pointerup") { knobT = Math.round(knobT / (Math.PI * 2)) * Math.PI * 2; inkRef = knobT; }
      else knobT = Math.round(knobT / DETENT) * DETENT;
      turning = null; canvas.style.cursor = e.pointerType === "mouse" ? "grab" : ""; kick();
    }
  };
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  const onLeave = () => { deskSet.hover(null); showHint(null); if (!turning) canvas.style.cursor = ""; };
  /* The entrance plays as the opening sheet lifts, if the scene is ready by then. If it is not, the
     poster has shown the desk with everything in its place, so the scene takes over from it as it is
     (no entrance: the tools must not jump away from where the poster showed them). Reduced motion
     and snapshot mode get the finished desk. */
  const onRevealed = () => {
    if (!ready) { introAt = 0; return; }
    startProbe();
    if (introAt >= 0 || reduce.matches || document.documentElement.hasAttribute("data-snap")) return;
    introAt = performance.now(); deskSet.enter(); kick();
  };
  window.addEventListener("launch:revealed", onRevealed);
  // Ready after the sheet has gone: no entrance (onRevealed above), the canvas fades in over the poster.
  if (!document.querySelector('[data-launch-loader]:not([data-phase="leaving"])')) introAt = Math.max(introAt, 0);
  canvas.addEventListener("pointerleave", onLeave);
  const onVisibility = () => { if (!document.hidden) { kick(); if (reprobe) startProbe(); } };
  document.addEventListener("visibilitychange", onVisibility);
  // The cursor blinks; a blink asks for one frame, and only while the device is on screen.
  const blink = window.setInterval(() => {
    cursor.visible = !cursor.visible;
    if (!document.hidden && device.visible && canvas.style.opacity !== "0") renderOnce();
  }, 530);

  // Compile every material up front, off the main thread where the driver allows it, so the first
  // frame does not stall on shader compilation.
  hooks.onProgress?.(.75);
  /* The device lives on layer 1 on every screen, so it can be drawn on its own, on top of the desk:
     then the veil can sit above everything on the desk (the tall mug included) and darken it evenly,
     while the device rising out of it stays bright. The lights and shadow cameras include layer 1, so
     it is lit and casts its shadow exactly as before. Desktop does this inside its composer; phones
     draw the two passes directly (see frame()). */
  device.traverse((o) => o.layers.set(DEVICE_LAYER));
  camera.layers.enable(DEVICE_LAYER);
  scene.traverse((o) => {
    if (!(o as THREE.Light).isLight) return;
    o.layers.enable(DEVICE_LAYER);
    (o as THREE.Light & { shadow?: THREE.LightShadow }).shadow?.camera.layers.enable(DEVICE_LAYER);
  });
  const phoneDeviceMask = new THREE.Layers(); phoneDeviceMask.set(DEVICE_LAYER);
  // Desktop: ambient occlusion so things darken where they meet the mat. The dark scenes draw straight
  // to the screen and keep their transparency.
  const passMaterials = new THREE.Scene(), screenPasses = new THREE.Scene();
  /* Stand-ins for the materials three uses internally on the scene's meshes: the shadow maps' depth
     material and the ambient occlusion's normal pass. three caches programs by their settings, not by
     material, so compiling look-alikes ahead of time gives the real ones a finished program. They are
     drawn into render targets, with each side and with instancing (each a separate program). */
  const helpers = new THREE.Scene(), helperTarget = keep(new THREE.WebGLRenderTarget(1, 1));
  {
    const tri = geo(new THREE.PlaneGeometry(1, 1));
    for (const side of [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide]) {
      const depth = keep(new THREE.MeshDepthMaterial({ side }));
      helpers.add(new THREE.Mesh(tri, depth), new THREE.InstancedMesh(tri, depth, 1));
    }
  }
  let composerTarget: THREE.WebGLRenderTarget | null = null, disposeComposer: (() => void) | null = null;
  if (!small()) {
    const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { OutputPass }] = await Promise.all([
      import("three/addons/postprocessing/EffectComposer.js"),
      import("three/addons/postprocessing/RenderPass.js"),
      import("three/addons/postprocessing/GTAOPass.js"),
      import("three/addons/postprocessing/OutputPass.js"),
    ]);
    if (signal?.aborted) return abandon();
    const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
    // 2x MSAA: enough for the mat's grid and the device's edges; 4x cost a lot of fill on integrated GPUs.
    const target = new THREE.WebGLRenderTarget(buffer.x, buffer.y, { type: THREE.HalfFloatType, samples: 2 });
    const c = new EffectComposer(renderer, target); composerTarget = target;
    c.addPass(new RenderPass(scene, camera));
    // Ambient occlusion is soft by nature, so it is worked out at half resolution (its normal pass,
    // the occlusion and the denoise) and blended back up over the full-size image.
    class HalfGTAOPass extends GTAOPass {
      setSize(w: number, h: number) { super.setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2))); }
    }
    const gtao = new HalfGTAOPass(scene, camera, Math.round(buffer.x / 2), Math.round(buffer.y / 2));
    gtao.updateGtaoMaterial({ radius: .5, distanceExponent: 1.4, thickness: 1.2, scale: 1.3, samples: 8 });
    gtao.blendIntensity = .95;
    c.addPass(gtao);
    /* The device is drawn on its own, on top, after the occlusion: the desk's AO never darkens it and
       the veil can sit over the desk without covering it. It lives on layer 1. The first passes leave
       layer 1 out (frame() turns it off around the composer), but the shadow cameras and the lights
       include it, so it still casts its shadow on the mat and is lit exactly as before. */
    const deviceCam = camera.clone();
    class DevicePass extends RenderPass {
      render(r: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget, dt: number, mask: boolean) {
        deviceCam.copy(camera); deviceCam.layers.set(DEVICE_LAYER);
        // The shadow maps were drawn by the first pass this frame; do not draw them again.
        const auto = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false;
        super.render(r, write, read, dt, mask);
        r.shadowMap.autoUpdate = auto;
      }
    }
    const dp = new DevicePass(scene, deviceCam); dp.clear = false; dp.clearDepth = true;
    c.addPass(dp);
    const output = new OutputPass();
    // OutputPass picks its defines on its first frame, which would compile it then; set them now, as
    // it would, so the program compiled below is the one it uses.
    {
      const o = output as unknown as { _outputColorSpace: string | null; _toneMapping: number | null };
      o._outputColorSpace = renderer.outputColorSpace; o._toneMapping = renderer.toneMapping;
      output.material.defines = { ACES_FILMIC_TONE_MAPPING: "" };
      if (THREE.ColorManagement.getTransfer(renderer.outputColorSpace) === THREE.SRGBTransfer) output.material.defines.SRGB_TRANSFER = "";
      output.material.needsUpdate = true;
    }
    c.addPass(output);
    const normals = gtao.normalMaterial;
    helpers.add(new THREE.Mesh(geo(new THREE.PlaneGeometry(1, 1)), normals), new THREE.InstancedMesh(geo(new THREE.PlaneGeometry(1, 1)), normals, 1));
    c.setPixelRatio(renderer.getPixelRatio()); c.setSize(innerWidth, innerHeight);
    composer = c;
    // The passes' own materials (ambient occlusion, output) compile with the scene's below, in
    // the background, instead of on the composer's first frame.
    // Without normals, like the composer's own full-screen triangle (normals change the program).
    const quad = geo(new THREE.PlaneGeometry(2, 2)); quad.deleteAttribute("normal");
    for (const pass of c.passes) for (const v of Object.values(pass)) {
      if (!(v as THREE.Material)?.isMaterial) continue;
      // Every pass draws into the composer's buffers except the last, which draws to the screen.
      const m = new THREE.Mesh(quad, v as THREE.Material); m.frustumCulled = false; (pass === output ? screenPasses : passMaterials).add(m);
    }
    disposeComposer = () => { c.dispose(); target.dispose(); gtao.dispose(); };
    disposables.push({ dispose: () => disposeComposer?.() });
  }
  /* Compile every shader before it is first drawn, in the background (parallel compile): a shader
     first met mid-frame compiles on the spot and freezes the page for a few hundred milliseconds.
     three builds a separate variant of each material per render target (tone mapping and colour
     space differ) and per set of lights, so each state the page shows needs its own set:
       desk  the desk as it starts (desktop draws it into the composer's buffer)
       dark  the dark scenes: the desk hidden, and with it the window light and the wall fill (see
             frame()), drawn straight to the screen
       wall  More work: the wall up (its strip light), then the hologram too (its own light)
     The desk's set is compiled and waited for before the first frame; the others are started then too. */
  // One slot of background work: an idle moment, or a short wait at most, so setup never starves.
  const slot = () => new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(() => resolve(), { timeout: 60 });
    else setTimeout(resolve, 0);
  });
  const lightsOf = [...sunExtras, wallFill];
  /* Compiled a few meshes at a time, about 12 ms per slot: building a program's source is synchronous
     work, and a whole state at once held the main thread for over a second. Each mesh is compiled as
     a shallow clone (same geometry and material, so the same program) against the real scene's
     lights; whatever is switched for the state is switched back within the same slot, before any
     frame can see it. */
  /* The More work wall: built in an idle moment, its textures uploaded in idle time, then its two
     states compiled a slice at a time. It stays hidden throughout (its light included, so the desk's
     own shaders are untouched). If More work is reached first, setWall builds it on the spot. */
  let wallPrepared = false;
  function prepareWall() {
    if (wallPrepared || disposed) return;
    wallPrepared = true;
    void (async () => {
      await slot(); if (disposed) return;
      uploadIdle(deskSet.buildWall());
      for (const set of ["wall", "wall+holo"] as const) await compileFor(set);
    })();
  }
  const compileFor = async (state: "desk" | "dark" | "wall" | "wall+holo", target = composerTarget) => {
    const dark = state === "dark";
    const meshes: THREE.Object3D[] = [];
    const take = (o: THREE.Object3D) => o.traverse((m) => { if ((m as THREE.Mesh).isMesh || (m as THREE.Points).isPoints) meshes.push(m); });
    // The dark scenes show only what is outside the desk (the device, the veil).
    if (dark) scene.children.filter((o) => o !== desk).forEach(take); else take(scene);
    // The shadow and occlusion passes under this state's lights (always into a render target) go last.
    const helperMeshes = helpers.children.slice();
    const pending: Promise<unknown>[] = [];
    for (let i = 0; i < meshes.length + helperMeshes.length;) {
      await slot();
      if (disposed) return;
      if (state !== "desk" && !dark) deskSet.prewarm(true, state === "wall+holo");
      const lit = lightsOf.map((l) => l.visible);
      if (dark) lightsOf.forEach((l) => { l.visible = false; });
      const until = performance.now() + 12;
      do {
        const helper = i >= meshes.length;
        const src = helper ? helperMeshes[i - meshes.length] : meshes[i];
        renderer.setRenderTarget(helper ? helperTarget : dark ? null : target);
        const batch = new THREE.Group(); batch.add(src.clone(false));
        pending.push(compile(batch, camera, scene));
        i++;
      } while (i < meshes.length + helperMeshes.length && performance.now() < until);
      if (state !== "desk" && !dark) deskSet.prewarm(false);
      lightsOf.forEach((l, k) => { l.visible = lit[k]; });
      renderer.setRenderTarget(null);
    }
    await Promise.all(pending);
  };
  await compileFor("desk");
  hooks.onProgress?.(.88);
  if (composer) {
    renderer.setRenderTarget(helperTarget);
    const inTarget = compile(passMaterials, camera);
    renderer.setRenderTarget(null);
    await Promise.all([inTarget, compile(screenPasses, camera)]);
  }
  hooks.onProgress?.(.94);
  // The dark scenes are started now too, but not waited for: they finish in the background long
  // before anyone scrolls to them. The wall's states wait for the wall (prepareWall below).
  void compileFor("dark");
  // Upload every texture now too (the hidden parts' and the notebook pages'), one per idle moment,
  // rather than the first time each is drawn: after the reveal has played (the sheet lifting, the
  // desk's entrance), and then only in real idle time, so it never competes with the opening.
  const uploadIdle = (root: THREE.Object3D) => {
    const textures = new Set<THREE.Texture>();
    root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      for (const mat of m ? (Array.isArray(m) ? m : [m]) : []) for (const v of Object.values(mat)) if ((v as THREE.Texture)?.isTexture) textures.add(v as THREE.Texture);
    });
    const queue = [...textures];
    idleQueue(() => { const t = queue.shift(); if (!t) return false; renderer.initTexture(t); return true; });
  };
  afterOpening(() => uploadIdle(scene));
  // The More work wall is built on approach: as the projects come into view (see choreograph()), or
  // in idle time a while after the opening, whichever comes first.
  afterOpening(() => window.setTimeout(() => { if (!disposed) prepareWall(); }, 4000));
  // Hand More work its projects then too, so its pages are drawn in idle time long before it is reached.
  afterOpening(() => moreWork());
  await envArrived;
  await yieldToMain(); if (signal?.aborted) return abandon();
  // Paint the first frame now, not on the next animation frame: rAF never fires in a background tab.
  ready = true;
  frame();
  if (!document.querySelector('[data-launch-loader]:not([data-phase="leaving"])')) startProbe();
  hooks.onProgress?.(1);

  return {
    press,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf); clearInterval(blink);
      removeEventListener("pointermove", onPointer); removeEventListener("resize", resize); removeEventListener("scroll", kick);
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerleave", onLeave); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp); window.removeEventListener("launch:revealed", onRevealed);
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    },
  };
}
