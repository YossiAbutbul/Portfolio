"use client";

import { useEffect, useRef } from "react";
import styles from "./GraphSolve.module.css";

/**
 * A graph solving itself.
 *
 * A real graph - laid out by force relaxation in three dimensions, not placed
 * by hand - with a breadth-first search running on it on a loop. The frontier
 * advances one level at a time; edges the search keeps are inked, edges it
 * looked at and discarded stay faint, and visited nodes fill in solid.
 *
 * Drawn the way a pen plotter would draw it: one ink weight, no shading, no
 * light source. Nodes are filled with the paper colour before being stroked,
 * and every primitive is depth-sorted, so near nodes occlude the edges behind
 * them and the result reads as a diagram rather than a render.
 *
 * The search is the point. An ordering you cannot see, made visible one step
 * at a time, is the whole argument the page is making.
 */

const NODES = 24;
/** Neighbours each node reaches for when the graph is built. */
const DEGREE = 3;
const RELAX_STEPS = 260;
const MAX_DPR = 2;
/** One turn, in seconds. Drift, not animation. */
const TURN_SECONDS = 54;
/** One full search, including the pause at the end before it resets. */
const CYCLE_SECONDS = 11;
/** Share of the cycle spent searching; the rest holds the finished tree. */
const SEARCH_SHARE = 0.62;
/** How far the pointer may lean the graph, in radians. */
const LEAN = 0.26;

