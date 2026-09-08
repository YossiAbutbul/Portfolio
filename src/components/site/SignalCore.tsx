"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type * as Three from "three";
import { signalStory, transition } from "./signal-story";
import styles from "./SignalCore.module.css";

const SCULPTURE_SCALE = 0.85;
const SIGNAL_RADIUS = 0.018;
const SIGNAL_PLANE_Z = 0.46;

/** An analog signal passes through a processor and becomes sampled data. */
export default function SignalCore({ progress, seek, onUnavailable }: {
  progress: RefObject<number>;
  seek: RefObject<((progress: number) => void) | null>;
  onUnavailable: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let cleanup = () => {};

    async function initialize() {
      const [THREE, { RoomEnvironment }, { RoundedBoxGeometry }, { RectAreaLightUniformsLib }, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { mergeGeometries }] = await Promise.all([
        import("three"),
        import("three/addons/environments/RoomEnvironment.js"),
        import("three/addons/geometries/RoundedBoxGeometry.js"),
        import("three/addons/lights/RectAreaLightUniformsLib.js"),
        import("three/addons/postprocessing/EffectComposer.js"),
        import("three/addons/postprocessing/RenderPass.js"),
        import("three/addons/postprocessing/UnrealBloomPass.js"),
        import("three/addons/postprocessing/OutputPass.js"),
        import("three/addons/utils/BufferGeometryUtils.js"),
      ]);
      if (disposed) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { onUnavailable(); return; }
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
      const composer = new EffectComposer(renderer);
      const renderPass = new RenderPass(scene, camera);
      const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.24, 0.55, 1.45);
      const outputPass = new OutputPass();
      composer.addPass(renderPass);
      composer.addPass(bloom);
      composer.addPass(outputPass);
      detach.push(() => { renderPass.dispose(); bloom.dispose(); outputPass.dispose(); composer.dispose(); });
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
      const orange = material(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff7a42).multiplyScalar(1.8), toneMapped: false }));
      const signalFinish = material(new THREE.MeshPhysicalMaterial({
        color: 0xff8547, emissive: 0xff481c, emissiveIntensity: 0.65,
        metalness: 0.4, roughness: 0.26, clearcoat: 0.6,
      }));
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
      const segments = 144;
      const sides = 8;
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
        waveGeometry.computeVertexNormals();
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
      const pulseGeometry = geometry(new THREE.SphereGeometry(0.05, 16, 12));
      // One persistent pulse avoids visibility and scale jumps at stage boundaries.
      const signalPulse = new THREE.Mesh(pulseGeometry, white);
      sculpture.add(signalPulse);
      const bridgeSegments = 48;
      const bridgePositions = new Float32Array((bridgeSegments + 1) * sides * 3);
      const bridgeIndices: number[] = [];
      for (let i = 0; i < bridgeSegments; i++) {
        for (let j = 0; j < sides; j++) {
          const a = i * sides + j, b = i * sides + (j + 1) % sides;
          bridgeIndices.push(a, b, a + sides, b, b + sides, a + sides);
        }
      }
      const bridgeGeometry = geometry(new THREE.BufferGeometry());
      bridgeGeometry.setAttribute("position", new THREE.BufferAttribute(bridgePositions, 3).setUsage(THREE.DynamicDrawUsage));
      bridgeGeometry.setIndex(bridgeIndices);
      const bridge = new THREE.Mesh(bridgeGeometry, orange);
      bridge.frustumCulled = false;
      sculpture.add(bridge);
      const bridgeCurve = new THREE.CubicBezierCurve3();

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
      let lastWaveClockFrame = 0;
      let lastIdleFrame = 0;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      function pose(value: number) {
        const s = signalStory(value);
        const mix = THREE.MathUtils.lerp;
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
        // Leave the text column and take over the viewport as the chip appears.
        sculpture.position.set(centerX + mix(0, -2.67, s.handoff), centerY, 0);
        sculpture.rotation.set(
          0.12 + s.approach * 0.3 + s.closeup * 0.12 - s.handoff * 0.32,
          -0.1 - s.approach * 0.45 + s.closeup * 0.2 + s.handoff * 0.7,
          -0.06 - s.approach * 0.15 + s.handoff * 0.25,
        );
        // A moving softbox draws a highlight across the case as the shot opens.
        key.position.x = mix(-3, 1.8, s.open);
        key.lookAt(centerX, 0, 0);
        rim.intensity = 2.7 + s.closeup * 0.7;
        bloom.strength = 0.17 + Math.sin(s.process * Math.PI) * 0.1;
        const release = transition(value, 0.84, 0.89);
        processor.visible = s.approach > 0.001 && release < 0.999;
        processor.scale.setScalar(mix(0.7, 2.08, s.approach) * mix(1, 0.17, s.handoff) * (1 - release));
        processor.rotation.y = -(1 - s.approach) * 0.95;
        const initialWaveScale = 1.8 * Math.max(1, camera.aspect / 1.85);
        waveEnd.set(mix(1.215 * initialWaveScale, -0.94 * 2.08, s.approach), 0, mix(0, SIGNAL_PLANE_Z * 2.08, s.approach));
        point.copy(inputPin).multiply(processor.scale).applyEuler(processor.rotation);
        processor.position.copy(waveEnd).sub(point);
        processor.position.x -= s.handoff * 1.4;
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
        const now = performance.now();
        const dt = lastWaveClockFrame ? Math.min((now - lastWaveClockFrame) / 1000, 0.05) : 0;
        lastWaveClockFrame = now;
        if (input.visible && !reduced.matches) {
          const approachDrift = transition(value, 0.18, 0.43) * (1 - s.feed) * 0.28;
          waveClock += dt * (1 + approachDrift);
        }
        const time = waveClock;
        if (input.visible) updateWave(time);

        output.visible = s.handoff > 0.001;
        output.scale.setScalar(mix(0.05, 1.65, s.handoff) * (1 - s.exit * 0.12));
        output.position.x = mix(0.45, -0.52, s.handoff);
        output.rotation.y = mix(-1.2, 0, s.handoff);
        output.rotation.z = mix(-0.12, 0, s.handoff);
        processor.updateMatrix();
        output.updateMatrix();
        before.copy(outputPin).applyMatrix4(processor.matrix);
        after.copy(graphPoints[0]).applyMatrix4(output.matrix);
        // Keep the unfolding panel outside the case while both are visible.
        output.position.x += Math.max(0, before.x + 0.28 - after.x);
        graphGeometry.setDrawRange(0, Math.floor(s.graph * 128) * 8 * 6);
        samples.forEach((sample, index) => { sample.visible = s.graph >= index / 16 && s.graph > 0; });
        sampleStems.forEach((stem, index) => { stem.visible = s.graph >= index / 16 && s.graph > 0; });
        // Carry the processed signal to the first graph sample before releasing the chip.
        processor.updateMatrix();
        output.updateMatrix();
        bridgeCurve.v0.copy(outputPin).applyMatrix4(processor.matrix);
        bridgeCurve.v3.copy(graphPoints[0]).applyMatrix4(output.matrix);
        bridgeCurve.v0.lerp(bridgeCurve.v3, release);
        const reach = bridgeCurve.v0.distanceTo(bridgeCurve.v3) * 0.35;
        bridgeCurve.v1.copy(bridgeCurve.v0);
        bridgeCurve.v1.x += reach;
        bridgeCurve.v2.copy(bridgeCurve.v3);
        bridgeCurve.v2.x -= reach;
        bridge.visible = s.handoff > 0 && release < 0.999;
        for (let i = 0; i <= bridgeSegments; i++) {
          const u = i / bridgeSegments;
          bridgeCurve.getPoint(u, point);
          bridgeCurve.getTangent(u, tangent);
          normal.crossVectors(tangent, up).normalize();
          binormal.crossVectors(tangent, normal).normalize();
          // Match both transformed tube radii as the chip shrinks and graph grows.
          const blend = mix(release, 1, transition(u, 0, 1));
          const radius = SIGNAL_RADIUS * mix(processor.scale.x, output.scale.x, blend);
          for (let j = 0; j < sides; j++) {
            const angle = j / sides * Math.PI * 2;
            const a = Math.cos(angle) * radius, b = Math.sin(angle) * radius;
            const offset = (i * sides + j) * 3;
            bridgePositions[offset] = point.x + normal.x * a + binormal.x * b;
            bridgePositions[offset + 1] = point.y + normal.y * a + binormal.y * b;
            bridgePositions[offset + 2] = point.z + normal.z * a + binormal.z * b;
          }
        }
        bridgeGeometry.attributes.position.needsUpdate = true;
        signalPulse.visible = value >= 0.29;
        signalPulse.scale.setScalar(1 - s.exit);
        if (value < 0.43) {
          incoming(s.feed, time, signalPulse.position);
        } else if (value < 0.7) {
          // TubeGeometry uses arc length sampling; the pulse must use it too.
          circuitPath.getPointAt(s.process, signalPulse.position).applyMatrix4(processor.matrix);
        } else if (value < 0.78) {
          bridgeCurve.getPoint(transition(value, 0.7, 0.78), signalPulse.position);
        } else {
          graphCurve.getPointAt(s.graph, signalPulse.position).applyMatrix4(output.matrix);
        }
      }
      function render() { if (!contextLost) composer.render(); }
      function canAnimateWave() {
        return progress.current < 0.18 && visible && !document.hidden && !contextLost && !reduced.matches;
      }
      function animateWave(now: number) {
        frame = 0;
        if (!canAnimateWave()) { lastIdleFrame = 0; return; }
        const dt = lastIdleFrame ? Math.min((now - lastIdleFrame) / 1000, 0.05) : 0;
        lastIdleFrame = now;
        pose(progress.current);
        render();
        frame = requestAnimationFrame(animateWave);
      }
      function sync() {
        cancelAnimationFrame(frame);
        frame = 0;
        lastIdleFrame = 0;
        if (!visible || document.hidden || contextLost) return;
        pose(progress.current);
        render();
        if (canAnimateWave()) frame = requestAnimationFrame(animateWave);
      }
      function resize() {
        const { width, height } = element!.getBoundingClientRect();
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        composer.setSize(width, height);
        sync();
      }
      function lost(event: Event) { event.preventDefault(); contextLost = true; cancelAnimationFrame(frame); onUnavailable(); }
      function restored() { contextLost = false; setReady(true); resize(); sync(); }
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
      resize(); sync(); setReady(true);
    }
    initialize().catch(() => { cleanup(); cleanup = () => {}; if (!disposed) onUnavailable(); });
    return () => { disposed = true; cleanup(); };
  }, [progress, seek, onUnavailable]);

  return (
    <div className={styles.stage} role="img" aria-label="An orange analog waveform flows through a silver processor and emerges as a sampled data graph.">
      <div ref={host} className={styles.canvas} data-ready={ready} aria-hidden="true" />
    </div>
  );
}
