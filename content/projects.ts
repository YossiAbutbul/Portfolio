import type { Project } from "@/types/project";

export const PROJECTS: Project[] = [
  {
    slug: "report-generator",
    title: "RF Report Generator",
    summary:
      "Full-stack RF test-automation platform. Captures measurements, and generates structured reports with 3D analysis. Cut lab reporting time by 50%+.",
    tags: ["software", "hardware", "embedded"],
    year: 2024,
    role: "architecture, frontend, API, device integration",
    stack: ["React", "TypeScript", "Python", "FastAPI", "Plotly"],
    links: [
      { label: "GitHub", href: "https://github.com/YossiAbutbul/ReportGenrator" },
      { label: "Live Demo", href: "https://yossiabutbul.github.io/ReportGenrator/" },
    ],
    images: [
      {
        src: "/projects/report-generator/01-setup.png",
        alt: "RF Report Generator — setup and data table",
        width: 1600,
        height: 935,
      },
      {
        src: "/projects/report-generator/02-report.png",
        alt: "RF Report Generator — report preview and export",
        width: 1600,
        height: 935,
      },
      {
        src: "/projects/report-generator/03-3d-graph.png",
        alt: "RF Report Generator — 3D radiation surface",
        width: 1600,
        height: 935,
      },
      {
        src: "/projects/report-generator/04-2d-graph.png",
        alt: "RF Report Generator — 2D polar plots",
        width: 1600,
        height: 935,
      },
    ],
    featured: true,
  },
  {
    slug: "pipeline-cpu",
    title: "Pipeline CPU Simulator",
    summary:
      "Educational CPU pipeline visualizer. Step through instructions, watch hazards, forward, and stall. Built to make classic computer-architecture lectures concrete.",
    tags: ["software"],
    year: 2024,
    role: "Solo",
    stack: ["React", "TypeScript", "Vite"],
    wip: true,
    links: [
      { label: "GitHub", href: "https://github.com/YossiAbutbul/Pipeline_CPU" },
      { label: "Live Demo", href: "https://yossiabutbul.github.io/Pipeline_CPU/" },
    ],
    images: [
      {
        src: "/projects/pipeline-cpu/01-Pipeline-CPU-Diagram.png",
        alt: "Pipeline CPU simulator — pipeline diagram",
        width: 1919,
        height: 1079,
      },
    ],
    featured: true,
  },
  {
    slug: "two-pass-assembler",
    title: "Two-Pass Assembler",
    summary:
      "ANSI C90 compiler-like assembler. Two-stage: symbol-table build, then instruction parsing and base-4 machine-code emission. Built for the Systems Programming Laboratory course.",
    tags: ["software", "embedded"],
    year: 2023,
    role: "coursework",
    stack: ["C (ANSI C90)", "Make", "GDB"],
    links: [{ label: "GitHub", href: "https://github.com/YossiAbutbul/Assembler" }],
    images: [
      {
        src: "/projects/two-pass-assembler/01-assembler.svg",
        alt: "Two-Pass Assembler — source, symbol table, and base-4 machine code output",
        width: 1919,
        height: 1079,
      },
    ],
    featured: true,
  },
  {
    slug: "oplanner",
    title: "OPlanner",
    summary:
      "Full-stack semester + task planner built around student workflows. Reusable React components, Firebase-backed state, responsive progress-visualization dashboards.",
    tags: ["software"],
    year: 2023,
    role: "Solo",
    stack: ["React", "TypeScript", "Firebase"],
    links: [{ label: "Private repo — case study", href: "#contact" }],
    images: [
      {
        src: "/projects/oplanner/01-OPlanner.png",
        alt: "OPlanner — semester and task planner dashboard",
        width: 1919,
        height: 1079,
      },
    ],
    featured: true,
  },
  {
    slug: "mini-circuits-power-sensor",
    title: "Mini-Circuits Power Sensor Wrapper",
    summary:
      "Python wrapper around a USB power sensor, bridging vendor .NET DLLs into a clean Pythonic API for lab automation scripts.",
    tags: ["hardware", "software"],
    year: 2024,
    role: "Solo",
    stack: ["Python", ".NET DLL interop", "USB"],
    links: [
      {
        label: "GitHub",
        href: "https://github.com/YossiAbutbul/Mini-Circuits-Power-Sensor",
      },
    ],
    images: [
      {
        src: "/projects/mini-circuits/01-power-sensor.svg",
        alt: "Mini-Circuits power sensor — Python API, power vs time plot, terminal output",
        width: 1919,
        height: 1079,
      },
    ],
    featured: true,
  },
];

export const FEATURED_PROJECTS = PROJECTS.filter((p) => p.featured);

export function getProjectBySlug(slug: string): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
  return PROJECTS.map((p) => p.slug);
}
