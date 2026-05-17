"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function readCssHex(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

interface TraceCfg {
  /** Carrier frequency (cycles per unit x). Higher = denser RF look. */
  freq: number;
  /** Peak amplitude. */
  amp: number;
  /** Group-velocity of the outgoing wavepacket — emanation speed. */
  speed: number;
  /** Phase offset per trace. */
  phase: number;
  /** Y offset (stack the traces along Y to look like a wave bundle). */
  yOff: number;
  /** Z depth so traces read as 3D. */
  z: number;
  primary: boolean;
}

const N_POINTS = 260;
/** Origin is x=0 (anchored to text). Waves propagate to the right. */
const X_MIN = 0;
const X_MAX = 4.4;

const TRACES: TraceCfg[] = [
  // Outer / dim layers
  { freq: 9.5,  amp: 0.10, speed: 0.55, phase: 0.0, yOff:  0.95, z: -1.0, primary: false },
  { freq: 11.5, amp: 0.14, speed: 0.50, phase: 0.6, yOff:  0.55, z: -0.55, primary: false },
  { freq: 8.5,  amp: 0.18, speed: 0.45, phase: 1.1, yOff:  0.22, z: -0.18, primary: false },
  // Primary RF trace
  { freq: 12.0, amp: 0.22, speed: 0.65, phase: 1.7, yOff:  0.0,  z: 0.0,  primary: true },
  { freq: 9.0,  amp: 0.18, speed: 0.40, phase: 2.3, yOff: -0.22, z: 0.22, primary: false },
  { freq: 13.5, amp: 0.14, speed: 0.60, phase: 0.9, yOff: -0.55, z: 0.6,  primary: false },
  { freq: 10.0, amp: 0.10, speed: 0.35, phase: 2.9, yOff: -0.95, z: 1.05, primary: false },
];

/** RF-like sample: high-frequency carrier × travelling wave-packet envelope,
 *  with an emanation ramp so amplitude is zero at the origin and grows outward. */
function rfSample(x: number, cfg: TraceCfg, t: number): number {
  // 0 at origin, full by ~25% of span — wave appears to leave the text.
  const ramp = Math.min(1, Math.max(0, (x - X_MIN) / (0.25 * (X_MAX - X_MIN))));

  // Travelling Gaussian wavepacket centred at u, moving right with time.
  const u = ((t * cfg.speed) % (X_MAX - X_MIN + 1.5)) - 0.75;
  const packet = Math.exp(-Math.pow((x - u) * 0.7, 2));

  // Slow AM modulation overlaid on top.
  const am = 0.65 + 0.35 * Math.sin(x * 0.35 - t * 0.18 + cfg.phase * 0.3);

  // RF carrier — fast oscillation.
  const carrier = Math.sin(x * cfg.freq + cfg.phase - t * cfg.speed * 1.2);

  // Tiny analog jitter.
  const jitter = 0.04 * Math.sin(x * 28.0 + t * 1.6 + cfg.phase);

  return cfg.amp * ramp * (carrier * am + packet * 0.4 + jitter);
}

function Trace({ cfg, accent, dim }: { cfg: TraceCfg; accent: THREE.Color; dim: THREE.Color }) {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const positions = useMemo(() => new Float32Array(N_POINTS * 3), []);

  useMemo(() => {
    for (let i = 0; i < N_POINTS; i++) {
      const x = X_MIN + (i / (N_POINTS - 1)) * (X_MAX - X_MIN);
      positions[i * 3 + 0] = x;
      positions[i * 3 + 1] = cfg.yOff + rfSample(x, cfg, 0);
      positions[i * 3 + 2] = cfg.z;
    }
  }, [positions, cfg]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const arr = positions;
    for (let i = 0; i < N_POINTS; i++) {
      const x = X_MIN + (i / (N_POINTS - 1)) * (X_MAX - X_MIN);
      arr[i * 3 + 1] = cfg.yOff + rfSample(x, cfg, t);
    }
    if (geomRef.current) geomRef.current.attributes.position.needsUpdate = true;
  });

  return (
    <line>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        color={cfg.primary ? accent : dim}
        transparent
        opacity={cfg.primary ? 0.95 : 0.5}
        linewidth={1}
      />
    </line>
  );
}

function TraceField() {
  const groupRef = useRef<THREE.Group>(null);
  const accent = useMemo(() => new THREE.Color(readCssHex("--accent", "#c7f03a")), []);
  const dim = useMemo(() => new THREE.Color(readCssHex("--fg-dim", "#4a5056")), []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      // Very slow drift — barely moves.
      groupRef.current.rotation.y = -0.05 + Math.sin(t * 0.03) * 0.08;
      groupRef.current.rotation.x = -0.25 + Math.sin(t * 0.025) * 0.04;
    }
  });

  return (
    // Shift the bundle left so x=0 (the trace origin) sits behind the headline.
    <group ref={groupRef} position={[-2.4, 0, 0]}>
      {TRACES.map((cfg, i) => (
        <Trace key={i} cfg={cfg} accent={accent} dim={dim} />
      ))}
    </group>
  );
}

export default function AntennaPattern3D() {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 3.6], fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <TraceField />
    </Canvas>
  );
}
