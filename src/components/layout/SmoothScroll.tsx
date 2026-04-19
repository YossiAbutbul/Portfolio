"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

export default function SmoothScroll({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Restore scroll on route change. Lenis lives in layout so it persists
  // across nav; without explicit handling, the new page renders at the
  // previous page's offset. We save per-pathname positions in sessionStorage
  // so returning to a page (e.g. from a project detail back to "/") lands on
  // the same spot the user left.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isProject = pathname.startsWith("/projects/");
    const hash = window.location.hash; // e.g. "#projects"

    // Always strip the hash from the URL — sections are reached by scroll, not URL fragment.
    if (hash) history.replaceState(null, "", window.location.pathname);

    // If navigating to a hash section (e.g. via "Back to Projects"), scroll there.
    if (hash && !isProject) {
      const el = document.querySelector(hash);
      if (el) {
        if (window.__lenis) {
          window.__lenis.scrollTo(el as HTMLElement, { offset: -16, immediate: true, force: true });
        } else {
          el.scrollIntoView();
        }
        return;
      }
    }

    // Project detail pages always start at the top. Other routes restore
    // the last saved scroll position so returning home lands where the
    // user left off.
    const saved = isProject ? null : sessionStorage.getItem(`scroll:${pathname}`);
    const target = saved ? parseInt(saved, 10) : 0;
    if (window.__lenis) {
      window.__lenis.scrollTo(target, { immediate: true, force: true });
    } else {
      window.scrollTo(0, target);
    }
  }, [pathname]);

  // Throttled save of current scroll position, keyed by pathname.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const save = () => {
      pending = null;
      sessionStorage.setItem(`scroll:${pathname}`, String(window.scrollY));
    };
    const onScroll = () => {
      if (pending) return;
      pending = setTimeout(save, 200);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (pending) clearTimeout(pending);
    };
  }, [pathname]);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    // Force scroll to top on hard reload — browsers restore the previous
    // scroll position by default which fights the hero entrance.
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.2,
    });
    window.__lenis = lenis;

    // On initial load, scroll to hash section if present; otherwise top.
    const initHash = window.location.hash;
    const hashEl = initHash ? document.querySelector(initHash) : null;
    if (hashEl) {
      lenis.scrollTo(hashEl as HTMLElement, { offset: -16, immediate: true });
      history.replaceState(null, "", window.location.pathname);
    } else {
      lenis.scrollTo(0, { immediate: true });
    }

    // Intercept in-page hash links so they animate via Lenis instead of jumping.
    // Handles both "#section" and "/#section" formats.
    function handleAnchorClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href === "#") return;
      // Extract hash — accept "#section" or "/#section"
      const hash = href.startsWith("/#") ? href.slice(1) : href.startsWith("#") ? href : null;
      if (!hash) return;
      const dest = document.querySelector(hash);
      if (!dest) return;
      e.preventDefault();
      lenis.scrollTo(dest as HTMLElement, { offset: -16, duration: 1.4 });
    }
    document.addEventListener("click", handleAnchorClick);

    // Scroll-reveal via viewport test. Auto-stops polling once every
    // [data-reveal] element has been shown.
    const REVEAL_OFFSET = 0.88;
    let tick = 0;
    let stopped = false;
    function revealVisible() {
      const vh = window.innerHeight || 800;
      const threshold = vh * REVEAL_OFFSET;
      const pending = document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)");
      if (pending.length === 0) {
        stopped = true;
        return;
      }
      pending.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < threshold && rect.bottom > 0) el.classList.add("is-in");
      });
    }

    let raf = 0;
    function loop(time: number) {
      lenis.raf(time);
      if (!stopped && ++tick % 6 === 0) revealVisible();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    revealVisible();
    lenis.on("scroll", revealVisible);
    window.addEventListener("scroll", revealVisible, { passive: true });
    window.addEventListener("resize", revealVisible);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      delete window.__lenis;
      document.removeEventListener("click", handleAnchorClick);
      window.removeEventListener("scroll", revealVisible);
      window.removeEventListener("resize", revealVisible);
    };
  }, []);

  return <>{children}</>;
}
