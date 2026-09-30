const PROJECTS = [
  {
    slug: "test-console", title: "Test Console", year: 2026, role: "Solo: architecture, backend, frontend",
    summary: "Automates power-amplifier tests, load pull, and RF sweeps. Reduced a three-day manual qualification procedure to about eight minutes.",
    friction: "Qualifying one unit meant driving five instruments by hand, transcribing readings between them, and losing most of a week.",
    metric: ["3 days", "~8 min"],
    stack: ["React", "TypeScript", "FastAPI", "Python", "TanStack Query", "BLE"],
    shipped: "Code on GitHub; runs against the bench rig",
    link: "https://github.com/YossiAbutbul/test-console",
    wire: "console",
  },
  {
    slug: "oplanner", title: "OPlanner", year: 2023, role: "Solo",
    summary: "A student planner I built to import my university calendar and keep track of courses, deadlines, and exams.",
    friction: "My own semester lived across a portal, three spreadsheets and a notes app, and nothing agreed with anything else.",
    metric: ["6 tabs", "1 dashboard"],
    stack: ["React", "TypeScript", "Vite", "Firebase"],
    shipped: "Live",
    link: "https://oplanner-one.vercel.app/",
    wire: "dashboard",
  },
  {
    slug: "pipeline-cpu", title: "Pipeline CPU Simulator", year: 2024, role: "Solo",
    summary: "Step through a five-stage pipeline one cycle at a time, with hazards, forwarding and stall bubbles drawn onto the diagram as they happen.",
    friction: "Lectures draw the pipeline as one static diagram, and everything hard about it happens between the cycles that diagram never shows.",
    metric: ["a diagram", "every cycle"],
    stack: ["React", "TypeScript", "Vite"],
    shipped: "Live",
    link: "https://yossiabutbul.github.io/Pipeline_CPU/",
    wire: "diagram",
  },
  {
    slug: "current-logger", title: "Current Logger", year: 2026, role: "Solo",
    summary: "Records transmit bursts during battery tests. Triggers on current level and stops when the peak drops by a configured amount.",
    friction: "Product lifetime was an estimate nobody could show you, because measuring it meant watching an instrument for two days.",
    metric: ["estimated", "measured"],
    stack: ["Python", "WebSocket", "Canvas", "SCPI"],
    shipped: "Code on GitHub",
    link: "https://github.com/YossiAbutbul/current-logger",
    wire: "panel",
  },
  {
    slug: "algorithmx", title: "AlgorithmX", year: 2026, role: "Solo",
    summary: "A Hebrew learning tool for nine graph algorithms, with step-by-step playback, visible data structures, and side-by-side comparisons.",
    friction: "Lecture slides can't show the one thing that matters in a graph algorithm: the order things happen in.",
    metric: ["memorised", "watched"],
    stack: ["React", "TypeScript", "Vite", "Cloudflare Workers"],
    shipped: "Live",
    link: "https://algorithmx.abyossi22.workers.dev/",
    wire: "graph",
  },
  {
    slug: "toast-turn", title: "ToastTurn", year: 2026, role: "Solo",
    summary: "A small app for keeping track of whose turn it is to make toast at home. Logs turns and syncs them across the family's phones.",
    friction: "We needed a shared record of whose turn it was to make toast.",
    metric: ["an argument", "one screen"],
    stack: ["React", "TypeScript", "Vite", "Firebase", "PWA"],
    shipped: "Live",
    link: "https://toast-turn.vercel.app",
    wire: "phones",
  },
];

const ALSO = [
  ["Haparlamentor", "Search a line from the sitcom and jump to the episode and timestamp. Transcripts built with scraping and Whisper."],
  ["LoRa Log Visualizer", "RSSI, SNR and frequency over time from a gateway log, parsed entirely in the browser."],
  ["RF Report Generator", "Word reports from antenna measurements, with a 3D radiation-pattern viewer."],
  ["Two-Pass Assembler", "ANSI C90 assembler with a symbol table and base-4 machine code."],
];

const BACKGROUND = [
  ["2020 to present", "RF & Electronics Integrator", "Smart metering industry", "Bring-up and qualification of RF hardware, and the test software around it."],
  ["2022 to present", "BSc Computer Science", "The Open University", "Currently writing a seminar: Creating User Interfaces Using LLMs, From Specification to Code."],
  ["2017 to 2019", "Operational Project Leader", "IDF Intelligence, Unit 81", "Ran RF projects end to end and wrote the Python tooling for spectrum analyzer data collection."],
];

const SEMINAR = {
  title: "Creating User Interfaces Using LLMs: From Specification to Code",
  meta: "Seminar · The Open University · In progress",
  body: "How language models turn a written spec into a working interface, where they get it wrong, and how much the wording of the spec changes what comes out.",
};

const EMAIL = "abyossi22@gmail.com";

function stackIndex() {
  const map = new Map();
  for (const p of PROJECTS) for (const s of p.stack) {
    if (!map.has(s)) map.set(s, []);
    map.get(s).push(p.slug);
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }

function copyEmail(button) {
  const done = () => { const t = button.textContent; button.textContent = "Copied"; setTimeout(() => (button.textContent = t), 1400); };
  try { navigator.clipboard.writeText(EMAIL).then(done, () => selectEmail()); } catch { selectEmail(); }
}
function selectEmail() {
  const el = document.querySelector("[data-email]");
  if (!el) return;
  const r = document.createRange(); r.selectNodeContents(el);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
