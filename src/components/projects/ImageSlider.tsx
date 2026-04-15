"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ProjectImage } from "@/types/project";
import { withBasePath } from "@/lib/env";
import styles from "./ImageSlider.module.css";

interface Props {
  images: ProjectImage[];
  /** Always auto-play regardless of hover (detail page). Default: hover-only. */
  autoPlay?: boolean;
  /** Apply dark/grayscale theme filter, removed on hover (cards). */
  filter?: boolean;
  /** If set, clicking the image navigates to this project slug. */
  slug?: string;
  /** ms between slides. Default 2200. */
  interval?: number;
}

const DEFAULT_INTERVAL = 2200;

// padding-block percentages are relative to *inline size* (width).
// For object-fit:contain to fill the full width with no side gaps,
// the content area (height minus padding) must match the image's native ratio.
// Solving for wrapper_h:  img_w/(wrapper_h − 2p·wrapper_w) = img_w/img_h
//   →  wrapper_h = img_h + 2·p·img_w
const PADDING = 0.04;
function calcRatio(w: number, h: number) {
  return `${w} / ${Math.round(h + 2 * PADDING * w)}`;
}

export default function ImageSlider({
  images,
  autoPlay = false,
  filter = false,
  slug,
  interval = DEFAULT_INTERVAL,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [idx, setIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [revealed, setRevealed] = useState(!filter); // detail page: always revealed
  const router = useRouter();

  const total = images.length;
  const firstImg = images[0];

  // Use the known data dimensions immediately — no flash, no waiting for onLoad
  const [aspectRatio, setAspectRatio] = useState(
    calcRatio(firstImg.width, firstImg.height),
  );

  // Fallback: if data dimensions are stale/wrong, correct from natural size.
  // Also handles the case where the image was already cached and onLoad won't fire.
  const applyNaturalRatio = useCallback((el: HTMLImageElement) => {
    if (el.naturalWidth && el.naturalHeight) {
      setAspectRatio(calcRatio(el.naturalWidth, el.naturalHeight));
    }
  }, []);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    if (el.complete) {
      applyNaturalRatio(el); // already cached — onLoad won't fire
    }
  }, [applyNaturalRatio]);

  // Scroll reveal — only needed when filter is on (card view)
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

  // Auto-play: always (detail) or on hover (card)
  const playing = autoPlay || (hovered && total > 1);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (total < 2) return;
    timerRef.current = setInterval(
      () => setIdx((i) => (i + 1) % total),
      interval,
    );
  }, [total, interval]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    if (playing) startTimer();
    else if (!autoPlay) stopTimer();
    return stopTimer;
  }, [playing, autoPlay, startTimer, stopTimer]);

  const prev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIdx((i) => (i - 1 + total) % total);
    if (autoPlay) startTimer();
  }, [total, autoPlay, startTimer]);

  const next = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIdx((i) => (i + 1) % total);
    if (autoPlay) startTimer();
  }, [total, autoPlay, startTimer]);

  const handleClick = useCallback(() => {
    if (slug) router.push(`/projects/${slug}/`);
  }, [slug, router]);

  const cls = [
    styles.wrap,
    filter ? styles.filtered : "",
    filter && hovered ? styles.hovered : "",
    revealed ? styles.revealed : "",
    slug ? styles.clickable : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      ref={wrapRef}
      className={cls}
      style={{ aspectRatio }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
    >
      {/* Sliding track */}
      <div
        className={styles.track}
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {images.map((img, i) => (
          <div key={i} className={styles.slide}>
            <img
              ref={i === 0 ? imgRef : undefined}
              src={withBasePath(img.src)}
              alt={img.alt}
              className={styles.img}
              draggable={false}
              onLoad={i === 0 ? (e) => applyNaturalRatio(e.currentTarget) : undefined}
            />
          </div>
        ))}
      </div>

      {/* Grain (cards only) */}
      {filter && <div className={styles.grain} aria-hidden="true" />}

      {/* Scroll-reveal wipe (cards only) */}
      {filter && (
        <div className={`${styles.wipe} ${revealed ? styles.wipeGone : ""}`} aria-hidden="true" />
      )}

      {/* Arrows */}
      {total > 1 && (
        <>
          <button
            className={`${styles.arrow} ${styles.arrowPrev}`}
            onClick={prev}
            aria-label="Previous image"
            type="button"
          >
            ‹
          </button>
          <button
            className={`${styles.arrow} ${styles.arrowNext}`}
            onClick={next}
            aria-label="Next image"
            type="button"
          >
            ›
          </button>
        </>
      )}

      {/* Dot indicators */}
      {total > 1 && (
        <div className={styles.dots} aria-hidden="true">
          {images.map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${i === idx ? styles.dotActive : ""}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
