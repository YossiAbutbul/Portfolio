import type { Project } from "@/types/project";

/** Featured slugs, in display order on the showcase. */
export const FEATURED_SLUGS = [
  "oplanner",
  "report-generator",
  "haparlamentor",
  "lora-viz",
  "pipeline-cpu",
  "trump-jump",
  "toast-turn",
] as const;

export const PROJECTS: Project[] = [
  {
    slug: "rf-instrument-wrappers",
    title: "RF Instrument Wrappers",
    summary:
      "Python wrappers for Mini-Circuits USB power sensors and Agilent E5061B ENA. FastAPI servers expose instruments to n8n workflows. Live Smith chart viewer for S-parameter sweeps.",
    tags: ["hardware", "software"],
    year: 2026,
    role: "Solo",
    stack: ["Python", "FastAPI", "pythonnet", ".NET DLL", "n8n", "Smith chart"],
    wip: true,
    noCase: true,
    frequency: 1000,
    amplitude: 9,
    band: "L-band",
    links: [
      { label: "GitHub", href: "https://github.com/YossiAbutbul/rf-instrument-wrappers" },
    ],
  },
  {
    slug: "toast-turn",
    title: "ToastTurn",
    summary:
      "Whose turn is it to make toast? The answer fills the screen: no taps, no login. Pull the toaster lever to log a turn; every phone in the family syncs within a second.",
    tags: ["software"],
    year: 2026,
    role: "Solo",
    stack: ["React 19", "TypeScript", "Vite", "Firestore", "PWA", "Vercel"],
    frequency: 315,
    amplitude: 9,
    band: "ISM 315 MHz",
    links: [
      { label: "GitHub", href: "https://github.com/YossiAbutbul/ToastTurn" },
      { label: "Live Demo", href: "https://toast-turn.vercel.app" },
    ],
    // Drop demo.webm into public/projects/toast-turn/ and uncomment; the images
    // below stay as the poster frame and as the fallback wherever video is absent.
    // video: "/projects/toast-turn/demo.webm",
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
        src: "/projects/toast-turn/logged.png",
        alt: "After the lever is pulled, Yossi's turn is logged and Alon is up next",
        width: 780,
        height: 1688,
      },
      {
        src: "/projects/toast-turn/orders.png",
        alt: "Orders sheet: bread type and toppings picked per person",
        width: 780,
        height: 1688,
      },
      {
        src: "/projects/toast-turn/turns.png",
        alt: "Every turn: turns per person this month with star ratings",
        width: 780,
        height: 1688,
      },
      {
        src: "/projects/toast-turn/history.png",
        alt: "Month calendar with a badge on every day toast was made",
        width: 780,
        height: 1688,
      },
      {
        src: "/projects/toast-turn/share.png",
        alt: "Settings: the family code and the invite link to share",
        width: 780,
        height: 1688,
      },
    ],
    featured: true,
    overview: [
      "A single-question app: whose turn is it to make toast this week? Open it and the name is already on screen: no tapping, no scrolling, no login. The toaster itself is the button: drag the lever past two thirds and the slice drops, browns, and pops back up with the next person's initial on it. Keyboard works the same way, and whoever is standing there can log the turn regardless of whose credit it is.",
      "React 19 + TypeScript on Vite, plain CSS custom properties, no router and no component library. The toaster is one hand-drawn inline SVG. Firestore backs cross-phone sync, but the keys are optional: with none set the app runs entirely local and offline. Installed to the home screen it opens as a real PWA, and a turn logged in the kitchen dead-spot uploads the moment signal returns.",
    ],
    highlights: [
      "Drag-to-log toaster lever with a full toast cycle animation, keyboard-operable",
      "Per-person orders: up to three slices, each with its own bread, toppings, and note",
      "Month calendar plus every-turn log with 1–5 star ratings and per-person counts",
      "Join by link: tap your name, no sign-up; only the rotation owner needs an account",
      "Offline-first PWA: local-only without Firebase keys, queued writes sync on reconnect",
      "Holiday mode, hand-reorderable queue, and multiple rotations on one phone",
    ],
  },
  {
    slug: "trump-jump",
    title: "Trump Jump: Strait of Hormuz",
    summary:
      "Browser-based vertical arcade climber. Bounce up moving platforms, stomp drones, dodge missiles, grab power-ups. Firebase cloud saves, global leaderboard, shop economy.",
    tags: ["software"],
    year: 2026,
    role: "Solo",
    stack: ["JavaScript", "HTML5 Canvas", "Firebase", "Firestore", "Vercel"],
    frequency: 5800,
    amplitude: 10,
    band: "C-band",
    links: [
      { label: "GitHub", href: "https://github.com/YossiAbutbul/TrumpJump-Hormuz" },
      { label: "Live Demo", href: "https://trump-jump-hormuz.vercel.app" },
    ],
    video: "/projects/trump-jump/demo.webm",
    featured: true,
    overview: [
      "Browser-based vertical arcade climber: bounce upward through an endless stack of moving platforms while difficulty scales with altitude. Tap left/right (touch, arrow keys, or A/D) to steer; land on oil tankers and speedboats, stomp drones, and dodge incoming missiles. Loads instantly in the browser, no install.",
      "Built in vanilla JavaScript on an HTML5 canvas, deployed on Vercel, with Firebase Firestore backing cloud saves and a global leaderboard. Google sign-in syncs progress across devices; a shop economy unlocks character skins, fleet themes, and map variations, plus an eight-level power-up upgrade track.",
    ],
    highlights: [
      "Endless vertical climber with altitude-scaled difficulty",
      "Hazard system: stompable drones and dodgeable missiles",
      "Power-ups: Jet Cap flight, mega-bounce springs, Golden Dome shield, money magnet",
      "Firebase cloud saves via Google sign-in + global leaderboard",
      "Shop economy: character skins, fleet themes, map variations",
      "Eight-level power-up upgrade track and secret friend-code unlocks",
    ],
  },
  {
    slug: "report-generator",
    title: "RF Report Generator",
    summary:
      "Full-stack RF test-automation platform. Captures measurements over Bluetooth, builds structured reports with 2D polar & 3D radiation surfaces. Cut lab reporting time 50%+.",
    tags: ["software", "hardware"],
    year: 2024,
    role: "Architecture, frontend, API, device integration",
    stack: ["React", "TypeScript", "Three.js", "Python", "FastAPI", "Plotly"],
    frequency: 2450,
    amplitude: 10,
    band: "ISM 2.4 GHz",
    links: [
      { label: "GitHub", href: "https://github.com/YossiAbutbul/ReportGenrator" },
      { label: "Live Demo", href: "https://yossiabutbul.github.io/ReportGenrator/" },
    ],
    video: "/projects/report-generator/demo.webm",
    featured: true,
    overview: [
      "Full-stack RF test-automation workspace that turns raw chamber measurements into structured Word reports. Engineers upload Excel workbooks or Howland WTL text exports, scrub through 2D polar plots and 3D radiation surfaces, then export a polished A4 document with embedded graphs and metadata. Work that used to take half a day now takes minutes.",
      "The frontend is a React + Three.js single-page app; the backend is a FastAPI service handling Bluetooth device integration, file parsing, and Word generation. The 3D viewer is custom WebGL with spherical wireframe overlays, orbit controls, and vertex-colored heatmaps so technicians can spot pattern defects at a glance.",
    ],
    highlights: [
      "3D radiation pattern viewer with vertex-colored heatmap and orbit controls",
      "2D polar plots for azimuth and elevation with spline interpolation",
      "Real-time TRP (Total Radiated Power) calculation in watts",
      "A4 document viewer with direct Word export",
      "Multi-format input: Excel workbooks + Howland WTL text exports",
      "Searchable metadata grid: filter by unit, ID, frequency",
    ],
  },
  {
    slug: "haparlamentor",
    title: "Haparlamentor",
    summary:
      "Hebrew phrase-to-episode search for the Israeli sitcom הפרלמנט. CRT-frame UI, fuzzy search across transcripts, deep-links to Mako episode + timestamp.",
    tags: ["software"],
    year: 2026,
    role: "Solo",
    stack: ["Next.js 15", "TypeScript", "Tailwind v4", "Framer Motion", "Fuse.js"],
    wip: true,
    frequency: 433,
    amplitude: 8,
    band: "ISM 433 MHz",
    links: [
      { label: "GitHub", href: "https://github.com/YossiAbutbul/Haparlamentor" },
      { label: "Live Demo", href: "https://yossiabutbul.github.io/Haparlamentor/" },
    ],
    video: "/projects/haparlamentor/demo.webm",
    featured: true,
    overview: [
      "Hebrew phrase-to-episode search for the cult Israeli sitcom הפרלמנט. Type a quote, see which episode and timestamp it came from, and jump straight to that moment on Mako. Built around a fuzzy index over auto-generated transcripts.",
      "The transcript corpus is built by an agent that scrapes episodes from Mako and runs them through OpenAI's Whisper model for Hebrew speech-to-text - turning hours of raw audio into a searchable, timestamp-aligned index without any manual transcription work.",
      
    ],
    highlights: [
      "Automated transcript pipeline: scraper agent + Whisper Hebrew speech-to-text",
      "Fuzzy search across episode transcripts with timestamp deep-links to Mako",
      "CRT-frame UI: scanlines, grain, vignette, phosphor glow",
      "Channel-flip transition system between views",
      "Full RTL Hebrew support (Heebo / Assistant / JetBrains Mono)",
      "Static export via Next.js 15 with GitHub Actions deploy",
    ],
  },
  {
    slug: "lora-viz",
    title: "LoRa Gateway Log Visualizer",
    summary:
      "Drop-in viewer for LoRa gateway logs. Decodes packets, plots RSSI / SNR / frequency over time, highlights duty-cycle and join events.",
    tags: ["hardware", "software"],
    year: 2026,
    role: "Solo",
    stack: ["JavaScript", "Charting", "Log parser"],
    wip: true,
    frequency: 868,
    amplitude: 7,
    band: "LoRa EU868",
    links: [
      { label: "GitHub", href: "https://github.com/YossiAbutbul/lora-gateway-log-visualizer" },
      { label: "Live Demo", href: "https://yossiabutbul.github.io/lora-gateway-log-visualizer/" },
    ],
    video: "/projects/lora-viz/demo.webm",
    featured: true,
    overview: [
      "Browser-only viewer for LoRa gateway logs: drop in a .log or .txt file and get instant statistics, packet decoding, and time-series charts. Nothing leaves the page; parsing and visualization both happen client-side, which matters when you're staring at production traffic on a customer site.",
      "Loads multiple files at once, lets you toggle visibility per file, and remembers human-readable labels assigned to device addresses across sessions. Built as plain HTML + vanilla JS + Chart.js, with no build step, no framework, drop the folder onto a static host and it runs.",
    ],
    highlights: [
      "Multi-file loading with per-file toggle and persistent device labels",
      "Interactive charts: RSSI, SNR, rolling PER, frequency-channel map",
      "Packet inspector with raw payload and frame-counter gap detection",
      "Side-by-side time window comparison with automatic bisection",
      "Per-chart Y-axis pin to stabilize ranges across comparisons",
      "CSV export at both summary and packet level",
    ],
  },
  {
    slug: "pipeline-cpu",
    title: "Pipeline CPU Simulator",
    summary:
      "Educational CPU pipeline visualiser. Step through instructions, watch hazards, forward, and stall. Makes classic computer-architecture lectures concrete.",
    tags: ["software"],
    year: 2024,
    role: "Solo",
    stack: ["React", "TypeScript", "Vite"],
    frequency: 100,
    amplitude: 7,
    band: "Clock 100 MHz",
    links: [
      { label: "GitHub", href: "https://github.com/YossiAbutbul/Pipeline_CPU" },
      { label: "Live Demo", href: "https://yossiabutbul.github.io/Pipeline_CPU/" },
    ],
    video: "/projects/pipeline-cpu/demo.webm",
    featured: true,
    overview: [
      "Educational simulator that makes the classic 5-stage CPU pipeline tangible. Step through instructions one cycle at a time and watch them flow through fetch / decode / execute / memory / writeback, with hazards, forwarding, and stalls drawn directly onto the diagram. Built for computer-architecture students who learned the theory in lecture and need to see it move.",
      "React + TypeScript single-page app, Vite-built and shipped to GitHub Pages. The pipeline state is fully observable: every register, every forwarding bypass, every stall bubble is visible at every cycle, so you can pause on any instruction and read off exactly what the hardware is doing.",
    ],
    highlights: [
      "Cycle-accurate visualization of a 5-stage MIPS-style pipeline",
      "Step-through execution: pause, advance, inspect any cycle",
      "Hazard detection visualized: data, structural, control",
      "Forwarding and stall logic drawn on the pipeline diagram",
      "Register file and memory state live-updated each cycle",
      "Loadable instruction sequences for classic teaching examples",
    ],
  },
  {
    slug: "two-pass-assembler",
    title: "Two-Pass Assembler",
    summary:
      "ANSI C90 assembler. Two-stage: symbol-table build then instruction parsing and base-4 machine-code emission. Built for Systems Programming Lab course.",
    tags: ["embedded"],
    year: 2023,
    role: "Coursework",
    stack: ["C", "Assembler"],
    frequency: 30,
    amplitude: 6,
    band: "Baseband",
    links: [{ label: "GitHub", href: "https://github.com/YossiAbutbul/Assembler" }],
    noCase: true,
  },
  {
    slug: "oplanner",
    title: "OPlanner",
    summary:
      "Semester + task planner built around student workflows. .ics parser, reusable React components, Firestore-backed state, progress-visualisation dashboards.",
    tags: ["software"],
    year: 2023,
    role: "Solo",
    stack: ["React", "TypeScript", "Vite", "Firebase Auth", "Firestore"],
    frequency: 868,
    amplitude: 5,
    band: "n/a",
    links: [
      { label: "GitHub", href: "https://github.com/YossiAbutbul/OPlanner" },
      { label: "Live Demo", href: "https://oplanner-one.vercel.app/" },
    ],
    video: "/projects/oplanner/demo.webm",
    featured: true,
    overview: [
      "Student-focused semester planner that pulls course schedules, assignments, and deadlines from a single source instead of scattered spreadsheets. Drop in an .ics file from the university portal and the semester populates itself: courses, due dates, and exams ready in around 30 seconds.",
      "Tracks completion and overdue state at the semester level, then lets you drill into a single course view without the visual noise of the rest of the term. Cloud-sync via Firebase keeps progress consistent across devices, and the mobile layout was tuned to feel like a native app.",
    ],
    highlights: [
      "One-click .ics import, no manual course entry",
      "Semester dashboard: completed, remaining, overdue, total progress",
      "Per-course focused view with isolated task list",
      "Re-import updates existing tasks in place (no duplicates)",
      "Mobile-first responsive layout with drawer navigation",
      "Customizable color-coding for years, semesters, and courses",
    ],
  },
  {
    slug: "attenuator-wrapper",
    title: "Programmable Attenuator Wrapper",
    summary:
      "Python wrapper around Mini-Circuits programmable attenuators. Clean Pythonic API over vendor .NET DLLs for scripted sweep / fade tests.",
    tags: ["hardware"],
    year: 2026,
    role: "Solo",
    stack: ["Python", "pythonnet", ".NET DLL", "USB"],
    wip: true,
    noCase: true,
    frequency: 6000,
    amplitude: 6,
    band: "C-band",
    links: [
      { label: "GitHub", href: "https://github.com/YossiAbutbul/Mini-Circuits-Programmable-Attenuator-wrapper" },
    ],
  },
  {
    slug: "dmx-motor",
    title: "DMX-J-SA Motor Wrapper",
    summary:
      "Python wrapper for the DMX-J-SA motor controller. Clean API over the vendor interface for scripted motion control in lab automation workflows.",
    tags: ["hardware"],
    year: 2026,
    role: "Solo",
    stack: ["Python", "Serial / USB", "Motion control"],
    wip: true,
    noCase: true,
    frequency: 12,
    amplitude: 5,
    band: "Servo",
    links: [
      { label: "GitHub", href: "https://github.com/YossiAbutbul/DMX-J-SA-Motor-python-interface" },
    ],
  },
];

export const FEATURED_PROJECTS: Project[] = FEATURED_SLUGS
  .map((slug) => PROJECTS.find((p) => p.slug === slug))
  .filter((p): p is Project => Boolean(p));

export function getProjectBySlug(slug: string): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
  return PROJECTS.filter((p) => !p.noCase).map((p) => p.slug);
}

/** Projects to render in the post-showcase bento; excludes featured. */
export const OTHER_PROJECTS: Project[] = PROJECTS.filter(
  (p) => !(FEATURED_SLUGS as readonly string[]).includes(p.slug),
);
