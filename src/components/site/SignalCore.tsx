"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type * as Three from "three";
import type { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import type { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { signalStory, transition } from "./signal-story";
import styles from "./SignalCore.module.css";

const SCULPTURE_SCALE = 0.85;
const SIGNAL_RADIUS = 0.018;
const SIGNAL_PLANE_Z = 0.46;

/** How sharp the scene may draw, as a count of pixels in the drawing buffer.
 *  Screen size is a poor guide to what a machine can push. A phone at three
 *  times density and a laptop at two land in the same place under a budget,
 *  and both end up sharper than a flat cap on either would allow. */
const PIXEL_BUDGET = 4.5e6;
/** A frame this expensive during warm-up costs more than the sharpness is worth. */
const SLOW_FRAME = 14;
/** Three frames is enough to price a pass that has just been added. */
const POST_POSES = [0.45, 0.72, 0.95];
/** Warm-up buys a smooth first scroll; it must not become the wait itself.
 *  Past this the remaining poses are skipped rather than held for. */
const WARM_BUDGET = 1200;
/** Half rate, which is all the idle drift needs and half the battery it would take. */
const IDLE_FRAME = 1000 / 30;
/** Every beat of the story, drawn once before the reader can reach any of them. */
const WARM_POSES = [0, 0.2, 0.32, 0.45, 0.58, 0.66, 0.72, 0.83, 0.95];

/** An analog signal passes through a processor, is written into code, and becomes sampled data. */
export default function SignalCore({ progress, seek, onUnavailable, onWarming, onReady }: {
  progress: RefObject<number>;
  seek: RefObject<((progress: number) => void) | null>;
  onUnavailable: () => void;
  onWarming?: (fraction: number) => void;
  onReady?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let cleanup = () => {};

    async function initialize() {
      const [THREE, { RoomEnvironment }, { RoundedBoxGeometry }, { RectAreaLightUniformsLib }, { mergeGeometries }] = await Promise.all([
        import("three"),
        import("three/addons/environments/RoomEnvironment.js"),
        import("three/addons/geometries/RoundedBoxGeometry.js"),
        import("three/addons/lights/RectAreaLightUniformsLib.js"),
        import("three/addons/utils/BufferGeometryUtils.js"),
      ]);
      if (disposed) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { onUnavailable(); return; }
      const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
      // Mesh detail is the one thing still decided from what the device claims,
      // because it is fixed at build time. Resolution and post-processing are
      // measured during warm-up instead: see calibrate().
      const modestHardware = deviceMemory <= 4 || navigator.hardwareConcurrency <= 4;
      // Multisampling on the default framebuffer is nearly free next to the
      // shimmer it removes from every machined edge in the sculpture.
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;
      element!.appendChild(renderer.domElement);

      const geometries = new Set<Three.BufferGeometry>();
      const materials = new Set<Three.Material>();
      const textures = new Set<Three.Texture>();
      let environment: Three.WebGLRenderTarget | undefined;
      let frame = 0;
      const detach: (() => void)[] = [];
      // Install teardown early so partial initialization also cleans up.
      cleanup = () => {
        seek.current = null;
        cancelAnimationFrame(frame);
        detach.forEach((remove) => remove());
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        textures.forEach((texture) => texture.dispose());
        environment?.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
      function geometry<T extends Three.BufferGeometry>(value: T): T { geometries.add(value); return value; }
      function material<T extends Three.Material>(value: T): T { materials.add(value); return value; }
      function texture<T extends Three.Texture>(value: T): T { textures.add(value); return value; }

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
      camera.position.set(0, 0, 10);
      let composer: EffectComposer | null = null;
      let bloom: UnrealBloomPass | null = null;
      // The addon types leave `uniforms` as a bare object, so the two dials the
      // pose actually turns are named here.
      let bokeh: { uniforms: { focus: { value: number }; aperture: { value: number } } } | null = null;
      let dropBloom = () => {};
      let dropBokeh = () => {};
      detach.push(() => { dropBokeh(); dropBloom(); });
      /**
       * The glow around the signal is the first thing to go on a machine that
       * cannot afford it, so it is added only once a measured frame has shown
       * there is room, and taken away again if adding it proves otherwise.
       */
      async function addBloom() {
        const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
          import("three/addons/postprocessing/EffectComposer.js"),
          import("three/addons/postprocessing/RenderPass.js"),
          import("three/addons/postprocessing/UnrealBloomPass.js"),
          import("three/addons/postprocessing/OutputPass.js"),
        ]);
        if (disposed) return;
        // The composer draws into its own buffer, where the renderer's own
        // multisampling does not reach; without this the post-processed path
        // is the aliased one, which is backwards.
        const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
        const target = new THREE.WebGLRenderTarget(Math.max(1, buffer.x), Math.max(1, buffer.y), {
          type: THREE.HalfFloatType,
          samples: 4,
        });
        const composed = new EffectComposer(renderer, target);
        const renderPass = new RenderPass(scene, camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.24, 0.55, 1.45);
        const outputPass = new OutputPass();
        composed.addPass(renderPass);
        composed.addPass(bloomPass);
        composed.addPass(outputPass);
        composer = composed;
        bloom = bloomPass;
        dropBloom = () => {
          dropBokeh();
          composer = null;
          bloom = null;
          dropBloom = () => {};
          renderPass.dispose();
          bloomPass.dispose();
          outputPass.dispose();
          // The composer owns both of its buffers, this one included.
          composed.dispose();
        };
        const { width, height } = element!.getBoundingClientRect();
        if (width && height) composed.setSize(width, height);
      }
      /**
       * A shallow focus is the last thing an offline render has that a live one
       * usually does not, and the first thing the eye reads as "photographed".
       * It costs a second pass over the geometry for depth, so like the glow it
       * is earned rather than assumed.
       */
      async function addDepthOfField() {
        if (!composer) return;
        const { BokehPass } = await import("three/addons/postprocessing/BokehPass.js");
        if (disposed || !composer) return;
        const pass = new BokehPass(scene, camera, { focus: 10, aperture: 0.0004, maxblur: 0.006 });
        // Straight after the scene is drawn, so the glow blooms what the lens
        // actually resolved rather than the other way round.
        composer.insertPass(pass, 1);
        bokeh = pass as unknown as NonNullable<typeof bokeh>;
        dropBokeh = () => {
          bokeh = null;
          dropBokeh = () => {};
          composer?.removePass(pass);
          pass.dispose();
        };
      }
      const room = new RoomEnvironment();
      const pmrem = new THREE.PMREMGenerator(renderer);
      try {
        environment = pmrem.fromScene(room, 0.04);
        scene.environment = environment.texture;
        scene.environmentIntensity = 0.38;
      } finally { room.dispose(); pmrem.dispose(); }

      // Fine directional machining marks, generated once and reused by metal parts.
      const grainData = new Uint8Array(256 * 256 * 4);
      let seed = 19;
      const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      for (let y = 0; y < 256; y++) {
        const stripe = random() * 24;
        for (let x = 0; x < 256; x++) {
          const index = (y * 256 + x) * 4;
          const value = Math.round(180 + stripe + random() * 6);
          grainData.set([value, value, value, 255], index);
        }
      }
      const grain = texture(new THREE.DataTexture(grainData, 256, 256));
      grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
      grain.magFilter = THREE.LinearFilter;
      grain.minFilter = THREE.LinearMipmapLinearFilter;
      grain.generateMipmaps = true;
      grain.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      grain.needsUpdate = true;
      const metal = material(new THREE.MeshPhysicalMaterial({
        color: 0xb5b6b7, metalness: 0.9, roughness: 0.72, roughnessMap: grain,
        bumpMap: grain, bumpScale: 0.00065, anisotropy: 0.18,
        clearcoat: 0, envMapIntensity: 0.55,
      }));
      const graphite = material(new THREE.MeshStandardMaterial({ color: 0x171c20, metalness: 0.35, roughness: 0.52 }));
      const ceramic = material(new THREE.MeshPhysicalMaterial({ color: 0x292b2d, metalness: 0.02, roughness: 0.82, clearcoat: 0 }));
      const contacts = material(new THREE.MeshStandardMaterial({ color: 0xc9ab73, metalness: 1, roughness: 0.5, roughnessMap: grain }));
      const solder = material(new THREE.MeshStandardMaterial({ color: 0xa3adb2, metalness: 0.95, roughness: 0.48 }));
      const silicon = material(new THREE.MeshPhysicalMaterial({ color: 0x22272b, metalness: 0.5, roughness: 0.42, clearcoat: 0, iridescence: 0.05, iridescenceIOR: 1.45 }));
      const coverMaterial = material(metal.clone());
      coverMaterial.transparent = true;
      coverMaterial.depthWrite = true;
      const coverDetails = material(graphite.clone());
      coverDetails.transparent = true;
      const coverHardware = material(metal.clone());
      coverHardware.transparent = true;
      // Tuned so the signal comes out of the pipeline on the page's accent
      // rather than going into it on the accent. OutputPass tone maps the whole
      // composite, so `toneMapped: false` on the material buys nothing, and ACES
      // rolls the highlights off: fed #ff7a42 the wave arrives at #d36530, and
      // fed anything brighter it bleaches towards apricot, which is where the
      // old 1.8x multiplier had left it. This lands on #f17747, the closest to
      // the accent the tone curve allows, its red a shade short of the token's.
      const signal = new THREE.Color(0xff6642);
      const orange = material(new THREE.MeshBasicMaterial({ color: signal, toneMapped: false }));
      const signalFinish = material(new THREE.MeshBasicMaterial({ color: signal, toneMapped: false }));
      const white = material(new THREE.MeshBasicMaterial({ color: 0xcbd5dd }));
      const trace = material(new THREE.LineBasicMaterial({ color: 0x9aa9b4, transparent: true, opacity: 0.5 }));
      const grid = material(new THREE.LineBasicMaterial({ color: 0x687985, transparent: true, opacity: 0.22 }));
      const sculpture = new THREE.Group();
      sculpture.scale.setScalar(SCULPTURE_SCALE);
      sculpture.rotation.set(0.12, -0.1, -0.06);
      scene.add(sculpture);

      function box(parent: Three.Group, w: number, h: number, d: number, z: number, finish: Three.Material, radius = 0.04) {
        const mesh = new THREE.Mesh(geometry(new RoundedBoxGeometry(w, h, d, 3, radius)), finish);
        mesh.position.z = z;
        parent.add(mesh);
        return mesh;
      }
      function line(parent: Three.Group, points: number[][], finish: Three.LineBasicMaterial) {
        const shape = geometry(new THREE.BufferGeometry().setFromPoints(points.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z))));
        const result = new THREE.Line(shape, finish);
        parent.add(result);
        return result;
      }

      const processor = new THREE.Group();
      sculpture.add(processor);
      box(processor, 1.8, 1.8, 0.16, -0.19, graphite, 0.06);
      box(processor, 1.73, 1.73, 0.012, -0.1, contacts, 0.025);
      box(processor, 1.7, 1.7, 0.035, -0.075, ceramic, 0.025);
      const carrier = box(processor, 1.5, 1.5, 0.1, 0.04, metal);
      box(processor, 1.46, 1.46, 0.025, 0.175, graphite, 0.025);
      box(processor, 0.84, 0.84, 0.012, 0.256, contacts, 0.012);
      box(processor, 1.42, 1.42, 0.055, 0.22, ceramic, 0.025);
      const lid = box(processor, 1.46, 1.46, 0.13, 0.49, coverMaterial);
      // Draw the cover after transparent internal traces, then its surface details.
      lid.renderOrder = 2;
      const screwGeometry = geometry(new THREE.CylinderGeometry(0.023, 0.021, 0.012, 24));
      const washerGeometry = geometry(new THREE.RingGeometry(0.023, 0.033, 24));
      const slotGeometry = geometry(new THREE.BoxGeometry(0.029, 0.004, 0.002));
      for (const x of [-0.59, 0.59]) {
        for (const y of [-0.59, 0.59]) {
          const washer = new THREE.Mesh(washerGeometry, coverDetails);
          washer.position.set(x, y, 0.066);
          washer.renderOrder = 3;
          lid.add(washer);
          const screw = new THREE.Mesh(screwGeometry, coverHardware);
          screw.renderOrder = 3;
          screw.rotation.x = Math.PI / 2;
          screw.position.set(x, y, 0.072);
          lid.add(screw);
          const slot = new THREE.Mesh(slotGeometry, coverDetails);
          slot.position.set(x, y, 0.079);
          slot.rotation.z = x * 1.4 + y;
          slot.renderOrder = 4;
          lid.add(slot);
        }
      }
      // Machined grooves catch the softbox without adding labels to the case.
      const grooveGeometry = geometry(new THREE.BoxGeometry(0.48, 0.002, 0.001));
      for (let i = 0; i < 5; i++) {
        const groove = new THREE.Mesh(grooveGeometry, coverDetails);
        groove.renderOrder = 3;
        groove.position.set(0, 0.42 - i * 0.042, 0.066);
        lid.add(groove);
      }
      box(processor, 0.8, 0.8, 0.025, 0.27, silicon, 0.012);
      const pinGeometry = geometry(new RoundedBoxGeometry(0.18, 0.045, 0.025, 2, 0.005));
      for (let side = 0; side < 4; side++) {
        const pins = new THREE.Group();
        pins.rotation.z = side * Math.PI / 2;
        for (let i = 0; i < 11; i++) {
          const pin = new THREE.Mesh(pinGeometry, contacts);
          pin.position.set(0.9, (i - 5) * 0.12, -0.12);
          pins.add(pin);
        }
        processor.add(pins);
      }
      const cells = new THREE.Group();
      cells.position.z = 0.3;
      processor.add(cells);
      const cellGeometry = geometry(new THREE.BoxGeometry(0.066, 0.066, 0.003));
      const dieCells = new THREE.InstancedMesh(cellGeometry, silicon, 64);
      const placement = new THREE.Object3D();
      for (let i = 0; i < 64; i++) {
        placement.position.set((i % 8 - 3.5) * 0.083, (Math.floor(i / 8) - 3.5) * 0.083, 0);
        placement.updateMatrix();
        dieCells.setMatrixAt(i, placement.matrix);
        dieCells.setColorAt(i, new THREE.Color((i + Math.floor(i / 8)) % 3 === 0 ? 0x647785 : 0x26343e));
      }
      cells.add(dieCells);
      detach.push(() => dieCells.dispose());
      const capacitorGeometry = geometry(new THREE.BoxGeometry(0.048, 0.082, 0.034));
      const terminalGeometry = geometry(new RoundedBoxGeometry(0.051, 0.018, 0.036, 2, 0.004));
      for (const side of [-1, 1]) {
        for (let i = 0; i < 7; i++) {
          const capacitor = new THREE.Group();
          capacitor.position.set(side * 0.53, (i - 3) * 0.135, 0.268);
          capacitor.add(new THREE.Mesh(capacitorGeometry, graphite));
          for (const end of [-1, 1]) {
            const terminal = new THREE.Mesh(terminalGeometry, solder);
            terminal.position.y = end * 0.036;
            capacitor.add(terminal);
          }
          processor.add(capacitor);
        }
      }
      // Raised bond wires and plated vias distinguish the die from its substrate.
      const bondParts: Three.BufferGeometry[] = [];
      for (const side of [-1, 1]) {
        for (let i = 0; i < 16; i++) {
          const x = (i - 7.5) * 0.042;
          const bond = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(x, side * 0.385, 0.285),
            new THREE.Vector3(x * 1.08, side * 0.5, 0.38),
            new THREE.Vector3(x * 1.16, side * 0.62, 0.25),
          );
          bondParts.push(new THREE.TubeGeometry(bond, 12, 0.0035, 5, false));
        }
      }
      const bondGeometry = mergeGeometries(bondParts);
      bondParts.forEach((part) => part.dispose());
      if (bondGeometry) processor.add(new THREE.Mesh(geometry(bondGeometry), contacts));
      const viaGeometry = geometry(new THREE.RingGeometry(0.006, 0.013, 12));
      const vias = new THREE.InstancedMesh(viaGeometry, contacts, 48);
      const viaHoles = new THREE.InstancedMesh(geometry(new THREE.CircleGeometry(0.006, 12)), graphite, 48);
      for (let i = 0; i < 48; i++) {
        const side = Math.floor(i / 12);
        placement.position.set((i % 12 - 5.5) * 0.11, 0.668, 0.2485);
        placement.position.applyAxisAngle(new THREE.Vector3(0, 0, 1), side * Math.PI / 2);
        placement.updateMatrix();
        vias.setMatrixAt(i, placement.matrix);
        viaHoles.setMatrixAt(i, placement.matrix);
      }
      processor.add(vias, viaHoles);
      detach.push(() => { vias.dispose(); viaHoles.dispose(); });
      const copperParts: Three.BufferGeometry[] = [];
      for (const side of [-1, 1]) {
        for (let i = 0; i < 12; i++) {
          const x = (i - 5.5) * 0.052;
          const route = new THREE.CurvePath<Three.Vector3>();
          const points = [new THREE.Vector3(x, side * 0.62, 0.249), new THREE.Vector3(x, side * 0.635, 0.249), new THREE.Vector3(x * 1.8, side * 0.668, 0.249)];
          route.add(new THREE.LineCurve3(points[0], points[1]));
          route.add(new THREE.LineCurve3(points[1], points[2]));
          copperParts.push(new THREE.TubeGeometry(route, 4, 0.0025, 4, false));
        }
      }
      const copperGeometry = mergeGeometries(copperParts);
      copperParts.forEach((part) => part.dispose());
      if (copperGeometry) processor.add(new THREE.Mesh(geometry(copperGeometry), contacts));

      // Raised terminals physically join the board to the forward signal plane.
      const socketGeometry = geometry(new THREE.TorusGeometry(0.032, 0.006, 8, 24));
      for (const side of [-1, 1]) {
        const terminal = box(processor, 0.25, 0.18, 0.17, 0.3, graphite, 0.015);
        terminal.position.x = side * 0.815;
        // Open channel through the contact keeps the waveform unobstructed.
        for (const edge of [-1, 1]) {
          const rail = box(processor, 0.25, 0.026, 0.11, 0.44, contacts, 0.006);
          rail.position.set(side * 0.815, edge * 0.07, 0.44);
        }
        const socket = new THREE.Mesh(socketGeometry, solder);
        socket.rotation.y = Math.PI / 2;
        socket.position.set(side * 0.948, 0, SIGNAL_PLANE_Z);
        processor.add(socket);
      }

      const circuitPath = new THREE.CatmullRomCurve3([
        // Keep the entire waveform on one plane in front of the board.
        new THREE.Vector3(-0.94, 0, SIGNAL_PLANE_Z),
        new THREE.Vector3(-0.66, 0, SIGNAL_PLANE_Z),
        new THREE.Vector3(-0.3, 0.17, SIGNAL_PLANE_Z),
        new THREE.Vector3(0, 0, SIGNAL_PLANE_Z),
        new THREE.Vector3(0.3, -0.17, SIGNAL_PLANE_Z),
        new THREE.Vector3(0.66, 0, SIGNAL_PLANE_Z),
        new THREE.Vector3(0.94, 0, SIGNAL_PLANE_Z),
      ]);
      const circuitGeometry = geometry(new THREE.TubeGeometry(circuitPath, 80, SIGNAL_RADIUS, 8, false));
      processor.add(new THREE.Mesh(circuitGeometry, orange));
      const circuitLight = new THREE.PointLight(0xff692c, 0, 1.6, 2);
      processor.add(circuitLight);

      const input = new THREE.Group();
      const output = new THREE.Group();
      sculpture.add(input, output);
      const inputPin = new THREE.Vector3(-0.94, 0, SIGNAL_PLANE_Z);
      const outputPin = new THREE.Vector3(0.94, 0, SIGNAL_PLANE_Z);
      const waveEnd = new THREE.Vector3();
      let waveLength = 1;
      let waveAmplitude = 1;
      // The endpoint and the chip pin share sculpture-local coordinates.
      function incoming(u: number, time: number, target: Three.Vector3) {
        const envelope = Math.sin(Math.PI * u) ** 2 * waveAmplitude;
        const phase = u * Math.PI * 4 - time * 1.35;
        return target.set(waveEnd.x - (1 - u) * waveLength, waveEnd.y + Math.sin(phase) * envelope, waveEnd.z + Math.cos(phase) * envelope * 0.7);
      }
      const segments = modestHardware ? 96 : 120;
      const sides = modestHardware ? 6 : 8;
      const vertices = new Float32Array((segments + 1) * sides * 3);
      const indices: number[] = [];
      for (let i = 0; i < segments; i++) {
        for (let j = 0; j < sides; j++) {
          const a = i * sides + j, b = i * sides + (j + 1) % sides;
          indices.push(a, b, a + sides, b, b + sides, a + sides);
        }
      }
      const waveGeometry = geometry(new THREE.BufferGeometry());
      const wavePosition = new THREE.BufferAttribute(vertices, 3).setUsage(THREE.DynamicDrawUsage);
      waveGeometry.setAttribute("position", wavePosition);
      waveGeometry.setIndex(indices);
      const waveform = new THREE.Mesh(waveGeometry, signalFinish);
      waveform.frustumCulled = false;
      input.add(waveform);
      const point = new THREE.Vector3();
      const before = new THREE.Vector3();
      const after = new THREE.Vector3();
      const tangent = new THREE.Vector3();
      const normal = new THREE.Vector3();
      const binormal = new THREE.Vector3();
      const up = new THREE.Vector3(0, 0, 1);
      function updateWave(time: number) {
        for (let i = 0; i <= segments; i++) {
          const u = i / segments;
          incoming(u, time, point);
          incoming(Math.max(0, u - 0.001), time, before);
          incoming(Math.min(1, u + 0.001), time, after);
          tangent.subVectors(after, before).normalize();
          normal.crossVectors(tangent, up).normalize();
          binormal.crossVectors(tangent, normal).normalize();
          for (let j = 0; j < sides; j++) {
            const angle = j / sides * Math.PI * 2;
            const offset = (i * sides + j) * 3;
            const radius = Math.min(0.024, waveLength * 0.08);
            const a = Math.cos(angle) * radius, b = Math.sin(angle) * radius;
            vertices[offset] = point.x + normal.x * a + binormal.x * b;
            vertices[offset + 1] = point.y + normal.y * a + binormal.y * b;
            vertices[offset + 2] = point.z + normal.z * a + binormal.z * b;
          }
        }
        wavePosition.needsUpdate = true;
      }

      const graphPoints = Array.from({ length: 17 }, (_, i) => {
        const u = i / 16;
        return new THREE.Vector3(1.12 + u * 2.2, Math.sin(u * Math.PI * 4) * 0.46, 0.04);
      });
      const graphCurve = new THREE.CatmullRomCurve3(graphPoints, false, "centripetal");
      const graphGeometry = geometry(new THREE.TubeGeometry(graphCurve, 128, SIGNAL_RADIUS, 8, false));
      output.add(new THREE.Mesh(graphGeometry, orange));
      const glass = material(new THREE.MeshPhysicalMaterial({
        color: 0x081218, metalness: 0.05, roughness: 0.16,
        clearcoat: 1, clearcoatRoughness: 0.08, ior: 1.5,
        emissive: 0x0b1c24, emissiveIntensity: 0.18, envMapIntensity: 0.45,
      }));
      const panelBack = box(output, 2.72, 1.71, 0.085, -0.16, graphite, 0.045);
      panelBack.position.x = 2.22;
      const panelRim = box(output, 2.68, 1.67, 0.016, -0.108, metal, 0.025);
      panelRim.position.x = 2.22;
      const panel = box(output, 2.61, 1.6, 0.022, -0.087, glass, 0.025);
      panel.position.x = 2.22;
      line(output, [[1.02, 0.64, -0.025], [1.02, -0.64, -0.025], [3.43, -0.64, -0.025]], trace);
      for (let i = 0; i < 3; i++) {
        line(output, [[1.02, -0.4 + i * 0.4, -0.025], [3.43, -0.4 + i * 0.4, -0.025]], grid);
      }
      for (let i = 0; i <= 8; i++) {
        const x = 1.12 + i * 0.275;
        line(output, [[x, -0.64, -0.025], [x, 0.64, -0.025]], grid);
      }
      const sampleGeometry = geometry(new THREE.SphereGeometry(0.034, 12, 8));
      const samples: Three.Mesh[] = [];
      for (const sample of graphPoints) {
        const node = new THREE.Mesh(sampleGeometry, white);
        node.position.copy(sample);
        samples.push(node);
        output.add(node);
      }
      // The incoming waveform becomes evenly spaced, individually readable samples.
      const sampleStems = graphPoints.map((sample) => {
        const stem = line(output, [[sample.x, 0, 0.01], [sample.x, sample.y, 0.01]], trace);
        return stem;
      });
      // The bench machine the processed signal is carried to, where handling it
      // is written out a line at a time. Built to the standard of the processor
      // beside it: a graphite shell over a vented housing, a machined stand,
      // and the screen recessed behind its own bezel.
      const station = new THREE.Group();
      sculpture.add(station);
      // Its own glass rather than the panel's: a display has to stay readable
      // under the same softbox the instrument fronts are there to catch.
      const display = material(new THREE.MeshPhysicalMaterial({
        color: 0x05090c, metalness: 0.04, roughness: 0.44,
        clearcoat: 0.5, clearcoatRoughness: 0.22, ior: 1.5,
        emissive: 0x0a1a22, emissiveIntensity: 0.12, envMapIntensity: 0.12,
      }));
      // Moulded rather than machined: the same grain, much finer, and matte.
      const shell = material(new THREE.MeshStandardMaterial({
        color: 0x1b1f22, metalness: 0.38, roughness: 0.58,
        roughnessMap: grain, bumpMap: grain, bumpScale: 0.0004,
      }));
      box(station, 2.58, 1.54, 0.012, -0.052, metal, 0.02);
      box(station, 2.56, 1.52, 0.055, -0.075, shell, 0.025);
      // The electronics sit in a housing behind the panel, vented across the back.
      const housing = new THREE.Mesh(geometry(new RoundedBoxGeometry(1.24, 0.8, 0.11, 2, 0.03)), shell);
      housing.position.set(0, -0.02, -0.15);
      station.add(housing);
      const ventGeometry = geometry(new THREE.BoxGeometry(0.52, 0.013, 0.004));
      for (let i = 0; i < 7; i++) {
        const vent = new THREE.Mesh(ventGeometry, graphite);
        vent.position.set(0, 0.22 - i * 0.062, -0.207);
        station.add(vent);
      }
      const screenPanel = box(station, 2.4, 1.32, 0.012, -0.041, display, 0.006);
      screenPanel.position.y = 0.04;
      // Thin on three sides with a chin under the screen, standing a little
      // proud of the glass so the display reads as set into the case.
      for (const [width, height, x, y] of [
        [2.56, 0.06, 0, 0.73],
        [2.56, 0.14, 0, -0.69],
        [0.08, 1.52, -1.24, 0],
        [0.08, 1.52, 1.24, 0],
      ]) {
        const bar = box(station, width, height, 0.035, -0.018, shell, 0.008);
        bar.position.x = x;
        bar.position.y = y;
      }
      const led = new THREE.Mesh(geometry(new THREE.BoxGeometry(0.024, 0.011, 0.006)), orange);
      led.position.set(1.05, -0.7, -0.002);
      station.add(led);
      line(station, [[-0.16, -0.735, 0.002], [0.16, -0.735, 0.002]], grid);

      // Both leads land in jacks on the back edge, where they would.
      const stationIn = new THREE.Vector3(-1.36, -0.12, -0.08);
      const stationOut = new THREE.Vector3(1.36, -0.12, -0.08);
      const jackGeometry = geometry(new RoundedBoxGeometry(0.1, 0.12, 0.09, 2, 0.012));
      const collarGeometry = geometry(new THREE.TorusGeometry(0.032, 0.007, 8, 20));
      for (const port of [stationIn, stationOut]) {
        const side = Math.sign(port.x);
        const jack = new THREE.Mesh(jackGeometry, graphite);
        jack.position.set(side * 1.24, port.y, port.z);
        const collar = new THREE.Mesh(collarGeometry, solder);
        collar.rotation.y = Math.PI / 2;
        collar.position.set(side * 1.29, port.y, port.z);
        station.add(jack, collar);
      }
      const arm = new THREE.Mesh(geometry(new RoundedBoxGeometry(0.34, 0.3, 0.16, 2, 0.03)), shell);
      arm.position.set(0, -0.6, -0.16);
      const neck = new THREE.Mesh(geometry(new RoundedBoxGeometry(0.24, 0.62, 0.12, 2, 0.03)), metal);
      neck.position.set(0, -1, -0.16);
      const foot = new THREE.Mesh(geometry(new THREE.CylinderGeometry(0.58, 0.62, 0.05, 32)), metal);
      foot.position.set(0, -1.3, -0.13);
      foot.scale.z = 0.62;
      station.add(arm, neck, foot);
      // Power dressed down the back of the stand, out of the signal's way.
      const cable = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.1, -0.44, -0.19),
        new THREE.Vector3(0.24, -0.78, -0.25),
        new THREE.Vector3(0.16, -1.12, -0.24),
        new THREE.Vector3(0.05, -1.28, -0.18),
      ]);
      station.add(new THREE.Mesh(geometry(new THREE.TubeGeometry(cable, 24, 0.016, 6, false)), graphite));

      // Everything on the screen sits in front of the recessed glass.
      const screen = new THREE.Group();
      screen.position.set(0, 0.04, -0.028);
      station.add(screen);
      const codeInk = material(new THREE.MeshBasicMaterial({ color: 0x93a3af }));
      const codeFaint = material(new THREE.MeshBasicMaterial({ color: 0x4b5862 }));
      // The gold off the chip's contacts, so the second colour on the screen is
      // one the sculpture already uses.
      const codeString = material(new THREE.MeshBasicMaterial({ color: 0xc0a173 }));
      line(screen, [[-1.1, 0.56, 0], [1.1, 0.56, 0]], trace);
      line(screen, [[-0.99, 0.5, 0], [-0.99, -0.6, 0]], grid);
      for (const x of [-0.75, -0.6]) line(screen, [[x, 0.46, 0], [x, -0.6, 0]], grid);
      const tabGeometry = geometry(new THREE.BoxGeometry(1, 0.018, 0.004));
      for (const [width, x, finish] of [[0.26, -0.95, orange], [0.2, -0.65, codeFaint]] as const) {
        const openTab = new THREE.Mesh(tabGeometry, finish);
        openTab.position.set(x, 0.605, 0);
        openTab.scale.x = width;
        screen.add(openTab);
      }
      const scrollbar = new THREE.Mesh(geometry(new THREE.BoxGeometry(0.016, 0.38, 0.004)), codeFaint);
      scrollbar.position.set(1.13, 0.26, 0);
      screen.add(scrollbar);
      // Indent, then the run of tokens on that line. The kinds are the ones an
      // editor would colour: a keyword, a string, a comment, and the rest.
      const codeRows: { indent: number; tokens: [width: number, kind: number][] }[] = [
        { indent: 0, tokens: [[0.86, 3]] },
        { indent: 0, tokens: [[0.34, 1], [0.62, 0], [0.24, 0]] },
        { indent: 1, tokens: [[0.5, 0], [0.4, 1], [0.3, 0]] },
        { indent: 1, tokens: [[0.72, 0], [0.28, 2]] },
        { indent: 2, tokens: [[0.42, 1], [0.58, 0]] },
        { indent: 2, tokens: [[0.5, 0], [0.32, 2], [0.44, 0]] },
        { indent: 1, tokens: [[0.36, 1], [0.66, 0]] },
        { indent: 0, tokens: [[0.3, 1], [0.48, 0], [0.5, 2]] },
        { indent: 1, tokens: [[0.56, 0], [0.42, 1]] },
      ];
      const codeInks = [codeInk, orange, codeString, codeFaint];
      const tokenGeometry = geometry(new THREE.BoxGeometry(1, 0.034, 0.005));
      const numberGeometry = geometry(new THREE.BoxGeometry(0.045, 0.014, 0.004));
      const tokens: { mesh: Three.Mesh; x: number; y: number; width: number; from: number; to: number }[] = [];
      const lineNumbers: { mesh: Three.Mesh; from: number }[] = [];
      // Typing runs at one pace across the whole block, so the write head moves
      // like a cursor rather than a line arriving at a time.
      const written = codeRows.reduce((total, row) => total + row.tokens.reduce((sum, [width]) => sum + width, 0), 0);
      let typed = 0;
      codeRows.forEach((row, index) => {
        const y = 0.42 - index * 0.125;
        let x = -0.9 + row.indent * 0.15;
        const number = new THREE.Mesh(numberGeometry, codeFaint);
        number.position.set(-1.06, y, 0);
        screen.add(number);
        lineNumbers.push({ mesh: number, from: typed / written });
        for (const [width, kind] of row.tokens) {
          const mesh = new THREE.Mesh(tokenGeometry, codeInks[kind]);
          mesh.position.set(x + width / 2, y, 0);
          mesh.scale.x = width;
          screen.add(mesh);
          tokens.push({ mesh, x, y, width, from: typed / written, to: (typed + width) / written });
          typed += width;
          x += width + 0.055;
        }
      });
      const caret = new THREE.Mesh(geometry(new THREE.BoxGeometry(0.02, 0.076, 0.005)), orange);
      screen.add(caret);
      const activeLine = new THREE.Mesh(
        geometry(new THREE.PlaneGeometry(2.32, 0.096)),
        material(new THREE.MeshBasicMaterial({ color: signal, transparent: true, opacity: 0.06 })),
      );
      activeLine.position.z = -0.004;
      screen.add(activeLine);
      const writeHead = new THREE.Vector3();

      const pulseGeometry = geometry(new THREE.SphereGeometry(0.05, 16, 12));
      // One persistent pulse avoids visibility and scale jumps at stage boundaries.
      const signalPulse = new THREE.Mesh(pulseGeometry, white);
      sculpture.add(signalPulse);
      const bridgeSegments = 48;
      const bridgeIndices: number[] = [];
      for (let i = 0; i < bridgeSegments; i++) {
        for (let j = 0; j < sides; j++) {
          const a = i * sides + j, b = i * sides + (j + 1) % sides;
          bridgeIndices.push(a, b, a + sides, b, b + sides, a + sides);
        }
      }
      /**
       * A length of the signal spanning two stages of the story. The caller
       * places both ends, then asks for the tube between them; `collapse`
       * retracts it into the far end as the near object leaves.
       */
      function makeBridge() {
        const positions = new Float32Array((bridgeSegments + 1) * sides * 3);
        const shape = geometry(new THREE.BufferGeometry());
        shape.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
        shape.setIndex(bridgeIndices);
        const mesh = new THREE.Mesh(shape, orange);
        mesh.frustumCulled = false;
        sculpture.add(mesh);
        const curve = new THREE.CubicBezierCurve3();
        function span(fromScale: number, toScale: number, collapse: number) {
          curve.v0.lerp(curve.v3, collapse);
          const reach = curve.v0.distanceTo(curve.v3) * 0.35;
          curve.v1.copy(curve.v0);
          curve.v1.x += reach;
          curve.v2.copy(curve.v3);
          curve.v2.x -= reach;
          if (!mesh.visible) return;
          for (let i = 0; i <= bridgeSegments; i++) {
            const u = i / bridgeSegments;
            curve.getPoint(u, point);
            curve.getTangent(u, tangent);
            normal.crossVectors(tangent, up).normalize();
            binormal.crossVectors(tangent, normal).normalize();
            // Match both transformed tube radii as one object shrinks and the next grows.
            const blend = THREE.MathUtils.lerp(collapse, 1, transition(u, 0, 1));
            const radius = SIGNAL_RADIUS * THREE.MathUtils.lerp(fromScale, toScale, blend);
            for (let j = 0; j < sides; j++) {
              const angle = j / sides * Math.PI * 2;
              const a = Math.cos(angle) * radius, b = Math.sin(angle) * radius;
              const offset = (i * sides + j) * 3;
              positions[offset] = point.x + normal.x * a + binormal.x * b;
              positions[offset + 1] = point.y + normal.y * a + binormal.y * b;
              positions[offset + 2] = point.z + normal.z * a + binormal.z * b;
            }
          }
          shape.attributes.position.needsUpdate = true;
        }
        return { mesh, curve, span };
      }
      // Chip to machine, then machine to panel.
      const chipBridge = makeBridge();
      const codeBridge = makeBridge();

      // A studio sits its subject against a lit sweep, not in a void, and the
      // subject throws a shadow onto it. Both are one soft round falloff, drawn
      // behind everything: the pool reads as the wall, and the shade reads as
      // the shadow only because it falls across the pool.
      const falloffSize = 96;
      const falloffData = new Uint8Array(falloffSize * falloffSize * 4);
      for (let y = 0; y < falloffSize; y++) {
        for (let x = 0; x < falloffSize; x++) {
          const dx = (x / (falloffSize - 1)) * 2 - 1;
          const dy = (y / (falloffSize - 1)) * 2 - 1;
          const edge = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
          const index = (y * falloffSize + x) * 4;
          falloffData.set([255, 255, 255, Math.round(255 * edge * edge * (3 - 2 * edge))], index);
        }
      }
      const falloff = texture(new THREE.DataTexture(falloffData, falloffSize, falloffSize));
      falloff.minFilter = falloff.magFilter = THREE.LinearFilter;
      falloff.needsUpdate = true;
      function backdrop(color: number, blending: Three.Blending) {
        const finish = material(new THREE.MeshBasicMaterial({
          map: falloff, color, transparent: true, opacity: 0, blending,
          depthWrite: false, depthTest: false, toneMapped: false,
        }));
        const mesh = new THREE.Mesh(geometry(new THREE.PlaneGeometry(1, 1)), finish);
        // Drawn first and testing against nothing, so the sculpture covers it.
        mesh.renderOrder = -2;
        scene.add(mesh);
        return { mesh, finish };
      }
      const pool = backdrop(0x93aec4, THREE.AdditiveBlending);
      const shade = backdrop(0x04070a, THREE.NormalBlending);
      shade.mesh.renderOrder = -1;
      const subject = new THREE.Vector3();
      const staged = new THREE.Vector3();

      RectAreaLightUniformsLib.init();
      const key = new THREE.RectAreaLight(0xf4f6ff, 5.5, 4, 7);
      key.position.set(-3, 4, 6);
      key.lookAt(0, 0, 0);
      const rim = new THREE.RectAreaLight(0xffbd91, 2.7, 1.2, 4);
      rim.position.set(4, -1, 3);
      rim.lookAt(0, 0, 0);
      const edge = new THREE.DirectionalLight(0xd4e2ee, 2.4);
      edge.position.set(-2, 2, -3);
      const fill = new THREE.RectAreaLight(0xc5d8e8, 1.4, 5, 3);
      fill.position.set(0, -3, 5);
      fill.lookAt(0, 0, 0);
      scene.add(key, rim, edge, fill, new THREE.AmbientLight(0xffffff, 0.1));

      let visible = true;
      let contextLost = false;
      let waveClock = 0;
      // A second clock, running whenever the scene is on screen. The story is
      // still derived entirely from scroll; this only rides on top of it.
      let breathClock = 0;
      let lastPoseFrame = 0;
      let lastDrawnFrame = 0;
      // Drawing is held back until the warm-up has finished with the scene, so
      // the two are never mid-frame at the same time.
      let warm = false;
      /** Scaled down only if the warm-up finds this machine cannot keep up. */
      let quality = 1;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      function markReady() {
        if (disposed) return;
        setReady(true);
        onReady?.();
      }
      function pose(value: number) {
        const s = signalStory(value);
        const mix = THREE.MathUtils.lerp;
        const now = performance.now();
        const step = lastPoseFrame ? Math.min((now - lastPoseFrame) / 1000, 0.05) : 0;
        lastPoseFrame = now;
        if (!reduced.matches) breathClock += step;
        const portrait = camera.aspect < 1;
        const fov = mix(36, 30, s.focus);
        if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
        const halfAngle = Math.tan(fov * Math.PI / 360);
        const introDistance = Math.max(7.4, 2.6 / (halfAngle * camera.aspect));
        const closeDistance = Math.max((5.8 - s.closeup * 0.55) / (2 * halfAngle), 2.7 / (halfAngle * camera.aspect));
        camera.position.z = mix(introDistance, closeDistance, s.focus);
        const viewHeight = 2 * halfAngle * camera.position.z;
        const viewWidth = viewHeight * camera.aspect;
        const centerX = portrait ? 0 : viewWidth * (mix(0.235, 0.07, s.focus) + s.closeup * 0.015);
        const centerY = portrait ? -viewHeight * mix(0.23, 0.11, s.focus) : 0.06;
        // Leave the text column and take over the viewport as the chip appears,
        // then track left once per handover as the story walks along the bench.
        sculpture.position.set(centerX - 2.67 * (s.write + s.handoff), centerY, 0);
        sculpture.rotation.set(
          0.12 + s.approach * 0.3 + s.closeup * 0.12 - s.write * 0.32,
          -0.1 - s.approach * 0.45 + s.closeup * 0.2 + s.write * 0.7,
          -0.06 - s.approach * 0.15 + s.write * 0.25,
        );
        // Held still, a scene reads as a photograph of itself. Three slow
        // drifts at periods that do not divide into each other, so the
        // sculpture never visibly repeats and never arrives anywhere.
        if (!reduced.matches) {
          sculpture.rotation.x += Math.sin(breathClock * 0.31) * 0.032;
          sculpture.rotation.y += Math.sin(breathClock * 0.47 + 1.2) * 0.078;
          sculpture.rotation.z += Math.sin(breathClock * 0.21 + 2.3) * 0.018;
          sculpture.position.y += Math.sin(breathClock * 0.37 + 0.7) * 0.05;
        }
        // A moving softbox draws a highlight across the case as the shot opens.
        key.position.x = mix(-3, 1.8, s.open);
        key.lookAt(centerX, 0, 0);
        rim.intensity = 2.7 + s.closeup * 0.7;
        if (bloom) bloom.strength = 0.17 + Math.sin(s.process * Math.PI) * 0.1 + Math.sin(s.code * Math.PI) * 0.05;
        processor.visible = s.approach > 0.001 && s.chipRelease < 0.999;
        processor.scale.setScalar(mix(0.7, 2.08, s.approach) * mix(1, 0.17, s.write) * (1 - s.chipRelease));
        processor.rotation.y = -(1 - s.approach) * 0.95;
        const initialWaveScale = 1.8 * Math.max(1, camera.aspect / 1.85);
        waveEnd.set(mix(1.215 * initialWaveScale, -0.94 * 2.08, s.approach), 0, mix(0, SIGNAL_PLANE_Z * 2.08, s.approach));
        point.copy(inputPin).multiply(processor.scale).applyEuler(processor.rotation);
        processor.position.copy(waveEnd).sub(point);
        processor.position.x -= s.write * 1.4;
        carrier.position.z = 0.04 - s.open * 0.08;
        lid.position.z = 0.49 + s.open * 1.05;
        lid.position.y = s.open * 0.12;
        lid.rotation.y = -s.open * 0.15;
        coverMaterial.opacity = 1 - transition(s.open, 0.2, 1) * 0.82;
        coverDetails.opacity = 1 - transition(s.open, 0.1, 0.85);
        coverHardware.opacity = coverDetails.opacity;
        circuitGeometry.setDrawRange(0, Math.floor(s.process * 80) * 8 * 6);
        circuitPath.getPointAt(s.process, circuitLight.position);
        circuitLight.position.z += 0.12;
        circuitLight.intensity = Math.sin(s.process * Math.PI) * 1.8;

        waveLength = mix(2.43 * initialWaveScale, 2.43, s.approach) * (1 - s.feed);
        waveAmplitude = mix(0.86, 0.46, s.approach) * (1 - s.feed);
        input.visible = s.feed < 1;
        if (input.visible && !reduced.matches) {
          const approachDrift = transition(value, 0.14, 0.34) * (1 - s.feed) * 0.28;
          waveClock += step * (1 + approachDrift);
        }
        const time = waveClock;
        if (input.visible) updateWave(time);

        // The machine unfolds from the right as the case slides away, and later
        // makes the same exit itself.
        station.visible = s.write > 0.001 && s.stationRelease < 0.999;
        station.scale.setScalar(mix(0.06, 1.5, s.write) * mix(1, 0.17, s.handoff) * (1 - s.stationRelease));
        // Lifted as it lands, so the screen sits on the frame's centre line and
        // the stand has somewhere to stand.
        station.position.set(mix(4.5, 2.67, s.write) - s.handoff * 1.35, mix(-0.4, 0.24, s.write), 0);
        station.rotation.set(0, mix(-1.15, 0, s.write), mix(-0.1, 0, s.write));
        processor.updateMatrix();
        station.updateMatrix();
        before.copy(outputPin).applyMatrix4(processor.matrix);
        after.copy(stationIn).applyMatrix4(station.matrix);
        // Keep the machine clear of the case while both are on stage.
        station.position.x += Math.max(0, before.x + 0.3 - after.x);
        station.updateMatrix();

        // One pace for the whole block, so the write head reads as a cursor
        // rather than a line arriving at a time. The head is tracked clear of
        // the glass, so the bead that follows it rides the screen instead of
        // sitting half buried in it.
        const headZ = screen.position.z + 0.08;
        writeHead.set(-0.9, 0.42 + screen.position.y, headZ);
        for (const token of tokens) {
          const t = Math.max(0, Math.min(1, (s.code - token.from) / (token.to - token.from)));
          token.mesh.visible = t > 0.002;
          token.mesh.scale.x = Math.max(0.0001, token.width * t);
          token.mesh.position.x = token.x + token.width * t / 2;
          if (t > 0) writeHead.set(token.x + token.width * t, token.y + screen.position.y, headZ);
        }
        for (const number of lineNumbers) number.mesh.visible = s.code > number.from;
        caret.visible = s.code > 0.002 && s.code < 0.998;
        caret.position.set(writeHead.x + 0.03, writeHead.y - screen.position.y, 0.002);
        activeLine.visible = caret.visible;
        activeLine.position.y = caret.position.y;
        // The screen lifts as it fills, rather than a lamp being pointed at it.
        display.emissiveIntensity = 0.1 + s.code * 0.32;

        output.visible = s.handoff > 0.001;
        output.scale.setScalar(mix(0.05, 1.65, s.handoff) * (1 - s.exit * 0.12));
        // Held one handover to the right, so the panel lands centred once the
        // second pan has run.
        output.position.x = mix(0.45, -0.52, s.handoff) + 2.67;
        output.rotation.y = mix(-1.2, 0, s.handoff);
        output.rotation.z = mix(-0.12, 0, s.handoff);
        output.updateMatrix();
        before.copy(stationOut).applyMatrix4(station.matrix);
        after.copy(graphPoints[0]).applyMatrix4(output.matrix);
        // Keep the unfolding panel outside the machine while both are visible.
        output.position.x += Math.max(0, before.x + 0.3 - after.x);
        output.updateMatrix();
        graphGeometry.setDrawRange(0, Math.floor(s.graph * 128) * 8 * 6);
        samples.forEach((sample, index) => { sample.visible = s.graph >= index / 16 && s.graph > 0; });
        sampleStems.forEach((stem, index) => { stem.visible = s.graph >= index / 16 && s.graph > 0; });
        // Hand the signal on before letting go of the stage that carried it.
        chipBridge.mesh.visible = s.write > 0 && s.chipRelease < 0.999;
        chipBridge.curve.v0.copy(outputPin).applyMatrix4(processor.matrix);
        chipBridge.curve.v3.copy(stationIn).applyMatrix4(station.matrix);
        chipBridge.span(processor.scale.x, station.scale.x, s.chipRelease);
        codeBridge.mesh.visible = s.handoff > 0 && s.stationRelease < 0.999;
        codeBridge.curve.v0.copy(stationOut).applyMatrix4(station.matrix);
        codeBridge.curve.v3.copy(graphPoints[0]).applyMatrix4(output.matrix);
        codeBridge.span(station.scale.x, output.scale.x, s.stationRelease);

        // Seat whatever is on stage: a pool behind it, and its shadow thrown
        // down and to the right, away from the key light.
        sculpture.updateMatrix();
        subject.set(0, 0, 0.1).applyMatrix4(processor.matrix).applyMatrix4(sculpture.matrix);
        let reach = 2.5 * processor.scale.x * SCULPTURE_SCALE;
        if (s.write > 0.001) {
          staged.set(0, 0.1, -0.05).applyMatrix4(station.matrix).applyMatrix4(sculpture.matrix);
          subject.lerp(staged, s.write);
          reach = mix(reach, 2.6 * station.scale.x * SCULPTURE_SCALE, s.write);
        }
        if (s.handoff > 0.001) {
          staged.set(2.22, 0, 0).applyMatrix4(output.matrix).applyMatrix4(sculpture.matrix);
          subject.lerp(staged, s.handoff);
          reach = mix(reach, 2.6 * output.scale.x * SCULPTURE_SCALE, s.handoff);
        }
        // Dimmed rather than switched off as the hero leaves, so the last
        // beat does not drop back into the void it started in.
        const seated = s.focus * (1 - s.exit * 0.6);
        pool.mesh.position.set(subject.x, subject.y, -2.6);
        pool.mesh.scale.setScalar(reach * 2.1);
        pool.finish.opacity = 0.085 * seated;
        shade.mesh.position.set(subject.x + reach * 0.46, subject.y - reach * 0.6, -2.5);
        shade.mesh.scale.set(reach * 2.4, reach * 1.5, 1);
        shade.finish.opacity = 0.6 * seated;
        if (bokeh) {
          // Focus on whatever the pool is lighting, and open the lens up as the
          // shot closes in. Wide establishing frames stay sharp throughout,
          // close-ups fall away.
          bokeh.uniforms.focus.value = Math.max(0.5, camera.position.z - subject.z);
          bokeh.uniforms.aperture.value = 0.00018 + s.closeup * 0.0016 + s.code * 0.0009;
        }

        signalPulse.visible = value >= 0.23;
        signalPulse.scale.setScalar(1 - s.exit);
        if (value < 0.34) {
          incoming(s.feed, time, signalPulse.position);
        } else if (value < 0.55) {
          // TubeGeometry uses arc length sampling; the pulse must use it too.
          circuitPath.getPointAt(s.process, signalPulse.position).applyMatrix4(processor.matrix);
        } else if (value < 0.655) {
          chipBridge.curve.getPoint(transition(value, 0.55, 0.655), signalPulse.position);
        } else if (value < 0.8) {
          // In at the port, up to the write head, and back out to the far port
          // once the last token is down.
          before.copy(stationIn).applyMatrix4(station.matrix);
          after.copy(writeHead).applyMatrix4(station.matrix);
          signalPulse.position.copy(before).lerp(after, transition(value, 0.655, 0.7));
          before.copy(stationOut).applyMatrix4(station.matrix);
          signalPulse.position.lerp(before, transition(value, 0.77, 0.8));
        } else if (value < 0.85) {
          codeBridge.curve.getPoint(transition(value, 0.8, 0.85), signalPulse.position);
        } else {
          graphCurve.getPointAt(s.graph, signalPulse.position).applyMatrix4(output.matrix);
        }
      }
      function render() {
        if (contextLost) return;
        if (composer) composer.render();
        else renderer.render(scene, camera);
      }
      /** Compile every material in the scene, whatever the current pose hides. */
      async function compileAll() {
        const shown = [processor, station, output, chipBridge.mesh, codeBridge.mesh, input, signalPulse]
          .map((object) => [object, object.visible] as const);
        const circuitRange = { start: circuitGeometry.drawRange.start, count: circuitGeometry.drawRange.count };
        const graphRange = { start: graphGeometry.drawRange.start, count: graphGeometry.drawRange.count };
        shown.forEach(([object]) => { object.visible = true; });
        circuitGeometry.setDrawRange(0, Infinity);
        graphGeometry.setDrawRange(0, Infinity);
        // Compiling off the main thread where the browser offers it: the intro
        // is counting on that thread and freezes if this blocks it.
        if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
        else renderer.compile(scene, camera);
        circuitGeometry.setDrawRange(circuitRange.start, circuitRange.count);
        graphGeometry.setDrawRange(graphRange.start, graphRange.count);
        shown.forEach(([object, wasVisible]) => { object.visible = wasVisible; });
      }
      const probe = new Uint8Array(4);
      /**
       * A drawn frame, timed honestly. `render` only queues work, so without
       * reading a pixel back, which blocks until the queue has drained, the
       * measurement would be of the queueing and not of the drawing.
       */
      function timePose(value: number) {
        const start = performance.now();
        pose(value);
        render();
        const gl = renderer.getContext();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, probe);
        return performance.now() - start;
      }
      function nextFrame() {
        // A hidden tab hands out no frames at all, so the wait is bounded and
        // the warm-up finishes rather than parking the scene forever.
        return new Promise<void>((resolve) => {
          const timer = window.setTimeout(done, 40);
          function done() { window.clearTimeout(timer); resolve(); }
          requestAnimationFrame(done);
        });
      }
      /** Draw every beat once and report the middling frame among them. */
      async function sweep(report: (fraction: number) => void, deadline: number, poses = WARM_POSES) {
        const costs: number[] = [];
        for (let i = 0; i < poses.length; i++) {
          costs.push(timePose(poses[i]));
          report((i + 1) / poses.length);
          if (disposed || performance.now() > deadline) break;
          await nextFrame();
          if (disposed) break;
        }
        // The first frame of a sweep pays for texture uploads the rest do not.
        const timed = (costs.length > 2 ? costs.slice(1) : costs).sort((a, b) => a - b);
        return timed[Math.floor(timed.length / 2)] ?? 0;
      }
      /**
       * Every stage of the story is drawn once while the intro still covers the
       * page, so no shader compiles under the reader's first scroll. Since
       * those frames have to be drawn anyway, they are timed, and what the
       * machine can actually afford is settled from the measurement rather than
       * guessed from its screen size.
       */
      async function calibrate() {
        const deadline = performance.now() + WARM_BUDGET;
        // Nothing timed against a hidden tab means anything: it hands out no
        // frames, and throttles what it does draw. A load like that keeps the
        // defaults rather than being judged on numbers that are not real.
        let measured = !document.hidden;
        const watch = () => { measured = measured && !document.hidden; };
        document.addEventListener("visibilitychange", watch);
        try {
          onWarming?.(0.05);
          await compileAll();
          if (disposed || contextLost) return;
          onWarming?.(0.3);
          let cost = await sweep((fraction) => onWarming?.(0.3 + 0.3 * fraction), deadline);
          if (disposed || contextLost || !measured) return;
          if (cost > SLOW_FRAME && quality > 0.75) {
            // Too expensive at this sharpness: hand some resolution back and
            // keep the frame rate, which is the more visible of the two.
            quality = 0.72;
            resize();
            cost = await sweep((fraction) => onWarming?.(0.6 + 0.15 * fraction), deadline);
            if (disposed || contextLost || !measured) return;
          }
          onWarming?.(0.7);
          // Optimistic, and measured afterwards. Refusing the glow up front on
          // a guess about what it would cost is how a machine that could have
          // afforded it ends up without it, and how every machine that had it
          // before lost it once this was measured. Only a frame that is truly
          // slow loses anything here.
          if (cost < SLOW_FRAME) {
            await addBloom();
            if (disposed || contextLost || !composer) return;
            const glowing = await sweep(() => {}, deadline + 400, POST_POSES);
            if (disposed || contextLost) return;
            onWarming?.(0.85);
            if (glowing > SLOW_FRAME || !measured) dropBloom();
            else {
              await addDepthOfField();
              if (disposed || contextLost) return;
              if (bokeh) {
                const focused = await sweep(() => {}, deadline + 700, POST_POSES);
                if (disposed || contextLost) return;
                if (focused > SLOW_FRAME || !measured) dropBokeh();
              }
            }
          }
        } finally {
          document.removeEventListener("visibilitychange", watch);
          onWarming?.(1);
        }
      }
      /**
       * The scene now draws whenever it is on screen rather than only while
       * the wave is on, because the sculpture drifts even when the page is
       * still. Everything that stops it stops it completely: off screen,
       * another tab, a lost context, a reader who asked for less motion.
       */
      function canAnimate() {
        return visible && !document.hidden && !contextLost && !reduced.matches;
      }
      function animate(now: number) {
        frame = 0;
        if (!canAnimate()) { lastDrawnFrame = 0; return; }
        // The drift is slow enough to carry at half rate, and the other half of
        // those frames is battery on a page the reader may sit on for a while.
        if (!lastDrawnFrame || now - lastDrawnFrame >= IDLE_FRAME) {
          lastDrawnFrame = now;
          pose(progress.current);
          render();
        }
        frame = requestAnimationFrame(animate);
      }
      function sync() {
        cancelAnimationFrame(frame);
        frame = 0;
        if (!warm || !visible || document.hidden || contextLost) return;
        // Scrolling draws at full rate; the idle loop is the throttled one.
        lastDrawnFrame = performance.now();
        pose(progress.current);
        render();
        if (canAnimate()) frame = requestAnimationFrame(animate);
      }
      /**
       * Sharpness under a fixed pixel count rather than a fixed ratio. A phone
       * at three times density and a laptop at two both draw about as many
       * pixels as they can afford, and both draw more of them than the flat
       * caps this replaces ever allowed. Recomputed on every resize, since the
       * ratio changes when a window is dragged between two screens.
       */
      function pixelRatioFor(width: number, height: number) {
        const ceiling = Math.sqrt(PIXEL_BUDGET / Math.max(1, width * height));
        return Math.max(0.8, Math.min(window.devicePixelRatio || 1, 2, Math.max(1, ceiling)) * quality);
      }
      function resize() {
        const { width, height } = element!.getBoundingClientRect();
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        const ratio = pixelRatioFor(width, height);
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height);
        composer?.setPixelRatio(ratio);
        composer?.setSize(width, height);
        sync();
      }
      function lost(event: Event) { event.preventDefault(); contextLost = true; cancelAnimationFrame(frame); onUnavailable(); }
      function restored() { contextLost = false; warm = true; markReady(); resize(); sync(); }
      const observer = new ResizeObserver(resize);
      observer.observe(element!);
      const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
      intersection.observe(element!);
      renderer.domElement.addEventListener("webglcontextlost", lost);
      renderer.domElement.addEventListener("webglcontextrestored", restored);
      document.addEventListener("visibilitychange", sync);
      reduced.addEventListener("change", sync);
      seek.current = () => sync();
      detach.push(() => {
        observer.disconnect(); intersection.disconnect();
        renderer.domElement.removeEventListener("webglcontextlost", lost);
        renderer.domElement.removeEventListener("webglcontextrestored", restored);
        document.removeEventListener("visibilitychange", sync);
        reduced.removeEventListener("change", sync);
      });
      resize();
      // The intro overlay holds the page until this settles, which is what buys
      // the scene the room to be warmed up and measured before it is seen.
      // A warm-up that fails is not a scene that fails: whatever it managed to
      // compile, the story still has to be drawn.
      void calibrate().catch(() => {}).finally(() => {
        if (disposed) return;
        warm = true;
        resize();
        sync();
        markReady();
      });
    }
    initialize().catch(() => { cleanup(); cleanup = () => {}; if (!disposed) onUnavailable(); });
    return () => { disposed = true; cleanup(); };
  }, [progress, seek, onUnavailable, onWarming, onReady]);

  return (
    <div className={styles.stage} role="img" aria-label="An orange analog waveform flows through a silver processor, is written out as code on a bench machine, and emerges as a sampled data graph.">
      <div ref={host} className={styles.canvas} data-ready={ready} aria-hidden="true" />
    </div>
  );
}
