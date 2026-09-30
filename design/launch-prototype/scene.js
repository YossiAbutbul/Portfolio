import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const canvas = document.getElementById("stage");
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { canvas.remove(); throw new Error("no WebGL"); }
const small = () => innerWidth <= 720;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small() ? 1.25 : 1.6));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, .1, 100); camera.position.set(0, 0, 12);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
scene.environmentIntensity = .35;

// Warm late-afternoon key from the upper left, like a desk by a window.
const sun = new THREE.DirectionalLight(0xffe0bd, 3.2); sun.position.set(-5, 6, 9); sun.castShadow = true;
sun.shadow.mapSize.set(small() ? 1024 : 2048, small() ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 6, bottom: -6, near: 1, far: 30 }); sun.shadow.bias = -.0004; sun.shadow.radius = 6;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xfff1e0, 0x2a1a10, .7));
// A soft spot that takes over once the desk goes dark.
const spot = new THREE.SpotLight(0xffd9b0, 0, 30, .45, .8, 1.2); spot.position.set(2, 5, 10); spot.target.position.set(0, 0, 0); scene.add(spot, spot.target);

const tex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

/* ---------- The desk ---------- */
const desk = new THREE.Group(); scene.add(desk);
const wood = tex(1024, 1024, (x, w, h) => {
  x.fillStyle = "#7a4a2a"; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { const y = Math.random() * h; x.strokeStyle = `rgba(${40 + Math.random() * 40},${20 + Math.random() * 20},10,${.08 + Math.random() * .12})`; x.lineWidth = 1 + Math.random() * 3; x.beginPath(); x.moveTo(0, y); for (let px = 0; px <= w; px += 32) x.lineTo(px, y + Math.sin(px / 90 + i) * 6); x.stroke(); }
  for (let i = 0; i < 6; i++) { x.fillStyle = "rgba(255,210,160,.05)"; x.fillRect(0, i * 180 + 60, w, 50); }
});
wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(2, 2);
const table = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), new THREE.MeshStandardMaterial({ map: wood, roughness: .7 })); table.position.z = -.06; table.receiveShadow = true; desk.add(table);

