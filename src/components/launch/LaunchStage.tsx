"use client";

import { useEffect, useRef, useState } from "react";
import type { LaunchScene } from "./scene";
import styles from "./LaunchStage.module.css";

type Backdrop = "desk" | "void" | "thermal";

/**
 * The fixed layers behind the page: a backdrop glow that matches the scene's veil, then the WebGL
 * canvas. The three.js module is fetched only after the page has painted, so the hero text is the
 * first thing anyone sees and never waits on it.
 */
export default function LaunchStage() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [backdrop, setBackdrop] = useState<Backdrop>("desk");

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let scene: LaunchScene | null = null;
    const abort = new AbortController();

    let loading = false;
    const load = async () => {
      if (loading) return;
      loading = true;
      const { createLaunchScene } = await import("./scene");
      if (abort.signal.aborted) return;
      scene = await createLaunchScene(el, {
        onBackdrop: setBackdrop,
        say: (message) => window.dispatchEvent(new CustomEvent("launch:say", { detail: message })),
        onPress: (count) => window.dispatchEvent(new CustomEvent("launch:press", { detail: count })),
        onHeat: (value) => window.dispatchEvent(new CustomEvent("launch:heat", { detail: value })),
        onProgress: (value) => window.dispatchEvent(new CustomEvent("launch:progress", { detail: value })),
      }, abort.signal);
      if (!scene) return;
      if (abort.signal.aborted) { scene.dispose(); scene = null; return; }
      setReady(true);
    };
    // Desktop loads straight away, behind the loading screen, after the first paint. Phones wait for
    // the first scroll or touch: a phone's first seconds belong to the text, not a 3D scene.
    const phone = window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;
    const idle = phone ? 0 : window.setTimeout(() => void load(), 0);
    const hurry = () => { clearTimeout(idle); void load(); };
    const once = { once: true, passive: true } as const;
    let started = false;
    const start = () => { if (!started) { started = true; hurry(); } };
    window.addEventListener("scroll", start, once);
    window.addEventListener("pointerdown", start, once);
    // Other components press the device's button through an event, so they need no handle on the scene.
    const press = () => scene?.press();
    window.addEventListener("launch:press-device", press);

    return () => {
      abort.abort();
      clearTimeout(idle);
      window.removeEventListener("scroll", start);
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("launch:press-device", press);
      scene?.dispose();
    };
  }, []);

  return (
    <>
      <div className={styles.backdrop} data-backdrop={backdrop} aria-hidden="true" />
      {/* The giant word slides between the backdrop and the device; the scene moves it. */}
      <div className={styles.word} id="launch-word" aria-hidden="true">it ships.</div>
      <canvas ref={canvas} className={styles.canvas} data-ready={ready} aria-hidden="true" />
    </>
  );
}
