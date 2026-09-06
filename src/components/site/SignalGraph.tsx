"use client";

import { useEffect, useRef, useState } from "react";
import { buildGraph } from "@/lib/graph";
import styles from "./SignalCore.module.css";

/**
 * A graph solving itself, in three dimensions.
 *
 * Same shell and lifecycle as SignalCore - the difference is what is on screen.
 * The geometry is not a stock mesh: nodes are relaxed into place by spring and
 * repulsion forces, and a breadth-first search runs across them on a loop. The
 * frontier advances a level at a time, tree edges light as they are taken, and
 * edges the search looked at and discarded stay dark.
 *
 * Nodes are spheres and edges are thin cylinders rather than lines, because
 * WebGL ignores line widths above one pixel and a wire graph reads as a smudge
 * at this size.
 */

const GRAPH_SCALE = 2.55;
/** Seconds for the frontier to cross the graph. */
const SEARCH_SECONDS = 6.5;
/** Seconds the finished tree is held before the search restarts. */
const HOLD_SECONDS = 2.5;

export default function SignalGraph() {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<{ pause: (value: boolean) => void; replay: () => void } | null>(null);
  const [paused, setPaused] = useState(false);
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

      const graph = buildGraph();
      const cycleSeconds = SEARCH_SECONDS + HOLD_SECONDS;

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

      const group = new THREE.Group();
      group.rotation.set(0.3, -0.4, -0.15);
      scene.add(group);

      // Four materials, shared by every node and edge: swapping a mesh between
      // them is how a discovery is drawn, so nothing is allocated per frame.
      const dormantNode = new THREE.MeshPhysicalMaterial({
        color: 0x8f979c, metalness: 1, roughness: 0.28, clearcoat: 1, envMapIntensity: 1.4,
      });
      const visitedNode = new THREE.MeshPhysicalMaterial({
        color: 0xff5b1c, metalness: 0.5, roughness: 0.24,
        emissive: 0xff4108, emissiveIntensity: 0.45, clearcoat: 1,
      });
      const dormantEdge = new THREE.MeshPhysicalMaterial({
        color: 0x6a7176, metalness: 1, roughness: 0.42, envMapIntensity: 0.9,
      });
      const takenEdge = new THREE.MeshPhysicalMaterial({
        color: 0xff7a42, metalness: 0.6, roughness: 0.3,
        emissive: 0xff4108, emissiveIntensity: 0.3,
      });

      const nodeGeometry = new THREE.IcosahedronGeometry(0.115, 3);
      const sourceGeometry = new THREE.IcosahedronGeometry(0.18, 3);
      // One unit cylinder along Y, reused by every edge via its own transform.
      const edgeGeometry = new THREE.CylinderGeometry(0.023, 0.023, 1, 8, 1);
      const axisY = new THREE.Vector3(0, 1, 0);

      const nodeMeshes = graph.nodes.map((node, index) => {
        const mesh = new THREE.Mesh(index === graph.source ? sourceGeometry : nodeGeometry, dormantNode);
        mesh.position.set(node.x * GRAPH_SCALE, node.y * GRAPH_SCALE, node.z * GRAPH_SCALE);
        group.add(mesh);
        return mesh;
      });

      const edgeMeshes = graph.edges.map((edge) => {
        const a = new THREE.Vector3(
          graph.nodes[edge.a].x * GRAPH_SCALE,
          graph.nodes[edge.a].y * GRAPH_SCALE,
          graph.nodes[edge.a].z * GRAPH_SCALE,
        );
        const b = new THREE.Vector3(
          graph.nodes[edge.b].x * GRAPH_SCALE,
          graph.nodes[edge.b].y * GRAPH_SCALE,
          graph.nodes[edge.b].z * GRAPH_SCALE,
        );
        const mesh = new THREE.Mesh(edgeGeometry, dormantEdge);
        mesh.position.copy(a).add(b).multiplyScalar(0.5);
        mesh.scale.y = a.distanceTo(b);
        mesh.quaternion.setFromUnitVectors(axisY, b.clone().sub(a).normalize());
        group.add(mesh);
        return mesh;
      });

      const rim = new THREE.DirectionalLight(0xff6d2f, 4);
      rim.position.set(-4, -1, 2);
      const key = new THREE.DirectionalLight(0xe7efff, 4);
      key.position.set(3, 4, 5);
      const edgeLight = new THREE.DirectionalLight(0xe7efff, 2.5);
      edgeLight.position.set(-3, 3, -2);
      scene.add(rim, key, edgeLight, new THREE.AmbientLight(0xffffff, 0.5));

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      const pointer = { x: 0, y: 0 };
      let manualPause = false;
      let visible = true;
      let frame = 0;
      let last = 0;
      let elapsed = 0;
      let searchStart = 0;
      let dragging = false;
      let previousX = 0;
      let dragRotation = 0;
      let contextLost = false;
      let scrollProgress = 0;
      /** Last frontier level painted, so materials are only swapped on change. */
      let painted = -1;
      const hero = element!.closest("section");

      function updateScroll() {
        if (!hero) return;
        const bounds = hero.getBoundingClientRect();
        scrollProgress = Math.max(0, Math.min(1, -bounds.top / Math.max(bounds.height, 1)));
      }

      /** Repaint discovery state. Cheap, and skipped when nothing changed. */
      function paint(reached: number, force = false) {
        if (!force && reached === painted) return;
        painted = reached;
        for (let index = 0; index < nodeMeshes.length; index += 1) {
          nodeMeshes[index].material = graph.level[index] <= reached ? visitedNode : dormantNode;
        }
        for (let index = 0; index < edgeMeshes.length; index += 1) {
          const edge = graph.edges[index];
          const taken = edge.tree && edge.child >= 0 && graph.level[edge.child] <= reached;
          edgeMeshes[index].material = taken ? takenEdge : dormantEdge;
        }
      }

      function render() {
        if (!contextLost) renderer.render(scene, camera);
      }

      function tick(now: number) {
        frame = 0;
        const dt = last ? Math.min((now - last) / 1000, 0.04) : 0;
        last = now;
        elapsed += dt;
        searchStart += dt;

        const cycle = searchStart % cycleSeconds;
        paint(Math.floor(Math.min(1, cycle / SEARCH_SECONDS) * (graph.depth + 1)));

        const smoothing = 1 - Math.exp(-dt * 3.5);
        group.rotation.y +=
          ((-0.4 + elapsed * 0.09 + pointer.x * 0.32 + dragRotation + scrollProgress * 1.2) - group.rotation.y) * smoothing;
        group.rotation.x += ((0.3 + pointer.y * 0.22 + scrollProgress * 0.35) - group.rotation.x) * smoothing;
        group.position.y = Math.sin(elapsed * 0.7) * 0.09 + scrollProgress * 0.22;
        group.scale.setScalar(1 - scrollProgress * 0.15);
        key.position.x += ((3 + pointer.x * 1.4) - key.position.x) * smoothing;

        render();
        if (visible && !document.hidden && !manualPause && !reduced.matches && !contextLost) {
          frame = requestAnimationFrame(tick);
        }
      }

      function sync() {
        cancelAnimationFrame(frame);
        frame = 0;
        last = 0;
        if (visible && !document.hidden && !manualPause && !reduced.matches && !contextLost) {
          frame = requestAnimationFrame(tick);
        } else {
          render();
        }
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
        pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
        pointer.y = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
        if (dragging) {
          const delta = (event.clientX - previousX) * 0.009;
          dragRotation += delta;
          previousX = event.clientX;
          if (manualPause || reduced.matches) {
            group.rotation.y += delta;
            render();
          }
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
        group.rotation.y += delta;
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
      const intersection = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        sync();
      });
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
        replay() { searchStart = 0; paint(0, true); render(); },
      };

      // Reduced motion gets the finished tree rather than a dormant graph.
      paint(reduced.matches ? graph.depth : 0, true);
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
        nodeGeometry.dispose();
        sourceGeometry.dispose();
        edgeGeometry.dispose();
        dormantNode.dispose();
        visitedNode.dispose();
        dormantEdge.dispose();
        takenEdge.dispose();
        environment.dispose();
        renderer.dispose();
        renderer.domElement.remove();
        controller.current = null;
      };
    }

    initialize().catch(() => {
      cleanup();
      if (!disposed) setStatus("fallback");
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div className={styles.stage}>
      <div
        ref={host}
        className={styles.canvas}
        tabIndex={status === "ready" ? 0 : -1}
        role="group"
        aria-label="Interactive three-dimensional graph running a breadth-first search. Drag horizontally or use left and right arrow keys to rotate."
      />
      {status !== "ready" && (
        <div className={styles.fallback}>
          <p>{status === "loading" ? "Loading 3D view" : "3D view unavailable"}</p>
        </div>
      )}
      <div className={styles.bottomline}>
        <span>{status === "ready" ? "Breadth-first search · drag to rotate" : ""}</span>
        {status === "ready" && (
          <div className={styles.controls}>
            <button type="button" onClick={() => controller.current?.replay()}>
              Replay
            </button>
            <button
              type="button"
              aria-label={paused ? "Resume rotation" : "Pause rotation"}
              aria-pressed={paused}
              onClick={() => {
                setPaused(!paused);
                controller.current?.pause(!paused);
              }}
            >
              {paused ? "Play" : "Pause"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
