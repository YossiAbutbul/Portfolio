"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uIntensity;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    vUv = uv;
    vec3 p = position;
    float t = uTime * 0.6;
    float prog = uProgress;
    // Two travelling sine waves + a chirp tied to scroll progress.
    float wave1 = sin(p.x * 2.4 + t) * 0.18;
    float wave2 = sin(p.y * 2.0 - t * 0.7 + prog * 6.2832) * 0.16;
    float wave3 = sin((p.x + p.y) * (1.0 + prog * 3.0) + t * 1.4) * 0.12;
    float radial = exp(-length(p.xy) * 0.6);
    float elevation = (wave1 + wave2 + wave3) * radial * uIntensity;
    p.z += elevation;
    vElevation = elevation;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uAccent;
  uniform vec3 uFg;
  uniform float uTime;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    // Grid lines along UV.
    vec2 g = abs(fract(vUv * 32.0) - 0.5);
    float line = smoothstep(0.48, 0.5, max(g.x, g.y));
    // Crest highlight where elevation peaks.
    float crest = smoothstep(0.05, 0.18, abs(vElevation));
    vec3 base = mix(uFg * 0.18, uAccent, crest * 0.8);
    vec3 col = mix(base * 0.4, base, line);
    // Vignette
    float vig = smoothstep(1.05, 0.3, length(vUv - 0.5) * 1.6);
    col *= vig;
    float alpha = clamp(line * 0.85 + crest * 0.6, 0.05, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

function hexToVec3(hex: string): [number, number, number] {
  const s = hex.replace("#", "");
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ];
}

function readCssColor(name: string, fallback: string): [number, number, number] {
  if (typeof window === "undefined") return hexToVec3(fallback);
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return hexToVec3(v || fallback);
}

function WaveMesh({ progress }: { progress: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const accent = useMemo(() => readCssColor("--accent", "#c7f03a"), []);
  const fg = useMemo(() => readCssColor("--fg", "#e7e9ec"), []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uIntensity: { value: 1 },
      uAccent: { value: new THREE.Vector3(...accent) },
      uFg: { value: new THREE.Vector3(...fg) },
    }),
    [accent, fg],
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = t;
      matRef.current.uniforms.uProgress.value = progress.current;
      matRef.current.uniforms.uIntensity.value = 1 + progress.current * 0.4;
    }
    if (meshRef.current) {
      const target = progress.current * Math.PI * 2;
      meshRef.current.rotation.z += (target - meshRef.current.rotation.z) * 0.04;
      meshRef.current.rotation.x = -Math.PI / 3 + Math.sin(t * 0.2) * 0.1 + progress.current * 0.25;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 3, 0, 0]}>
      <planeGeometry args={[4, 4, 160, 160]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        wireframe={false}
      />
    </mesh>
  );
}

export default function Wave3D({ progress }: { progress: React.MutableRefObject<number> }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.2], fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <ambientLight intensity={0.4} />
      <WaveMesh progress={progress} />
    </Canvas>
  );
}
