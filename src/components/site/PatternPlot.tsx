"use client";

import { useEffect, useRef } from "react";
import styles from "./PatternPlot.module.css";

/**
 * Plotted radiation pattern.
 *
 * A real 3D surface - the far field of a circular aperture, main lobe and
 * sidelobe rings and all - drawn the way a pen plotter would draw it:
 * hidden-line removed, one ink weight, no shading and no light source. Paper
 * does not glow, so nothing here does either.
 *
 * Hidden-line removal is the painter's algorithm doing double duty. Faces are
 * sorted back to front; each one is filled with the paper colour and then
 * stroked, so a near face paints over the lines of everything behind it. No
 * depth buffer, no WebGL, and the output is line art rather than a render.
 *
 * On load the pen sweeps once around the azimuth, which is why the reveal runs
 * on the meridian index rather than on opacity.
 */

/** Aperture size in ka. Larger means a tighter lobe and more sidelobe rings. */
const APERTURE = 4.4;
/** Surface resolution. Kept modest: every face is a fill plus a stroke. */
const RINGS = 30;
const MERIDIANS = 44;
/** Only every other line is inked; the rest still occludes. */
const INK_STRIDE = 2;
const MAX_DPR = 2;
/** One turn, in seconds. Slow enough to read as drift rather than animation. */
const TURN_SECONDS = 46;
const SWEEP_SECONDS = 2.6;
/** How far the pointer may lean the object, in radians. */
const LEAN = 0.22;

type Point = { x: number; y: number; z: number };

/**
 * Bessel function of the first kind, order one. Abramowitz & Stegun 9.4.4 and
 * 9.4.6 - a polynomial below 3 and the asymptotic form above it, good to about
 * 1e-7, which is far past what a one-pixel line can show.
 */
function besselJ1(x: number): number {
  const ax = Math.abs(x);

  if (ax < 3) {
    const y = (x / 3) * (x / 3);
    return (
      x *
      (0.5 +
        y *
          (-0.56249985 +
            y * (0.21093573 + y * (-0.03954289 + y * (0.00443319 + y * (-0.00031761 + y * 0.00001109))))))
    );
  }

  const t = 3 / ax;
  const amplitude =
    0.79788456 +
    t * (0.00000156 + t * (0.01659667 + t * (0.00017105 + t * (-0.00249511 + t * (0.00113653 + t * -0.00020033)))));
  const phase =
    ax -
    2.35619449 +
    t * (0.12499612 + t * (0.0000565 + t * (-0.00637879 + t * (0.00074348 + t * (0.00079824 + t * -0.00029166)))));
  const value = (amplitude / Math.sqrt(ax)) * Math.cos(phase);
  return x < 0 ? -value : value;
}

/**
 * Far field of a uniformly illuminated circular aperture: the Airy pattern,
 * 2*J1(u)/u. This is the shape a dish or a patch actually radiates - one main
 * lobe on boresight with concentric sidelobe rings around it. The rings are
 * not decoration; they fall where the zeros of J1 put them.
 */
function aperture(theta: number): number {
  const u = APERTURE * Math.sin(theta);
  // The limit at u -> 0 is 1; guard the removable singularity.
  if (Math.abs(u) < 1e-6) return 1;
  const airy = Math.abs((2 * besselJ1(u)) / u);
  // Aperture antennas radiate forward. Taper the back hemisphere rather than
  // mirroring the lobe, which leaves the small back lobe a real one has.
  const front = 0.2 + 0.8 * ((1 + Math.cos(theta)) / 2) ** 0.85;
  return airy * front;
}

/** Radius at a given polar and azimuthal angle. */
function radius(theta: number, phi: number): number {
  // Enough azimuthal dependence that the silhouette changes as it turns, not
  // so much that it stops reading as a pattern.
  const azimuth = 0.9 + 0.1 * Math.cos(2 * phi);
  return (0.13 + 0.87 * aperture(theta)) * azimuth;
}

/** Surface vertices, indexed [ring][meridian]. Built once. */
function buildSurface(): Point[][] {
  const grid: Point[][] = [];
  for (let i = 0; i <= RINGS; i += 1) {
    const theta = (i / RINGS) * Math.PI;
    const row: Point[] = [];
    for (let j = 0; j <= MERIDIANS; j += 1) {
      const phi = (j / MERIDIANS) * Math.PI * 2;
      const r = radius(theta, phi);
      row.push({
        x: r * Math.sin(theta) * Math.cos(phi),
        y: r * Math.cos(theta),
        z: r * Math.sin(theta) * Math.sin(phi),
      });
    }
    grid.push(row);
  }
  return grid;
}