type Vec = { x: number; y: number; z: number };
type Edge = { a: number; b: number; tree: boolean; child: number };

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distance(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Build the graph once: scatter nodes, connect each to its nearest few, weld
 * any disconnected components, then relax the whole thing so the drawing has
 * even spacing instead of clumps.
 */
function buildGraph() {
  const random = mulberry32(0x9e37);
  const nodes: Vec[] = [];

  for (let index = 0; index < NODES; index += 1) {
    nodes.push({
      x: random() * 2 - 1,
      y: random() * 2 - 1,
      z: random() * 2 - 1,
    });
  }

  // Nearest-neighbour edges, deduplicated.
  const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const pairs = new Set<string>();

  for (let index = 0; index < NODES; index += 1) {
    const order = nodes
      .map((node, other) => ({ other, d: distance(nodes[index], node) }))
      .filter((entry) => entry.other !== index)
      .sort((one, two) => one.d - two.d);
    for (let n = 0; n < DEGREE; n += 1) pairs.add(key(index, order[n].other));
  }

  // Weld components so the search reaches every node.
  const adjacency = () => {
    const list: number[][] = Array.from({ length: NODES }, () => []);
    for (const pair of pairs) {
      const [a, b] = pair.split(":").map(Number);
      list[a].push(b);
      list[b].push(a);
    }
    return list;
  };

  for (let guard = 0; guard < NODES; guard += 1) {
    const list = adjacency();
    const seen = new Set<number>([0]);
    const queue = [0];
    while (queue.length) {
      const current = queue.shift()!;
      for (const next of list[current]) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    if (seen.size === NODES) break;

    // Join the nearest pair that bridges the split.
    let best = { a: -1, b: -1, d: Infinity };
    for (const inside of seen) {
      for (let outside = 0; outside < NODES; outside += 1) {
        if (seen.has(outside)) continue;
        const d = distance(nodes[inside], nodes[outside]);
        if (d < best.d) best = { a: inside, b: outside, d };
      }
    }
    if (best.a < 0) break;
    pairs.add(key(best.a, best.b));
  }

  const links = [...pairs].map((pair) => {
    const [a, b] = pair.split(":").map(Number);
    return { a, b };
  });

  // Force relaxation: springs along edges, repulsion everywhere else.
  for (let step = 0; step < RELAX_STEPS; step += 1) {
    const force: Vec[] = nodes.map(() => ({ x: 0, y: 0, z: 0 }));

    for (let a = 0; a < NODES; a += 1) {
      for (let b = a + 1; b < NODES; b += 1) {
        const dx = nodes[a].x - nodes[b].x;
        const dy = nodes[a].y - nodes[b].y;
        const dz = nodes[a].z - nodes[b].z;
        const d = Math.max(0.08, Math.hypot(dx, dy, dz));
        const push = 0.016 / (d * d);
        force[a].x += (dx / d) * push;
        force[a].y += (dy / d) * push;
        force[a].z += (dz / d) * push;
        force[b].x -= (dx / d) * push;
        force[b].y -= (dy / d) * push;
        force[b].z -= (dz / d) * push;
      }
    }

    for (const link of links) {
      const dx = nodes[link.b].x - nodes[link.a].x;
      const dy = nodes[link.b].y - nodes[link.a].y;
      const dz = nodes[link.b].z - nodes[link.a].z;
      const d = Math.max(0.08, Math.hypot(dx, dy, dz));
      const pull = (d - 0.62) * 0.06;
      force[link.a].x += (dx / d) * pull;
      force[link.a].y += (dy / d) * pull;
      force[link.a].z += (dz / d) * pull;
      force[link.b].x -= (dx / d) * pull;
      force[link.b].y -= (dy / d) * pull;
      force[link.b].z -= (dz / d) * pull;
    }

    for (let index = 0; index < NODES; index += 1) {
      nodes[index].x += force[index].x;
      nodes[index].y += force[index].y;
      nodes[index].z += force[index].z;
    }
  }

  // Centre and normalise so the drawing always fills its box.
  const centre = nodes.reduce(
    (acc, node) => ({ x: acc.x + node.x / NODES, y: acc.y + node.y / NODES, z: acc.z + node.z / NODES }),
    { x: 0, y: 0, z: 0 },
  );
  let extent = 0;
  for (const node of nodes) {
    node.x -= centre.x;
    node.y -= centre.y;
    node.z -= centre.z;
    extent = Math.max(extent, Math.hypot(node.x, node.y, node.z));
  }
  for (const node of nodes) {
    node.x /= extent;
    node.y /= extent;
    node.z /= extent;
  }

  // Breadth-first search from the node nearest the centre: levels give the
  // order the frontier advances in, and parents give the tree edges.
  let source = 0;
  let bestRadius = Infinity;
  for (let index = 0; index < NODES; index += 1) {
    const r = Math.hypot(nodes[index].x, nodes[index].y, nodes[index].z);
    if (r < bestRadius) {
      bestRadius = r;
      source = index;
    }
  }

  const list: number[][] = Array.from({ length: NODES }, () => []);
  for (const link of links) {
    list[link.a].push(link.b);
    list[link.b].push(link.a);
  }

  const level = new Array<number>(NODES).fill(-1);
  const parent = new Array<number>(NODES).fill(-1);
  level[source] = 0;
  const queue = [source];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of list[current]) {
      if (level[next] !== -1) continue;
      level[next] = level[current] + 1;
      parent[next] = current;
      queue.push(next);
    }
  }

  const edges: Edge[] = links.map((link) => {
    const treeForward = parent[link.b] === link.a;
    const treeBack = parent[link.a] === link.b;
    return {
      a: link.a,
      b: link.b,
      tree: treeForward || treeBack,
      child: treeForward ? link.b : treeBack ? link.a : -1,
    };
  });

  const depth = Math.max(...level);
  return { nodes, edges, level, source, depth };
}

