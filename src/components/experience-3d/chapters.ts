export interface Chapter {
  id: string;
  index: string;
  kicker: string;
  title: string;
  body: string;
  /** Left-lane HTML/code snippet, shown as a typed block. */
  code: string;
  codeLang: "tsx" | "html" | "py" | "c" | "json";
  /** Right-lane "signal" shape used to morph the waveform. */
  signal: {
    label: string;
    freqMHz: number;
    waveform: "sine" | "square" | "pulse" | "noise" | "burst";
  };
  /** Optional CTA. */
  cta?: { label: string; href: string; external?: boolean };
}

export const CHAPTERS: Chapter[] = [
  {
    id: "intro",
    index: "00",
    kicker: "boot · spectrum_view = false",
    title: "Yossi Abutbul",
    body: "Software where signals meet code. Five years building RF test-automation, antenna tooling, and the unglamorous glue that turns lab benches into products.",
    codeLang: "tsx",
    code: `<Engineer
  name="Yossi Abutbul"
  domains={["RF", "automation", "web"]}
  base="Israel"
>
  signals.meet(code);
</Engineer>`,
    signal: { label: "boot", freqMHz: 0.001, waveform: "burst" },
  },
  {
    id: "signal",
    index: "01",
    kicker: "ch.01 / signal_chain",
    title: "Signal Chain",
    body: "Unit 81 → Arad Technologies → Open University CS. Antenna at the front, automation at the back, debug at every stage. Cut a lab's reporting time by 50%+ by writing the tools nobody else wanted to write.",
    codeLang: "py",
    code: `# rf_signal_chain.py
chain = [
    Antenna(unit="IDF-81", year=2017),
    Amplifier(role="RF integrator", at="Arad"),
    Mixer(degree="BSc CS @ Open Uni"),
    Filter(focus="test automation"),
    Output(shipped="RF tooling"),
]
for stage in chain:
    stage.tune()`,
    signal: { label: "chain", freqMHz: 2.4, waveform: "sine" },
  },
  {
    id: "automation",
    index: "02",
    kicker: "ch.02 / automation_layer",
    title: "Automation Layer",
    body: "Python wrappers over vendor .NET DLLs. FastAPI servers exposing instruments to n8n. React + TS frontends so engineers stop fighting Excel. The lab speaks HTTP now.",
    codeLang: "py",
    code: `# rf-instrument-wrappers — exposes Mini-Circuits + Agilent ENA over HTTP
@app.get("/measure/{unit_id}")
async def measure(unit_id: str) -> Measurement:
    sensor = await PowerSensor.attach()
    trace  = await sensor.sweep(start_mhz=400, stop_mhz=6000)
    return Measurement(unit=unit_id, trace=trace, ts=utcnow())`,
    signal: { label: "automation", freqMHz: 868, waveform: "pulse" },
    cta: { label: "GitHub → rf-instrument-wrappers", href: "https://github.com/YossiAbutbul/rf-instrument-wrappers", external: true },
  },
  {
    id: "captures",
    index: "03",
    kicker: "ch.03 / captures",
    title: "Selected Captures",
    body: "Test platforms, antenna viewers, a Hebrew TV phrase-search, an assembler, a CPU pipeline. Each one started because someone needed it.",
    codeLang: "json",
    code: `{
  "captures": [
    { "id": "report-gen",      "stack": ["React","FastAPI","Plotly"], "win": "−50% reporting time" },
    { "id": "graphviewer-2",   "stack": ["JS","Plotly"],              "win": "antenna pattern QC" },
    { "id": "lora-log-viz",    "stack": ["JS"],                       "win": "gateway debug" },
    { "id": "haparlamentor",   "stack": ["Next 15","Fuse.js"],        "win": "phrase → episode" }
  ]
}`,
    signal: { label: "captures", freqMHz: 5800, waveform: "burst" },
  },
  {
    id: "stack",
    index: "04",
    kicker: "ch.04 / stack",
    title: "Stack",
    body: "TypeScript / React on the front. Python / FastAPI on the back. C when the chip insists. Git, GDB, Make. Spectrum analyzers and power sensors when the browser ends.",
    codeLang: "tsx",
    code: `<Stack>
  <Layer name="frontend"  tech={["TS", "React", "Next.js", "Plotly"]} />
  <Layer name="backend"   tech={["Python", "FastAPI", "Firebase"]} />
  <Layer name="systems"   tech={["C90", "Make", "GDB", "xv6"]} />
  <Layer name="rf"        tech={["SA", "Power Sensor", "FEM", "LoRa"]} />
</Stack>`,
    signal: { label: "stack", freqMHz: 3500, waveform: "square" },
  },
  {
    id: "link",
    index: "05",
    kicker: "ch.05 / establish_link",
    title: "Establish Link",
    body: "Open to RF + software roles, contract work on test automation, or quietly nerding out about FEMs over coffee.",
    codeLang: "html",
    code: `<a href="mailto:abyossi22@gmail.com">abyossi22@gmail.com</a>
<a href="https://github.com/YossiAbutbul">@YossiAbutbul</a>
<a href="tel:+972525476603">+972 52-547-6603</a>`,
    signal: { label: "carrier", freqMHz: 2450, waveform: "sine" },
    cta: { label: "abyossi22@gmail.com", href: "mailto:abyossi22@gmail.com" },
  },
];
