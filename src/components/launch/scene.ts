import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { buildDesk } from "./desk";

/**
 * The launch scene: the device on a desk, then lifted into a spotlight, turned under a thermal camera,
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
  /** Setup progress from 0 to 1, for the loading screen. */
  onProgress?: (value: number) => void;
  /** Called when scrolling moves the thermal slider, so its readout can follow. */
  onHeat?: (value: number) => void;
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
  let composer: { render: () => void; setSize: (w: number, h: number) => void; setPixelRatio: (r: number) => void } | null = null;
  let bokeh: { uniforms: { focus: { value: number } } } | null = null;
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
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  // Variance shadows blur properly, which is what makes a soft window light look like one.
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  camera.position.set(0, 0, 12);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTarget = pmrem.fromScene(room, .04);
  room.dispose(); pmrem.dispose();
  scene.environment = envTarget.texture;
  // Low: a bright studio reflection is what made everything read as glossy plastic.
  scene.environmentIntensity = .16;
  hooks.onProgress?.(.25);
  await yieldToMain(); if (signal?.aborted) { envTarget.dispose(); renderer.dispose(); return null; }

  // Everything created here is tracked so dispose() can release it.
  const disposables: { dispose: () => void }[] = [envTarget];
  const keep = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };

  const sunExtras: THREE.Light[] = [];
  const sun = new THREE.DirectionalLight(0xffe0bd, 1.7);
  sun.position.set(-5, 6, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);

  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 6, bottom: -6, near: 1, far: 30 });
  sun.shadow.bias = -.0006; sun.shadow.radius = 9; sun.shadow.blurSamples = 16;
  scene.add(sun, new THREE.HemisphereLight(0xffe9cf, 0x3a2414, .6));
  // Late sun through a window: a spot light carrying a blurred pane pattern across the desk.
  if (!small()) {
    const panes = document.createElement("canvas"); panes.width = panes.height = 256;
    // Light through a window with a plant in it: bright panes broken up by soft leaf shadows.
    const pc = panes.getContext("2d")!; pc.fillStyle = "#000"; pc.fillRect(0, 0, 256, 256); pc.filter = "blur(7px)"; pc.fillStyle = "#fff";
    for (const [px, py] of [[20, 20], [134, 20], [20, 134], [134, 134]]) pc.fillRect(px, py, 102, 102);
    pc.fillStyle = "#000"; let ls = 5; const lr = () => { ls = (Math.imul(ls, 1664525) + 1013904223) >>> 0; return ls / 4294967296; };
    for (let i = 0; i < 26; i++) { pc.beginPath(); pc.ellipse(120 + (lr() - .5) * 200, 60 + lr() * 150, 8 + lr() * 18, 4 + lr() * 8, lr() * Math.PI, 0, Math.PI * 2); pc.fill(); }
    const paneTex = new THREE.CanvasTexture(panes); paneTex.colorSpace = THREE.SRGBColorSpace; disposables.push(paneTex);
    const windowLight = new THREE.SpotLight(0xffc98f, 95, 40, .55, .6, 1.2);
    windowLight.position.set(-9, 7, 11); windowLight.target.position.set(1.5, -1, 0);
    windowLight.map = paneTex; windowLight.castShadow = true; windowLight.shadow.mapSize.set(1024, 1024); windowLight.shadow.radius = 12; windowLight.shadow.blurSamples = 16; windowLight.shadow.bias = -.0006;
    scene.add(windowLight, windowLight.target);
    sunExtras.push(windowLight);
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

  const abandon = () => { disposables.forEach((d) => d.dispose()); renderer.dispose(); return null; };
  await yieldToMain(); if (signal?.aborted) return abandon();

  /* ---------- The desk ---------- */
  const deskSet = buildDesk({ tex, std, geo, mesh, SANS, MONO, TEX, phone: small(), photo: !small() });
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
  const shell = phys({ color: 0xe6dccb, roughness: .66, sheen: .2, sheenRoughness: .8 });
  const accent = phys({ color: 0xc8692c, roughness: .55, envMapIntensity: .35 });
  const dark = phys({ color: 0x2a221c, roughness: .5 });
  const olive = phys({ color: 0x4d5a36, roughness: .6, envMapIntensity: .35 });
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
  const labelTex = tex(512, 64, (x) => { x.fillStyle = "#8a7c6a"; x.font = `800 34px ${SANS}`; x.fillText("YOSSI ABUTBUL", 0, 44); x.font = `400 20px ${MONO}`; x.fillText("YA-26", 290, 43); });
  const label = new THREE.Mesh(geo(new THREE.PlaneGeometry(1.2, .15)), keep(new THREE.MeshBasicMaterial({ transparent: true, map: labelTex })));
  label.position.set(-.73, -.82, FRONT + .002); device.add(label);
  // Contact shadow under the device while it lies on the desk: what makes it sit rather than hover.
  const devicePadTex = tex(256, 160, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); g.addColorStop(0, "rgba(0,0,0,.7)"); g.addColorStop(.6, "rgba(0,0,0,.35)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const devicePad = new THREE.Mesh(geo(new THREE.PlaneGeometry(W * 1.25, H * 1.35)), keep(new THREE.MeshBasicMaterial({ map: devicePadTex, transparent: true, depthWrite: false, toneMapped: false })));
  devicePad.position.z = .006; devicePad.renderOrder = 1; scene.add(devicePad);
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
    x.fillStyle = "#a08c78"; x.font = `400 18px ${MONO}`; x.fillText("YOSSI ABUTBUL  ·  FW 2.1", 22, 38);
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
      ships?.querySelectorAll<HTMLElement>("[data-fade]").forEach((el) => el.toggleAttribute("data-off", p < .08 || p > .92));
    } else if (rect(therm).top > vh * .4) {
      t.veil = 1; t.show = 0; t.z = 2.4; t.s = .2; backdrop = "void";
    } else if (rect(pressSec).top > vh * .4) {
      const p = prog(therm); thermalMode = true; backdrop = "thermal";
      t.veil = 1; t.z = 2; t.rx = -.25; t.ry = -.6 + p * 1.4; t.rz = .05; t.s = mob ? .66 : .95;
      therm?.querySelectorAll<HTMLElement>("[data-fade]").forEach((el) => el.toggleAttribute("data-off", p < .1));
      if (heat && !heatManual) {
        const next = Math.round(smooth(.15, .85, p) * 100);
        if (+heat.value !== next) { heat.value = String(next); hooks.onHeat?.(next); }
      }
    } else {
      const p = prog(pressSec);
      t.veil = 1 - smooth(0, .3, p); t.spot = t.veil;
      t.z = lerp(2.2, FRONT, smooth(0, .35, p)); t.rx = lerp(-.3, 0, smooth(0, .35, p)); t.ry = lerp(.8, 0, smooth(0, .35, p));
      backdrop = t.veil > .5 ? "void" : "desk";
    }
    if (rect(after).top < vh * .6) t.show = 0;
    // The giant word crosses the ships beat from right to left, behind the device.
    const word = byId("launch-word");
    if (word) {
      const r = rect(ships), onScreen = r.top < vh && r.bottom > 0;
      word.style.opacity = onScreen ? "1" : "0";
      if (onScreen) word.style.transform = `translate3d(${lerp(innerWidth, -word.offsetWidth, prog(ships))}px, 0, 0)`;
    }
    return { t, backdrop, thermalMode };
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    composer?.setPixelRatio(renderer.getPixelRatio()); composer?.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.fov = small() ? 44 : 30; camera.updateProjectionMatrix();
    kick();
  }
  addEventListener("resize", resize); resize();

  function frame() {
    // One clock for everything: rAF timestamps and performance.now() disagree by up to a frame.
    const now = performance.now();
    raf = 0;
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    // <html data-snap> (set by the screenshot harness) skips easing so captures show the exact pose.
    const still = reduce.matches || document.documentElement.hasAttribute("data-snap");
    if (!still) time += dt;
    const { t, backdrop, thermalMode } = choreograph();
    if (backdrop !== lastBackdrop) { lastBackdrop = backdrop; hooks.onBackdrop?.(backdrop); }
    const k = still ? 1 : 1 - Math.exp(-dt * 5);
    let moving = 0;
    (Object.keys(cur) as (keyof Pose)[]).forEach((key) => { const next = lerp(cur[key], t[key], k); moving += Math.abs(next - cur[key]); cur[key] = next; });
    pointer.x = lerp(pointer.x, pointer.tx, 1 - Math.exp(-dt * 4)); pointer.y = lerp(pointer.y, pointer.ty, 1 - Math.exp(-dt * 4));
    moving += Math.abs(pointer.tx - pointer.x) + Math.abs(pointer.ty - pointer.y);
    const lifted = clamp((cur.z - FRONT) / 1.5);
    // The desk is playable only while it is lit and the device is lying on it.
    const onDesk = desk.visible && cur.veil < .05 && lifted < .03;
    const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), halfW = halfH * camera.aspect;
    const obstacles: [number, number, number][] = onDesk ? [-1, 0, 1].map((k) => [cur.x + k * .95 * cur.s, cur.y, .95 * cur.s] as [number, number, number]) : [];
    // The mat is the edge: tools can be nudged partly out of frame, and their home spring brings them back.
    const edge = { w: 6.2, h: 4.2 };
    const deskMoving = desk.visible ? deskSet.update(dt, edge, obstacles) : false;
    if (!onDesk) deskSet.hover(null);
    canvas.style.pointerEvents = onDesk ? "auto" : "none";
    device.position.set(cur.x, cur.y + (still ? 0 : Math.sin(time * 1.2) * .04 * lifted), cur.z);
    // Lying on the desk the device is still; only once lifted does it lean toward the pointer.
    device.rotation.set(cur.rx + pointer.y * .12 * lifted, cur.ry + pointer.x * .25 * lifted, cur.rz);
    device.scale.setScalar(Math.max(.0001, cur.s * cur.show));
    devicePad.visible = desk.visible && lifted < .5; devicePad.position.set(cur.x + .08, cur.y - .1, .006); devicePad.scale.setScalar(cur.s); (devicePad.material as THREE.MeshBasicMaterial).opacity = 1 - lifted * 2;
    device.visible = cur.show > .02;
    veilMat.opacity = cur.veil;
    // Fully dark: drop the veil and the desk, so the canvas is transparent and the page shows through.
    veil.visible = desk.visible = cur.veil < .985;
    spot.intensity = cur.spot * 90; sun.intensity = 1.7 * (1 - cur.veil * .8);
    sunExtras.forEach((l) => { l.visible = desk.visible; });
    canvas.style.opacity = cur.show < .05 && cur.veil > .98 ? "0" : "1";
    setThermal(thermalMode);
    const heatValue = heat ? +heat.value : 0;
    thermal.uniforms.uHeat.value = 1 - heatValue / 100; thermal.uniforms.uTime.value = time;
    if (thermalMode && scr.mode !== "heat") show("heat", "4,320 MIN\n→ 8 MIN");
    else if (!thermalMode && scr.mode === "heat") show(presses ? "msg" : "boot", "READY");
    pressT = Math.max(0, pressT - dt * 5);
    button.position.z = FRONT + .07 - Math.sin(pressT * Math.PI) * .06;
    // On the desk the camera leans back and turns a touch, like a photo taken standing over a table;
    // it straightens up as the room goes dark so every later pose is shot square on.
    const tilt = 1 - cur.veil;
    camera.position.set(0, -5.2 * tilt, 12 + 1.1 * tilt);
    camera.up.set(Math.sin(.035 * tilt), Math.cos(.035 * tilt), 0);
    camera.lookAt(0, .7 * tilt, 0);
    if (composer && desk.visible) {
      if (bokeh) bokeh.uniforms.focus.value = camera.position.distanceTo(device.position);
      composer.render();
    } else renderer.render(scene, camera);
    // Keep going while anything is still easing, the device is floating, or a gag is animating;
    // otherwise stop until scroll, pointer or resize wakes it.
    const floating = !still && lifted > .05 && device.visible;
    idleFrames = moving > .0005 || floating || pressT > 0 || thermalMode || deskMoving ? 0 : idleFrames + 1;
    if (idleFrames < 30 && !document.hidden) raf = requestAnimationFrame(frame);
  }
  // Waking from idle restarts the clock; a kick while already running must not, or dt collapses to 0.
  function kick() { if (!raf && !disposed) { if (idleFrames >= 30) last = performance.now(); raf = requestAnimationFrame(frame); } }
  addEventListener("scroll", kick, { passive: true });

  /* ---------- Playing with the desk ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const rayAt = (x: number, y: number) => { const r = canvas.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray; };
  // The desk reacts to the pointer; a tap or click gives the nearby tools a push. Nothing is dragged,
  // so touch never has to fight the page's own scrolling.
  const onDown = (e: PointerEvent) => { deskSet.poke(rayAt(e.clientX, e.clientY)); kick(); };
  const onMove = (e: PointerEvent) => { if (e.pointerType !== "mouse") return; deskSet.hover(rayAt(e.clientX, e.clientY)); kick(); };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  const onLeave = () => deskSet.hover(null);
  // The tools hop once, as soon as the loading sheet has lifted (or straight away if there is none).
  const onRevealed = () => { deskSet.hop(); kick(); };
  window.addEventListener("launch:revealed", onRevealed);
  if (!document.querySelector("[data-launch-loader]")) onRevealed();
  canvas.addEventListener("pointerleave", onLeave);
  const onVisibility = () => { if (!document.hidden) kick(); };
  document.addEventListener("visibilitychange", onVisibility);
  const blink = window.setInterval(() => { if (scr.mode !== "heat" && !document.hidden) { scr.cursor = !scr.cursor; drawScreen(); kick(); } }, 530);

  // Compile every material up front, off the main thread where the driver allows it, so neither the
  // first frame nor the thermal switch stalls on shader compilation.
  hooks.onProgress?.(.75);
  // Desktop: ambient occlusion so things darken where they meet the mat, and a shallow depth of field
  // focused on the device. The dark scenes draw straight to the screen and keep their transparency.
  if (!small()) {
    const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { BokehPass }, { OutputPass }] = await Promise.all([
      import("three/addons/postprocessing/EffectComposer.js"),
      import("three/addons/postprocessing/RenderPass.js"),
      import("three/addons/postprocessing/GTAOPass.js"),
      import("three/addons/postprocessing/BokehPass.js"),
      import("three/addons/postprocessing/OutputPass.js"),
    ]);
    if (signal?.aborted) return abandon();
    const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(buffer.x, buffer.y, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EffectComposer(renderer, target);
    c.addPass(new RenderPass(scene, camera));
    const gtao = new GTAOPass(scene, camera, buffer.x, buffer.y);
    gtao.updateGtaoMaterial({ radius: .5, distanceExponent: 1.4, thickness: 1.2, scale: 1.3, samples: 16 });
    gtao.blendIntensity = .95;
    c.addPass(gtao);
    // Just a hint of focus falloff at the far edge; sharpness is what makes a product shot read as real.
    const b = new BokehPass(scene, camera, { focus: 13, aperture: .0005, maxblur: .0025 });
    c.addPass(b);
    c.addPass(new OutputPass());
    c.setPixelRatio(renderer.getPixelRatio()); c.setSize(innerWidth, innerHeight);
    composer = c; bokeh = b as unknown as typeof bokeh;
    disposables.push({ dispose: () => { c.dispose(); target.dispose(); gtao.dispose(); b.dispose(); } });
  }
  await renderer.compileAsync(scene, camera).catch(() => {});
  hooks.onProgress?.(.9);
  setThermal(true); await renderer.compileAsync(scene, camera).catch(() => {}); setThermal(false);
  await yieldToMain(); if (signal?.aborted) return abandon();
  // Paint the first frame now, not on the next animation frame: rAF never fires in a background tab.
  frame();
  hooks.onProgress?.(1);

  return {
    press,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf); clearInterval(blink);
      removeEventListener("pointermove", onPointer); removeEventListener("resize", resize); removeEventListener("scroll", kick);
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerleave", onLeave); window.removeEventListener("launch:revealed", onRevealed);
      document.removeEventListener("visibilitychange", onVisibility);
      heat?.removeEventListener("input", onHeat);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