export default function GraphSolve() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const graph = buildGraph();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let ink = "#15181B";
    let paper = "#ECEBE5";
    let faint = "#6B6F74";

    let frame = 0;
    let start = 0;
    let elapsedSeconds = 0;
    const lean = { x: 0, y: 0 };
    let target = { x: 0, y: 0 };

    function readPalette() {
      const style = getComputedStyle(host!);
      ink = style.getPropertyValue("--ink").trim() || ink;
      paper = style.getPropertyValue("--paper").trim() || paper;
      // Undiscovered edges take the muted ink, not the faintest one: at the
      // faintest the whole graph reads as a smudge rather than a drawing.
      faint = style.getPropertyValue("--ink-muted").trim() || faint;
    }

    function resize() {
      const rect = host!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.max(1, Math.round(width * dpr));
      canvas!.height = Math.max(1, Math.round(height * dpr));
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
      readPalette();
    }

    function draw(elapsed: number) {
      if (width < 2 || height < 2) return;

      const spin = (elapsed / TURN_SECONDS) * Math.PI * 2 + 0.6 + lean.x;
      const pitch = -0.3 + lean.y;

      // Where the frontier has reached. Reduced motion gets the finished tree.
      const cyclePosition = reduced ? 1 : (elapsed % CYCLE_SECONDS) / CYCLE_SECONDS;
      const reached = reduced
        ? graph.depth + 1
        : Math.min(graph.depth + 1, (cyclePosition / SEARCH_SHARE) * (graph.depth + 1));

      const scale = Math.min(width, height) * 0.5;
      const originX = width / 2;
      const originY = height / 2;

      const cosSpin = Math.cos(spin);
      const sinSpin = Math.sin(spin);
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);

      function project(point: Vec) {
        const x = point.x * cosSpin - point.z * sinSpin;
        const z = point.x * sinSpin + point.z * cosSpin;
        const y = point.y * cosPitch - z * sinPitch;
        const depth = point.y * sinPitch + z * cosPitch;
        const k = 2.9 / (2.9 + depth);
        return { sx: originX + x * scale * k, sy: originY - y * scale * k, depth, k };
      }

      const screen = graph.nodes.map(project);

      context!.clearRect(0, 0, width, height);
      context!.lineWidth = 1;
      context!.lineJoin = "round";

      // Everything is depth sorted together so nodes occlude the edges that
      // pass behind them.
      type Item = { depth: number; render: () => void };
      const items: Item[] = [];

      for (const edge of graph.edges) {
        const a = screen[edge.a];
        const b = screen[edge.b];
        // A tree edge inks in as soon as the node it discovered is reached.
        const discovered =
          edge.tree && edge.child >= 0 && graph.level[edge.child] <= Math.floor(reached);
        items.push({
          depth: (a.depth + b.depth) / 2,
          render: () => {
            context!.strokeStyle = discovered ? ink : faint;
            context!.beginPath();
            context!.moveTo(a.sx, a.sy);
            context!.lineTo(b.sx, b.sy);
            context!.stroke();
          },
        });
      }

      for (let index = 0; index < NODES; index += 1) {
        const point = screen[index];
        const nodeLevel = graph.level[index];
        const visited = nodeLevel <= Math.floor(reached);
        // The level the frontier is on right now gets a ring around it.
        const onFrontier = !reduced && nodeLevel === Math.floor(reached) && cyclePosition < SEARCH_SHARE;
        const radius = (index === graph.source ? 4.4 : 3.2) * point.k;

        items.push({
          depth: point.depth,
          render: () => {
            context!.beginPath();
            context!.arc(point.sx, point.sy, radius, 0, Math.PI * 2);
            context!.fillStyle = visited ? ink : paper;
            context!.fill();
            context!.strokeStyle = visited ? ink : faint;
            context!.stroke();

            if (onFrontier) {
              context!.beginPath();
              context!.arc(point.sx, point.sy, radius + 3.5, 0, Math.PI * 2);
              context!.strokeStyle = ink;
              context!.stroke();
            }
          },
        });
      }

      items.sort((one, two) => two.depth - one.depth);
      for (const item of items) item.render();
    }

    function loop(now: number) {
      if (!start) start = now;
      elapsedSeconds = (now - start) / 1000;
      lean.x += (target.x - lean.x) * 0.06;
      lean.y += (target.y - lean.y) * 0.06;
      draw(elapsedSeconds);
      frame = requestAnimationFrame(loop);
    }

    resize();
    // Paint one frame synchronously. requestAnimationFrame does not fire in a
    // background tab, so a canvas that only ever draws from inside the loop is
    // an empty box until the tab is looked at.
    draw(0);
    if (!reduced) frame = requestAnimationFrame(loop);

    const observer = new ResizeObserver(() => {
      resize();
      draw(elapsedSeconds);
    });
    observer.observe(host);

    function handlePointer(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      target = {
        x: (event.clientX / window.innerWidth - 0.5) * LEAN * 2,
        y: (event.clientY / window.innerHeight - 0.5) * -LEAN,
      };
    }
    if (!reduced) window.addEventListener("pointermove", handlePointer, { passive: true });

    // rAF stops in a background tab. Rebase the clock on return so the search
    // resumes rather than jumping several cycles ahead.
    function handleVisibility() {
      if (!document.hidden) start = performance.now() - elapsedSeconds * 1000;
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", handlePointer);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={hostRef} className={styles.host} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
