# Direction

Agreed September 2026. Supersedes `portfolio-motion-concept.md`, which proposed
a spectrum-analyser hero that was rejected in favour of something code-first.

## Palette

One theme, dark. Six values, all in `src/styles/tokens.css`.

| Token | Value | Job |
| --- | --- | --- |
| `--graphite` | `#0c1114` | Ground. A cold cast rather than a neutral near-black |
| `--bench` | `#171f23` | Raised surface. Depth comes from a second ground value, not a shadow |
| `--chalk` | `#e9eae4` | Primary text, slightly warm so it does not glare |
| `--pencil` | `#8a9599` | Secondary text |
| `--phosphor` | `#ffb02e` | The accent. Terminal amber |
| `--trace` | `#5fc6d4` | Data only. Never a UI accent |

Contrast against `--graphite`: chalk 15.7:1, phosphor 10.4:1, trace 9.5:1,
pencil 6.2:1. All clear AA for body text.

The previous acid green on near-black was dropped: it is a well-worn
generated-site combination and it came from nowhere in particular.

## Type

Two faces, both variable.

- **Archivo** carries display, navigation, labels and figures. Its width axis
  (62 to 125) is the site's emphasis mechanism, which is why the site has only
  one accent colour: links and headings widen rather than change colour.
- **Newsreader** carries anything read at length.

No monospace. Labels are Archivo at 600 weight with `--track-label` of `0.06em`,
deliberately short of the usual eyebrow treatment. Anything that has to line up
in columns uses `.figures`, which is Archivo with tabular numerals.

## Layout

Left-aligned throughout, on a visible column grid, with one exception: project
media runs full bleed to the right edge. A fixed left rail carries offsets and
section markers, and it is real navigation rather than a decorative scale.

Sections are separated by a change of ground value, not by a rule.

## Motion

Constants are defined once in `tokens.css` and reused.

- `--ease-enter` for arrivals, `--ease-exit` for departures. Anything following
  the pointer uses a 90 ms time constant instead of a curve, so it feels the
  same at 60 and 144 Hz.
- Durations: 120 ms micro, 260 ms short, 380 ms long, 1600 ms for the hero
  entrance and page transitions.
- Staggers: 18 ms per character, 45 ms per word, 60 ms per row, 40 ms per grid
  item.

**Nothing rests at `opacity: 0`.** In the previous build the hero lede was
painted transparent and revealed by a scroll library, which gave it a 5,037 ms
render delay and cost the mobile Lighthouse performance score 23 points on its
own. Sections are visible at rest and animate from a visible position.

## Rules

- No em dashes anywhere, including code comments and commit messages.
- Numbers and markers only where the content is genuinely a sequence: the
  project index and the timeline.
- No arrows appended to links, no middle-dot meta strings, no tracked-out
  eyebrow above every heading.
