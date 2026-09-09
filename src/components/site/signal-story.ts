/** All scene changes are derived from scroll position, so seeking reverses exactly. */
export function transition(progress: number, start: number, end: number) {
  const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

/**
 * Four beats, each handed to the next by the same move: the object that has
 * had its turn shrinks and slides left while the next one unfolds from the
 * right, with the signal itself bridging the two.
 *
 *   wave -> processor -> workstation -> graph
 */
export function signalStory(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  // The chip hands over to the machine, and the machine to the panel.
  const write = transition(p, 0.55, 0.68);
  const handoff = transition(p, 0.8, 0.91);
  return {
    progress: p,
    focus: transition(p, 0.08, 0.23),
    closeup: transition(p, 0.31, 0.42) * (1 - write),
    approach: transition(p, 0.09, 0.23),
    feed: transition(p, 0.23, 0.34),
    open: transition(p, 0.28, 0.41),
    // Pick up at the input pin as soon as the incoming wave finishes.
    process: transition(p, 0.34, 0.52),
    // A deliberate hold after processing gives the close-up breathing room.
    write,
    // Typing starts while the machine is still unfolding, as the graph draws
    // while the panel is still opening.
    code: transition(p, 0.63, 0.77),
    handoff,
    graph: transition(p, 0.85, 0.965),
    // Each object leaves only once the next one has taken the signal on.
    chipRelease: transition(p, 0.66, 0.72),
    stationRelease: transition(p, 0.91, 0.955),
    exit: transition(p, 0.975, 1),
    introOpacity: 1 - transition(p, 0.06, 0.16),
    chipOpacity: transition(p, 0.19, 0.27) * (1 - transition(p, 0.52, 0.58)),
    codeOpacity: transition(p, 0.6, 0.67) * (1 - transition(p, 0.81, 0.87)),
    graphOpacity: transition(p, 0.87, 0.93),
  };
}
