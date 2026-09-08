/** All scene changes are derived from scroll position, so seeking reverses exactly. */
export function transition(progress: number, start: number, end: number) {
  const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function signalStory(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  return {
    progress: p,
    focus: transition(p, 0.1, 0.29),
    closeup: transition(p, 0.4, 0.54) * (1 - transition(p, 0.7, 0.84)),
    approach: transition(p, 0.12, 0.29),
    feed: transition(p, 0.29, 0.43),
    open: transition(p, 0.36, 0.52),
    // Pick up at the input pin as soon as the incoming wave finishes.
    process: transition(p, 0.43, 0.66),
    // A deliberate hold after processing gives the close-up breathing room.
    handoff: transition(p, 0.7, 0.84),
    graph: transition(p, 0.78, 0.94),
    exit: transition(p, 0.96, 1),
    introOpacity: 1 - transition(p, 0.08, 0.2),
    chipOpacity: transition(p, 0.24, 0.34) * (1 - transition(p, 0.68, 0.75)),
    graphOpacity: transition(p, 0.79, 0.87),
  };
}
