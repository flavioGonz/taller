'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Check, X, Minus, Car, Armchair, Cog, Wrench, ShieldCheck, FileText, Package, Gauge,
  ClipboardCheck, KeyRound, SunDim, CircleDot, Luggage, Footprints, Container, Link2,
  Sticker, Paintbrush, Radio, Siren, Fuel, ArrowUpFromLine, FireExtinguisher, TriangleAlert,
  Shirt, BriefcaseMedical, BadgeCheck, BookOpen, RadioTower, Gem, Sparkles, Lightbulb,
  Droplets, CircleOff, Route, Ear, Disc, Layers, CircleHelp, ListChecks,
} from 'lucide-react';
import { CHECKLIST_GROUPS, type ChecklistItem } from '@taller/shared';
import { cn } from '@/lib/utils';

export type ChecklistValue = Record<string, boolean | string | null>;

/* -------------------------------------------------------------- íconos */

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Car, Armchair, Cog, Wrench, ShieldCheck, FileText, Package, Gauge, ClipboardCheck, KeyRound,
  SunDim, CircleDot, Luggage, Footprints, Container, Link2, Sticker, Paintbrush, Radio, Siren,
  Fuel, ArrowUpFromLine, FireExtinguisher, TriangleAlert, Shirt, BriefcaseMedical, BadgeCheck,
  BookOpen, RadioTower, Gem, Sparkles, Lightbulb, Droplets, CircleOff, Route, Ear, Disc, Layers,
};

function Glyph({ name, className }: { name?: string; className?: string }) {
  const Cmp = (name && ICONS[name]) || CircleHelp;
  return <Cmp className={className} />;
}

/** Cada grupo tiene su color, así el ojo separa exterior de interior de mecánica. */
const TONE: Record<string, { chip: string; ring: string; text: string }> = {
  brand:   { chip: 'bg-[var(--brand-soft)] text-[var(--brand-700)]', ring: 'border-[var(--brand-200)]', text: 'text-[var(--brand-700)]' },
  ok:      { chip: 'bg-[var(--ok-bg)] text-[var(--ok)]',             ring: 'border-[var(--ok-bd)]',     text: 'text-[var(--ok)]' },
  warn:    { chip: 'bg-[var(--warn-bg)] text-[var(--warn)]',         ring: 'border-[var(--warn-bd)]',   text: 'text-[var(--warn)]' },
  danger:  { chip: 'bg-[var(--falla-bg)] text-[var(--falla)]',       ring: 'border-[var(--falla-bd)]',  text: 'text-[var(--falla)]' },
  violeta: { chip: 'bg-[var(--violeta-bg)] text-[var(--violeta)]',   ring: 'border-[var(--violeta-bd)]',text: 'text-[var(--violeta)]' },
  cian:    { chip: 'bg-[var(--cian-bg)] text-[var(--cian)]',         ring: 'border-[var(--cian-bd)]',   text: 'text-[var(--cian)]' },
};

const BOOL_OPTIONS = [
  { v: true as const, icon: Check, label: 'Tiene', cls: 'data-[on=true]:border-[var(--ok-bd)] data-[on=true]:bg-[var(--ok-bg)] data-[on=true]:text-[var(--ok)]' },
  { v: false as const, icon: X, label: 'No tiene', cls: 'data-[on=true]:border-[var(--falla-bd)] data-[on=true]:bg-[var(--falla-bg)] data-[on=true]:text-[var(--falla)]' },
  { v: null, icon: Minus, label: 'No aplica', cls: 'data-[on=true]:border-[var(--border-strong)] data-[on=true]:bg-[var(--surface-3)] data-[on=true]:text-[var(--muted)]' },
];

const STATES = [
  { v: 'BUENO' as const, label: 'Bueno', cls: '!border-[var(--ok-bd)] !bg-[var(--ok-bg)] !text-[var(--ok)]' },
  { v: 'REGULAR' as const, label: 'Regular', cls: '!border-[var(--warn-bd)] !bg-[var(--warn-bg)] !text-[var(--warn)]' },
  { v: 'MALO' as const, label: 'Malo', cls: '!border-[var(--falla-bd)] !bg-[var(--falla-bg)] !text-[var(--falla)]' },
];

/**
 * Checklist del taller: inventario de recepción, detalles visuales del vehículo
 * y control de calidad. Cada ítem es una tarjeta con su ícono; los booleanos
 * tienen tres estados a propósito — sí, no y "no aplica", que es distinto de no
 * haberlo mirado — y el encabezado de cada grupo lleva la cuenta.
 */
