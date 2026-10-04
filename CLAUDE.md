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

## Folders

- `src/app/` routes: `/` and `/projects/[slug]` (statically generated).
- `src/components/launch/` the launch scene: `scene.ts` (three.js device, veil, cameras, scroll
  choreography; loaded with a dynamic import) and `desk.ts` (the desk set: wood, mat, mug, pencil,
  the 3D notebook with its More work mode and hologram, and the wall of playable gadgets that rises
  only for More work). `LaunchStage` (fixed backdrop with drifting glows + canvas, loads the scene
  right after first paint on desktop and when the browser is idle on phones), and one component per beat in page
  order: `LaunchIntro` (desk hero + spotlight), `LaunchHeroScroll`, `LaunchShips`, `LaunchBrowser`
  (projects in a browser window, one flick per project), `LaunchNotebook` (More work: caption with
  links, drawn fallback book, and the projects as JSON in `data-projects` for the scene),
  `LaunchEditorial` (release history, stack, paper), `LaunchContact` (panels + footer),
  `LaunchToast`. `projectMedia.ts` holds the demo videos/posters. Components talk to the scene
  through window events (`launch:press-device`, `launch:press`, `launch:say`) and data attributes
  (`data-fade`, `data-projects`), not refs. Design reference: `design/launch-prototype/`.
- The scene's beats are found by id (`intro`, `ships`, `work`, `more-work`, `experience`); renaming
  or removing a section id changes the choreography.
- `src/components/site/Home.tsx` just composes the launch beats; the scene finds them by id.
- `src/components/layout/` shell: `Nav`, `SmoothScroll` (Lenis + scroll restoration),
  `PageTransition`, `SkipToContent`. `LaunchLoader` (a sketch of the device drawing itself) is a short
  title card: it lifts on its own CSS clock (`--lift` in `tokens.css`, 1.1s; 0.6s on a reload in the
  same tab via `sessionStorage` `launch:seen`, read by a head script in the root layout) and never waits
  for the scene. The hero's entrance is CSS timed from `--lift`. Until the scene's first frame,
  `LaunchStage` shows a poster of the desk (`public/textures/poster*.webp`), then crossfades to the
  canvas. Reduced motion and no-JS never see the sheet.
- `content/projects.ts` project data; `src/types/project.ts` its type.
- `public/` CV PDF, project screenshots/posters, `og.jpg` (1200 x 630, the hero desk with the name).

## Commands

- `npm run dev` (the `.claude/launch.json` config `next-dev` runs it on port 3001)
- `npm run typecheck`
- `npm run build` (static export to `out/`), `npm run serve` to preview it
- `npm run bake:textures` re-renders the desk's procedural textures and the baked environment light
  (`scripts/bake-textures/`) into `public/textures`. Edit textures in `draw.js`, never back in
  `desk.ts` (drawing them at startup froze the page for seconds).
- `npm run bake:poster` (after `npm run build`) re-renders the desk posters; rerun whenever the desk,
  its layout or the hero camera changes, or the poster and the live scene will not line up.
- `npm run lint` (ESLint 9 flat config in `eslint.config.mjs`; ESLint 10 is not yet supported by
  `eslint-config-next`'s parser, so don't upgrade it).
- No test suite. Verify in the browser at desktop and 375px mobile, and with reduced motion. For
  headless screenshots set `<html data-snap>` so the scene skips easing and shows the exact pose.

## Styling conventions

- Launch palette in `tokens.css`: warm dark `--paper`, cream `--ink`, cork `--mark` as the one UI
  accent. The set colours (`--olive`, `--mat`, `--red`, `--sand`, `--plum`) belong to specific scenes
  and cards, not to UI chrome. `--limit` is semantic only.
- Use tokens for colour, type steps, spacing, easing and durations. No raw hex in components
  except inside WebGL/SVG drawing code.
- Anything measured (numbers, units, dates, labels) is mono with tabular figures.
- New beats are their own `Launch*` component with an id the scene can find; pinned beats use the
  `.pin` / `.frame` (sticky, 100svh) pattern in `LaunchSections.module.css`.
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
- Entrances run once. Nothing loops forever in view except the hero and these deliberate ambient
  loops: the drifting backdrop glows/grain (`LaunchStage`) and the More work hologram's shimmer and
  motes (shown only in the dark room and in More work respectively; both off under reduced motion).
  Don't add more.

## Performance constraints

- Initial load: HTML, nav, hero text and critical fonts. Heavy modules (three, gsap, post-processing)
  are dynamic imports loaded after first paint or on approach.
- Hero text must be readable without waiting for WebGL. Anything that blocks the page on the scene
  has to justify itself with measurements.
- Images: explicit width/height, responsive `sizes`, lazy below the fold. Prefer AVIF/WebP.
- Unreferenced files in `public/` still bloat the repo; delete assets for cut projects.
- Check Lighthouse (LCP, CLS, INP) and the JS chunk sizes after any motion or asset change.
- No shader may compile mid-scroll. three builds one variant per material for each render target and
  each set of visible lights, so `scene.ts` precompiles every state the page shows (`compileFor`:
  desk, dark, wall, wall+holo). Toggling a light's `visible`, adding a light, or drawing to a new
  target adds a state: add it there. Frames are held (`ready`) until the desk's set has compiled.
- Shadow maps are static (`shadowMap.autoUpdate = false`); `frame()` redraws them only when a caster
  moves or shows/hides. Anything new that moves on its own must report it (via `deskSet.update`'s
  return value) or its shadow will freeze.
- Desktop quality steps down (no composer/AO, pixel ratio 1) if the first ~2s after the reveal run under
  50 fps; `data-snap` always gets full quality.
- Background work goes through `idleQueue` / `afterOpening`; never re-request an idle callback with a
  fresh timeout (the hero's loop keeps idle slots short and the job starves).

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
