"use client";

import { useEffect, useRef } from "react";

const VERT = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform vec2 uRes;
  uniform vec3 uBg;
  uniform vec3 uAccent;
  uniform vec3 uFg;

  // Simplex-ish noise (Ashima 2D)
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
  float snoise(vec2 v){
    const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
    vec2 i=floor(v+dot(v,C.yy));
    vec2 x0=v-i+dot(i,C.xx);
    vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
    vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1;
    i=mod289(i);
    vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
    vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
    m=m*m; m=m*m;
    vec3 x=2.0*fract(p*C.www)-1.0;
    vec3 h=abs(x)-0.5;
    vec3 ox=floor(x+0.5);
    vec3 a0=x-ox;
    m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
    vec3 g;
    g.x=a0.x*x0.x+h.x*x0.y;
    g.yz=a0.yz*x12.xz+h.yz*x12.yw;
    return 130.0*dot(m,g);
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
    vec2 mouse = (uMouse - 0.5 * uRes) / min(uRes.x, uRes.y);

    float dM = length(p - mouse);
    float pull = 0.35 / (dM * 6.0 + 1.0);

    float t = uTime * 0.05;
    float n1 = snoise(p * 1.6 + vec2(t, t * 0.7));
    float n2 = snoise(p * 3.2 - vec2(t * 0.8, -t));
    float n  = n1 * 0.65 + n2 * 0.35 + pull;

    // Dot grid mask
    vec2 gridUv = gl_FragCoord.xy / 18.0;
    vec2 gridF = fract(gridUv) - 0.5;
    float dotMask = 1.0 - smoothstep(0.05, 0.18, length(gridF));

    // Modulate dot intensity by noise
    float intensity = smoothstep(0.0, 1.0, n * 0.5 + 0.5);
    float dotI = dotMask * intensity;

    // Vignette
    float vig = smoothstep(1.1, 0.2, length(p));

    vec3 col = uBg;
    col = mix(col, uFg * 0.55, dotI * 0.6 * vig);
    col = mix(col, uAccent, dotI * pull * 4.0 * vig);

    // Subtle film grain
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col += (grain - 0.5) * 0.025;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace("#", "").trim();
  const n = s.length === 3
    ? s.split("").map((c) => c + c).join("")
    : s;
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function cssVarHex(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || "#000000";
}

export default function NoiseField() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cleanup: (() => void) | null = null;
    let raf = 0;

    (async () => {
      const { Renderer, Program, Mesh, Triangle } = await import("ogl");

      const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 2), alpha: false });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 1);
      host.appendChild(gl.canvas);
      gl.canvas.style.width = "100%";
      gl.canvas.style.height = "100%";
      gl.canvas.style.display = "block";

      const geometry = new Triangle(gl);

      const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uMouse: { value: [0, 0] },
          uRes: { value: [host.clientWidth, host.clientHeight] },
          uBg: { value: hexToRgb(cssVarHex("--bg")) },
          uAccent: { value: hexToRgb(cssVarHex("--accent")) },
          uFg: { value: hexToRgb(cssVarHex("--fg")) },
        },
      });

      const mesh = new Mesh(gl, { geometry, program });

      function resize() {
        if (!host) return;
        const w = host.clientWidth;
        const h = host.clientHeight;
        renderer.setSize(w, h);
        program.uniforms.uRes.value = [w * renderer.dpr, h * renderer.dpr];
      }
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      const mouse: [number, number] = [host.clientWidth / 2 * renderer.dpr, host.clientHeight / 2 * renderer.dpr];
      function onMove(e: PointerEvent) {
        const r = host!.getBoundingClientRect();
        mouse[0] = (e.clientX - r.left) * renderer.dpr;
        mouse[1] = (r.height - (e.clientY - r.top)) * renderer.dpr;
      }
      window.addEventListener("pointermove", onMove, { passive: true });

      function refreshColors() {
        program.uniforms.uBg.value = hexToRgb(cssVarHex("--bg"));
        program.uniforms.uAccent.value = hexToRgb(cssVarHex("--accent"));
        program.uniforms.uFg.value = hexToRgb(cssVarHex("--fg"));
      }
      const themeObserver = new MutationObserver(refreshColors);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      const start = performance.now();
      function loop(now: number) {
        program.uniforms.uTime.value = (now - start) / 1000;
        program.uniforms.uMouse.value = mouse;
        renderer.render({ scene: mesh });
        raf = requestAnimationFrame(loop);
      }
      raf = requestAnimationFrame(loop);

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        themeObserver.disconnect();
        window.removeEventListener("pointermove", onMove);
        if (gl.canvas.parentNode === host) host.removeChild(gl.canvas);
      };
    })();

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