const MAT_W = 11.2, MAT_H = 7.4;
const matTex = tex(2240, 1480, (x, w, h) => {
  x.fillStyle = "#2c574a"; x.fillRect(0, 0, w, h);
  const cm = w / 56;
  for (let i = 0; i * cm <= w; i++) { x.strokeStyle = i % 5 ? "rgba(225,240,230,.16)" : "rgba(225,240,230,.34)"; x.lineWidth = i % 5 ? 1.2 : 2.2; x.beginPath(); x.moveTo(i * cm, 0); x.lineTo(i * cm, h); x.stroke(); }
  for (let j = 0; j * cm <= h; j++) { x.strokeStyle = j % 5 ? "rgba(225,240,230,.16)" : "rgba(225,240,230,.34)"; x.lineWidth = j % 5 ? 1.2 : 2.2; x.beginPath(); x.moveTo(0, j * cm); x.lineTo(w, j * cm); x.stroke(); }
  x.fillStyle = "rgba(230,240,232,.7)"; x.font = "22px 'JetBrains Mono', monospace";
  for (let i = 5; i * cm < w; i += 5) { x.fillText(String(i), i * cm + 6, 26); x.fillText(String(i), i * cm + 6, h - 12); }
  x.strokeStyle = "rgba(230,240,232,.3)"; x.lineWidth = 2; x.beginPath(); x.arc(w * .82, h * .72, h * .16, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.moveTo(w * .1, h * .9); x.lineTo(w * .3, h * .55); x.stroke();
  x.font = "700 26px Figtree, sans-serif"; x.fillText("YOSSI-1 · CUTTING MAT · DO NOT SHIP BUGS", 30, h - 46);
});
const mat = shadowed(new THREE.Mesh(new RoundedBoxGeometry(MAT_W, MAT_H, .05, 2, .02), [
  new THREE.MeshStandardMaterial({ color: 0x244a3e, roughness: .9 }), new THREE.MeshStandardMaterial({ color: 0x244a3e, roughness: .9 }),
  new THREE.MeshStandardMaterial({ color: 0x244a3e, roughness: .9 }), new THREE.MeshStandardMaterial({ color: 0x244a3e, roughness: .9 }),
  new THREE.MeshStandardMaterial({ map: matTex, roughness: .85 }), new THREE.MeshStandardMaterial({ color: 0x244a3e }),
])); mat.position.set(.9, -.1, -.03); mat.castShadow = false; desk.add(mat);

// Pencil, lying diagonally at the top right.
{
  const g = new THREE.Group();
  const body = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, 4.2, 6), new THREE.MeshStandardMaterial({ color: 0x5b6b3f, roughness: .45 }))); g.add(body);
  const wood2 = shadowed(new THREE.Mesh(new THREE.ConeGeometry(.11, .45, 6), new THREE.MeshStandardMaterial({ color: 0xd9b384, roughness: .8 }))); wood2.position.y = 2.32; g.add(wood2);
  const lead = shadowed(new THREE.Mesh(new THREE.ConeGeometry(.035, .14, 12), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: .4, metalness: .3 }))); lead.position.y = 2.6; g.add(lead);
  const ferrule = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.115, .115, .3, 24), new THREE.MeshStandardMaterial({ color: 0xc9c2b3, metalness: 1, roughness: .3 }))); ferrule.position.y = -2.2; g.add(ferrule);
  const rub = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .22, 24), new THREE.MeshStandardMaterial({ color: 0xd98a7a, roughness: .8 }))); rub.position.y = -2.45; g.add(rub);
  g.rotation.z = .62; g.position.set(4.3, 2.2, .12); desk.add(g);
}
// Utility knife, bottom right.
{
  const g = new THREE.Group();
  g.add(shadowed(new THREE.Mesh(new RoundedBoxGeometry(3.1, .46, .2, 3, .08), new THREE.MeshStandardMaterial({ color: 0xe0852f, roughness: .45 }))));
  const grip = shadowed(new THREE.Mesh(new RoundedBoxGeometry(1.5, .3, .22, 3, .06), new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: .8 }))); grip.position.x = -.5; g.add(grip);
  const blade = shadowed(new THREE.Mesh(new THREE.BoxGeometry(.9, .3, .02), new THREE.MeshStandardMaterial({ color: 0xdadada, metalness: 1, roughness: .2 }))); blade.position.x = 1.95; g.add(blade);
  const slider = shadowed(new THREE.Mesh(new RoundedBoxGeometry(.3, .16, .1, 2, .03), new THREE.MeshStandardMaterial({ color: 0xcfc8bb, metalness: .8, roughness: .3 }))); slider.position.set(.6, 0, .14); g.add(slider);
  g.rotation.z = .55; g.position.set(4.6, -2.6, .12); desk.add(g);
}
// Paperclips, top left.
function clip() {
  const path = new THREE.CurvePath();
  const pts = [[0, -.5], [0, .45], [.26, .45], [.26, -.62], [-.08, -.62], [-.08, .3], [.16, .3], [.16, -.35]];
  for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(pts[i][0], pts[i][1], 0), new THREE.Vector3(pts[i + 1][0], pts[i + 1][1], 0)));
  return shadowed(new THREE.Mesh(new THREE.TubeGeometry(path, 64, .022, 8, false), new THREE.MeshStandardMaterial({ color: 0xd9d6cf, metalness: 1, roughness: .25 })));
}
{ const a = clip(); a.position.set(-4.9, 2.4, .03); a.rotation.z = .9; desk.add(a); const b = clip(); b.position.set(-4.3, 1.9, .03); b.rotation.z = -.4; desk.add(b); }
// Eraser, bottom left.
{ const e = shadowed(new THREE.Mesh(new RoundedBoxGeometry(.9, .55, .3, 3, .08), new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: .9 }))); e.position.set(-4.6, -2.7, .15); e.rotation.z = .3; desk.add(e); }
// Sticky note with the to-do list.
{
  const note = tex(512, 512, (x, w, h) => { x.fillStyle = "#efe2c4"; x.fillRect(0, 0, w, h); x.fillStyle = "#3a2c22"; x.font = "600 44px Figtree, sans-serif"; ["TODO", "✓ find the slow part", "✓ build the fix", "✓ ship it", "☐ say hi"].forEach((l, i) => x.fillText(l, 40, 90 + i * 78)); });
  const n = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, .01), [0, 0, 0, 0, 0, 0].map((_, i) => i === 4 ? new THREE.MeshStandardMaterial({ map: note, roughness: .9 }) : new THREE.MeshStandardMaterial({ color: 0xe6d6b4 }))));
  n.position.set(-3.6, -.6, .02); n.rotation.z = -.12; desk.add(n);
}

