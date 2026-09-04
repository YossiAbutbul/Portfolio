"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useForm, ValidationError } from "@formspree/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FEATURED_PROJECTS } from "@content/projects";
import { withBasePath } from "@/lib/env";
import type { Project } from "@/types/project";
import HeroSignalReveal from "./HeroSignalReveal";
import styles from "./PortfolioExperience.module.css";

gsap.registerPlugin(ScrollTrigger);

// ---------------------------------------------------------------------------
// Motion system. One easing family, one duration scale, three amplitude tiers.
// Amplitude encodes importance: the further something travels, the more it
// matters. Nothing outside tier 1 is allowed a large move.
// ---------------------------------------------------------------------------
const EASE = "expo.out";
const DUR = { lead: 1, support: 0.66, meta: 0.44 } as const;
const STAGGER = { lead: 0.09, support: 0.06, meta: 0.04 } as const;
const RISE = { support: 20, meta: 8 } as const;

const EXPERIENCE = [
  {
    years: "2020—NOW",
    role: "RF & Electronics Integrator",
    kind: "WORK",
    place: "Arad Technologies",
    detail: "I design test systems where radio hardware, automation, data, and usable interfaces meet. One automated platform cut a three-day lab cycle to roughly eight minutes.",
  },
  {
    years: "2022—NOW",
    role: "BSc Computer Science",
    kind: "EDUCATION",
    place: "The Open University",
    detail: "Coursework includes systems programming, algorithms, computer architecture, and software engineering.",
  },
  {
    years: "2017—2019",
    role: "Operational Project Leader",
    kind: "WORK",
    place: "IDF Intelligence · Unit 81",
    detail: "Led multi-disciplinary RF projects, handled field integration, and built Python tools for Spectrum Analyzer data collection.",
  },
];

const STACK_ROWS = [
  ["React", "TypeScript", "Next.js", "Three.js"],
  ["Python", "FastAPI", "RF Automation", "Embedded Systems"],
  ["WebGL", "Firestore", "C", "Hardware Integration"],
];

