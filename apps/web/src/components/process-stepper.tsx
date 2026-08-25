'use client';

import { motion } from 'framer-motion';
import { Tooltip } from 'react-tooltip';
import { progressOf, WORKORDER_KIND_DEFS, STATUS_LABELS, type WorkOrderKind, type WorkOrderStatus } from '@taller/shared';

/**
 * Recorrido del vehículo dentro del taller, dibujado en SVG y animado.
 * Las etapas dependen del tipo de ingreso: un service no pasa por diagnóstico,
 * una garantía no pasa por presupuesto, y un siniestro sí espera repuestos.
 */
export function ProcessStepper({
  kind,
  status,
  compact = false,
}: {
  kind: WorkOrderKind;
  status: WorkOrderStatus;
  compact?: boolean;
}) {
  const def = WORKORDER_KIND_DEFS[kind] ?? WORKORDER_KIND_DEFS.REPARACION;
  const { steps, index, offTrack, percent } = progressOf(kind, status);

  const cancelled = status === 'CANCELADO';
  const rejected = status === 'RECHAZADO';
  const accent = cancelled ? 'var(--subtle)' : rejected ? 'var(--falla)' : def.color;

  const R = compact ? 9 : 13;
  const GAP = compact ? 66 : 104;
  const W = (steps.length - 1) * GAP + R * 2 + 8;
  const H = compact ? 30 : 34;
  const cy = H / 2;
  const cx = (i: number) => R + 4 + i * GAP;

  const doneUntil = status === 'ENTREGADO' ? steps.length - 1 : index;

  return (
    <div className="w-full">
      <div className="overflow-x-auto pb-1">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Recorrido ${def.label}: etapa ${index + 1} de ${steps.length} (${STATUS_LABELS[status]})`}
          className="max-w-full"
        >
          {/* riel */}
          <line x1={cx(0)} y1={cy} x2={cx(steps.length - 1)} y2={cy} stroke="var(--border-strong)" strokeWidth={compact ? 2 : 3} strokeLinecap="round" />

          {/* avance */}
          <motion.line
            x1={cx(0)}
            y1={cy}
            x2={cx(0)}
            y2={cy}
            stroke={accent}
            strokeWidth={compact ? 2 : 3}
            strokeLinecap="round"
            initial={{ x2: cx(0) }}
            animate={{ x2: cx(Math.max(0, doneUntil)) }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />

          {steps.map((step, i) => {
            const done = i < doneUntil || status === 'ENTREGADO';
            const current = i === index && status !== 'ENTREGADO';
            const id = `step-${kind}-${step.status}`;
            return (
              <g key={step.status} data-tooltip-id="ts-tip" data-tooltip-content={`${step.label} — ${step.hint}`} className="cursor-help">
                {current && !cancelled && (
                  <motion.circle
                    cx={cx(i)} cy={cy} r={R}
                    fill="none" stroke={accent} strokeWidth={2}
                    initial={{ opacity: 0.55, scale: 1 }}
                    animate={{ opacity: [0.55, 0, 0.55], scale: [1, 1.75, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ transformOrigin: `${cx(i)}px ${cy}px` }}
                  />
                )}
                <motion.circle
                  cx={cx(i)} cy={cy} r={R}
                  fill={done || current ? accent : 'var(--surface)'}
                  stroke={done || current ? accent : 'var(--border-strong)'}
                  strokeWidth={2}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 320, damping: 22 }}
                  id={id}
                />
                {done && (
                  <motion.path
                    d={`M ${cx(i) - R * 0.42} ${cy} l ${R * 0.3} ${R * 0.34} l ${R * 0.55} ${-R * 0.62}`}
                    fill="none" stroke="#fff" strokeWidth={compact ? 1.8 : 2.2} strokeLinecap="round" strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.25 + i * 0.06, duration: 0.35 }}
                  />
                )}
                {current && !done && (
                  <circle cx={cx(i)} cy={cy} r={R * 0.32} fill="#fff" />
                )}
                {!done && !current && (
                  <text x={cx(i)} y={cy + (compact ? 3 : 4)} textAnchor="middle" fontSize={compact ? 9 : 11} fontWeight={700} fill="var(--subtle)">
                    {i + 1}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {!compact && (
          <div className="flex" style={{ width: W }}>
            {steps.map((step, i) => (
              <div key={step.status} className="shrink-0 text-center" style={{ width: i === 0 ? R * 2 + 4 + GAP / 2 : GAP }}>
                <p
                  className={`truncate text-[11px] ${i === index ? 'font-bold' : 'text-[var(--muted)]'}`}
                  style={i === index ? { color: accent } : undefined}
                >
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {(offTrack || rejected || cancelled) && (
        <p className={`mt-1 text-[11.5px] ${cancelled ? 'text-[var(--muted)]' : 'text-[var(--falla)]'}`}>
          {cancelled ? 'OT cancelada — el recorrido se interrumpió.' : rejected ? 'El cliente no aprobó el presupuesto: se rehace o se devuelve el vehículo.' : `Estado fuera del recorrido habitual de ${def.short.toLowerCase()}.`}
        </p>
      )}

      {!compact && (
        <p className="mt-1 text-[11.5px] text-[var(--muted)]">
          {def.label} · {percent}% del recorrido
        </p>
      )}

      <Tooltip id="ts-tip" place="top" className="!z-50 !rounded-lg !bg-[var(--text)] !px-2.5 !py-1.5 !text-[12px] !opacity-100" />
    </div>
  );
}

/** Barra mínima para las tarjetas del tablero. */
export function ProcessBar({ kind, status }: { kind: WorkOrderKind; status: WorkOrderStatus }) {
  const def = WORKORDER_KIND_DEFS[kind] ?? WORKORDER_KIND_DEFS.REPARACION;
  const { percent } = progressOf(kind, status);
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-2)]" aria-hidden>
      <motion.div
        className="h-full rounded-full"
        style={{ background: def.color }}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
}