// Dimmer: a warm-black veil laid over the desk, with a soft glow where the spotlight lands.
const veilTex = tex(512, 512, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 2); g.addColorStop(0, "#3a271b"); g.addColorStop(.55, "#1d1410"); g.addColorStop(1, "#17110e"); x.fillStyle = g; x.fillRect(0, 0, w, h); });
const veil = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshBasicMaterial({ map: veilTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
veil.position.z = .3; veil.renderOrder = 1; scene.add(veil);

/* ---------- The device ---------- */
const device = new THREE.Group(); scene.add(device);
const W = 3, H = 1.9, D = .75, FRONT = D / 2;
const shell = new THREE.MeshPhysicalMaterial({ color: 0xe9dfcf, roughness: .5, clearcoat: .3 });
const accent = new THREE.MeshPhysicalMaterial({ color: 0xc46f35, roughness: .4, clearcoat: .4 });
const dark = new THREE.MeshPhysicalMaterial({ color: 0x2a221c, roughness: .5 });
const olive = new THREE.MeshPhysicalMaterial({ color: 0x4d5a36, roughness: .45, clearcoat: .5 });
const glass = new THREE.MeshPhysicalMaterial({ color: 0x0c0a09, roughness: .1, clearcoat: 1 });
const body = shadowed(new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 6, .22), shell)); device.add(body);
const sc = document.createElement("canvas"); sc.width = 640; sc.height = 384; const sx = sc.getContext("2d");
const screenTex = new THREE.CanvasTexture(sc); screenTex.colorSpace = THREE.SRGBColorSpace;
const bezel = shadowed(new THREE.Mesh(new RoundedBoxGeometry(1.86, 1.16, .04, 3, .06), glass)); bezel.position.set(-.45, .14, FRONT); device.add(bezel);
const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 1.03), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false })); screen.position.set(-.45, .14, FRONT + .023); device.add(screen);
const knob = new THREE.Group(); knob.position.set(.95, .38, FRONT); device.add(knob);
const knobBody = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.27, .29, .24, 64), accent)); knobBody.rotation.x = Math.PI / 2; knobBody.position.z = .12; knob.add(knobBody);
const notch = new THREE.Mesh(new THREE.BoxGeometry(.035, .14, .01), dark); notch.position.set(0, .15, .245); knob.add(notch);
const button = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .14, 64), olive)); button.rotation.x = Math.PI / 2; button.position.set(.95, -.46, FRONT + .07); device.add(button);
const grille = new THREE.InstancedMesh(new THREE.CircleGeometry(.018, 10), dark, 60); const m4 = new THREE.Object3D();
for (let i = 0; i < 60; i++) { m4.position.set(-1.28 + (i % 20) * .088, -.62 - Math.floor(i / 20) * .085, FRONT + .002); m4.updateMatrix(); grille.setMatrixAt(i, m4.matrix); }
device.add(grille);
const label = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .15), new THREE.MeshBasicMaterial({ transparent: true, map: tex(512, 64, (x) => { x.fillStyle = "#8a7c6a"; x.font = "800 34px Figtree, sans-serif"; x.fillText("YOSSI-1", 0, 44); x.font = "400 20px 'JetBrains Mono', monospace"; x.fillText("MODEL YA-26", 200, 43); }) }));
label.position.set(-.73, -.82, FRONT + .002); device.add(label);
const deviceMeshes = []; device.traverse((o) => { if (o.isMesh && o !== screen && o !== label) deviceMeshes.push(o); });
const originals = new Map(deviceMeshes.map((o) => [o, o.material]));

