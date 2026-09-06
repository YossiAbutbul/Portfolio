# Yossi Abutbul portfolio

> _I write software that makes hardware testable._

Personal site. Cold graphite ground, terminal phosphor amber, one theme.
Built because a resume never quite explains what I do.

**Live** → <https://yossiabutbul.vercel.app/>

---

## What's inside

- A hero that resolves out of a hex dump and doubles as the project index
- Six projects: instruments talking to software, tools I needed, coursework that stuck
- Case studies with the whole screenshot set, not just the cover
- A left rail that carries offsets, section markers and reading position in one object
- Type that emphasises by width rather than by colour

Everything respects `prefers-reduced-motion`, and nothing rests at `opacity: 0`.

---

## Built with

Next.js 16 · React 19 · TypeScript · CSS Modules · GSAP + Lenis · Archivo (variable) · Newsreader

Static export, deployed on Vercel.

---

## Local

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export to out/
npm run serve      # serve the export
```

## Where things live

| Path | What |
| --- | --- |
| `content/projects.ts` | Project data, one object each |
| `content/case-copy.ts` | Draft problem and outcome copy, waiting to be rewritten |
| `content/copy.ts` | Every sentence the site says in its own voice |
| `content/experience.ts` | Work, degree, service |
| `src/styles/tokens.css` | Palette, type scale, spacing, motion constants |
| `src/components/sections/` | One file per home page section |
| `src/components/layout/` | Header, left rail, skip link |

## Design direction

See [design/direction.md](design/direction.md).
