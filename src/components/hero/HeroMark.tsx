"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function hexToVec3(hex: string): [number, number, number] {
  const s = hex.replace("#", "");
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ];
}

function readCss(name: string, fallback: string): [number, number, number] {
  if (typeof window === "undefined") return hexToVec3(fallback);
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return hexToVec3(v || fallback);
}

const VERT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vEl;
  void main() {
    vUv = uv;
    vec3 p = position;
    float t = uTime * 0.7;
    float el = sin(p.x * 3.4 + t) * 0.12
             + sin(p.y * 3.0 - t * 0.8) * 0.10
             + sin((p.x + p.y) * 4.0 + t * 1.3) * 0.06;
    el *= exp(-length(p.xy) * 0.5);
    p.z += el;
    vEl = el;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uAccent;
  varying vec2 vUv;
  varying float vEl;
  void main() {
    vec2 g = abs(fract(vUv * 22.0) - 0.5);
    float line = smoothstep(0.46, 0.5, max(g.x, g.y));
    float crest = smoothstep(0.04, 0.14, abs(vEl));
    vec3 col = mix(vec3(0.0), uAccent, line * 0.85 + crest * 0.4);
    float a = line * 0.9 + crest * 0.5;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }
`;

function Mesh() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const accent = useMemo(() => readCss("--accent", "#c7f03a"), []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAccent: { value: new THREE.Vector3(...accent) },
    }),
    [accent],
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (mat.current) mat.current.uniforms.uTime.value = t;
    if (mesh.current) {
      mesh.current.rotation.z = t * 0.12;
      mesh.current.rotation.x = -Math.PI / 3 + Math.sin(t * 0.3) * 0.08;
    }
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 3, 0, 0]}>
      <planeGeometry args={[2.4, 2.4, 110, 110]} />
      <shaderMaterial
        ref={mat}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function HeroMark() {
  return (
    <Canvas
      camera={{ position: [0, 0, 2.6], fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <Mesh />
    </Canvas>
  );
}
