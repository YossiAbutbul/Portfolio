"use client";

import { useEffect, useRef } from "react";
import styles from "./ProjectSignature.module.css";

/**
 * A plotted signature per project.
 *
 * Instead of a screenshot, every row draws the shape of its own subject:
 * load-pull contours, a decaying burst train, a pipeline lattice, a graph with
 * its search tree. They are small diagrams, drawn in one ink weight at hairline
 * width, and they carry information - the burst train really does decay, the
 * pipeline really does stall on the third instruction.
 *
 * At rest each one is fully drawn and quiet. Hovering the row re-draws it once,
 * left to right, and darkens the ink.
 */

export type SignatureKind =
  | "contours"
  | "semester"
  | "pipeline"
  | "bursts"
  | "graph"
  | "flat";

const MAX_DPR = 2;
const DRAW_SECONDS = 0.7;

type Ink = { line: string; strong: string; paper: string };

/** Deterministic noise so a signature looks the same on every render. */
function wobble(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value) - 0.5;
}

type Scene = {
  width: number;
  height: number;
  progress: number;
  ink: Ink;
};

/** Load-pull: nested constant-power contours closing on an optimum. */
function drawContours(context: CanvasRenderingContext2D, scene: Scene) {
  const { width, height, progress, ink } = scene;
  const cx = width * 0.5;
  const cy = height * 0.5;
  const rings = 5;
  const shown = Math.ceil(progress * rings);

  for (let ring = 0; ring < shown; ring += 1) {
    const scale = 0.16 + ring * 0.17;
    // Each contour leans a little further off centre, the way real load-pull
    // contours do as they open out from the optimum.
    const offsetX = ring * width * 0.022;
    const offsetY = ring * -height * 0.014;

    context.beginPath();
    for (let step = 0; step <= 48; step += 1) {
      const t = (step / 48) * Math.PI * 2;
      const r = 1 + 0.22 * Math.cos(3 * t + ring * 0.7) + 0.08 * Math.cos(5 * t);
      const x = cx + offsetX + Math.cos(t) * r * width * scale;
      const y = cy + offsetY + Math.sin(t) * r * height * scale * 0.92;
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.strokeStyle = ring === 0 ? ink.strong : ink.line;
    context.stroke();
  }

  if (progress > 0.6) {
    // The optimum, marked the way it is on a plot: a cross, not a dot.
    context.strokeStyle = ink.strong;
    context.beginPath();
    context.moveTo(cx - 3, cy);
    context.lineTo(cx + 3, cy);
    context.moveTo(cx, cy - 3);
    context.lineTo(cx, cy + 3);
    context.stroke();
  }
}

/** A semester: fourteen weeks of load, read off a baseline. */
function drawSemester(context: CanvasRenderingContext2D, scene: Scene) {
  const { width, height, progress, ink } = scene;
  const weeks = 14;
  const load = [0.2, 0.28, 0.35, 0.3, 0.52, 0.44, 0.66, 0.5, 0.62, 0.78, 0.7, 0.88, 0.95, 0.6];
  const base = height * 0.84;
  const shown = Math.ceil(progress * weeks);

  context.strokeStyle = ink.line;
  context.beginPath();
  context.moveTo(0, base + 0.5);
  context.lineTo(width, base + 0.5);
  context.stroke();

  context.strokeStyle = ink.strong;
  for (let week = 0; week < shown; week += 1) {
    const x = Math.round(((week + 0.5) / weeks) * width) + 0.5;
    const top = base - load[week] * height * 0.66;
    context.beginPath();
    context.moveTo(x, base);
    context.lineTo(x, top);
    context.stroke();
  }

  // Exam week, called out with a caret.
  if (progress > 0.85) {
    const x = Math.round(((12 + 0.5) / weeks) * width) + 0.5;
    context.beginPath();
    context.moveTo(x - 3, height * 0.14);
    context.lineTo(x, height * 0.06);
    context.lineTo(x + 3, height * 0.14);
    context.stroke();
  }
}

/** Five stages, four instructions, and one stall bubble. */
function drawPipeline(context: CanvasRenderingContext2D, scene: Scene) {
  const { width, height, progress, ink } = scene;
  const stages = 5;
  const rows = 4;
  const cell = width / (stages + rows - 1);
  const rowHeight = height / rows;
  const shown = progress * rows * stages;

  let drawn = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let stage = 0; stage < stages; stage += 1) {
      drawn += 1;
      if (drawn > shown) break;

      // Instruction three stalls a cycle, so everything after it shifts right.
      const bubble = row >= 2 ? 1 : 0;
      const x = (row + stage + bubble) * cell;
      const y = row * rowHeight;

      context.strokeStyle = stage === 0 ? ink.strong : ink.line;
      context.strokeRect(
        Math.round(x) + 0.5,
        Math.round(y + rowHeight * 0.18) + 0.5,
        Math.max(2, cell - 2),
        Math.max(2, rowHeight * 0.62),
      );
    }
  }

  // The bubble itself: an empty slot, crossed through.
  if (progress > 0.55) {
    const x = 2 * cell;
    const y = 2 * rowHeight;
    context.strokeStyle = ink.strong;
    context.beginPath();
    context.moveTo(x + 1, y + rowHeight * 0.2);
    context.lineTo(x + cell - 3, y + rowHeight * 0.78);
    context.moveTo(x + cell - 3, y + rowHeight * 0.2);
    context.lineTo(x + 1, y + rowHeight * 0.78);
    context.stroke();
  }
}

