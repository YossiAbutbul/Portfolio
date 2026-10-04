"use client";

import { useEffect, useRef } from "react";
import styles from "./Scrollbar.module.css";

/** The page's scrollbar, drawn over the content so it never takes width from the layout (the
 *  native one is hidden in globals.css). Always shown, brighter while the page moves or the pointer
 *  is on it. The bar drags and the track jumps. Not shown on touch screens. Decorative
 *  to assistive tech: keyboard and wheel scrolling are the browser's own. */
export default function Scrollbar() {
  const track = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = track.current, th = thumb.current;
    // Touch screens show no bar (see the CSS), so nothing to measure or follow.
    if (!t || !th || window.matchMedia("(pointer: coarse)").matches) return;
    const root = document.documentElement;
    let frame = 0, idle: ReturnType<typeof setTimeout> | undefined, size = 0, travel = 0, max = 0;
    // The stretch: the bar lengthens a little toward where it is going when the page moves fast, and
    // eases back once it slows. Off under reduced motion.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stretch = 1, lastY = window.scrollY, lastT = performance.now();

    // Sizes are read on resize and content changes only; scroll moves the thumb by transform.
    const measure = () => {
      const view = window.innerHeight;
      max = Math.max(0, root.scrollHeight - view);
      size = max > 0 ? Math.max(40, (view * view) / root.scrollHeight) : 0;
      travel = view - size - 8;
      th.style.height = `${size}px`;
      t.toggleAttribute("data-off", max === 0);
      place();
    };
    const place = () => {
      frame = 0;
      const now = performance.now(), sy = window.scrollY;
      const p = max > 0 ? Math.min(1, Math.max(0, sy / max)) : 0, y = p * travel + 4;
      if (!still) {
        const v = (sy - lastY) / Math.max(1, now - lastT);
        const target = 1 + Math.min(0.3, Math.abs(v) * 0.08);
        stretch += (target - stretch) * 0.25;
        if (v !== 0) th.style.transformOrigin = v > 0 ? "50% 0" : "50% 100%";
        if (Math.abs(stretch - 1) < 0.002 && v === 0) stretch = 1;
        else frame = requestAnimationFrame(place);
      }
      lastY = sy; lastT = now;
      th.style.transform = `translate3d(0, ${y}px, 0) scaleY(${stretch})`;
    };
    const wake = () => {
      t.setAttribute("data-active", "");
      clearTimeout(idle);
      idle = setTimeout(() => t.removeAttribute("data-active"), 1200);
    };
    const onScroll = () => {
      wake();
      if (!frame) frame = requestAnimationFrame(place);
    };

    const scrollTo = (y: number, immediate: boolean) => {
      const top = Math.max(0, Math.min(max, y));
      if (window.__lenis) window.__lenis.scrollTo(top, { immediate, force: true });
      else window.scrollTo({ top, behavior: immediate ? "instant" : "smooth" });
    };

    // Drag the thumb: the page follows the pointer one to one along the track.
    let dragFrom = -1, dragTop = 0;
    const onThumbDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      dragFrom = e.clientY; dragTop = window.scrollY;
      th.setPointerCapture(e.pointerId);
      t.setAttribute("data-dragging", "");
    };
    const onThumbMove = (e: PointerEvent) => {
      if (dragFrom < 0 || travel <= 0) return;
      scrollTo(dragTop + ((e.clientY - dragFrom) / travel) * max, true);
    };
    const onThumbUp = (e: PointerEvent) => {
      if (dragFrom < 0) return;
      dragFrom = -1;
      th.releasePointerCapture(e.pointerId);
      t.removeAttribute("data-dragging");
      wake();
    };
    // A press on the track centres the thumb there.
    const onTrackDown = (e: PointerEvent) => {
      if (e.button !== 0 || e.target === th || travel <= 0) return;
      scrollTo(((e.clientY - 4 - size / 2) / travel) * max, false);
    };

    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(document.body);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    th.addEventListener("pointerdown", onThumbDown);
    th.addEventListener("pointermove", onThumbMove);
    th.addEventListener("pointerup", onThumbUp);
    th.addEventListener("pointercancel", onThumbUp);
    t.addEventListener("pointerdown", onTrackDown);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(idle);
      resize.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", onScroll);
      th.removeEventListener("pointerdown", onThumbDown);
      th.removeEventListener("pointermove", onThumbMove);
      th.removeEventListener("pointerup", onThumbUp);
      th.removeEventListener("pointercancel", onThumbUp);
      t.removeEventListener("pointerdown", onTrackDown);
    };
  }, []);

  return (
    <div ref={track} className={styles.track} aria-hidden="true" data-off="">
      <div ref={thumb} className={styles.thumb} />
    </div>
  );
}
