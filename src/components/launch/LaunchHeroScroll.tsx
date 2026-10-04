"use client";

import { useEffect } from "react";

/**
 * What the hero does as it scrolls away, all derived from scroll position each frame so scrolling
 * back reverses it exactly:
 * - the big name shrinks and glides into the top bar's corner, then hands over to the bar's own
 *   link (same font, size, colour and shadow, so the swap is invisible). At the top the bar shows no name.
 * - the card's lines (its headline, then its sentence) slide down out of sight, each behind its own mask,
 *   one after another, while the card itself holds still on screen and fades away; the scroll cue fades as soon as you scroll.
 * The name and the card are fixed to the screen while this runs (they sit exactly where the hero puts
 * them at the top), so nothing is moved against the scroll: a phone scrolls on its own thread and a
 * position corrected a frame later shook. Height-only resizes (a phone's address bar showing or
 * hiding) change nothing here, so the lines are not re-split mid-scroll.
 * Reduced motion: nothing moves; the bar's name simply appears once the hero is half gone.
 */
export default function LaunchHeroScroll() {
  useEffect(() => {
    const name = document.getElementById("hero-name");
    const brand = document.querySelector<HTMLElement>("[data-brand]");
    if (!name || !brand) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    brand.dataset.dock = "";

    /* ---- Text that leaves line by line: each line gets a clipping box with the words inside. ---- */
    const card = document.querySelector<HTMLElement>("#top [data-card]");
    const cue = document.querySelector<HTMLElement>("#top [data-cue]");
    const blocks = reduce ? [] : [...document.querySelectorAll<HTMLElement>("#top [data-lines]")].map((el) => ({ el, text: el.textContent ?? "", lines: [] as HTMLElement[] }));
    const split = () => {
      for (const b of blocks) {
        b.el.textContent = "";
        const words = b.text.trim().split(/\s+/).map((w) => { const s = document.createElement("span"); s.textContent = w + " "; b.el.append(s); return s; });
        // Group the words by the line the browser put them on, then wrap each line.
        const rows: HTMLElement[][] = [];
        let top = NaN;
        for (const w of words) { if (w.offsetTop !== top) { rows.push([]); top = w.offsetTop; } rows[rows.length - 1].push(w); }
        b.el.textContent = "";
        b.lines = rows.map((row) => {
          const mask = document.createElement("span"), inner = document.createElement("span");
          mask.style.cssText = "display:block;overflow:hidden;padding-bottom:.12em;margin-bottom:-.12em";
          inner.style.cssText = "display:block;will-change:transform";
          inner.textContent = row.map((w) => w.textContent).join("").trimEnd();
          mask.append(inner); b.el.append(mask);
          return inner;
        });
      }
    };

    /* ---- The name's flight to the bar. ---- */
    // Measured with nothing applied: the name's box and the bar link's, both on screen. The hero's
    // run is measured once per width, so the address bar coming and going does not move anything.
    let nameLeft = 0, nameMid = 0, toLeft = 0, toMid = 0, k = 1, run = innerHeight * .45, width = innerWidth;
    const measure = () => {
      name.style.translate = name.style.scale = "";
      run = innerHeight * .45; width = innerWidth;
      // The target is the bar's name text itself (not its pill): the full name, or the initials on
      // small screens, whichever is showing.
      const text = [...brand.querySelectorAll<HTMLElement>("[data-brand-text]")].find((s) => s.offsetWidth > 0) ?? brand;
      const n = name.getBoundingClientRect(), b = text.getBoundingClientRect();
      nameLeft = n.left; nameMid = n.top + n.height / 2;
      toLeft = b.left; toMid = b.top + b.height / 2;
      k = parseFloat(getComputedStyle(text).fontSize) / parseFloat(getComputedStyle(name).fontSize);
      split();
    };

    let frame = 0;
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    const show = (el: HTMLElement, o: number) => { el.style.opacity = String(o); el.style.visibility = o < .02 ? "hidden" : ""; };
    const update = () => {
      frame = 0;
      const p = clamp(scrollY / run);
      if (reduce) { show(brand, p >= 1 ? 1 : 0); return; }
      const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      // From where it starts toward the bar (it is fixed to the screen, so scroll plays no part).
      name.style.translate = `${(toLeft - nameLeft) * e}px ${(toMid - nameMid) * e}px`;
      const sc = 1 + (k - 1) * e;
      name.style.scale = String(sc);
      // The shadow is scaled with the name, so set it so that on screen it moves from the hero's soft
      // glow to the bar's exact shadow; at the hand-over the two are pixel for pixel the same.
      const sy = 2 + (1 - 2) * e, blur = 30 + (14 - 30) * e, a = .25 + (.45 - .25) * e;
      name.style.textShadow = `0 ${(sy / sc).toFixed(2)}px ${(blur / sc).toFixed(2)}px rgba(0,0,0,${a.toFixed(3)})`;
      // No cross-fade: two copies half visible at once read as a smudge. At the end of the flight the
      // name is exactly the bar's link, so one simply replaces the other.
      const docked = p >= 1;
      show(name, docked ? 0 : 1); show(brand, docked ? 1 : 0);
      // Lines drop out of their masks in turn: the card's headline first, then its sentence.
      let i = 0;
      for (const b of blocks) for (const line of b.lines) {
        const t = clamp((p - i * .07) / .32), q = t * t * (3 - 2 * t);
        line.style.transform = `translate3d(0, ${q * 110}%, 0)`;
        i++;
      }
      // The scroll cue has done its job as soon as scrolling starts.
      if (cue) { const c = clamp(p / .2); cue.style.opacity = String(1 - c); cue.style.visibility = c > .98 ? "hidden" : ""; }
      // Once its words have gone, the glass card goes too.
      // It stays exactly where it is on screen (it is fixed there) and simply fades.
      if (card) { const c = clamp((p - .45) / .35); card.style.opacity = String(1 - c); card.style.visibility = c > .98 ? "hidden" : ""; }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const onResize = () => { measure(); schedule(); };
    // Touch screens resize their height as the address bar comes and goes: only a new width counts.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const onWindowResize = () => { if (!coarse || innerWidth !== width) onResize(); };

    name.style.transformOrigin = "0 50%";
    // Fixed where the hero places them at the top of the page (see the note above).
    if (!reduce) { name.style.position = "fixed"; if (card) card.style.position = "fixed"; }
    measure(); update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onWindowResize);
    // The fonts settle the sizes and the line breaks; measure again once they are in.
    document.fonts?.ready.then(onResize).catch(() => {});
    // The name rises in as the loading sheet lifts; measured mid-rise, it would dock off by the rise.
    // So measure again once that entrance (or any other animation on it) has finished.
    const settle = (e: AnimationEvent) => { if (e.target === name || (e.target as Node).contains?.(name)) onResize(); };
    document.addEventListener("animationend", settle);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onWindowResize);
      document.removeEventListener("animationend", settle);
      name.style.translate = name.style.scale = name.style.transformOrigin = name.style.opacity = name.style.visibility = name.style.textShadow = name.style.position = "";
      brand.style.opacity = brand.style.visibility = "";
      delete brand.dataset.dock;
      for (const b of blocks) b.el.textContent = b.text;
      if (card) card.style.opacity = card.style.visibility = card.style.position = "";
      if (cue) cue.style.opacity = cue.style.visibility = "";
    };
  }, []);
  return null;
}
