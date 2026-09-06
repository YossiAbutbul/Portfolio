"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./SignalCore.module.css";

const SCULPTURE_SCALE = 0.85;

/** Interactive metal sculpture with drag and keyboard rotation. */
export default function SignalCore() {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<{ pause: (value: boolean) => void; wire: (value: boolean) => void } | null>(null);
  const [paused, setPaused] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let cleanup = () => {};

    async function initialize() {
      const THREE = await import("three");
      const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
      if (disposed) return;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
      camera.position.set(0, 0, 8.1);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      element!.appendChild(renderer.domElement);

      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      const environment = pmrem.fromScene(room, 0.04);
      scene.environment = environment.texture;
      room.dispose();
      pmrem.dispose();

      const sculpture = new THREE.Group();
      sculpture.scale.setScalar(SCULPTURE_SCALE);
      sculpture.rotation.set(0.35, -0.45, -0.4);
      scene.add(sculpture);
      const metal = new THREE.MeshPhysicalMaterial({
        color: 0xc4ccd1, metalness: 1, roughness: 0.18, clearcoat: 1,
        clearcoatRoughness: 0.12, envMapIntensity: 1.65,
      });
      const orange = new THREE.MeshPhysicalMaterial({
        color: 0xff5b1c, metalness: 0.5, roughness: 0.24,
        emissive: 0xff4108, emissiveIntensity: 0.28, clearcoat: 1,
      });
      const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.35, 0.37, 240, 36, 2, 3), metal);
      sculpture.add(knot);
      const orbit = new THREE.Group();
      orbit.rotation.set(0.75, -0.45, 0.2);
      orbit.add(new THREE.Mesh(new THREE.TorusGeometry(2.16, 0.026, 10, 160), orange));
      const satellite = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), orange);
      orbit.add(satellite);
      sculpture.add(orbit);
      const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.37, 2), orange);
      sculpture.add(inner);

      const rim = new THREE.DirectionalLight(0xff6d2f, 4);
      rim.position.set(-4, -1, 2);
      const key = new THREE.DirectionalLight(0xe7efff, 4);
      key.position.set(3, 4, 5);
      const edge = new THREE.DirectionalLight(0xe7efff, 2.5);
      edge.position.set(-3, 3, -2);
      scene.add(rim, key, edge, new THREE.AmbientLight(0xffffff, 0.5));

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      const pointer = { x: 0, y: 0 };
      let manualPause = false;
      let visible = true;
      let frame = 0;
      let last = 0;
      let elapsed = 0;
      let dragging = false;
      let previousX = 0;
      let dragRotation = 0;
      let contextLost = false;
      let scrollProgress = 0;
      const hero = element!.closest("section");

      function updateScroll() {
        if (!hero) return;
        const bounds = hero.getBoundingClientRect();
        scrollProgress = Math.max(0, Math.min(1, -bounds.top / Math.max(bounds.height, 1)));
      }

      function render() { if (!contextLost) renderer.render(scene, camera); }
      function tick(now: number) {
        frame = 0;
        const dt = last ? Math.min((now - last) / 1000, 0.04) : 0;
        last = now;
        elapsed += dt;
        const smoothing = 1 - Math.exp(-dt * 3.5);
        sculpture.rotation.y += ((-0.45 + elapsed * 0.1 + pointer.x * 0.32 + dragRotation + scrollProgress * 1.2) - sculpture.rotation.y) * smoothing;
        sculpture.rotation.x += ((0.35 + pointer.y * 0.22 + scrollProgress * 0.35) - sculpture.rotation.x) * smoothing;
        sculpture.position.y = Math.sin(elapsed * 0.7) * 0.09 + scrollProgress * 0.22;
        const scale = SCULPTURE_SCALE * (1 - scrollProgress * 0.15);
        sculpture.scale.setScalar(scale);
        key.position.x += ((3 + pointer.x * 1.4) - key.position.x) * smoothing;
        knot.rotation.z = Math.sin(elapsed * 0.15) * 0.12;
        orbit.rotation.z = elapsed * 0.12;
        satellite.position.set(Math.cos(elapsed * 0.5) * 2.16, Math.sin(elapsed * 0.5) * 2.16, 0);
        inner.rotation.y = elapsed * 0.4;
        render();
        if (visible && !document.hidden && !manualPause && !reduced.matches && !contextLost) frame = requestAnimationFrame(tick);
      }
      function sync() {
        cancelAnimationFrame(frame);
        frame = 0;
        last = 0;
        if (visible && !document.hidden && !manualPause && !reduced.matches && !contextLost) frame = requestAnimationFrame(tick);
        else render();
      }
      function resize() {
        const { width, height } = element!.getBoundingClientRect();
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.position.z = camera.aspect < 0.9 ? 8.8 : 8.1;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        render();
      }
      function move(event: PointerEvent) {
        const bounds = element!.getBoundingClientRect();
        pointer.x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
        pointer.y = (event.clientY - bounds.top) / bounds.height * 2 - 1;
        if (dragging) {
          const delta = (event.clientX - previousX) * 0.009;
          dragRotation += delta;
          previousX = event.clientX;
          if (manualPause || reduced.matches) { sculpture.rotation.y += delta; render(); }
        }
      }
      function down(event: PointerEvent) {
        dragging = true;
        previousX = event.clientX;
        element!.setPointerCapture(event.pointerId);
      }
      function up() { dragging = false; }
      function leave() { pointer.x = 0; pointer.y = 0; }
      function keydown(event: KeyboardEvent) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const delta = event.key === "ArrowLeft" ? -0.18 : 0.18;
        dragRotation += delta;
        sculpture.rotation.y += delta;
        render();
      }
      function lost(event: Event) {
        event.preventDefault();
        contextLost = true;
        cancelAnimationFrame(frame);
        setStatus("fallback");
      }
      function restored() { contextLost = false; setStatus("ready"); sync(); }
      const observer = new ResizeObserver(resize);
      observer.observe(element!);
      const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
      intersection.observe(element!);
      element!.addEventListener("pointermove", move);
      element!.addEventListener("pointerdown", down);
      element!.addEventListener("pointerup", up);
      element!.addEventListener("pointercancel", up);
      element!.addEventListener("pointerleave", leave);
      element!.addEventListener("keydown", keydown);
      renderer.domElement.addEventListener("webglcontextlost", lost);
      renderer.domElement.addEventListener("webglcontextrestored", restored);
      document.addEventListener("visibilitychange", sync);
      window.addEventListener("scroll", updateScroll, { passive: true });
      reduced.addEventListener("change", sync);
      controller.current = {
        pause(value) { manualPause = value; sync(); },
        wire(value) { metal.wireframe = value; metal.needsUpdate = true; render(); },
      };
      satellite.position.set(2.16, 0, 0);
      updateScroll();
      resize();
      sync();
      setStatus("ready");
      cleanup = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        intersection.disconnect();
        document.removeEventListener("visibilitychange", sync);
        window.removeEventListener("scroll", updateScroll);
        reduced.removeEventListener("change", sync);
        element!.removeEventListener("pointermove", move);
        element!.removeEventListener("pointerdown", down);
        element!.removeEventListener("pointerup", up);
        element!.removeEventListener("pointercancel", up);
        element!.removeEventListener("pointerleave", leave);
        element!.removeEventListener("keydown", keydown);
        renderer.domElement.removeEventListener("webglcontextlost", lost);
        renderer.domElement.removeEventListener("webglcontextrestored", restored);
        scene.traverse((object) => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
        metal.dispose(); orange.dispose(); environment.dispose(); renderer.dispose();
        renderer.domElement.remove();
        controller.current = null;
      };
    }
    initialize().catch(() => { cleanup(); if (!disposed) setStatus("fallback"); });
    return () => { disposed = true; cleanup(); };
  }, []);

  return (
    <div className={styles.stage}>
      <div ref={host} className={styles.canvas} tabIndex={status === "ready" ? 0 : -1} role="group"
        aria-label="Interactive three-dimensional sculpture. Drag horizontally or use left and right arrow keys to rotate." />
      {status !== "ready" && <div className={styles.fallback}><p>{status === "loading" ? "Loading 3D view" : "3D view unavailable"}</p></div>}
      <div className={styles.bottomline}>
        <span>{status === "ready" ? "Drag to rotate" : ""}</span>
        {status === "ready" && <div className={styles.controls}>
          <button type="button" aria-pressed={wireframe} onClick={() => { setWireframe(!wireframe); controller.current?.wire(!wireframe); }}>{wireframe ? "Solid" : "Wireframe"}</button>
          <button type="button" aria-label={paused ? "Resume rotation" : "Pause rotation"} aria-pressed={paused} onClick={() => { setPaused(!paused); controller.current?.pause(!paused); }}>{paused ? "Play" : "Pause"}</button>
        </div>}
      </div>
    </div>
  );
}
