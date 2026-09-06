/**
 * A small graph, built rather than drawn.
 *
 * Nodes are scattered from a seeded PRNG, joined to their nearest few, welded
 * into one component, then relaxed with spring and repulsion forces until the
 * spacing is even. A breadth-first search from the most central node gives the
 * levels the frontier advances through and the tree edges it keeps.
 *
 * Seeded throughout, so the layout is identical on every load and between the
 * server and the client - but nothing here is placed by hand.
 */

export type Vec = { x: number; y: number; z: number };

export type GraphEdge = {
  a: number;
  b: number;
  /** True when the search kept this edge, false when it looked and discarded. */
  tree: boolean;
  /** The endpoint this edge discovered, or -1 for a non-tree edge. */
  child: number;
};

export type Graph = {
  nodes: Vec[];
  edges: GraphEdge[];
  /** Breadth-first distance from the source, per node. */
  level: number[];
  source: number;
  /** Deepest level reached. */
  depth: number;
};

export type GraphOptions = {
  seed?: number;
  count?: number;
  /** Neighbours each node reaches for when the graph is built. */
  degree?: number;
  relaxSteps?: number;
  /** Rest length of an edge during relaxation. */
  restLength?: number;
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distance(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function buildGraph({
  seed = 0x9e37,
  count = 24,
  degree = 3,
  relaxSteps = 260,
  restLength = 0.62,
}: GraphOptions = {}): Graph {
  const random = mulberry32(seed);
  const nodes: Vec[] = [];

  for (let index = 0; index < count; index += 1) {
    nodes.push({ x: random() * 2 - 1, y: random() * 2 - 1, z: random() * 2 - 1 });
  }

  const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const pairs = new Set<string>();

  for (let index = 0; index < count; index += 1) {
    const order = nodes
      .map((node, other) => ({ other, d: distance(nodes[index], node) }))
      .filter((entry) => entry.other !== index)
      .sort((one, two) => one.d - two.d);
    for (let n = 0; n < degree; n += 1) pairs.add(key(index, order[n].other));
  }

  const adjacency = () => {
    const list: number[][] = Array.from({ length: count }, () => []);
    for (const pair of pairs) {
      const [a, b] = pair.split(":").map(Number);
      list[a].push(b);
      list[b].push(a);
    }
    return list;
  };

  // Weld components so the search reaches every node.
  for (let guard = 0; guard < count; guard += 1) {
    const list = adjacency();
    const seen = new Set<number>([0]);
    const queue = [0];
    while (queue.length) {
      const current = queue.shift()!;
      for (const next of list[current]) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    if (seen.size === count) break;

    let best = { a: -1, b: -1, d: Infinity };
    for (const inside of seen) {
      for (let outside = 0; outside < count; outside += 1) {
        if (seen.has(outside)) continue;
        const d = distance(nodes[inside], nodes[outside]);
        if (d < best.d) best = { a: inside, b: outside, d };
      }
    }
    if (best.a < 0) break;
    pairs.add(key(best.a, best.b));
  }

  const links = [...pairs].map((pair) => {
    const [a, b] = pair.split(":").map(Number);
    return { a, b };
  });

  for (let step = 0; step < relaxSteps; step += 1) {
    const force: Vec[] = nodes.map(() => ({ x: 0, y: 0, z: 0 }));

    for (let a = 0; a < count; a += 1) {
      for (let b = a + 1; b < count; b += 1) {
        const dx = nodes[a].x - nodes[b].x;
        const dy = nodes[a].y - nodes[b].y;
        const dz = nodes[a].z - nodes[b].z;
        const d = Math.max(0.08, Math.hypot(dx, dy, dz));
        const push = 0.016 / (d * d);
        force[a].x += (dx / d) * push;
        force[a].y += (dy / d) * push;
        force[a].z += (dz / d) * push;
        force[b].x -= (dx / d) * push;
        force[b].y -= (dy / d) * push;
        force[b].z -= (dz / d) * push;
      }
    }

    for (const link of links) {
      const dx = nodes[link.b].x - nodes[link.a].x;
      const dy = nodes[link.b].y - nodes[link.a].y;
      const dz = nodes[link.b].z - nodes[link.a].z;
      const d = Math.max(0.08, Math.hypot(dx, dy, dz));
      const pull = (d - restLength) * 0.06;
      force[link.a].x += (dx / d) * pull;
      force[link.a].y += (dy / d) * pull;
      force[link.a].z += (dz / d) * pull;
      force[link.b].x -= (dx / d) * pull;
      force[link.b].y -= (dy / d) * pull;
      force[link.b].z -= (dz / d) * pull;
    }

    for (let index = 0; index < count; index += 1) {
      nodes[index].x += force[index].x;
      nodes[index].y += force[index].y;
      nodes[index].z += force[index].z;
    }
  }

  // Centre and normalise so the drawing always fills its box.
  const centre = nodes.reduce(
    (acc, node) => ({
      x: acc.x + node.x / count,
      y: acc.y + node.y / count,
      z: acc.z + node.z / count,
    }),
    { x: 0, y: 0, z: 0 },
  );
  let extent = 0;
  for (const node of nodes) {
    node.x -= centre.x;
    node.y -= centre.y;
    node.z -= centre.z;
    extent = Math.max(extent, Math.hypot(node.x, node.y, node.z));
  }
  for (const node of nodes) {
    node.x /= extent;
    node.y /= extent;
    node.z /= extent;
  }

  let source = 0;
  let bestRadius = Infinity;
  for (let index = 0; index < count; index += 1) {
    const r = Math.hypot(nodes[index].x, nodes[index].y, nodes[index].z);
    if (r < bestRadius) {
      bestRadius = r;
      source = index;
    }
  }

  const list: number[][] = Array.from({ length: count }, () => []);
  for (const link of links) {
    list[link.a].push(link.b);
    list[link.b].push(link.a);
  }

  const level = new Array<number>(count).fill(-1);
  const parent = new Array<number>(count).fill(-1);
  level[source] = 0;
  const queue = [source];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of list[current]) {
      if (level[next] !== -1) continue;
      level[next] = level[current] + 1;
      parent[next] = current;
      queue.push(next);
    }
  }

  const edges: GraphEdge[] = links.map((link) => {
    const forward = parent[link.b] === link.a;
    const back = parent[link.a] === link.b;
    return {
      a: link.a,
      b: link.b,
      tree: forward || back,
      child: forward ? link.b : back ? link.a : -1,
    };
  });

  return { nodes, edges, level, source, depth: Math.max(...level) };
}
