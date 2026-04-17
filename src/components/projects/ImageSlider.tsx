"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ProjectImage } from "@/types/project";
import { withBasePath } from "@/lib/env";
import styles from "./ImageSlider.module.css";

interface Props {
  images: ProjectImage[];
  autoPlay?: boolean;
  filter?: boolean;
  slug?: string;
  interval?: number;
  drag?: boolean;
  paddingRatio?: number;
}

const DEFAULT_INTERVAL = 2200;
const DRAG_THRESHOLD = 50;

const DEFAULT_PADDING = 0.04;
function calcRatio(w: number, h: number, padding: number) {
  return `${w} / ${Math.round(h + 2 * padding * w)}`;
}

export default function ImageSlider({
  images,
  autoPlay = false,
  filter = false,
  slug,
  interval = DEFAULT_INTERVAL,
  drag = false,
  paddingRatio = DEFAULT_PADDING,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [hovered, setHovered] = useState(false);
  const [revealed, setRevealed] = useState(!filter);
  const router = useRouter();

  const total = images.length;
  const canLoop = total > 1;

  // [clone-last, img0 … imgN-1, clone-first]
  const extImages: ProjectImage[] = canLoop
    ? [images[total - 1], ...images, images[0]]
    : images;

  const [trackIdx, setTrackIdx] = useState(canLoop ? 1 : 0);
  // Keep a ref mirror so drag callbacks always see the current index without stale closure
  const trackIdxRef = useRef(trackIdx);

  const [animated, setAnimated] = useState(true);

  const dotIdx = canLoop ? ((trackIdx - 1) % total + total) % total : trackIdx;

  // Drag refs — no React state, DOM mutations only → zero re-renders during drag
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const direction = useRef<"h" | "v" | null>(null);

  // Aspect ratio
  const firstImg = images[0];
  const [aspectRatio, setAspectRatio] = useState(
    calcRatio(firstImg.width, firstImg.height, paddingRatio),
  );

  const applyNaturalRatio = useCallback((el: HTMLImageElement) => {
    if (el.naturalWidth && el.naturalHeight) {
      setAspectRatio(calcRatio(el.naturalWidth, el.naturalHeight, paddingRatio));
    }
  }, [paddingRatio]);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    if (el.complete) applyNaturalRatio(el);
  }, [applyNaturalRatio]);

  // Re-enable CSS transition after an instant jump (animated=false)
  useEffect(() => {
    if (!animated) {
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setAnimated(true))
      );
      return () => cancelAnimationFrame(raf);
    }
  }, [animated]);

  // Helper: commit a new track index (keeps ref in sync)
  const commitTrack = useCallback((fn: (i: number) => number, anim = true) => {
    setAnimated(anim);
    setTrackIdx((prev) => {
      const next = fn(prev);
      trackIdxRef.current = next;
      return next;
    });
  }, []);

  // When the CSS transition ends on a clone, jump to the real counterpart.
  // Guard: only the track's own transform transition — ignore bubbled child events.
  const handleTransitionEnd = useCallback((e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== trackRef.current) return;
    if (e.propertyName !== "transform") return;
    if (!canLoop) return;
    const i = trackIdxRef.current;
    if (i === 0) {
      commitTrack(() => total, false);
    } else if (i === total + 1) {
      commitTrack(() => 1, false);
    }
  }, [canLoop, total, commitTrack]);

  // Scroll reveal (card view only)
  useEffect(() => {
    if (!filter) return;
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].intersectionRatio > 0.1) { setRevealed(true); io.disconnect(); }
      },
      { threshold: [0, 0.1, 0.5, 1] },
    );
    io.observe(el);
    const t = window.setTimeout(() => {
      if (!wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) setRevealed(true);
    }, 200);
    return () => { io.disconnect(); window.clearTimeout(t); };
  }, [filter]);

  // Auto-play
  const playing = autoPlay || (hovered && canLoop);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!canLoop) return;
    timerRef.current = setInterval(() => {
      setAnimated(true);
      commitTrack((i) => i + 1);
    }, interval);
  }, [canLoop, interval, commitTrack]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    if (playing) startTimer();
    else if (!autoPlay) stopTimer();
    return stopTimer;
  }, [playing, autoPlay, startTimer, stopTimer]);

  const goPrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!canLoop) return;
    commitTrack((i) => i - 1);
    if (autoPlay) startTimer();
  }, [canLoop, autoPlay, commitTrack, startTimer]);

  const goNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!canLoop) return;
    commitTrack((i) => i + 1);
    if (autoPlay) startTimer();
  }, [canLoop, autoPlay, commitTrack, startTimer]);

  const handleClick = useCallback(() => {
    if (slug) router.push(`/projects/${slug}/`);
  }, [slug, router]);

  // ── Drag: all DOM-direct, no setState → no React re-renders ──
  const setTrackStyle = useCallback((offset: number, transition: boolean) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = transition ? "" : "none";
    el.style.transform = offset !== 0
      ? `translateX(calc(-${trackIdxRef.current * 100}% + ${offset}px))`
      : `translateX(-${trackIdxRef.current * 100}%)`;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!drag || !canLoop) return;
    isDragging.current = true;
    startX.current = e.clientX;
    startY.current = e.clientY;
    direction.current = null;
    if (e.pointerType === "mouse") {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [drag, canLoop]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (direction.current === null && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      direction.current = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
    }

    if (direction.current === "v") {
      isDragging.current = false;
      return;
    }

    if (direction.current === "h") {
      e.preventDefault(); // prevent page scroll while dragging horizontally
      setTrackStyle(dx, false);
    }
  }, [setTrackStyle]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const delta = e.clientX - startX.current;

    // Clear inline override — let React-controlled style take over
    if (trackRef.current) {
      trackRef.current.style.transition = "";
      trackRef.current.style.transform = "";
    }

    if (direction.current === "h" && Math.abs(delta) >= DRAG_THRESHOLD) {
      commitTrack((i) => delta < 0 ? i + 1 : i - 1);
      if (autoPlay) startTimer();
    }
    direction.current = null;
  }, [commitTrack, autoPlay, startTimer]);

  const cls = [
    styles.wrap,
    filter ? styles.filtered : "",
    filter && hovered ? styles.hovered : "",
    revealed ? styles.revealed : "",
    slug ? styles.clickable : "",
    drag && canLoop ? styles.draggable : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      ref={wrapRef}
      className={cls}
      style={{ aspectRatio }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        ref={trackRef}
        className={styles.track}
        style={{
          transform: `translateX(-${trackIdx * 100}%)`,
          transition: animated ? undefined : "none",
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {extImages.map((img, i) => (
          <div key={i} className={styles.slide}>
            <img
              ref={i === (canLoop ? 1 : 0) ? imgRef : undefined}
              src={withBasePath(img.src)}
              alt={img.alt}
              className={styles.img}
              draggable={false}
              onLoad={i === (canLoop ? 1 : 0) ? (e) => applyNaturalRatio(e.currentTarget) : undefined}
            />
          </div>
        ))}
      </div>

      {filter && <div className={styles.grain} aria-hidden="true" />}
      {filter && (
        <div className={`${styles.wipe} ${revealed ? styles.wipeGone : ""}`} aria-hidden="true" />
      )}

      {canLoop && (
        <>
          <button className={`${styles.arrow} ${styles.arrowPrev}`} onClick={goPrev} aria-label="Previous image" type="button">‹</button>
          <button className={`${styles.arrow} ${styles.arrowNext}`} onClick={goNext} aria-label="Next image" type="button">›</button>
        </>
      )}

      {canLoop && (
        <div className={styles.dots} aria-hidden="true">
          {images.map((_, i) => (
            <span key={i} className={`${styles.dot} ${i === dotIdx ? styles.dotActive : ""}`} />
          ))}
        </div>
      )}
    </div>
  );
}