export default function PatternPlot() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const surface = buildSurface();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let ink = "#15181B";
    let paper = "#ECEBE5";
    let faint = "#93968F";

    let frame = 0;
    /** Wall clock from first paint. Drives the one-time pen sweep. */
    let born = 0;
    /** Visible-time clock. Drives rotation, so leaving and returning does not
     *  teleport the object a quarter turn. */
    let start = 0;
    let elapsedSeconds = 0;
    let lean = { x: 0, y: 0 };
    let target = { x: 0, y: 0 };

    function readPalette() {
      const style = getComputedStyle(host!);
      ink = style.getPropertyValue("--ink").trim() || ink;
      paper = style.getPropertyValue("--paper").trim() || paper;
      faint = style.getPropertyValue("--ink-faint").trim() || faint;
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

    function draw(elapsed: number, age: number) {
      if (width < 2 || height < 2) return;

      const yaw = reduced ? 0.9 : (elapsed / TURN_SECONDS) * Math.PI * 2 + 0.9;
      const pitch = -0.42 + lean.y;
      const spin = yaw + lean.x;
      // The sweep is a one-time event measured against wall time: someone
      // returning to the tab should find a finished drawing, not watch the pen
      // start over.
      const sweep = reduced ? 1 : Math.min(1, age / SWEEP_SECONDS);
      const drawn = Math.round(sweep * MERIDIANS);

      const scale = Math.min(width, height) * 0.46;
      const originX = width / 2;
      const originY = height / 2;

      const cosSpin = Math.cos(spin);
      const sinSpin = Math.sin(spin);
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);

      /** Rotate, then project with a gentle perspective divide. */
      function project(point: Point) {
        const x = point.x * cosSpin - point.z * sinSpin;
        const z = point.x * sinSpin + point.z * cosSpin;
        const y = point.y * cosPitch - z * sinPitch;
        const depth = point.y * sinPitch + z * cosPitch;
        const k = 2.6 / (2.6 + depth);
        return { sx: originX + x * scale * k, sy: originY - y * scale * k, depth };
      }

      context!.clearRect(0, 0, width, height);

      // Collect faces with their depth. Sorting by centroid is enough for a
      // convex-ish lobe surface and costs nothing next to the stroking.
      type Face = {
        points: { sx: number; sy: number }[];
        depth: number;
        inked: boolean;
      };
      const faces: Face[] = [];

      for (let i = 0; i < RINGS; i += 1) {
        for (let j = 0; j < drawn; j += 1) {
          const a = project(surface[i][j]);
          const b = project(surface[i][j + 1]);
          const c = project(surface[i + 1][j + 1]);
          const d = project(surface[i + 1][j]);
          faces.push({
            points: [a, b, c, d],
            depth: (a.depth + b.depth + c.depth + d.depth) / 4,
            inked: i % INK_STRIDE === 0 || j % INK_STRIDE === 0,
          });
        }
      }

      faces.sort((one, two) => two.depth - one.depth);

      context!.lineJoin = "round";
      context!.lineWidth = 1;
      context!.fillStyle = paper;
      context!.strokeStyle = ink;

      for (const face of faces) {
        context!.beginPath();
        context!.moveTo(face.points[0].sx, face.points[0].sy);
        for (let k = 1; k < face.points.length; k += 1) {
          context!.lineTo(face.points[k].sx, face.points[k].sy);
        }
        context!.closePath();
        // The fill is the hidden-line removal; only some faces are inked.
        context!.fill();
        if (face.inked) context!.stroke();
      }

      // Boresight axis, plotted through the main lobe.
      const axisTop = project({ x: 0, y: 1.12, z: 0 });
      const axisBottom = project({ x: 0, y: -0.55, z: 0 });
      context!.save();
      context!.setLineDash([2, 4]);
      context!.strokeStyle = faint;
      context!.beginPath();
      context!.moveTo(axisTop.sx, axisTop.sy);
      context!.lineTo(axisBottom.sx, axisBottom.sy);
      context!.stroke();
      context!.restore();
    }

    function loop(now: number) {
      if (!start) start = now;
      if (!born) born = now;
      elapsedSeconds = (now - start) / 1000;
      // Ease the lean rather than snapping to the pointer.
      lean.x += (target.x - lean.x) * 0.06;
      lean.y += (target.y - lean.y) * 0.06;
      draw(elapsedSeconds, (now - born) / 1000);
      frame = requestAnimationFrame(loop);
    }

    resize();

    if (reduced) {
      draw(0, 1);
    } else {
      frame = requestAnimationFrame(loop);
    }

    const observer = new ResizeObserver(() => {
      resize();
      if (reduced) draw(0, 1);
    });
    observer.observe(host);

    // The pointer leans the object a little. It does not deform it: a
    // measurement that wobbles when you look at it is not a measurement.
    function handlePointer(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      target = {
        x: (event.clientX / window.innerWidth - 0.5) * LEAN * 2,
        y: (event.clientY / window.innerHeight - 0.5) * -LEAN,
      };
    }
    if (!reduced) window.addEventListener("pointermove", handlePointer, { passive: true });

    // rAF is paused in a background tab, so the clock would otherwise jump by
    // however long the tab was away. Rebase it against the elapsed time we had
    // reached - resuming, not replaying: the opening pen sweep happens once.
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
