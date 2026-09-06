/**
 * TX current-decay run.
 *
 * Mirrors what `current-logger` actually captures: a battery/HLC-powered unit
 * transmits a burst on a fixed interval, the analyzer arms on a current-level
 * trigger and records each burst, and the run ends once the peak has fallen a
 * configured amount below the first capture's reference peak.
 *
 * The numbers below are synthesised because the rig is not on the bench, but
 * the shape is the real one: a long, almost flat plateau while the cell holds,
 * then a knee as internal resistance climbs and the cell can no longer source
 * the TX peak. Swapping in a real `_summary.csv` means replacing
 * `generateRun` with a parser - every consumer only reads `Capture[]`.
 */

export type Capture = {
  /** Capture number, 0-based, in acquisition order. */
  index: number;
  /** Seconds elapsed since the run started. */
  t: number;
  /** Peak TX current for this burst, milliamps. */
  peakMa: number;
  /** Peak relative to the reference capture, 20*log10(I/Iref). */
  deltaDb: number;
};

export type DecayRun = {
  captures: Capture[];
  /** First capture's peak: the reference every later capture is measured against. */
  refMa: number;
  /** Sleep-state current between bursts, milliamps. Sets the trace baseline. */
  floorMa: number;
  /** Stop condition, in dB below reference. Negative. */
  thresholdDb: number;
  /** Seconds between bursts. */
  intervalS: number;
  /** Total run length, seconds. */
  durationS: number;
  /** Index of the first capture at or below threshold, or -1 if never reached. */
  crossIndex: number;
};

/** Deterministic PRNG - the trace must be identical on server and client. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RunOptions = {
  seed?: number;
  /** Number of bursts captured across the run. */
  count?: number;
  /** Seconds between bursts. */
  intervalS?: number;
  /** Reference peak current, milliamps. */
  refMa?: number;
  /** Sleep current between bursts, milliamps. */
  floorMa?: number;
  thresholdDb?: number;
};

export function generateRun({
  seed = 0x51f3,
  count = 192,
  intervalS = 900,
  refMa = 178,
  floorMa = 2.4,
  thresholdDb = -3,
}: RunOptions = {}): DecayRun {
  const random = mulberry32(seed);
  const captures: Capture[] = [];

  for (let index = 0; index < count; index += 1) {
    const u = index / (count - 1);

    // Two terms. The linear one is the slow sag across the whole run; the
    // high-power one is the end-of-life knee, flat until it very much is not.
    const sag = 0.055 * u;
    const knee = 0.3 * Math.pow(u, 5.5);

    // Capture-to-capture scatter, plus a slow thermal wander that a real
    // bench run always has and a clean curve never does.
    const scatter = (random() - 0.5) * 1.7;
    const thermal = Math.sin(u * 7.3 + 0.8) * 0.9 + Math.sin(u * 19.1) * 0.35;

    const peakMa = refMa * (1 - sag - knee) + scatter + thermal;

    captures.push({
      index,
      t: index * intervalS,
      peakMa,
      deltaDb: 20 * Math.log10(peakMa / refMa),
    });
  }

  // The reference is the first capture's measured peak, not the nominal value.
  const measuredRef = captures[0].peakMa;
  for (const capture of captures) {
    capture.deltaDb = 20 * Math.log10(capture.peakMa / measuredRef);
  }

  const crossIndex = captures.findIndex((c) => c.deltaDb <= thresholdDb);

  return {
    captures,
    refMa: measuredRef,
    floorMa,
    thresholdDb,
    intervalS,
    durationS: (count - 1) * intervalS,
    crossIndex,
  };
}

/** Milliamp level corresponding to a dB offset from the reference peak. */
export function levelForDb(run: DecayRun, db: number): number {
  return run.refMa * Math.pow(10, db / 20);
}

/** Elapsed seconds as HH:MM:SS - how the logger writes it. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
