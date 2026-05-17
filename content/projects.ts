import type { Project } from "@/types/project";

/** Featured slugs, in display order on the showcase. */
export const FEATURED_SLUGS = [
  "oplanner",
  "report-generator",
  "haparlamentor",
  "lora-viz",
  "pipeline-cpu",
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
    images: [
      { src: "/projects/report-generator/01-setup.png", alt: "RF Report Generator — setup and data table", width: 1600, height: 935 },
      { src: "/projects/report-generator/02-report.png", alt: "RF Report Generator — report preview and export", width: 1600, height: 935 },
      { src: "/projects/report-generator/03-3d-graph.png", alt: "RF Report Generator — 3D radiation surface", width: 1600, height: 935 },
      { src: "/projects/report-generator/04-2d-graph.png", alt: "RF Report Generator — 2D polar plots", width: 1600, height: 935 },
    ],
    video: "/projects/report-generator/demo.webm",
    featured: true,
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
    images: [
      { src: "/projects/haparlamentor/01-haparlamentor.svg", alt: "Haparlamentor — CRT-framed Hebrew search UI", width: 1919, height: 1079 },
    ],
    video: "/projects/haparlamentor/demo.webm",
    featured: true,
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
    images: [
      { src: "/projects/pipeline-cpu/01-Pipeline-CPU-Diagram.png", alt: "Pipeline CPU simulator — pipeline diagram", width: 1919, height: 1079 },
    ],
    video: "/projects/pipeline-cpu/demo.webm",
    featured: true,
  },
  {
    slug: "two-pass-assembler",
    title: "Two-Pass Assembler",
    summary:
      "ANSI C90 assembler. Two-stage: symbol-table build then instruction parsing and base-4 machine-code emission. Built for Systems Programming Lab.",
    tags: ["embedded"],
    year: 2023,
    role: "Coursework",
    stack: ["C (ANSI C90)", "Make", "GDB"],
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
    stack: ["React", "TypeScript", "Vite", "Firebase Auth + Firestore"],
    frequency: 868,
    amplitude: 5,
    band: "—",
    links: [
      { label: "GitHub", href: "https://github.com/YossiAbutbul/OPlanner" },
      { label: "Live Demo", href: "https://oplanner-one.vercel.app/" },
    ],
    video: "/projects/oplanner/demo.webm",
    featured: true,
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
    slug: "mini-circuits-power-sensor",
    title: "Mini-Circuits Power Sensor Wrapper",
    summary:
      "Python wrapper around a USB power sensor, bridging vendor .NET DLLs into a clean Pythonic API for lab automation scripts.",
    tags: ["hardware"],
    year: 2024,
    role: "Solo",
    stack: ["Python", ".NET DLL interop", "USB"],
    frequency: 8000,
    amplitude: 6,
    band: "X-band",
    links: [
      { label: "GitHub", href: "https://github.com/YossiAbutbul/Mini-Circuits-Power-Sensor" },
    ],
    noCase: true,
  },
  {
    slug: "dmx-motor",
    title: "DMX-J-SA Antenna Positioner",
    summary:
      "Python interface to the DMX-J-SA antenna positioner motor. Scriptable azimuth / elevation sweeps for chamber measurements.",
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

/** Projects to render in the post-showcase bento — excludes featured. */
export const OTHER_PROJECTS: Project[] = PROJECTS.filter(
  (p) => !(FEATURED_SLUGS as readonly string[]).includes(p.slug),
);
