"use client";

import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type Lenis from "lenis";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

export default function SmoothScroll({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    if (isPageReload()) {
      try { sessionStorage.removeItem(`scroll:${pathname}`); } catch {}
      window.scrollTo(0, 0);
    }
    return () => {
      history.scrollRestoration = previousRestoration;
    };
  }, [pathname]);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    let disposed = false;
    let cleanup = () => {};

    async function startSmoothScroll() {
      const [{ default: Lenis }, { default: gsap }, { ScrollTrigger }] = await Promise.all([
        import("lenis"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);

      const lenis = new Lenis({
        // Longer than the library's own default. The hero is a story told over
        // several screens, and a glide that settles in under a second makes
        // every wheel notch a step rather than a movement.
        duration: 1.3,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        // A notch carries about four fifths of the distance the browser would
        // give it. This is the dial for how fast the page reads: the hero's
        // height only slows the hero, but this slows everything, which is what
        // keeps the sections below reading at the same pace as the story above.
        wheelMultiplier: 0.8,
        // Touch keeps its full travel. A thumb has to cross the screen to earn
        // its distance, and taking any of it away just makes the page heavy.
        touchMultiplier: 1,
      });
      window.__lenis = lenis;
      lenis.on("scroll", ScrollTrigger.update);

      let raf = 0;
      function loop(time: number) {
        lenis.raf(time);
        raf = requestAnimationFrame(loop);
      }
      raf = requestAnimationFrame(loop);

      function handleAnchorClick(event: MouseEvent) {
        const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
        const href = anchor?.getAttribute("href");
        if (!href) return;
        const hash = href.startsWith("/#") ? href.slice(1) : href.startsWith("#") ? href : null;
        if (!hash) return;
        const target = document.querySelector<HTMLElement>(hash);
        if (!target) return;
        event.preventDefault();
        lenis.scrollTo(target, { offset: -16, duration: 1.05 });
      }
      document.addEventListener("click", handleAnchorClick);

      cleanup = () => {
        cancelAnimationFrame(raf);
        document.removeEventListener("click", handleAnchorClick);
        lenis.off("scroll", ScrollTrigger.update);
        lenis.destroy();
        delete window.__lenis;
      };
    }

    const frame = requestAnimationFrame(() => { void startSmoothScroll(); });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cleanup();
    };
  }, []);

  useEffect(() => {
    const isProject = pathname.startsWith("/projects/");
    const reloaded = isPageReload();
    const hash = window.location.hash;
    let targetId: string | null = null;

    try { targetId = reloaded ? null : sessionStorage.getItem("__navTarget"); } catch {}
    if (!targetId && hash && !isProject && !reloaded) targetId = hash.slice(1);
    if (hash) history.replaceState(null, "", window.location.pathname);

    if (targetId && !isProject) {
      const lenis = window.__lenis;
      lenis?.stop();
      let raf = 0;
      let attempts = 0;

      const findAndScroll = () => {
        const target = document.getElementById(targetId!);
        if (target) {
          const top = Math.max(0, target.offsetTop - 16);
          if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
          else window.scrollTo(0, top);
          lenis?.start();
          try { sessionStorage.removeItem("__navTarget"); } catch {}
          return;
        }
        if (++attempts < 90) raf = requestAnimationFrame(findAndScroll);
        else lenis?.start();
      };

      raf = requestAnimationFrame(findAndScroll);
      return () => {
        cancelAnimationFrame(raf);
        lenis?.start();
      };
    }

    let saved: string | null = null;
    try { saved = isProject || reloaded ? null : sessionStorage.getItem(`scroll:${pathname}`); } catch {}
    const top = saved ? Number.parseInt(saved, 10) : 0;
    const raf = requestAnimationFrame(() => {
      if (window.__lenis) window.__lenis.scrollTo(top, { immediate: true, force: true });
      else window.scrollTo(0, top);
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const save = () => {
      pending = null;
      try { sessionStorage.setItem(`scroll:${pathname}`, String(window.scrollY)); } catch {}
    };
    const onScroll = () => {
      if (!pending) pending = setTimeout(save, 160);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (pending) clearTimeout(pending);
      save();
    };
  }, [pathname]);

  return <>{children}</>;
}

function isPageReload() {
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return navigation?.type === "reload";
}
