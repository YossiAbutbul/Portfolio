/**
 * The intro loader sits in the root layout; the WebGL hero it waits for is
 * several levels down inside the page. Rather than thread a callback through
 * every layer, the hero reports its own state here and the loader listens.
 *
 * A page without a hero never declares one, which is how the loader knows it
 * has nothing to wait for.
 */

let declared = false;
let mounting = false;
let settled = false;
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

/** The hero exists on this page, so the loader should hold for it. */
export function declareScene() {
  if (declared) return;
  declared = true;
  announce();
}

/** The hero's WebGL module has arrived and is being mounted. */
export function mountingScene() {
  if (mounting) return;
  mounting = true;
  announce();
}

/**
 * The hero is done deciding: either it has drawn its first real frame, or it
 * has given up and fallen back to the static drawing. Both release the loader,
 * so a machine without WebGL never waits out the full timeout.
 */
export function settleScene() {
  if (settled) return;
  settled = true;
  announce();
}

export function readScene() {
  return { declared, mounting, settled };
}

export function watchScene(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
