import type { Project } from "@/types/project";

/**
 * Featured slugs, in display order.
 *
 * The order is an argument, not a ranking by recency: the flagship first, the
 * personal one second so the range shows immediately, and the one that needs
 * no instrument last.
 */
export const FEATURED_SLUGS = [
  "test-console",
  "oplanner",
  "pipeline-cpu",
  "current-logger",
  "algorithmx",
  "toast-turn",
] as const;

export const PROJECTS: Project[] = [
  {
    slug: "test-console",
    title: "Test Console",
    summary:
      "Five instruments, one browser tab. BLE-driven power-amplifier testing, load pull, and RF sweeps that used to be three days of manual bench work.",
    friction:
      "Qualifying one unit meant driving five instruments by hand, transcribing readings between them, and losing most of a week.",
    metric: { before: "3 days", after: "~8 min" },
    tags: ["hardware", "software"],
    year: 2026,
    role: "Solo - architecture, backend, frontend",
    stack: ["React 19", "TypeScript", "MUI", "TanStack Query", "FastAPI", "PyVISA", "BLE"],
    links: [{ label: "GitHub", href: "https://github.com/YossiAbutbul/test-console" }],
    featured: true,
    overview: [
      "A test rig that runs itself. The console connects to the device under test over BLE, drives a DC power analyzer, a network analyzer, a spectrum analyzer, a Mini-Circuits power sensor, an Arcus trombone motor and an Arduino RF switch, and walks a full power-amplifier characterisation without anyone standing at the bench writing numbers down.",
      "FastAPI on the instrument side, React on the operator side. Every instrument is a wrapper behind one API, so a test sequence reads like a procedure rather than a pile of VISA calls. A preflight dialog checks the whole chain before a run starts, because discovering a missing driver an hour into a sweep is how afternoons disappear.",
    ],
    highlights: [
      "Six devices driven in parallel over VISA, BLE, USB and serial",
      "Load-pull test with motorised RF trombone positioning",
      "Preflight check across drivers, VISA layer and instrument discovery",
      "Path-loss compensation applied per measurement, not after the fact",
      "Live progress and per-step logs while a sweep runs",
      "LoRa and LTE device paths behind one operator interface",
    ],
  },
  {
    slug: "oplanner",
    title: "OPlanner",
    summary:
      "A semester that builds itself from the calendar file the university already gives you. Courses, deadlines and exams in about thirty seconds.",
    friction:
      "My own semester lived across a portal, three spreadsheets and a notes app, and nothing agreed with anything else.",
    metric: { before: "6 tabs", after: "1 dashboard" },
    tags: ["software"],
    year: 2023,
    role: "Solo",
    stack: ["React", "TypeScript", "Vite", "Firebase Auth", "Firestore"],
    links: [
      { label: "Live", href: "https://oplanner-one.vercel.app/" },
      { label: "GitHub", href: "https://github.com/YossiAbutbul/OPlanner" },
    ],
    featured: true,
    overview: [
      "Student planner built around the way a semester actually arrives: as an .ics export nobody reads. Drop the file in and the term populates itself - courses, due dates, exams - instead of being retyped by hand into yet another tool.",
      "Tracks completion and overdue state across the whole term, then lets you drill into one course without the noise of the rest of it. Re-importing updates tasks in place rather than duplicating them, which is the difference between a planner you keep using and one you abandon in week three.",
    ],
    highlights: [
      "One-click .ics import, no manual course entry",
      "Semester dashboard: completed, remaining, overdue, total progress",
      "Per-course focused view with an isolated task list",
      "Re-import updates existing tasks in place, no duplicates",
      "Cloud sync across devices via Firebase",
      "Mobile-first layout tuned to feel native",
    ],
  },
  {
    slug: "report-generator",
    title: "RF Report Generator",
    summary:
      "Chamber measurements in, a finished Word report out. 2D polar plots and a 3D radiation surface you can turn, so pattern defects are visible instead of inferred.",
    friction:
      "Every antenna measurement ended the same way: half a day rebuilding the same document by hand from the same spreadsheet.",
    metric: { before: "half a day", after: "minutes" },
    tags: ["software", "hardware"],
    year: 2024,
    role: "Architecture, frontend, API, device integration",
    stack: ["React", "TypeScript", "Three.js", "Python", "FastAPI", "Plotly"],
    links: [
      { label: "Live", href: "https://yossiabutbul.github.io/ReportGenrator/" },
      { label: "GitHub", href: "https://github.com/YossiAbutbul/ReportGenrator" },
    ],
    overview: [
      "Full-stack workspace that turns raw chamber measurements into structured reports. Engineers upload Excel workbooks or Howland WTL exports, scrub through 2D polar plots and a 3D radiation surface, then export a finished A4 document with the graphs and metadata already in place.",
      "The 3D viewer is custom WebGL: spherical wireframe overlay, orbit controls, vertex-coloured heatmap. It exists because a table of numbers hides a pattern defect that a surface shows in a second.",
    ],
    highlights: [
      "3D radiation-pattern viewer with vertex-coloured heatmap and orbit controls",
      "2D polar plots for azimuth and elevation with spline interpolation",
      "Total Radiated Power calculated live, in watts",
      "A4 document viewer with direct Word export",
      "Multi-format input: Excel workbooks and Howland WTL text exports",
      "Searchable metadata grid: filter by unit, ID, frequency",
    ],
  },
  {
    slug: "pipeline-cpu",
    title: "Pipeline CPU Simulator",
    summary:
      "Step through a five-stage pipeline one cycle at a time, with hazards, forwarding and stall bubbles drawn onto the diagram as they happen.",
    friction:
      "Architecture lectures draw the pipeline as one static diagram, and everything that is actually hard about it happens between the cycles that diagram never shows.",
    metric: { before: "a diagram", after: "every cycle" },
    tags: ["software"],
    year: 2024,
    role: "Solo",
    stack: ["React", "TypeScript", "Vite"],
    links: [
      { label: "Live", href: "https://yossiabutbul.github.io/Pipeline_CPU/" },
      { label: "GitHub", href: "https://github.com/YossiAbutbul/Pipeline_CPU" },
    ],
    featured: true,
    overview: [
      "Educational simulator that makes the classic five-stage pipeline tangible. Advance one cycle at a time and watch instructions flow through fetch, decode, execute, memory and writeback, with data, structural and control hazards marked on the diagram at the moment they occur.",
      "The pipeline state is fully observable: every register, every forwarding bypass and every stall bubble is visible at every cycle, so you can stop anywhere and read off exactly what the hardware is doing rather than reconstructing it from a lecture slide.",
    ],
    highlights: [
      "Cycle-accurate view of a five-stage MIPS-style pipeline",
      "Step forward, pause and inspect any cycle",
      "Data, structural and control hazards marked as they arise",
      "Forwarding paths and stall bubbles drawn onto the diagram",
      "Register file and memory state updated live each cycle",
      "Loadable instruction sequences for the classic teaching examples",
    ],
  },
  {
    slug: "current-logger",
    title: "Current Logger",
    summary:
      "How long does the battery really last? Arms on a current-level trigger, captures every transmit burst, and stops itself once the peak has dropped 3 dB.",
    friction:
      "Product lifetime was an estimate nobody could show you, because measuring it meant watching an instrument for two days.",
    metric: { before: "estimated", after: "measured" },
    tags: ["hardware", "software"],
    year: 2026,
    role: "Solo",
    stack: ["Python", "Keysight N6781A", "R&S FSC3", "SCPI", "WebSocket", "Canvas"],
    links: [{ label: "GitHub", href: "https://github.com/YossiAbutbul/current-logger" }],
    featured: true,
    overview: [
      "A battery- or HLC-powered unit transmits on a fixed interval, and the question is how many of those transmits it has left. The logger arms on a current-level trigger so it never has to predict when a burst happens - it waits, captures, records the peak, and repeats until the peak has fallen a configured amount below the first capture.",
      "Every capture is written as its own CSV inside a run folder that is never overwritten, and the browser viewer plays back a finished run as easily as it watches a live one. Two tests share the same shape: transmit current on a Keysight N6781A, and transmit power on an R&S FSC3 over SCPI.",
    ],
    highlights: [
      "Current-level trigger: no prediction of when the device transmits",
      "Stop condition in dB below the reference capture, configurable",
      "Live view and saved-run browser over the same WebSocket API",
      "Every run folder immutable: config, summary, result, per-capture CSV",
      "General-purpose instrument panel with markers, RBW/VBW and an SCPI console",
      "Subnet and ARP scanners for finding an analyzer that will not announce itself",
    ],
  },
  {
    slug: "algorithmx",
    title: "AlgorithmX",
    summary:
      "Nine graph algorithms, one step at a time. Feed Dijkstra a negative edge and watch it lock in the wrong answer instead of being told that it would.",
    friction:
      "I was learning graph algorithms from lecture slides where the interesting part - the order things happen in - is exactly what a static diagram cannot show.",
    metric: { before: "memorised", after: "watched" },
    tags: ["software"],
    year: 2026,
    role: "Solo",
    stack: ["TypeScript", "React", "Vite", "Cloudflare Workers"],
    links: [
      { label: "Live", href: "https://algorithmx.abyossi22.workers.dev/" },
      { label: "GitHub", href: "https://github.com/YossiAbutbul/AlgorithmX" },
    ],
    featured: true,
    overview: [
      "An interactive Hebrew learning site that turns graph algorithms from something you memorise into something you watch happen. Every step colours the node and the edge that changed and says in one sentence what just happened and why. Step forward, step back, or drag along a timeline where each mark is coloured by what the algorithm did there.",
      "The data structures fill up alongside the graph - queue, stack, priority queue, distance array, Union-Find groups, flow table - and two algorithms can run side by side on the same graph, which is the fastest way to see why Dijkstra and Bellman-Ford disagree. Every algorithm is a pure function returning the full list of steps, so nothing is animated by hand and what you watch is what actually ran.",
    ],
    highlights: [
      "Nine algorithms: BFS, DFS, Dijkstra, Bellman-Ford, Floyd-Warshall, Prim, Kruskal, Ford-Fulkerson, Edmonds-Karp",
      "Step timeline coloured by event type, draggable through time",
      "Four prepared comparisons, each teaching one specific difference",
      "Warns when an algorithm is the wrong tool, then runs it anyway if you insist",
      "Build, save and share your own graphs",
      "Pitfalls, exam tips and practice questions per algorithm",
    ],
  },
  {
    slug: "toast-turn",
    title: "ToastTurn",
    summary:
      "Whose turn is it to make toast? The answer fills the screen. Pull the toaster lever to log a turn and every phone in the house agrees within a second.",
    friction:
      "Not every problem needs an instrument. This one needed a family to stop arguing in the kitchen.",
    metric: { before: "an argument", after: "one screen" },
    tags: ["software"],
    year: 2026,
    role: "Solo",
    stack: ["React 19", "TypeScript", "Vite", "Firestore", "PWA"],
    links: [
      { label: "Live", href: "https://toast-turn.vercel.app" },
      { label: "GitHub", href: "https://github.com/YossiAbutbul/ToastTurn" },
    ],
    featured: true,
    images: [
      {
        src: "/projects/toast-turn/cover.png",
        alt: "ToastTurn on three phones: the orders sheet, the home screen with the toaster, and the turn history",
        width: 1920,
        height: 1080,
      },
      {
        src: "/projects/toast-turn/home.png",
        alt: "Home screen: this week it's Yossi, with the toaster lever and the queue along the bottom",
        width: 780,
        height: 1688,
      },
      {
        src: "/projects/toast-turn/turns.png",
        alt: "Every turn: turns per person this month with star ratings",
        width: 780,
        height: 1688,
      },
    ],
    overview: [
      "A single-question app. Open it and the name is already on screen: no tapping, no scrolling, no login. The toaster is the button - drag the lever past two thirds and the slice drops, browns, and pops back up with the next person's initial on it. Keyboard works the same way, and whoever is standing there can log the turn regardless of whose credit it is.",
      "No router, no component library, one hand-drawn SVG toaster. Firestore backs cross-phone sync but the keys are optional: with none set it runs entirely local and offline, and a turn logged in the kitchen dead-spot uploads the moment signal returns.",
    ],
    highlights: [
      "Drag-to-log toaster lever with a full toast cycle, keyboard-operable",
      "Per-person orders: bread, toppings and a note per slice",
      "Month calendar and full turn log with per-person counts",
      "Join by link, tap your name, no sign-up",
      "Offline-first PWA with queued writes",
      "Runs with no backend at all if you never set the keys",
    ],
  },

  /* ---------------------------------------------------------------------
     Not featured. Real work, but each makes the same point as something
     above and makes it less well.
     --------------------------------------------------------------------- */
  {
    slug: "haparlamentor",
    title: "Haparlamentor",
    summary:
      "Type a line from the Israeli sitcom הפרלמנט and jump to the episode and timestamp it came from. The transcripts were built by scraping and Whisper, not by hand.",
    tags: ["software"],
    year: 2026,
    role: "Solo",
    stack: ["Next.js 15", "TypeScript", "Tailwind v4", "Fuse.js", "Whisper"],
    wip: true,
    noCase: true,
    links: [
      { label: "Live", href: "https://yossiabutbul.github.io/Haparlamentor/" },
      { label: "GitHub", href: "https://github.com/YossiAbutbul/Haparlamentor" },
    ],
  },
  {
    slug: "lora-viz",
    title: "LoRa Gateway Log Visualizer",
    summary:
      "Drop a gateway log in and get RSSI, SNR and frequency over time. Everything parses in the browser, which matters when the log is production traffic on a customer site.",
    tags: ["hardware", "software"],
    year: 2026,
    role: "Solo",
    stack: ["JavaScript", "Chart.js", "Log parser"],
    noCase: true,
    links: [
      { label: "Live", href: "https://yossiabutbul.github.io/lora-gateway-log-visualizer/" },
      { label: "GitHub", href: "https://github.com/YossiAbutbul/lora-gateway-log-visualizer" },
    ],
  },
  {
    slug: "rf-instrument-wrappers",
    title: "RF Instrument Wrappers",
    summary:
      "Python wrappers for Mini-Circuits power sensors, programmable attenuators, the Agilent E5061B and the DMX-J-SA motor. The layer everything else here is built on.",
    tags: ["hardware"],
    year: 2026,
    role: "Solo",
    stack: ["Python", "pythonnet", ".NET DLL", "VISA"],
    wip: true,
    noCase: true,
    links: [
      { label: "GitHub", href: "https://github.com/YossiAbutbul/rf-instrument-wrappers" },
    ],
  },
  {
    slug: "two-pass-assembler",
    title: "Two-Pass Assembler",
    summary:
      "ANSI C90 assembler: symbol table on the first pass, instruction parsing and base-4 machine code on the second.",
    tags: ["embedded"],
    year: 2023,
    role: "Coursework",
    stack: ["C"],
    noCase: true,
    links: [{ label: "GitHub", href: "https://github.com/YossiAbutbul/Assembler" }],
  },
];

export const FEATURED_PROJECTS: Project[] = FEATURED_SLUGS
  .map((slug) => PROJECTS.find((p) => p.slug === slug))
  .filter((p): p is Project => Boolean(p));

/** Everything worth linking but not worth a case study. */
export const OTHER_PROJECTS: Project[] = PROJECTS.filter(
  (p) => !(FEATURED_SLUGS as readonly string[]).includes(p.slug),
);

export function getProjectBySlug(slug: string): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
  return PROJECTS.filter((p) => !p.noCase).map((p) => p.slug);
}
