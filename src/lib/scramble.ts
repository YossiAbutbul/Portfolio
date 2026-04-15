const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export interface ScrambleHandle {
  stop(): void;
}

export function scrambleText(
  el: HTMLElement,
  target: string,
  { duration = 280, reveal = 0.6 }: { duration?: number; reveal?: number } = {},
): ScrambleHandle {
  const start = performance.now();
  let raf = 0;
  const chars = target.split("");

  function frame(now: number) {
    const t = Math.min(1, (now - start) / duration);
    const revealedUpTo = Math.floor(chars.length * (t / reveal));
    const out = chars
      .map((c, i) => {
        if (i < revealedUpTo || c === " ") return c;
        return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      })
      .join("");
    el.textContent = out;
    if (t < 1) raf = requestAnimationFrame(frame);
    else el.textContent = target;
  }

  raf = requestAnimationFrame(frame);
  return {
    stop() {
      cancelAnimationFrame(raf);
      el.textContent = target;
    },
  };
}
