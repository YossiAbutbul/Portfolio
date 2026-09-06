"use client";

import { useEffect } from "react";

/**
 * Two jobs.
 *
 * The first is to remember that the entrance has played, so a soft navigation
 * back to the home page in the same tab does not replay it.
 *
 * The second is scroll-linked motion for browsers that cannot do it natively.
 * Everything on the site is written against `animation-timeline`, which runs
 * off the main thread and costs nothing. Where that is not actually working,
 * this drives the same four effects from a single frame loop.
 *
 * There is no motion library behind this. The effects are four transforms;
 * GSAP plus ScrollTrigger is around 70 KB to do that, and under Turbopack the
 * plugin and the core resolved to separate module instances, which meant the
 * scroll config was quietly ignored and every tween sat on its start value.
 * Forty lines that can be read start to finish are the better trade.
 */

/** Element kinds, tagged in the markup with data-scroll. */
type Kind = "media" | "drift" | "lift" | "progress";

interface Tracked {
  el: HTMLElement;
  kind: Kind;
}

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Whether scroll-driven CSS animations actually move something.
 *
 * `CSS.supports("animation-timeline: view()")` is not a safe test. There are
 * builds that parse the property, hand back a real ScrollTimeline object, and
 * then never advance it, so the only trustworthy check is to attach one to a
 * throwaway element and read the value back off it.
 */
function nativeTimelinesWork(): boolean {
  if (!CSS.supports("animation-timeline", "scroll(root block)")) return false;

  const style = document.createElement("style");
  style.textContent =
    "@keyframes ccProbe{from{opacity:0.25}to{opacity:0.75}}" +
    "#cc-probe{position:fixed;top:0;left:0;width:1px;height:1px;pointer-events:none;" +
    "animation:ccProbe linear both;animation-timeline:scroll(root block)}";
  const probe = document.createElement("div");
  probe.id = "cc-probe";
  probe.setAttribute("aria-hidden", "true");
  document.head.appendChild(style);
  document.body.appendChild(probe);

  /* At the top of a scrollable document a working timeline puts this at the
     first keyframe. An inactive one leaves the element at its own style. */
  const opacity = Number.parseFloat(getComputedStyle(probe).opacity);
  const works = Math.abs(opacity - 0.25) < 0.02;

  probe.remove();
  style.remove();
  return works;
}

export default function ScrollMotion() {
  useEffect(() => {
    try {
      sessionStorage.setItem("seen", "1");
    } catch {
      // Private mode refuses this. The entrance plays again, which is the
      // right behaviour when there is nothing to remember with.
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    let teardown: (() => void) | undefined;

    /* The probe reads a value the compositor drives, and a hidden tab does not
       advance it. Deciding while hidden would condemn a browser that is
       perfectly capable, so wait until there is something to measure. */
    function decide() {
      if (document.hidden) return;
      document.removeEventListener("visibilitychange", decide);
      if (nativeTimelinesWork()) return;
      teardown = startScrubbing();
    }

    function startScrubbing() {
      /* Take the CSS animations out before writing to the same transforms. */
      root.dataset.jsScroll = "1";

      const tracked: Tracked[] = [...document.querySelectorAll<HTMLElement>("[data-scroll]")].map(
        (el) => ({ el, kind: el.dataset.scroll as Kind }),
      );
      if (!tracked.length) return undefined;

      let raf = 0;
      let queued = false;

      function apply() {
        queued = false;
        const view = window.innerHeight;

        /* Read every rect, then write every transform. Interleaving the two
         forces a synchronous layout per element, which on this page was
         reading as script time rather than layout time and cost more than
         everything else in the pass put together. */
        const rects: (DOMRect | null)[] = tracked.map(({ el, kind }) =>
          kind === "progress" ? null : el.getBoundingClientRect(),
        );
        const max = root.scrollHeight - root.clientHeight;
        const scrolled = window.scrollY;

        for (let i = 0; i < tracked.length; i += 1) {
          const { el, kind } = tracked[i];

          if (kind === "progress") {
            const p = max > 0 ? clamp(scrolled / max) : 0;
            el.style.transform = `scaleY(${p.toFixed(4)})`;
            continue;
          }

          const box = rects[i]!;
          /* Skip anything well outside the viewport: its transform is already
           at whichever end it should be. */
          if (box.bottom < -view || box.top > view * 2) continue;

          if (kind === "media") {
            /* Settles as the panel crosses: entry at 92% of the viewport
             through to its centre sitting at 55%. */
            const p = clamp((view * 0.92 - box.top) / (view * 0.92 - view * 0.15));
            const scale = 1.06 - 0.06 * p;
            el.style.transform = `scale(${scale.toFixed(4)}) translateY(${(-2 + 2 * p).toFixed(3)}%)`;
          } else if (kind === "drift") {
            /* One parallax layer, running the whole time the panel is in view. */
            const p = clamp((view - box.top) / (view + box.height));
            el.style.transform = `translateY(${(-18 + 36 * p).toFixed(3)}%)`;
          } else if (kind === "lift") {
            const p = clamp((view * 0.94 - box.top) / (view * 0.32));
            el.style.transform = `translateY(${(26 - 26 * p).toFixed(2)}px)`;
          }
        }
      }

      function schedule() {
        if (queued) return;
        queued = true;
        raf = requestAnimationFrame(apply);
      }

      /* A frame requested just before the tab was hidden never arrives, which
       would leave the gate stuck closed and the scrubber dead once the tab
       came back. Reopen it and catch up. */
      function onVisibility() {
        if (document.hidden) return;
        queued = false;
        schedule();
      }

      apply();
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);

      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        document.removeEventListener("visibilitychange", onVisibility);
        delete root.dataset.jsScroll;
        for (const { el } of tracked) el.style.transform = "";
      };
    }

    decide();
    document.addEventListener("visibilitychange", decide);

    return () => {
      document.removeEventListener("visibilitychange", decide);
      teardown?.();
    };
  }, []);

  return null;
}