export function Checklist({
  items,
  value,
  onChange,
  readOnly = false,
  columns = 2,
}: {
  items: readonly ChecklistItem[];
  value: ChecklistValue;
  onChange: (next: ChecklistValue) => void;
  readOnly?: boolean;
  columns?: 1 | 2;
}) {
  const groups = useMemo(() => [...new Set(items.map((i) => i.group))], [items]);
  const set = (code: string, v: boolean | string | null) => onChange({ ...value, [code]: v });

  const revisado = (item: ChecklistItem) => {
    const v = value[item.code];
    if (item.kind === 'text') return typeof v === 'string' && v.trim().length > 0;
    return v !== undefined;
  };

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const style = CHECKLIST_GROUPS[group] ?? { icon: 'ListChecks', tone: 'brand' as const };
        const tone = TONE[style.tone] ?? TONE.brand!;
        const groupItems = items.filter((i) => i.group === group);
        const hechos = groupItems.filter(revisado).length;
        const completo = hechos === groupItems.length;

        return (
          <section key={group}>
            <header className="mb-2 flex items-center gap-2.5">
              <span className={cn('grid size-7 shrink-0 place-items-center rounded-[9px]', tone.chip)}>
                <Glyph name={style.icon} className="size-4" />
              </span>
              <h3 className={cn('text-[13px] font-bold uppercase tracking-wide', tone.text)}>{group}</h3>
              <span
                className={cn(
                  'ts-nav-count !ml-0',
                  completo && 'bg-[var(--ok-bg)] text-[var(--ok)]',
                )}
                data-tooltip-id="ts-tip"
                data-tooltip-content={completo ? 'Todo el grupo revisado' : `${groupItems.length - hechos} sin revisar`}
              >
                {hechos}/{groupItems.length}
              </span>
              <span className="h-px flex-1 bg-[var(--border)]" aria-hidden />
            </header>

            <div className={cn('grid gap-2', columns === 2 && 'lg:grid-cols-2')}>
              {groupItems.map((item, i) => {
                const marcado = revisado(item);
                return (
                  <motion.div
                    key={item.code}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(i, 10) * 0.02 }}
                    className={cn(
                      'flex items-center gap-2.5 rounded-[var(--r)] border bg-[var(--surface)] p-2.5 transition',
                      marcado ? tone.ring : 'border-[var(--border)]',
                      !readOnly && 'hover:shadow-[var(--sh-xs)]',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-[9px] transition',
                        marcado ? tone.chip : 'bg-[var(--surface-2)] text-[var(--subtle)]',
                      )}
                      aria-hidden
                    >
                      <Glyph name={item.icon} className="size-[17px]" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium leading-tight">{item.label}</span>
                      {item.hint && <span className="block truncate text-[11px] text-[var(--muted)]">{item.hint}</span>}
                    </span>

                    {item.kind === 'bool' && (
                      <span className="flex shrink-0 gap-1" role="group" aria-label={item.label}>
                        {BOOL_OPTIONS.map(({ v, icon: Icon, cls, label }) => (
                          <button
                            key={String(v)}
                            type="button"
                            disabled={readOnly}
                            data-on={value[item.code] === v}
                            onClick={() => set(item.code, v)}
                            aria-label={`${item.label}: ${label}`}
                            aria-pressed={value[item.code] === v}
                            data-tooltip-id="ts-tip"
                            data-tooltip-content={label}
                            className={cn(
                              'focus-ring grid size-7 place-items-center rounded-lg border border-[var(--border)] text-[var(--subtle)] transition hover:border-[var(--border-strong)] disabled:opacity-60',
                              cls,
                            )}
                          >
                            <Icon className="size-3.5" aria-hidden />
                          </button>
                        ))}
                      </span>
                    )}

                    {item.kind === 'state' && (
                      <span className="flex shrink-0 gap-1" role="group" aria-label={item.label}>
                        {STATES.map((s) => (
                          <button
                            key={s.v}
                            type="button"
                            disabled={readOnly}
                            onClick={() => set(item.code, s.v)}
                            aria-pressed={value[item.code] === s.v}
                            className={cn('ts-chip !px-2.5 !py-1 !text-[12px]', value[item.code] === s.v && s.cls)}
                          >
                            {s.label}
                          </button>
                        ))}
                      </span>
                    )}

                    {item.kind === 'text' && (
                      <input
                        className="ts-input sm !w-44 shrink-0"
                        disabled={readOnly}
                        value={typeof value[item.code] === 'string' ? (value[item.code] as string) : ''}
                        onChange={(e) => set(item.code, e.target.value)}
                        aria-label={item.label}
                        placeholder="Anotá qué ves"
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Resumen de lo marcado, para mostrar en una ficha sin repetir el formulario. */
export function ChecklistSummary({
  items,
  value,
  emptyText = 'Todavía no se registró nada.',
}: {
  items: readonly ChecklistItem[];
  value: ChecklistValue;
  emptyText?: string;
}) {
  const presentes = items.filter((i) => value[i.code] === true);
  const estados = items.filter((i) => i.kind === 'state' && typeof value[i.code] === 'string');
  const textos = items.filter((i) => i.kind === 'text' && typeof value[i.code] === 'string' && (value[i.code] as string).trim());

  if (presentes.length === 0 && estados.length === 0 && textos.length === 0) {
    return <p className="text-[12.5px] text-[var(--muted)]">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {presentes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presentes.map((i) => (
            <span key={i.code} className="ts-badge brand">
              <Glyph name={i.icon} className="size-3" /> {i.label}
            </span>
          ))}
        </div>
      )}
      {estados.map((i) => {
        const v = value[i.code] as string;
        return (
          <p key={i.code} className="flex items-center gap-1.5 text-[12.5px]">
            <Glyph name={i.icon} className="size-3.5 text-[var(--subtle)]" />
            <span className="text-[var(--muted)]">{i.label}:</span>
            <span className={cn('font-semibold',
              v === 'BUENO' && 'text-[var(--ok)]',
              v === 'REGULAR' && 'text-[var(--warn)]',
              v === 'MALO' && 'text-[var(--falla)]')}>
              {v.charAt(0) + v.slice(1).toLowerCase()}
            </span>
          </p>
        );
      })}
      {textos.map((i) => (
        <p key={i.code} className="flex items-start gap-1.5 text-[12.5px]">
          <Glyph name={i.icon} className="mt-0.5 size-3.5 shrink-0 text-[var(--subtle)]" />
          <span><span className="text-[var(--muted)]">{i.label}:</span> {value[i.code] as string}</span>
        </p>
      ))}
    </div>
  );
}

export { ListChecks };
