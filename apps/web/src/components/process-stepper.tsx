'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardList, Stethoscope, FileText, ThumbsUp, PackageSearch, Wrench,
  ShieldCheck, Droplets, PartyPopper, KeyRound, Circle,
} from 'lucide-react';
import {
  progressOf, WORKORDER_KIND_DEFS, STATUS_LABELS,
  type WorkOrderKind, type WorkOrderStatus,
} from '@taller/shared';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ íconos */

/** Ícono por etapa: se lee de un vistazo en qué anda el vehículo. */
const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  RECEPCION: ClipboardList,
  DIAGNOSTICO: Stethoscope,
  PRESUPUESTADO: FileText,
  APROBADO: ThumbsUp,
  ESPERA_REPUESTO: PackageSearch,
  EN_PROCESO: Wrench,
  CONTROL_CALIDAD: ShieldCheck,
  LAVADO: Droplets,
  FINALIZADO: PartyPopper,
  ENTREGADO: KeyRound,
};

function StepGlyph({ status, className }: { status: string; className?: string }) {
  const Cmp = STEP_ICONS[status] ?? Circle;
  return <Cmp className={className} />;
}

/* ------------------------------------------------------------ stepper full */

/**
 * Recorrido del vehículo dentro del taller. Las etapas dependen del tipo de
 * ingreso: un service no pasa por diagnóstico, una garantía no se presupuesta y
 * un siniestro espera la autorización de la compañía.
 *
 * Cada etapa es un nodo con su ícono; la línea de avance crece, la etapa actual
 * late y las cumplidas dibujan el tilde. Con `onSelect` los nodos siguientes se
 * vuelven accionables para mover la OT desde el propio recorrido.
 */