export default function PortfolioExperience() {
  const root = useRef<HTMLDivElement>(null);
  const activeProjectRef = useRef(0);
  const [activeProject, setActiveProject] = useState(0);
  const projects = FEATURED_PROJECTS.slice(0, 5);

  useLayoutEffect(() => {
    if (!root.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = gsap.context(() => {
      // ------------------------------------------------------------------
      // Hero: the name is the only large move on first paint. Everything
      // else resolves after it, at a smaller amplitude.
      // ------------------------------------------------------------------
      gsap.set("[data-hero-line]", { yPercent: 105 });
      gsap.set("[data-hero-lede]", { opacity: 0, y: RISE.support });
      gsap.set("[data-hero-meta]", { opacity: 0, y: RISE.meta });

      gsap
        .timeline({ defaults: { ease: EASE } })
        .to("[data-hero-line]", { yPercent: 0, duration: DUR.lead, stagger: STAGGER.lead }, 0.1)
        .to("[data-hero-lede]", { opacity: 1, y: 0, duration: DUR.support, stagger: STAGGER.support }, 0.55)
        .to("[data-hero-meta]", { opacity: 1, y: 0, duration: DUR.meta, stagger: STAGGER.meta }, 0.72);

      gsap.to(`.${styles.scopeLine}`, {
        strokeDashoffset: -260,
        ease: "none",
        scrollTrigger: { trigger: `.${styles.hero}`, start: "top top", end: "bottom top", scrub: true },
      });

      // ------------------------------------------------------------------
      // Tier 1 - section headlines. Masked line reveal, one per section.
      // ------------------------------------------------------------------
      gsap.utils.toArray<HTMLElement>("[data-lead-scope]").forEach((scope) => {
        gsap.from(scope.querySelectorAll("[data-lead]"), {
          yPercent: 105,
          duration: DUR.lead,
          stagger: STAGGER.lead,
          ease: EASE,
          scrollTrigger: { trigger: scope, start: "top 82%" },
        });
      });

      // Tier 2 - supporting copy. Short rise, no masking.
      gsap.utils.toArray<HTMLElement>("[data-support]").forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: RISE.support,
          duration: DUR.support,
          ease: EASE,
          scrollTrigger: { trigger: el, start: "top 88%" },
        });
      });

      // Tier 3 - labels and meta. Fade only; they should never pull focus.
      gsap.utils.toArray<HTMLElement>("[data-meta]").forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: RISE.meta,
          duration: DUR.meta,
          ease: EASE,
          scrollTrigger: { trigger: el, start: "top 92%" },
        });
      });

      // Ambient depth only - kept well under the content amplitudes above.
      gsap.utils.toArray<HTMLElement>("[data-float]").forEach((item, index) => {
        const dir = index % 2 === 0 ? 1 : -1;
        gsap.fromTo(item, { yPercent: 7 * dir }, {
          yPercent: -7 * dir,
          ease: "none",
          scrollTrigger: { trigger: `.${styles.statement}`, start: "top bottom", end: "bottom top", scrub: 1 },
        });
      });

      const responsive = gsap.matchMedia();
      responsive.add("(min-width: 701px)", () => {
        const layers = gsap.utils.toArray<HTMLElement>("[data-story-layer]");
        const copies = gsap.utils.toArray<HTMLElement>("[data-story-copy]");
        const markers = gsap.utils.toArray<HTMLElement>("[data-story-marker]");
        const storyDistance = () => window.innerHeight * (projects.length - 0.8);

        gsap.set(layers, { opacity: 0, scale: 0.94, clipPath: "inset(100% 0 0 0)" });
        gsap.set(copies, { opacity: 0, y: RISE.support });
        gsap.set(markers, { opacity: 0.24 });
        gsap.set(layers[0], { opacity: 1, scale: 1, clipPath: "inset(0% 0 0 0)" });
        gsap.set(copies[0], { opacity: 1, y: 0 });
        gsap.set(markers[0], { opacity: 1 });

        const storyTimeline = gsap.timeline({
          scrollTrigger: {
            trigger: `.${styles.storyStage}`,
            start: "top top",
            end: () => `+=${storyDistance()}`,
            pin: true,
            scrub: 0.4,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const next = Math.min(projects.length - 1, Math.round(self.progress * (projects.length - 1)));
              if (next !== activeProjectRef.current) {
                activeProjectRef.current = next;
                setActiveProject(next);
              }
            },
          },
        });

        for (let index = 1; index < projects.length; index += 1) {
          const at = index - 0.45;
          storyTimeline
            .to(layers[index - 1], { opacity: 0, scale: 1.05, duration: 0.34 }, at)
            .to(copies[index - 1], { opacity: 0, y: -RISE.support, duration: 0.24 }, at)
            .to(markers[index - 1], { opacity: 0.24, duration: 0.16 }, at)
            .to(layers[index], { opacity: 1, scale: 1, clipPath: "inset(0% 0 0 0)", duration: 0.48, ease: "power2.out" }, at + 0.08)
            .to(copies[index], { opacity: 1, y: 0, duration: 0.32, ease: "power2.out" }, at + 0.14)
            .to(markers[index], { opacity: 1, duration: 0.16 }, at + 0.14);
        }

        gsap.to(`.${styles.storyProgressFill}`, {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: `.${styles.storyStage}`,
            start: "top top",
            end: () => `+=${storyDistance()}`,
            scrub: true,
          },
        });
      });

      responsive.add("(max-width: 700px)", () => {
        gsap.utils.toArray<HTMLElement>("[data-mobile-project]").forEach((card) => {
          gsap.from(card, {
            opacity: 0,
            y: RISE.support,
            duration: DUR.support,
            ease: EASE,
            scrollTrigger: { trigger: card, start: "top 86%" },
          });
        });
      });

      // Career rows are list items - tier 3. A settled fade, not a scrub, so
      // they stop shimmering while the user is still reading them.
      gsap.utils.toArray<HTMLElement>("[data-career-row]").forEach((row) => {
        gsap.from(row, {
          opacity: 0,
          y: RISE.meta,
          duration: DUR.support,
          ease: EASE,
          scrollTrigger: { trigger: row, start: "top 88%" },
        });
      });
      gsap.to(`.${styles.careerProgress}`, {
        scaleY: 1,
        ease: "none",
        scrollTrigger: { trigger: `.${styles.experience}`, start: "top 35%", end: "bottom 70%", scrub: true },
      });

      gsap.to(`.${styles.core}`, {
        rotate: 60,
        ease: "none",
        scrollTrigger: { trigger: `.${styles.stack}`, start: "top bottom", end: "bottom top", scrub: 0.8 },
      });
      gsap.utils.toArray<HTMLElement>("[data-marquee]").forEach((row, index) => {
        const from = index % 2 === 0 ? -8 : -22;
        const to = index % 2 === 0 ? -22 : -8;
        gsap.fromTo(row, { xPercent: from }, {
          xPercent: to,
          ease: "none",
          scrollTrigger: { trigger: `.${styles.stack}`, start: "top bottom", end: "bottom top", scrub: 1 },
        });
      });

      ScrollTrigger.refresh();
    }, root);

    return () => context.revert();
  }, [projects.length]);

  return (
    <div ref={root} className={styles.page}>
      <section id="hero" className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.grid} aria-hidden="true" />
        <div className={styles.heroShade} aria-hidden="true" />
        <HeroSignalReveal />
        <svg className={styles.scope} viewBox="0 0 1200 180" preserveAspectRatio="none" aria-hidden="true">
          <path className={styles.scopeLine} pathLength="1000" d="M0 92 C110 92 120 78 210 78 S320 112 410 112 510 34 600 34 700 148 790 148 890 58 980 58 1080 104 1200 104" />
        </svg>
        <div className={styles.heroInner}>
          <div className={styles.heroTop} data-hero-meta>
            <span>PORTFOLIO / 2026</span>
            <span>RF SYSTEMS &amp; SOFTWARE</span>
          </div>

          <div className={styles.heroMain}>
            <h1 id="hero-title" className={styles.heroTitle}>
              <span className={styles.reveal}><span data-hero-line>YOSSI</span></span>
              <span className={styles.reveal}><span data-hero-line>ABUTBUL</span></span>
            </h1>
            <div className={styles.heroLede}>
              <p data-hero-lede>
                I build RF test automation and software tools for engineering teams.
              </p>
              <a className={styles.heroCta} href="#showcase" data-hero-lede>
                VIEW PROJECTS <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className={styles.statement} aria-labelledby="about-title">
        <div className={styles.sectionBar} data-meta><span>01 / ABOUT</span><span>SOFTWARE + RF</span></div>
        <div className={`${styles.floatShape} ${styles.floatOne}`} data-float><span>RF SYSTEMS</span><i /></div>
        <div className={`${styles.floatShape} ${styles.floatTwo}`} data-float><span>WEB TOOLS</span><i /></div>
        <div className={`${styles.floatShape} ${styles.floatThree}`} data-float><span>AUTOMATION</span><i /></div>
        <h2 id="about-title" className={styles.statementTitle} data-lead-scope>
          <span className={styles.reveal}><span data-lead>SOFTWARE FOR ENGINEERS</span></span>
          <span className={styles.reveal}><span data-lead>WORKING WITH <em>RF HARDWARE</em>.</span></span>
        </h2>
        <p className={styles.statementCopy} data-support>My work combines hands-on RF integration with full-stack development. I focus on reducing manual work and making technical results easier to inspect and share.</p>
      </section>

      <section id="showcase" className={styles.work} aria-labelledby="work-title">
        <header id="projects" className={styles.workHeader}>
          <div className={styles.sectionBar} data-meta><span>02 / PROJECTS</span><span>05 SELECTED CASES</span></div>
          <div className={styles.workHeaderRow}>
            <h2 id="work-title" data-lead-scope>
              <span className={styles.reveal}><span data-lead>SELECTED PROJECTS</span></span>
            </h2>
            <p data-support>
              Five builds where the hardware, the data, and the interface all had to work together.
            </p>
          </div>
        </header>

        <div className={styles.storyStage}>
          <div className={styles.storyGrid} aria-hidden="true" />
          <div className={styles.storyLabel}>PROJECT INDEX</div>
          <div className={styles.storyMedia}>
            {projects.map((project, index) => (
              <div key={project.slug} className={styles.storyLayer} data-story-layer aria-hidden={index !== activeProject}>
                <ProjectMedia project={project} active={index === activeProject} />
              </div>
            ))}
          </div>
          <div className={styles.storyCopies}>
            {projects.map((project, index) => (
              <article
                key={project.slug}
                className={styles.storyCopy}
                data-story-copy
                aria-hidden={index !== activeProject}
                inert={index !== activeProject}
              >
                <div className={styles.storyEyebrow}><span>{String(index + 1).padStart(2, "0")}</span><span>{project.year}</span><span>{project.band}</span></div>
                <h3>{project.title}</h3>
                <p>{project.summary}</p>
                <ProjectLinks project={project} />
              </article>
            ))}
          </div>
          <div className={styles.storyMarkers} aria-hidden="true">
            {projects.map((project, index) => <span key={project.slug} data-story-marker>{String(index + 1).padStart(2, "0")}</span>)}
          </div>
          <div className={styles.storyProgress} aria-hidden="true"><span className={styles.storyProgressFill} /></div>
        </div>

        <div className={styles.mobileProjects} aria-label="Selected project list">
          {projects.map((project, index) => (
            <article key={project.slug} className={styles.mobileProject} data-mobile-project>
              <div className={styles.mobileProjectMeta}><span>{String(index + 1).padStart(2, "0")}</span><span>{project.year}</span><span>{project.band}</span></div>
              <MobileProjectMedia project={project} />
              <h3>{project.title}</h3>
              <p>{project.summary}</p>
              <ProjectLinks project={project} />
            </article>
          ))}
        </div>
      </section>

      <section id="experience" className={styles.experience} aria-labelledby="experience-title">
        <div className={styles.sectionBar} data-meta><span>03 / EXPERIENCE</span><span>2017—PRESENT</span></div>
        <h2 id="experience-title" data-lead-scope>
          <span className={styles.reveal}><span data-lead>WORK &amp; <em>EDUCATION</em></span></span>
        </h2>
        <div className={styles.careerWrap}>
          <div className={styles.careerRail} aria-hidden="true"><span className={styles.careerProgress} /></div>
          <ol className={styles.careerList}>
            {EXPERIENCE.map((item, index) => (
              <li key={item.years} className={styles.careerRow} data-career-row>
                <div className={styles.careerMeta}>
                  <span className={styles.careerKind}>{item.kind}</span>
                  <span className={styles.careerYears}>{item.years}</span>
                </div>
                <div className={styles.careerBody}>
                  <h3>{item.role}</h3>
                  <p className={styles.careerPlace}>{item.place}</p>
                  <p className={styles.careerDetail}>{item.detail}</p>
                </div>
                <span className={styles.careerNum} aria-hidden="true">0{index + 1}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="stack" className={styles.stack} aria-labelledby="stack-title">
        <div className={`${styles.sectionBar} ${styles.stackBar}`} data-meta><span>04 / SKILLS</span><span>SELECTED TECHNOLOGIES</span></div>
        <h2 id="stack-title" className={styles.srOnly}>Technology stack and capabilities</h2>
        <div className={styles.core} aria-hidden="true">
          <span className={styles.coreRing} /><span className={styles.coreRing} /><span className={styles.coreRing} />
          <strong>RF</strong><small>+ SOFTWARE</small>
        </div>
        <div className={styles.marqueeField}>
          {STACK_ROWS.map((row, index) => (
            <div key={row[0]} className={styles.marqueeRow} data-marquee>
              {[...row, ...row, ...row].map((item, itemIndex) => <span key={`${item}-${itemIndex}`} className={index === 1 ? styles.outlineText : ""}>{item}<i>✦</i></span>)}
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className={styles.contact} aria-labelledby="contact-title">
        <div className={styles.sectionBar} data-meta><span>05 / CONTACT</span><span>EMAIL / FORM</span></div>
        <div className={styles.contactPanel}>
          <div className={styles.contactIntro}>
            <span className={styles.contactIndex}>CONTACT</span>
            <h2 id="contact-title" data-lead-scope>
              <span className={styles.reveal}><span data-lead>GET IN TOUCH</span></span>
            </h2>
            <p data-support>For RF automation, engineering software, or a role where both matter.</p>
            <ul className={styles.contactLinks}>
              <li>
                <a className={styles.contactLinkPrimary} href="mailto:abyossi22@gmail.com">
                  <span className={styles.contactLinkLabel}>EMAIL</span>
                  <span className={styles.contactLinkValue}>abyossi22@gmail.com</span>
                  <span className={styles.contactLinkArrow} aria-hidden="true">↗</span>
                </a>
              </li>
              <li>
                <a className={styles.contactLink} href="https://www.linkedin.com/in/yossi-abutbul-550958199/" target="_blank" rel="noreferrer">
                  <span className={styles.contactLinkLabel}>LINKEDIN</span>
                  <span className={styles.contactLinkValue}>yossi-abutbul</span>
                  <span className={styles.contactLinkArrow} aria-hidden="true">↗</span>
                </a>
              </li>
              <li>
                <a className={styles.contactLink} href="https://github.com/YossiAbutbul" target="_blank" rel="noreferrer">
                  <span className={styles.contactLinkLabel}>GITHUB</span>
                  <span className={styles.contactLinkValue}>YossiAbutbul</span>
                  <span className={styles.contactLinkArrow} aria-hidden="true">↗</span>
                </a>
              </li>
              <li>
                <a className={styles.contactLink} href={withBasePath("/Yossi Abutbul - CV 2026.pdf")} target="_blank" rel="noreferrer">
                  <span className={styles.contactLinkLabel}>CV</span>
                  <span className={styles.contactLinkValue}>Download PDF</span>
                  <span className={styles.contactLinkArrow} aria-hidden="true">↗</span>
                </a>
              </li>
            </ul>
          </div>
          <PortfolioContactForm />
        </div>
        <footer className={styles.contactFooter}>
          <span className={styles.copyright}>© {new Date().getFullYear()} YOSSI ABUTBUL</span>
          <span className={styles.copyright}>BUILT WITH NEXT.JS</span>
        </footer>
      </section>
    </div>
  );
}

function ProjectMedia({ project, eager = false, active = false }: { project?: Project; eager?: boolean; active?: boolean }) {
  if (!project) return null;
  if (project.video) {
    return <ProjectVideo project={project} eager={eager} active={active} />;
  }
  const image = project.images?.[0];
  if (image) {
    return <img src={withBasePath(image.src)} alt={image.alt} width={image.width} height={image.height} loading={eager ? "eager" : "lazy"} />;
  }
  return <div className={styles.mediaFallback}><strong>{project.frequency}</strong><span>MHz / {project.band}</span></div>;
}

function ProjectVideo({ project, eager, active }: { project: Project; eager: boolean; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const canPlay = active && video.getClientRects().length > 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (canPlay) video.play().catch(() => {});
    else video.pause();
  }, [active]);

  return (
    <video
      ref={videoRef}
      src={withBasePath(project.video!)}
      poster={withBasePath(`/projects/${project.slug}/poster.jpg`)}
      muted
      loop
      playsInline
      preload={eager ? "auto" : "metadata"}
      aria-label={`${project.title} preview`}
    />
  );
}

function MobileProjectMedia({ project }: { project: Project }) {
  const source = project.video
    ? `/projects/${project.slug}/poster.jpg`
    : project.images?.[0]?.src;
  if (!source) return <div className={styles.mobileMediaFallback}>{project.band}</div>;
  return <img className={styles.mobileProjectMedia} src={withBasePath(source)} alt={`${project.title} interface preview`} loading="lazy" />;
}

function PortfolioContactForm() {
  const [state, handleSubmit] = useForm("xwvzvjkb");

  if (state.succeeded) {
    return (
      <div className={`${styles.contactForm} ${styles.formSuccess}`} role="status">
        <span>MESSAGE SENT</span>
        <strong>Thank you.</strong>
        <p>I&apos;ll reply to the email address you provided.</p>
      </div>
    );
  }

  return (
    <form className={styles.contactForm} onSubmit={handleSubmit}>
      <p className={styles.formTitle}>Send a message</p>
      <div className={styles.formField}>
        <label htmlFor="contact-name">Name</label>
        <input id="contact-name" name="name" type="text" placeholder="Your name" autoComplete="name" required />
      </div>
      <div className={styles.formField}>
        <label htmlFor="contact-email">Email</label>
        <input id="contact-email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
        <ValidationError prefix="Email" field="email" errors={state.errors} className={styles.formError} />
      </div>
      <div className={styles.formField}>
        <label htmlFor="contact-message">Message</label>
        <textarea id="contact-message" name="message" placeholder="Project or role details" rows={5} required />
        <ValidationError prefix="Message" field="message" errors={state.errors} className={styles.formError} />
      </div>
      <button type="submit" disabled={state.submitting}>{state.submitting ? "SENDING..." : "SEND MESSAGE"} <span aria-hidden="true">↗</span></button>
      <ValidationError errors={state.errors} className={styles.formError} />
    </form>
  );
}

function ProjectLinks({ project }: { project: Project }) {
  const primary = project.noCase ? project.links[0]?.href : `/projects/${project.slug}`;
  const live = project.links.find((link) => /live/i.test(link.label));
  return (
    <div className={styles.projectLinks}>
      {primary && (primary.startsWith("/") ? <Link href={primary}>OPEN CASE <span>↗</span></Link> : <a href={primary} target="_blank" rel="noreferrer">VIEW PROJECT <span>↗</span></a>)}
      {live && <a href={live.href} target="_blank" rel="noreferrer">LIVE <span>↗</span></a>}
    </div>
  );
}