/** Transmit bursts, peak sagging until it crosses the stop threshold. */
function drawBursts(context: CanvasRenderingContext2D, scene: Scene) {
  const { width, height, progress, ink } = scene;
  const count = 44;
  const base = height * 0.86;
  const top = height * 0.12;
  const shown = Math.ceil(progress * count);

  // Stop threshold, 3 dB below the first capture.
  const threshold = base - (base - top) * 0.708;
  context.save();
  context.setLineDash([2, 3]);
  context.strokeStyle = ink.line;
  context.beginPath();
  context.moveTo(0, Math.round(threshold) + 0.5);
  context.lineTo(width, Math.round(threshold) + 0.5);
  context.stroke();
  context.restore();

  context.strokeStyle = ink.strong;
  for (let index = 0; index < shown; index += 1) {
    const u = index / (count - 1);
    const peak = 1 - 0.08 * u - 0.34 * u ** 5 + wobble(index) * 0.03;
    const x = Math.round((index / (count - 1)) * (width - 2)) + 1.5;
    context.beginPath();
    context.moveTo(x, base);
    context.lineTo(x, base - (base - top) * peak);
    context.stroke();
  }
}

/** A graph with its search tree picked out. */
function drawGraph(context: CanvasRenderingContext2D, scene: Scene) {
  const { width, height, progress, ink } = scene;
  const nodes = [
    [0.1, 0.5],
    [0.3, 0.2],
    [0.3, 0.8],
    [0.52, 0.5],
    [0.54, 0.12],
    [0.56, 0.88],
    [0.76, 0.28],
    [0.78, 0.72],
    [0.94, 0.5],
  ].map(([x, y]) => [x * width, y * height] as const);

  // Tree edges are the ones a breadth-first search would keep; the rest are
  // the edges it looked at and discarded.
  const tree: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 4],
    [1, 3],
    [2, 5],
    [3, 6],
    [5, 7],
    [6, 8],
  ];
  const extra: [number, number][] = [
    [4, 6],
    [3, 7],
    [7, 8],
    [2, 3],
  ];

  context.strokeStyle = ink.line;
  for (const [from, to] of extra) {
    context.beginPath();
    context.moveTo(nodes[from][0], nodes[from][1]);
    context.lineTo(nodes[to][0], nodes[to][1]);
    context.stroke();
  }

  const shown = Math.ceil(progress * tree.length);
  context.strokeStyle = ink.strong;
  for (let index = 0; index < shown; index += 1) {
    const [from, to] = tree[index];
    context.beginPath();
    context.moveTo(nodes[from][0], nodes[from][1]);
    context.lineTo(nodes[to][0], nodes[to][1]);
    context.stroke();
  }

  // Nodes are filled with paper so the edges do not run through them; the
  // source is filled solid, the way a visited node is marked on a diagram.
  for (let index = 0; index < nodes.length; index += 1) {
    const [x, y] = nodes[index];
    context.beginPath();
    context.arc(x, y, index === 0 ? 3.2 : 2.4, 0, Math.PI * 2);
    context.fillStyle = index === 0 ? ink.strong : ink.paper;
    context.fill();
    if (index !== 0) {
      context.strokeStyle = ink.strong;
      context.stroke();
    }
  }
}

/** No instrument required. */
function drawFlat(context: CanvasRenderingContext2D, scene: Scene) {
  const { width, height, progress, ink } = scene;
  const y = Math.round(height * 0.5) + 0.5;
  context.strokeStyle = ink.strong;
  context.beginPath();
  context.moveTo(0, y);
  context.lineTo(width * progress, y);
  context.stroke();

  if (progress > 0.5) {
    const x = Math.round(width * 0.5) + 0.5;
    context.strokeStyle = ink.line;
    context.beginPath();
    context.moveTo(x, y - 4);
    context.lineTo(x, y + 4);
    context.stroke();
  }
}

const RENDERERS: Record<SignatureKind, (c: CanvasRenderingContext2D, s: Scene) => void> = {
  contours: drawContours,
  semester: drawSemester,
  pipeline: drawPipeline,
  bursts: drawBursts,
  graph: drawGraph,
  flat: drawFlat,
};

export default function ProjectSignature({
  kind,
  active = false,
}: {
  kind: SignatureKind;
  active?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;

    function palette(): Ink {
      const style = getComputedStyle(canvas!);
      return {
        line: style.getPropertyValue("--sig-line").trim() || "#93968F",
        strong: style.getPropertyValue("--sig-strong").trim() || "#15181B",
        paper: style.getPropertyValue("--paper").trim() || "#ECEBE5",
      };
    }

    function render(progress: number) {
      if (width < 2 || height < 2) return;
      context!.clearRect(0, 0, width, height);
      context!.lineWidth = 1;
      context!.lineJoin = "round";
      RENDERERS[kind](context!, { width, height, progress, ink: palette() });
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.max(1, Math.round(width * dpr));
      canvas!.height = Math.max(1, Math.round(height * dpr));
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    // At rest the signature is complete. The hover animation is a flourish on
    // top of a finished drawing, never the thing that makes it appear.
    render(1);

    const observer = new ResizeObserver(() => {
      resize();
      render(1);
    });
    observer.observe(canvas);

    if (active && !reduced) {
      const start = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / (DRAW_SECONDS * 1000));
        render(progress);
        if (progress < 1) frameRef.current = requestAnimationFrame(step);
      };
      frameRef.current = requestAnimationFrame(step);
    }

    return () => {
      observer.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [kind, active]);

  return <canvas ref={canvasRef} className={styles.signature} aria-hidden="true" />;
}
