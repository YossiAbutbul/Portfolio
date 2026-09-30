# Portfolio: working notes

Personal portfolio of Yossi Abutbul. Audience is recruiters and engineering managers; the site has to
be usable in the first ten seconds before it is impressive.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript. Static export (`output: "export"`),
  hosted on Vercel. No server code, no API routes, no Next image optimization.
- CSS modules + custom properties in `src/styles/tokens.css`. No Tailwind.
- Fonts: Figtree (sans, 800 uppercase for headings) and JetBrains Mono (labels, numbers, units) via
  `next/font/google`. Canvas text reads the hashed family names from `--font-figtree` /
  `--font-jetbrains`.
- Motion: `gsap` + `ScrollTrigger`, `lenis`, `three` (launch scene only), `motion` (route fade only).
  All are dynamically imported; keep it that way.
- Contact form: Formspree (`@formspree/react`).

## Folders

- `src/app/` routes: `/` and `/projects/[slug]` (statically generated).
- `src/components/launch/` the launch scene: `scene.ts` (three.js desk, device, veil, thermal
  shader, scroll choreography; loaded with a dynamic import), `LaunchStage` (fixed backdrop + canvas,
  loads the scene when idle on desktop and on first scroll/touch on phones), `LaunchIntro` (desk hero
  and spotlight beat). Design reference: `design/launch-prototype/`.
- `src/components/site/` the rest of the home page: `Home`, `ProjectSignature`, `ContactForm`.
- `src/components/layout/` shell: `Nav`, `SmoothScroll` (Lenis + scroll restoration),
  `PageTransition`, `SkipToContent`. There is no intro loader; the page must be readable at first paint.
- `content/projects.ts` project data; `src/types/project.ts` its type.
- `public/` CV PDF, project screenshots/posters, `og.png`.

## Commands

- `npm run dev` (the `.claude/launch.json` config `next-dev` runs it on port 3001)
- `npm run typecheck`
- `npm run build` (static export to `out/`), `npm run serve` to preview it
- `npm run lint` (ESLint 9 flat config in `eslint.config.mjs`; ESLint 10 is not yet supported by
  `eslint-config-next`'s parser, so don't upgrade it).
- No test suite. Verify in the browser at desktop and 375px mobile, and with reduced motion.

## Styling conventions

- Launch palette in `tokens.css`: warm dark `--paper`, cream `--ink`, cork `--mark` as the one UI
  accent. The set colours (`--olive`, `--mat`, `--red`, `--sand`, `--plum`) belong to specific scenes
  and cards, not to UI chrome. `--limit` is semantic only.
- Use tokens for colour, type steps, spacing, easing and durations. No raw hex in components
  except inside WebGL/SVG drawing code.
- Anything measured (numbers, units, dates, labels) is mono with tabular figures.
- New sections reuse the existing `Section` shell in `Home.tsx` rather than inventing layout.
- Copy states specific facts, not slogans. Do not write positioning statements or role titles
  ("full-stack developer", "AI engineer") into the site; the work carries that.
- RF/hardware is background, not the headline.

## Animation conventions

- Budget: one signature interaction (the hero), two to four medium ones, then microinteractions.
  Do not add a major effect to every section.
- Prefer CSS transitions, CSS scroll-driven animations (with a fallback) and IntersectionObserver.
  Use GSAP/ScrollTrigger only for scrubbed or sequenced timelines CSS cannot express cleanly.
- Scroll-linked state is derived from scroll position each frame (see `launch/scene.ts`) so reversing
  is exact. The scene's render loop stops when nothing is moving and wakes on scroll/pointer/resize.
- Animate `transform` and `opacity` only. No layout properties in scroll handlers.
- One passive scroll listener feeding requestAnimationFrame at most per effect; stop the loop when
  idle. Clean up every timeline, observer and listener on unmount.
- Never hide content waiting on JS: no content parked at `opacity: 0` that only JS reveals.
  Canvas/WebGL paints one frame synchronously before starting any rAF loop (rAF does not run in
  background tabs).
- Entrances run once. Nothing loops forever in view unless it is the hero.

## Performance constraints

- Initial load: HTML, nav, hero text and critical fonts. Heavy modules (three, gsap, post-processing)
  are dynamic imports loaded after first paint or on approach.
- Hero text must be readable without waiting for WebGL. Anything that blocks the page on the scene
  has to justify itself with measurements.
- Images: explicit width/height, responsive `sizes`, lazy below the fold. Prefer AVIF/WebP.
- Unreferenced files in `public/` still bloat the repo; delete assets for cut projects.
- Check Lighthouse (LCP, CLS, INP) and the JS chunk sizes after any motion or asset change.

## Accessibility requirements

- Respect `prefers-reduced-motion` everywhere: static fallbacks, no Lenis, no pinned scrolling.
- Keyboard: every interactive element reachable, visible `:focus-visible`, skip link kept working.
- Semantic HTML: one `h1`, sections labelled by their headings, lists as lists.
- Content hidden by animation must also be `inert` / `aria-hidden`.
- No hover-only information. Touch gets its own intended behaviour, not a degraded hover.
- Text contrast meets WCAG AA against `--paper`.

## Dependencies

- Prefer what is installed and native browser APIs. Before adding a package, state the problem it
  solves, why existing code can't, gzip cost, maintenance cost, and mobile impact.
- No new 3D, animation or UI-kit libraries without that justification.

## Changing existing behaviour

- Don't rewrite working code without a clear benefit, and say what the benefit is.
- Don't redesign unrelated components while implementing a feature.
- Work in small steps: change, typecheck + build, check desktop + mobile + console, then continue.
- Commits: conventional style `type(scope): message`, authored by Yossi only (no co-author
  trailers, no generated-by footers).
- `.claude/` stays gitignored.
