'use client';

import { use } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, Plus, DoorOpen, FileWarning, Receipt, ShieldCheck, Wrench, Hammer,
  Stethoscope, SprayCan, CircleDot, BadgeCheck, ClipboardCheck,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody } from '@/components/ui';
import { ProcessStepper } from '@/components/process-stepper';
import { WorkOrdersView } from '@/components/work-orders-view';
import { intakeBySlug, intakeQuery, WORKORDER_KIND_DEFS, type WorkOrderKind } from '@taller/shared';

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FileWarning, Receipt, ShieldCheck, Wrench, Hammer, Stethoscope, SprayCan, CircleDot,
  BadgeCheck, ClipboardCheck,
};

function Glyph({ name, className }: { name: string; className?: string }) {
  const Cmp = CHANNEL_ICONS[name] ?? DoorOpen;
  return <Cmp className={className} />;
}

export default function IngresoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const channel = intakeBySlug(slug);
  if (!channel) notFound();

  const kind = channel.kinds.length === 1 ? (channel.kinds[0] as WorkOrderKind) : null;

  return (
    <>
      <Topbar
        title={channel.label}
        actions={
          <Link href={`/ordenes/nueva${kind ? `?kind=${kind}` : ''}`}>
            <Button size="sm" tip={`Registrar un ingreso de tipo ${channel.short.toLowerCase()}`}>
              <Plus className="size-4" aria-hidden /> Nuevo ingreso
            </Button>
          </Link>
        }
      />

      <div className="space-y-4 p-6">
        <Link href="/ingresos" className="focus-ring inline-flex min-h-[24px] items-center gap-1.5 rounded text-[13px] text-[var(--muted)] hover:text-[var(--brand)]">
          <ArrowLeft className="size-3.5" aria-hidden /> Ingresos
        </Link>

        <Card>
          <CardBody className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <span className="flex items-start gap-3 lg:w-[340px] lg:shrink-0">
              <span
                className="grid size-11 shrink-0 place-items-center rounded-[var(--r)]"
                style={{ background: `color-mix(in srgb, ${channel.token} 12%, transparent)`, color: channel.token }}
              >
                <Glyph name={channel.icon} className="size-5" />
              </span>
              <span>
                <span className="block text-[15px] font-bold leading-tight">{channel.label}</span>
                <span className="block text-[12.5px] leading-snug text-[var(--muted)]">{channel.description}</span>
              </span>
            </span>

            {kind ? (
              <div className="min-w-0 flex-1">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
                  Recorrido de {WORKORDER_KIND_DEFS[kind].short.toLowerCase()}
                </p>
                <ProcessStepper kind={kind} status="RECEPCION" compact />
              </div>
            ) : (
              <p className="min-w-0 flex-1 text-[12.5px] text-[var(--muted)]">
                Agrupa varios tipos de ingreso: cada vehículo sigue el recorrido que le corresponde según cómo entró.
              </p>
            )}
          </CardBody>
        </Card>

        <WorkOrdersView
          storageKey={slug}
          fixedQuery={intakeQuery(channel)}
          hideKindFilter={channel.kinds.length === 1}
          accent={channel.token}
        />
      </div>
    </>
  );
}