// Thermal camera look: brightness from facing and height, mapped through an ironbow ramp.
const thermal = new THREE.ShaderMaterial({
  uniforms: { uHeat: { value: 1 }, uTime: { value: 0 } },
  vertexShader: "varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = (modelMatrix * vec4(position,1.)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
  fragmentShader: `uniform float uHeat, uTime; varying vec3 vN; varying vec3 vP;
  vec3 ramp(float t){ t = clamp(t,0.,1.);
    vec3 a = vec3(.10,.03,.25), b = vec3(.55,.07,.55), c = vec3(.92,.22,.18), d = vec3(1.,.66,.16), e = vec3(1.,.96,.72);
    return t < .25 ? mix(a,b,t/.25) : t < .5 ? mix(b,c,(t-.25)/.25) : t < .75 ? mix(c,d,(t-.5)/.25) : mix(d,e,(t-.75)/.25); }
  void main(){ float facing = max(vN.z, 0.); float core = 1. - clamp(length(vP.xy) / 2.2, 0., 1.);
    float t = uHeat * (.35 + .45 * core + .25 * facing) + .12 * facing + .015 * sin(vP.y * 9. + uTime * 2.);
    gl_FragColor = vec4(ramp(t), 1.); }`,
});
let thermalOn = false;
function setThermal(on) { if (on === thermalOn) return; thermalOn = on; deviceMeshes.forEach((o) => { o.material = on ? thermal : originals.get(o); }); }

/* ---------- Screen ---------- */
const scr = { mode: "boot", text: "", cursor: true };
function drawScreen() {
  const x = sx; x.fillStyle = "#0e0b09"; x.fillRect(0, 0, 640, 384);
  x.fillStyle = "#a08c78"; x.font = "400 18px 'JetBrains Mono', monospace"; x.fillText("YOSSI-1  ·  FW 2.1", 22, 38);
  x.fillStyle = "#f2e6d4"; x.font = "800 58px Figtree, sans-serif";
  const text = scr.mode === "boot" ? "READY" : scr.text;
  text.split("\n").forEach((l, i) => x.fillText(l, 22, 170 + i * 64));
  if (scr.cursor) x.fillRect(22, 300, 26, 6);
  x.fillStyle = "#a08c78"; x.font = "400 18px 'JetBrains Mono', monospace"; x.fillText(scr.mode === "boot" ? "PRESS THE BUTTON  ●" : `SHIPPED: ${presses}`, 22, 356);
  screenTex.needsUpdate = true;
}
let presses = 0, pressT = 0;
function show(mode, text = "") { scr.mode = mode; scr.text = text; drawScreen(); }
drawScreen(); if (document.fonts) document.fonts.ready.then(drawScreen);
const LINES = ["SHIPPING…", "BUILT\nEND TO END", "3 DAYS\n→ 8 MIN", "NO TOAST\nWAS HARMED", "READY"];
function press() {
  presses++; pressT = 1;
  let t = LINES[(presses - 1) % LINES.length];
  if (presses === 8) t = "YOU CAN\nSTOP NOW"; if (presses === 13) t = "FINE.\nKEEP GOING";
  if (presses === 25) { t = "ACHIEVEMENT:\nPERSISTENT"; window.say("25 presses. Same energy goes into debugging."); }
  show("msg", t); document.getElementById("press-count").textContent = `${presses} shipped`;
}
document.getElementById("press-btn").addEventListener("click", press);
window.pressDevice = press;

