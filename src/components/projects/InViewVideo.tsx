"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  poster?: string;
  className?: string;
  ariaLabel?: string;
}

export default function InViewVideo({ src, poster, className, ariaLabel }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting);
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (inView) {
      v.play().catch(() => {/* autoplay blocked is fine */});
    } else {
      v.pause();
      try { v.currentTime = 0.01; } catch {}
    }
  }, [inView]);

  function handleLoadedMetadata() {
    const v = ref.current;
    if (!v) return;
    if (!inView) {
      try { v.currentTime = 0.01; } catch {}
    }
  }

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="auto"
      aria-label={ariaLabel}
      onLoadedMetadata={handleLoadedMetadata}
    />
  );
}
