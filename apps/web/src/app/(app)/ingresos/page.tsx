'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Plus, ArrowRight, DoorOpen, FileWarning, Receipt, ShieldCheck, Wrench, Hammer,
  Stethoscope, SprayCan, CircleDot, BadgeCheck, ClipboardCheck,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Skeleton } from '@/components/ui';
import { ProcessStepper } from '@/components/process-stepper';
import { useApi } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { INTAKE_CHANNELS, MENU_INTAKES, WORKORDER_KIND_DEFS, type WorkOrderKind } from '@taller/shared';

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FileWarning, Receipt, ShieldCheck, Wrench, Hammer, Stethoscope, SprayCan, CircleDot,
  BadgeCheck, ClipboardCheck,
};

function Glyph({ name, className }: { name: string; className?: string }) {
  const Cmp = CHANNEL_ICONS[name] ?? DoorOpen;
  return <Cmp className={className} />;
}

const PORTAL = MENU_INTAKES.map((c) => c.slug);

export default function IngresosPage() {
  const counts = useApi<{ total: number; channels: Record<string, number> }>('/work-orders/intake-counts');
  const puertas = INTAKE_CHANNELS.filter((c) => PORTAL.includes(c.slug));
  const tipos = INTAKE_CHANNELS.filter((c) => !PORTAL.includes(c.slug));

  return (
    <>
      <Topbar
        title="Ingresos"
        description="Los vehículos agrupados por cómo entraron al taller"
        actions={
          <Link href="/ordenes/nueva">
            <Button size="sm" tip="Registrar el ingreso de un vehículo">
              <Plus className="size-4" aria-hidden /> Nuevo ingreso
            </Button>
          </Link>
        }
      />

      <div className="space-y-5 p-6">
        <p className="max-w-3xl text-[13.5px] text-[var(--muted)]">
          Cómo entró cada vehículo define su recorrido: qué se le pide al cliente, quién autoriza el trabajo y
          por qué etapas pasa. Elegí una puerta de entrada para ver sólo esos vehículos.
        </p>

        {/* ------------------------------------------------- las tres puertas */}
        <section aria-label="Puertas de entrada" className="grid gap-4 lg:grid-cols-3">
          {puertas.map((c, i) => {
            const n = counts.data?.channels?.[c.slug] ?? 0;
            return (
              <motion.div
                key={c.slug}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  href={`/ingresos/${c.slug}`}
                  className="focus-ring group relative block h-full overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:-translate-y-1 hover:shadow-[var(--sh-lg)]"
                  style={{ borderTopColor: c.token, borderTopWidth: 3 }}
                >
                  <span
                    className="absolute -right-8 -top-8 size-32 rounded-full opacity-[0.07] transition-transform duration-500 group-hover:scale-150"
                    style={{ background: c.token }}
                    aria-hidden
                  />
                  <span
                    className="grid size-12 place-items-center rounded-[var(--r)]"
                    style={{ background: `color-mix(in srgb, ${c.token} 12%, transparent)`, color: c.token }}
                  >
                    <Glyph name={c.icon} className="size-6" />
                  </span>

                  <h2 className="mt-3 text-[16px] font-bold leading-tight">{c.label}</h2>
                  <p className="mt-1 text-[12.5px] leading-snug text-[var(--muted)]">{c.description}</p>

                  <div className="mt-4 flex items-end justify-between">
                    <span>
                      <span className="mono block text-[30px] font-extrabold leading-none" style={{ color: c.token }}>
                        {counts.loading && !counts.data ? '—' : n}
                      </span>
                      <span className="text-[11.5px] text-[var(--muted)]">
                        {n === 1 ? 'vehículo en curso' : 'vehículos en curso'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-[12.5px] font-semibold text-[var(--muted)] transition group-hover:gap-2 group-hover:text-[var(--brand)]">
                      Ver <ArrowRight className="size-4" aria-hidden />
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </section>

        {/* ------------------------------------------------- por tipo de OT */}
        <Card>
          <CardHeader>
            <CardTitle>Por tipo de ingreso</CardTitle>
            <span className="text-[12px] text-[var(--muted)]">Cada tipo tiene su propio recorrido</span>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {tipos.map((c, i) => {
              const n = counts.data?.channels?.[c.slug] ?? 0;
              const kind = c.kinds[0] as WorkOrderKind | undefined;
              const def = kind ? WORKORDER_KIND_DEFS[kind] : undefined;
              return (
                <motion.div
                  key={c.slug}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.04, duration: 0.3 }}
                >
                  <Link
                    href={`/ingresos/${c.slug}`}
                    className="focus-ring flex h-full flex-col gap-2 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-3.5 transition hover:border-[var(--brand)] hover:shadow-[var(--sh-md)]"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="grid size-8 shrink-0 place-items-center rounded-[var(--r-sm)]"
                        style={{ background: `color-mix(in srgb, ${c.token} 12%, transparent)`, color: c.token }}
                      >
                        <Glyph name={c.icon} className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold">{c.short}</span>
                        <span className="block text-[11px] text-[var(--muted)]">
                          {def ? `${def.steps.length} etapas` : ''}
                        </span>
                      </span>
                      <span className="mono text-[18px] font-extrabold" style={{ color: n > 0 ? c.token : 'var(--subtle)' }}>{n}</span>
                    </span>
                    <p className="text-[11.5px] leading-snug text-[var(--muted)]">{c.description}</p>
                  </Link>
                </motion.div>
              );
            })}
          </CardBody>
        </Card>

        {/* ------------------------------------------------- recorridos */}
        <Card>
          <CardHeader>
            <CardTitle>Recorrido de cada tipo</CardTitle>
            <span className="text-[12px] text-[var(--muted)]">Pasá el mouse por cada etapa para ver qué se hace</span>
          </CardHeader>
          <CardBody className="space-y-7">
            {tipos.map((c) => {
              const kind = c.kinds[0] as WorkOrderKind | undefined;
              if (!kind) return null;
              return (
                <div key={c.slug}>
                  <p className="mb-3 flex items-center gap-2 text-[13px] font-bold">
                    <Glyph name={c.icon} className="size-4" />
                    {WORKORDER_KIND_DEFS[kind].label}
                  </p>
                  <ProcessStepper kind={kind} status="RECEPCION" compact />
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