export function ProcessStepper({
  kind,
  status,
  compact = false,
  onSelect,
  busy,
}: {
  kind: WorkOrderKind;
  status: WorkOrderStatus;
  compact?: boolean;
  /** Si se pasa, cada etapa alcanzable se puede clickear para mover la OT. */
  onSelect?: (status: string) => void;
  busy?: boolean;
}) {
  const def = WORKORDER_KIND_DEFS[kind] ?? WORKORDER_KIND_DEFS.REPARACION;
  const { steps, index, offTrack, percent } = progressOf(kind, status);

  const cancelled = status === 'CANCELADO';
  const rejected = status === 'RECHAZADO';
  const accent = cancelled ? 'var(--subtle)' : rejected ? 'var(--falla)' : def.token;
  const done = status === 'ENTREGADO' ? steps.length : Math.max(0, index);

  const size = compact ? 30 : 44;
  const line = compact ? 3 : 4;

  return (
    <div className="w-full">
      <div className="relative">
        {/* riel + avance, detrás de los nodos */}
        <div
          className="absolute rounded-full bg-[var(--border)]"
          style={{ top: size / 2 - line / 2, left: size / 2, right: size / 2, height: line }}
          aria-hidden
        />
        <motion.div
          className="absolute rounded-full"
          style={{ top: size / 2 - line / 2, left: size / 2, height: line, background: accent }}
          initial={{ width: 0 }}
          animate={{
            width: steps.length > 1
              ? `calc((100% - ${size}px) * ${Math.min(1, done / (steps.length - 1))})`
              : 0,
          }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        />

        <ol
          className="relative flex items-start justify-between gap-1"
          aria-label={`Recorrido ${def.label}: etapa ${index + 1} de ${steps.length} (${STATUS_LABELS[status]})`}
        >
          {steps.map((step, i) => {
            const isDone = i < done;
            const isCurrent = i === index && status !== 'ENTREGADO';
            const reachable = !!onSelect && !cancelled && (i === index + 1 || (isDone && i === done - 1));
            const Wrapper = reachable ? 'button' : 'div';

            return (
              <li key={step.status} className="flex min-w-0 flex-1 flex-col items-center">
                <Wrapper
                  {...(reachable
                    ? {
                        type: 'button' as const,
                        onClick: () => onSelect?.(step.status),
                        disabled: busy,
                        'aria-label': `Mover la orden a ${step.label}`,
                      }
                    : {})}
                  data-tooltip-id="ts-tip"
                  data-tooltip-content={`${step.label} — ${step.hint}${reachable ? ' · clic para mover la OT acá' : ''}`}
                  className={cn(
                    'relative grid place-items-center rounded-full border-2 transition',
                    reachable && 'focus-ring cursor-pointer hover:scale-110 active:scale-95',
                    !reachable && 'cursor-help',
                  )}
                  style={{
                    width: size,
                    height: size,
                    background: isDone || isCurrent ? accent : 'var(--surface)',
                    borderColor: isDone || isCurrent ? accent : 'var(--border-strong)',
                    color: isDone || isCurrent ? 'var(--on-kind)' : 'var(--subtle)',
                  }}
                >
                  {/* pulso de la etapa actual */}
                  {isCurrent && !cancelled && (
                    <motion.span
                      className="absolute inset-0 rounded-full"
                      style={{ border: `2px solid ${accent}` }}
                      initial={{ opacity: 0.6, scale: 1 }}
                      animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.6, 1] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                      aria-hidden
                    />
                  )}

                  {isDone ? (
                    <motion.svg
                      viewBox="0 0 24 24"
                      className={compact ? 'size-4' : 'size-5'}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <motion.path
                        d="M20 6 9 17l-5-5"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ delay: 0.2 + i * 0.07, duration: 0.35 }}
                      />
                    </motion.svg>
                  ) : (
                    <StepGlyph status={step.status} className={compact ? 'size-3.5' : 'size-[18px]'} />
                  )}

                  {step.optional && !isDone && !isCurrent && (
                    <span
                      className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--surface)] ring-2"
                      style={{ ['--tw-ring-color' as string]: 'var(--border-strong)' }}
                      aria-hidden
                    />
                  )}
                </Wrapper>

                {!compact && (
                  <div className="mt-2 w-full px-0.5 text-center">
                    <p
                      className={cn('truncate text-[11.5px] leading-tight', isCurrent ? 'font-bold' : 'text-[var(--muted)]')}
                      style={isCurrent ? { color: accent } : undefined}
                    >
                      {step.label}
                    </p>
                    {step.optional && <p className="text-[10px] text-[var(--subtle)]">opcional</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
        <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: accent }}>
          <span className="size-2 rounded-full" style={{ background: accent }} aria-hidden />
          {def.label}
        </span>
        <span className="text-[var(--muted)]">{percent}% del recorrido</span>
        {onSelect && !cancelled && (
          <span className="text-[var(--subtle)]">Hacé clic en la etapa siguiente para avanzar la OT.</span>
        )}
      </div>

      {(offTrack || rejected || cancelled) && (
        <p className={cn('mt-1.5 text-[11.5px]', cancelled ? 'text-[var(--muted)]' : 'text-[var(--falla)]')}>
          {cancelled
            ? 'OT cancelada — el recorrido se interrumpió.'
            : rejected
              ? 'El cliente no aprobó el presupuesto: se rehace o se devuelve el vehículo.'
              : `Estado fuera del recorrido habitual de ${def.short.toLowerCase()}.`}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ mini variantes */

/** Barra mínima para tarjetas y filas de tabla. */
export function ProcessBar({
  kind,
  status,
  showLabel = false,
}: {
  kind: WorkOrderKind;
  status: WorkOrderStatus;
  showLabel?: boolean;
}) {
  const def = WORKORDER_KIND_DEFS[kind] ?? WORKORDER_KIND_DEFS.REPARACION;
  const { percent, steps, index } = progressOf(kind, status);
  const color = status === 'CANCELADO' ? 'var(--subtle)' : status === 'RECHAZADO' ? 'var(--falla)' : def.token;

  return (
    <div className="w-full">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${def.label}: ${STATUS_LABELS[status]}`}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      {showLabel && (
        <p className="mt-1 flex items-center justify-between text-[10.5px] text-[var(--muted)]">
          <span className="truncate">{STATUS_LABELS[status]}</span>
          <span className="mono shrink-0">{index >= 0 ? `${index + 1}/${steps.length}` : '—'}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Puntos del recorrido en miniatura: entra en una celda de tabla y muestra
 * exactamente en qué etapa está sin ocupar lugar.
 */
export function ProcessDots({ kind, status }: { kind: WorkOrderKind; status: WorkOrderStatus }) {
  const def = WORKORDER_KIND_DEFS[kind] ?? WORKORDER_KIND_DEFS.REPARACION;
  const { steps, index } = progressOf(kind, status);
  const color = status === 'CANCELADO' ? 'var(--subtle)' : status === 'RECHAZADO' ? 'var(--falla)' : def.token;
  const done = status === 'ENTREGADO' ? steps.length : Math.max(0, index);

  const label = useMemo(
    () => `${def.label} · ${STATUS_LABELS[status]} (${index + 1} de ${steps.length})`,
    [def.label, status, index, steps.length],
  );

  return (
    <span className="inline-flex items-center gap-[3px]" data-tooltip-id="ts-tip" data-tooltip-content={label} aria-label={label}>
      {steps.map((s, i) => (
        <span
          key={s.status}
          className={cn('block rounded-full transition-all', i === index ? 'h-2 w-4' : 'size-2')}
          style={{
            background: i < done || i === index ? color : 'var(--border-strong)',
            opacity: i < done ? 0.55 : 1,
          }}
        />
      ))}
    </span>
  );
}
