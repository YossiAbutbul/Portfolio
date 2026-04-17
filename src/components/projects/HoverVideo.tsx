"use client";

import { useEffect, useRef } from "react";
import { withBasePath } from "@/lib/env";
import styles from "./HoverVideo.module.css";

interface Props {
  src: string;
  active: boolean;
  onAspect?: (aspect: number) => void;
}

export default function HoverVideo({ src, active, onAspect }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) {
      v.play().catch(() => {
        /* autoplay can fail before any user gesture — ignore */
      });
    } else {
      v.pause();
      // Seek to a hair past 0 so the first frame renders as the idle "poster".
      v.currentTime = 0.001;
    }
  }, [active]);

  return (
    <video
      ref={ref}
      className={styles.video}
      src={withBasePath(src)}
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      onLoadedMetadata={(e) => {
        const v = e.currentTarget;
        if (v.videoWidth && v.videoHeight) {
          onAspect?.(v.videoWidth / v.videoHeight);
        }
        // Force first-frame decode while paused so the card shows a still.
        if (v.paused && v.currentTime === 0) {
          v.currentTime = 0.001;
        }
      }}
    />
  );
}
