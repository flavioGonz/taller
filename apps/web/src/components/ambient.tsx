'use client';

/**
 * Fondo animado por WebGL, sin librerías: un campo de luz que se mueve muy
 * lento detrás del contenido. Pesa unos pocos KB, toma los colores de los
 * tokens del tema y se apaga solo cuando la pestaña no está a la vista o el
 * sistema pide menos movimiento. Si no hay WebGL, queda el degradado CSS.
 */
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2  uRes;
uniform float uT;
uniform vec3  uA;
uniform vec3  uB;
uniform float uAlpha;

// ruido barato: capas de seno desfasadas. No hace falta más para una luz de fondo.
float capa(vec2 q, float f, float s) {
  return sin(q.x * f + uT * s) * cos(q.y * f * 0.87 - uT * s * 0.73);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  vec2 q  = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 3.2;

  float n = capa(q, 1.0, 0.10)
          + capa(q, 2.1, 0.14) * 0.55
          + capa(q, 4.3, 0.19) * 0.28;
  n = n * 0.42 + 0.5;

  // dos focos que respiran en diagonal
  float d1 = 1.0 - smoothstep(0.0, 1.15, length(q - vec2(sin(uT * 0.11) * 0.9, cos(uT * 0.09) * 0.6)));
  float d2 = 1.0 - smoothstep(0.0, 1.35, length(q + vec2(cos(uT * 0.08) * 1.1, sin(uT * 0.12) * 0.7)));

  vec3 col = mix(uA, uB, clamp(n, 0.0, 1.0));
  float m  = clamp(d1 * 0.75 + d2 * 0.6, 0.0, 1.0) * (0.55 + n * 0.45);

  // se desvanece hacia los bordes para que nunca pelee con el texto
  float vig = smoothstep(1.05, 0.15, length(uv - 0.5) * 1.4);

  gl_FragColor = vec4(col, m * vig * uAlpha);
}
`;

function leerColor(nombre: string, fallback: [number, number, number]): [number, number, number] {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  const hex = raw.replace('#', '');
  if (hex.length === 6) {
    const n = parseInt(hex, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const m = raw.match(/(\d+(?:\.\d+)?)/g);
  if (m && m.length >= 3) return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
  return fallback;
}

export function Ambient({
  className,
  intensity = 0.55,
  colors = ['--brand-500', '--violeta'],
}: {
  className?: string;
  /** 0 a 1. Por encima de 0.7 empieza a competir con el texto. */
  intensity?: number;
  colors?: [string, string];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [c0, c1] = colors;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const gl = (cv.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false })
      ?? cv.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return;

    const compilar = (tipo: number, src: string) => {
      const sh = gl.createShader(tipo)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
    };
    const vs = compilar(gl.VERTEX_SHADER, VERT);
    const fs = compilar(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uT = gl.getUniformLocation(prog, 'uT');
    const uA = gl.getUniformLocation(prog, 'uA');
    const uB = gl.getUniformLocation(prog, 'uB');
    const uAlpha = gl.getUniformLocation(prog, 'uAlpha');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1f(uAlpha, intensity);

    const pintarColores = () => {
      const a = leerColor(c0, [0.96, 0.62, 0.04]);
      const b = leerColor(c1, [0.55, 0.36, 0.96]);
      gl.uniform3f(uA, a[0], a[1], a[2]);
      gl.uniform3f(uB, b[0], b[1], b[2]);
    };
    pintarColores();

    // se dibuja a media resolución: es una luz difusa, nadie ve los píxeles
    const redimensionar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * 0.5;
      const w = Math.max(1, Math.round(cv.clientWidth * dpr));
      const h = Math.max(1, Math.round(cv.clientHeight * dpr));
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(uRes, w, h);
      }
    };
    redimensionar();

    let raf = 0;
    let visible = true;
    const t0 = performance.now();
    const marco = (t: number) => {
      raf = requestAnimationFrame(marco);
      if (!visible) return;
      redimensionar();
      gl.uniform1f(uT, (t - t0) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(marco);

    const onVis = () => { visible = !document.hidden; };
    document.addEventListener('visibilitychange', onVis);

    const io = new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting && !document.hidden; });
    io.observe(cv);

    const mo = new MutationObserver(pintarColores);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const ro = new ResizeObserver(redimensionar);
    ro.observe(cv);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      io.disconnect();
      mo.disconnect();
      ro.disconnect();
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [intensity, c0, c1]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 size-full', className)}
    />
  );
}
