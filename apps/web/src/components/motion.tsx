'use client';

/**
 * Piezas de movimiento reutilizables. La regla: la animación explica algo
 * —de dónde viene un dato, cómo cambió un número, cuánto falta— y nunca hace
 * esperar. Todo respeta `prefers-reduced-motion`.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useInView, useMotionValue, useSpring, useReducedMotion, animate } from 'framer-motion';
import { cn } from '@/lib/utils';

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ Reveal */
/** Aparece cuando entra en pantalla. Una sola vez, sin rebotes. */
export function Reveal({
  children,
  delay = 0,
  y = 12,
  className,
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'tr';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px 0px -40px 0px' });
  const quieto = useReducedMotion();
  const Cmp = motion[as] as typeof motion.div;

  return (
    <Cmp
      ref={ref}
      className={className}
      initial={quieto ? false : { opacity: 0, y }}
      animate={inView || quieto ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.42, delay, ease: EASE_OUT }}
    >
      {children}
    </Cmp>
  );
}

/* ----------------------------------------------------------------- Stagger */
/** Contenedor que va soltando a sus hijos de a uno. Usar con <StaggerItem>. */
export function Stagger({ children, className, gap = 0.05, delay = 0 }: { children: ReactNode; className?: string; gap?: number; delay?: number }) {
  const quieto = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={quieto ? false : 'oculto'}
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: quieto ? 0 : gap, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  );
}

export const STAGGER_ITEM = {
  oculto: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.36, ease: EASE_OUT } },
};

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div variants={STAGGER_ITEM} className={className}>{children}</motion.div>;
}

/* ----------------------------------------------------------------- CountUp */
/**
 * Un número que "corre" hasta su valor. Cuando el dato cambia en vivo (socket)
 * el salto se ve, que es justamente lo que uno quiere notar en un tablero.
 */
export function CountUp({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 0.9,
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const quieto = useReducedMotion();
  const [texto, setTexto] = useState(() => fmt(value, decimals));
  const previo = useRef(value);

  useEffect(() => {
    if (quieto) {
      setTexto(fmt(value, decimals));
      previo.current = value;
      return;
    }
    const controls = animate(previo.current, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => setTexto(fmt(v, decimals)),
    });
    previo.current = value;
    return () => controls.stop();
  }, [value, decimals, duration, quieto]);

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}{texto}{suffix}
    </span>
  );
}

const fmt = (v: number, d: number) =>
  v.toLocaleString('es-UY', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Igual que CountUp pero acepta el texto ya formateado (ej: "$ 12.400,00"). */
export function CountUpText({ value, className }: { value: string; className?: string }) {
  const m = value.match(/-?[\d.,]+/);
  if (!m) return <span className={className}>{value}</span>;
  const crudo = m[0];
  const dec = crudo.includes(',') ? (crudo.split(',')[1]?.length ?? 0) : 0;
  const num = Number(crudo.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(num)) return <span className={className}>{value}</span>;
  const [antes, despues] = [value.slice(0, m.index!), value.slice(m.index! + crudo.length)];
  return <CountUp className={className} value={num} decimals={dec} prefix={antes} suffix={despues} />;
}

/* -------------------------------------------------------------------- Ring */
/** Anillo de progreso animado. Sirve para "8 de 12 pasos" sin ocupar lugar. */
export function Ring({
  value,
  size = 44,
  stroke = 4,
  color = 'var(--brand)',
  track = 'var(--surface-3)',
  label,
  className,
}: {
  /** 0 a 1 */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  label?: ReactNode;
  className?: string;
}) {
  const quieto = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));

  return (
    <span className={cn('relative inline-grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: quieto ? c * (1 - pct) : c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 0.9, ease: EASE_OUT }}
        />
      </svg>
      {label !== undefined && (
        <span className="absolute grid place-items-center text-[11px] font-extrabold tabular-nums">{label}</span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------- Pulse */
/** Punto que late: "esto está pasando ahora". */
export function Pulse({ color = 'var(--ok)', size = 8, className }: { color?: string; size?: number; className?: string }) {
  return (
    <span className={cn('relative inline-flex', className)} style={{ width: size, height: size }} aria-hidden>
      <span className="ts-pulse-ring absolute inset-0 rounded-full" style={{ background: color }} />
      <span className="relative inline-flex rounded-full" style={{ width: size, height: size, background: color }} />
    </span>
  );
}

/* --------------------------------------------------------------- Sparkline */
/** Mini gráfico de línea que se dibuja solo. Sin librerías. */
export function Sparkline({
  data,
  width = 92,
  height = 28,
  color = 'var(--brand)',
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  const quieto = useReducedMotion();
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 2) + 1;
    const y = height - 2 - ((v - min) / span) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = `M ${pts.join(' L ')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <motion.path
        d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
        initial={quieto ? false : { pathLength: 0, opacity: 0.2 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.1, ease: EASE_OUT }}
      />
      <circle cx={Number(pts[pts.length - 1]!.split(',')[0])} cy={Number(pts[pts.length - 1]!.split(',')[1])} r={2.2} fill={color} />
    </svg>
  );
}

/* ------------------------------------------------------------------- Tilt */
/** Tarjeta que sigue apenas al mouse. Sutil: 6 grados como máximo. */
export function Tilt({ children, className, max = 6 }: { children: ReactNode; className?: string; max?: number }) {
  const quieto = useReducedMotion();
  const rx = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 });
  const ry = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 });

  if (quieto) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * max * 2);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * max * 2);
      }}
      onPointerLeave={() => { rx.set(0); ry.set(0); }}
    >
      {children}
    </motion.div>
  );
}