/* ---------- Scroll choreography ---------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches, SNAP = location.hash === "#snap";
const $ = (id) => document.getElementById(id);
const secs = ["intro", "ships", "work", "thermal", "press", "changelog"].reduce((o, id) => (o[id] = $(id), o), {});
function prog(el) { const r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight)); }
function inView(el) { const r = el.getBoundingClientRect(); return r.top < innerHeight * .5 && r.bottom > innerHeight * .5; }
const introFades = [...secs.intro.querySelectorAll(".fade")], thermalFades = [...secs.thermal.querySelectorAll(".fade")];
const shipsKick = $("ships-kick"), word = $("slide-word"), reel = $("reel"), cards = [...reel.children], count = $("reel-count");
const heat = $("heat"), heatRead = $("heat-read"); let heatManual = false;
heat.addEventListener("input", () => { heatManual = true; });

const pose = { x: 0, y: 0, z: FRONT, rx: 0, ry: 0, rz: 0, s: 1, veil: 0, spot: 0, show: 1 };
const cur = { ...pose };
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener("pointermove", (e) => { pointer.tx = e.clientX / innerWidth * 2 - 1; pointer.ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });
let last = performance.now(), time = 0, lastBody = "";

function choreograph() {
  const P = { intro: prog(secs.intro), ships: prog(secs.ships), work: prog(secs.work), thermal: prog(secs.thermal), press: prog(secs.press) };
  const r = (id) => secs[id].getBoundingClientRect();
  const vh = innerHeight, mob = small();
  const t = { x: 0, y: 0, z: FRONT, rx: 0, ry: 0, rz: 0, s: mob ? .72 : 1, veil: 0, spot: 0, show: 1 };
  let bodyColor = "void", thermalMode = false;
  if (r("intro").top > 0) {
    // Hero: lying on the desk.
  } else if (r("ships").top > 0) {
    const p = P.intro;
    t.veil = smooth(0, .3, p); t.spot = t.veil;
    t.z = lerp(FRONT, 2.4, smooth(.05, .5, p)); t.rx = lerp(0, -.35, smooth(.1, .6, p)); t.ry = lerp(0, Math.PI * 2 - .5, smooth(.1, 1, p)); t.rz = lerp(0, .08, p);
    t.s = (mob ? .72 : 1) * lerp(1, .92, p);
    introFades.forEach((el) => el.toggleAttribute("data-off", p < .35));
  } else if (r("work").top > vh * .2) {
    const p = P.ships;
    t.veil = 1; t.spot = 1; t.z = 2.4; t.rx = -.35 + Math.sin(p * Math.PI) * .2; t.ry = -.5 + p * Math.PI; t.rz = .08; t.s = (mob ? .62 : .92);
    shipsKick.toggleAttribute("data-off", p < .08 || p > .92);
    // The device bows out before the project reel arrives.
    t.show = 1 - smooth(.82, .98, p);
  } else if (r("thermal").top > vh * .4) {
    t.veil = 1; t.show = 0; t.z = 2.4; t.s = .2;
  } else if (r("press").top > vh * .4) {
    const p = P.thermal; thermalMode = true; bodyColor = "thermal";
    t.veil = 1; t.spot = 0; t.z = 2; t.rx = -.25; t.ry = -.6 + p * 1.4; t.rz = .05; t.s = mob ? .66 : .95; t.x = mob ? 0 : 0;
    thermalFades.forEach((el) => el.toggleAttribute("data-off", p < .1));
    if (!heatManual) heat.value = String(Math.round(smooth(.15, .85, p) * 100));
  } else {
    // Back on the desk for the button.
    const p = P.press;
    t.veil = 1 - smooth(0, .3, p); t.spot = t.veil;
    t.z = lerp(2.2, FRONT, smooth(0, .35, p)); t.rx = lerp(-.3, 0, smooth(0, .35, p)); t.ry = lerp(.8, 0, smooth(0, .35, p));
  }
  // The giant word slides across the ships scene from right to left.
  const wp = P.ships; const ww = word.offsetWidth;
  word.style.transform = `translate3d(${lerp(innerWidth, -ww, wp)}px, 0, 0)`;
  word.style.opacity = r("ships").top < vh && r("ships").bottom > 0 ? 1 : 0;
  // Work reel: vertical scroll drives it sideways; the card nearest the middle is in focus.
  const cw = cards[0]?.offsetWidth || 0, gap = parseFloat(getComputedStyle(reel).columnGap) || 0;
  reel.style.paddingLeft = `${(innerWidth - cw) / 2}px`;
  const span = (cards.length - 1) * (cw + gap);
  reel.style.transform = `translate3d(${-P.work * span}px, 0, 0)`;
  let best = 0, bd = Infinity;
  cards.forEach((c, i) => { const b = c.getBoundingClientRect(); const d = Math.abs(b.left + b.width / 2 - innerWidth / 2); if (d < bd) { bd = d; best = i; } });
  cards.forEach((c, i) => c.toggleAttribute("data-far", i !== best));
  count.textContent = `${String(best + 1).padStart(2, "0")}/06`;
  if (r("changelog").top < vh * .6) t.show = 0;
  return { t, bodyColor, thermalMode };
}

function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.fov = small() ? 44 : 30; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; if (!REDUCE) time += dt;
  const { t, bodyColor, thermalMode } = choreograph();
  if (bodyColor !== lastBody) { document.body.dataset.scene = bodyColor; lastBody = bodyColor; }
  const k = REDUCE || SNAP ? 1 : 1 - Math.exp(-dt * 5);
  for (const key in cur) cur[key] = lerp(cur[key], t[key], k);
  pointer.x = lerp(pointer.x, pointer.tx, 1 - Math.exp(-dt * 4)); pointer.y = lerp(pointer.y, pointer.ty, 1 - Math.exp(-dt * 4));
  const lifted = clamp((cur.z - FRONT) / 1.5);
  device.position.set(cur.x, cur.y + Math.sin(time * 1.2) * .04 * lifted, cur.z);
  device.rotation.set(cur.rx + pointer.y * .12 * (.3 + lifted), cur.ry + pointer.x * .25 * (.3 + lifted), cur.rz);
  device.scale.setScalar(cur.s * cur.show);
  device.visible = cur.show > .02;
  veil.material.opacity = cur.veil;
  // Fully dark: drop the veil and desk so the canvas is transparent and the words behind it show.
  veil.visible = desk.visible = cur.veil < .985;
  spot.intensity = cur.spot * 90; sun.intensity = 3.2 * (1 - cur.veil * .8);
  canvas.style.opacity = t.show === 0 && cur.show < .05 && cur.veil > .98 ? "0" : "1";
  setThermal(thermalMode);
  thermal.uniforms.uHeat.value = 1 - +heat.value / 100; thermal.uniforms.uTime.value = time;
  heatRead.textContent = +heat.value < 50 ? `Manual · ${Math.round(lerp(4320, 8, +heat.value / 100)).toLocaleString()} min` : `Test Console · ${Math.max(8, Math.round(lerp(4320, 8, +heat.value / 100))).toLocaleString()} min`;
  if (thermalMode && scr.mode !== "heat") { scr.prev = scr.mode; show("heat", "4,320 MIN\n→ 8 MIN"); } else if (!thermalMode && scr.mode === "heat") show(presses ? "msg" : "boot", "READY");
  pressT = Math.max(0, pressT - dt * 5); button.position.z = FRONT + .07 - Math.sin(pressT * Math.PI) * .06;
  renderer.render(scene, camera);
}
setInterval(() => { if (scr.mode !== "heat") { scr.cursor = !scr.cursor; drawScreen(); } }, 530);
frame(performance.now());
let raf = 0;
const loop = (t) => { frame(t); raf = requestAnimationFrame(loop); };
const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else start(); });
start();
