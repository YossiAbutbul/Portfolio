"use client";

import { useEffect, useRef, useState } from "react";
import type { LaunchScene } from "./scene";
import styles from "./LaunchStage.module.css";

type Backdrop = "desk" | "void";

/**
 * The fixed layers behind the page: a backdrop glow that matches the scene's veil, a poster of the
 * desk, then the WebGL canvas. The poster (rendered from the scene by scripts/bake-poster.mjs) is in
 * the HTML, so the desk is there from the first paint; the three.js module is fetched only once the
 * browser is idle after that paint, and the canvas fades in over the poster when its first frame is
 * ready. Without WebGL the poster simply stays.
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
        onProgress: (value) => window.dispatchEvent(new CustomEvent("launch:progress", { detail: value })),
      }, abort.signal);
      // No WebGL (or it failed): let the loading sheet go now rather than at its time limit.
      if (!scene) { window.dispatchEvent(new CustomEvent("launch:progress", { detail: 1 })); return; }
      if (abort.signal.aborted) { scene.dispose(); scene = null; return; }
      setReady(true);
    };
    // After the first paint, once the browser is idle (the hero's text and the poster are already up):
    // soon on desktop, within about a second on phones; a scroll or touch before then hurries it.
    const phone = window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;
    // Safari has no requestIdleCallback: a short timeout stands in for it.
    const hasIdle = "requestIdleCallback" in window;
    const idle = hasIdle ? window.requestIdleCallback(() => void load(), { timeout: phone ? 1200 : 300 })
      : window.setTimeout(() => void load(), phone ? 400 : 50);
    const cancelIdle = () => { if (hasIdle) window.cancelIdleCallback(idle); else clearTimeout(idle); };
    const hurry = () => { cancelIdle(); void load(); };
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
      cancelIdle();
      window.removeEventListener("scroll", start);
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("launch:press-device", press);
      scene?.dispose();
    };
  }, []);

  return (
    <>
      <div className={styles.backdrop} data-backdrop={backdrop} aria-hidden="true">
        {/* Slow drifting glows and a grain, so the dark room breathes instead of sitting flat. */}
        <i className={styles.glow} /><i className={styles.glow} /><i className={styles.glow} /><i className={styles.grain} />
      </div>
      {/* The giant word slides between the backdrop and the device; the scene moves it. */}
      <div className={styles.word} id="launch-word" aria-hidden="true">it ships.</div>
      {/* The desk as the scene first shows it, until the scene's own first frame is up. */}
      <div className={styles.poster} data-off={ready} aria-hidden="true" />
      <canvas ref={canvas} className={styles.canvas} data-ready={ready} data-grade={backdrop === "desk"} aria-hidden="true" />
      {/* Steam off the mug: the scene pins it to the rim; CSS does the drifting. */}
      <div className={styles.steam} id="launch-steam" aria-hidden="true"><i /><i /><i /></div>
      {/* Pointer hint over the desk: the scene sets its text and follows the mouse. */}
      <div className={styles.hint} id="launch-hint" data-on="false" aria-hidden="true" />
      {/* Lens: vignette, grain and soft focus at the edges, only over the desk. */}
      <div className={styles.lens} data-on={backdrop === "desk"} aria-hidden="true" />
    </>
  );
}
