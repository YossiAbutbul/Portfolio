"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import InlineWaves from "./InlineWaves";
import HeroSineBg from "./HeroSineBg";
import styles from "./Hero.module.css";

gsap.registerPlugin(ScrollTrigger);

export default function Hero() {
  const heroRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const hero = heroRef.current;
    if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const copy = hero.querySelector<HTMLElement>(`.${styles.copy}`);
    const titleLines = hero.querySelectorAll<HTMLElement>(`.${styles.titleLine}`);
    const grid = hero.querySelector<HTMLElement>(`.${styles.grid}`);
    const ambient = hero.querySelector<HTMLElement>(`.${styles.ambient}`);
    if (!copy || !grid || !ambient) return;

    const context = gsap.context(() => {
      const intro = gsap.timeline({ defaults: { ease: "power4.out" } });
      intro
        .from(hero.querySelector(`.${styles.kicker}`), { y: 24, opacity: 0, duration: 0.7 })
        .from(titleLines[0], { xPercent: -35, opacity: 0, duration: 1.15 }, "-=0.4")
        .from(titleLines[1], { xPercent: 35, opacity: 0, duration: 1.15 }, "-=1.02")
        .from(
          [hero.querySelector(`.${styles.tagline}`), hero.querySelector(`.${styles.meta}`), hero.querySelector(`.${styles.cta}`)],
          { y: 28, opacity: 0, duration: 0.72, stagger: 0.08 },
          "-=0.7",
        );

      gsap.timeline({
        scrollTrigger: {
          trigger: hero,
          start: "top top",
          end: "bottom top",
          scrub: 0.75,
          invalidateOnRefresh: true,
        },
      })
        .to(titleLines[0], { xPercent: -20, ease: "none" }, 0)
        .to(titleLines[1], { xPercent: 20, ease: "none" }, 0)
        .to(copy.querySelectorAll(`.${styles.tagline}, .${styles.meta}, .${styles.cta}, .${styles.kicker}`), { y: -40, opacity: 0.15, ease: "none" }, 0)
        .to(grid, { scale: 1.9, yPercent: -25, opacity: 0.75, ease: "none" }, 0)
        .to(ambient, { scale: 1.75, opacity: 0.18, ease: "none" }, 0);
    }, hero);

    return () => context.revert();
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const render = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      hero.style.setProperty("--pointer-x", `${currentX.toFixed(3)}`);
      hero.style.setProperty("--pointer-y", `${currentY.toFixed(3)}`);
      frame = requestAnimationFrame(render);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = hero.getBoundingClientRect();
      targetX = (event.clientX - rect.left) / rect.width - 0.5;
      targetY = (event.clientY - rect.top) / rect.height - 0.5;
    };

    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    hero.addEventListener("pointermove", onPointerMove);
    hero.addEventListener("pointerleave", onPointerLeave);
    frame = requestAnimationFrame(render);

    return () => {
      hero.removeEventListener("pointermove", onPointerMove);
      hero.removeEventListener("pointerleave", onPointerLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={heroRef} id="hero" className={styles.hero} aria-labelledby="hero-name">
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />
      <HeroSineBg />
      <div className={`container ${styles.layout}`}>
        <div className={styles.copy}>
          <p className={styles.kicker}>Software engineer · RF systems · AI</p>
          <h1 id="hero-name" className={styles.title}>
            <span className={styles.titleLine}>Yossi</span>
            <span className={`${styles.titleLine} ${styles.titleAccent}`}>Abutbul</span>
          </h1>

          <p className={styles.tagline}>
            <span className={styles.taglineInner}>
              <span className={styles.taglinePrefix}>Building software where </span>
              <span className={styles.taglineBridge}>
                <span className={styles.kw}>signals</span>
                <InlineWaves />
                <span className={styles.kw}>code</span>.
              </span>
            </span>
          </p>

          <p className={styles.meta}>
            <span className={styles.metaLine}>BSc Computer Science Student · The Open University</span>
            <span className={styles.metaLine}>Innovating With AI</span>
          </p>

          <div className={styles.cta}>
            <a className={styles.ctaPrimary} href="#showcase">
              <span>View work</span><span className={styles.ctaArrow}>↗</span>
            </a>
            <a className={styles.ctaGhost} href="#contact">Get in touch</a>
          </div>
        </div>

      </div>
    </section>
  );
}
