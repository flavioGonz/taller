'use client';

import Link from 'next/link';
import {
  Clock, Wrench, Package, User, ShieldCheck, AlertTriangle, Fingerprint,
  Hammer, Stethoscope, SprayCan, CircleDot, BadgeCheck, FileWarning, ClipboardCheck,
} from 'lucide-react';
import { ProcessBar } from '@/components/process-stepper';
import { VehicleIdentity } from '@/components/vehicle-bits';
import { PriorityDot } from '@/components/status-badge';
import { customerName, formatDate, relativeTime, cn } from '@/lib/utils';
import { WORKORDER_KIND_DEFS, STATUS_LABELS, formatMoney, type WorkOrderKind, type WorkOrderStatus } from '@taller/shared';

export interface WorkOrderRow {
  id: string; number: string; auditId?: string | null;
  kind: WorkOrderKind; status: WorkOrderStatus; priority: string;
  receivedAt: string; promisedAt: string | null;
  laborTotal?: string; partsTotal?: string; grandTotal: string; currency?: string;
  customer: { firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean; phone?: string | null };
  vehicle: {
    id?: string; plate: string; brand: string; model: string; year?: number | null; color?: string | null;
    photoUrl?: string | null; brandRef?: { logoFile: string | null; name?: string } | null;
  };
  technician?: { id: string; firstName: string; lastName: string } | null;
  bay?: { id: string; name: string } | null;
  insuranceCase?: { status: string; insurer: { name: string } } | null;
  _count?: { items: number; quotes: number };
}

/** Ícono de cada tipo de ingreso. */
export const KIND_ICONS: Record<WorkOrderKind, React.ComponentType<{ className?: string }>> = {
  MANTENIMIENTO: Wrench,
  REPARACION: Hammer,
  DIAGNOSTICO: Stethoscope,
  CHAPA_PINTURA: SprayCan,
  NEUMATICOS: CircleDot,
  GARANTIA: BadgeCheck,
  SINIESTRO: FileWarning,
  PREENTREGA: ClipboardCheck,
};

export function KindIcon({ kind, className }: { kind: WorkOrderKind; className?: string }) {
  const Cmp = KIND_ICONS[kind] ?? Wrench;
  return <Cmp className={className} />;
}

/** Chip del tipo de ingreso, con el color propio de ese recorrido. */
export function KindChip({ kind, size = 'md' }: { kind: WorkOrderKind; size?: 'sm' | 'md' }) {
  const def = WORKORDER_KIND_DEFS[kind] ?? WORKORDER_KIND_DEFS.REPARACION;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-[11.5px]',
      )}
      style={{ background: `color-mix(in srgb, ${def.token} 12%, transparent)`, color: def.token }}
      data-tooltip-id="ts-tip"
      data-tooltip-content={def.description}
    >
      <KindIcon kind={kind} className={size === 'sm' ? 'size-3' : 'size-3.5'} />
      {def.short}
    </span>
  );
}

/** Días que lleva el vehículo en el taller y si se pasó de la fecha prometida. */
function timing(row: WorkOrderRow) {
  const dias = Math.max(0, Math.floor((Date.now() - new Date(row.receivedAt).getTime()) / 86_400_000));
  const atrasada = !!row.promisedAt && new Date(row.promisedAt) < new Date() && row.status !== 'ENTREGADO';
  return { dias, atrasada };
}

/**
 * Tarjeta de orden de trabajo: se ve el auto, de quién es, en qué anda, cuántos
 * repuestos lleva y cuánto va. Es lo que se usa tanto en el tablero como en la
 * vista de fichas.
 */
export function WorkOrderCard({ row, compact = false }: { row: WorkOrderRow; compact?: boolean }) {
  const def = WORKORDER_KIND_DEFS[row.kind] ?? WORKORDER_KIND_DEFS.REPARACION;
  const { dias, atrasada } = timing(row);

  return (
    <Link
      href={`/ordenes/${row.id}`}
      // el arrastre lo maneja el contenedor del tablero, no el enlace
      draggable={false}
      className="focus-ring group block overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] transition hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-[var(--sh-md)]"
    >
      {/* banda del tipo de ingreso */}
      <span className="block h-1 w-full" style={{ background: def.token }} aria-hidden />

      <div className={cn('space-y-2.5', compact ? 'p-3' : 'p-3.5')}>
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="mono truncate text-[13px] font-bold">{row.number}</span>
              <PriorityDot priority={row.priority} />
            </span>
            {row.auditId && (
              <span
                className="mono flex items-center gap-1 text-[10.5px] text-[var(--subtle)]"
                data-tooltip-id="ts-tip"
                data-tooltip-content="ID de auditoría: acompaña a esta reparación toda su vida"
              >
                <Fingerprint className="size-3 shrink-0" aria-hidden /> {row.auditId}
              </span>
            )}
          </span>
          <KindChip kind={row.kind} size="sm" />
        </div>

        <VehicleIdentity vehicle={row.vehicle} size={compact ? 44 : 52} />

        <p className="flex items-center gap-1.5 truncate text-[12.5px] text-[var(--muted)]">
          <User className="size-3.5 shrink-0 text-[var(--subtle)]" aria-hidden />
          <span className="truncate">{customerName(row.customer)}</span>
        </p>

        {row.insuranceCase && (
          <p className="flex items-center gap-1.5 truncate rounded-[var(--r-sm)] bg-[var(--surface-2)] px-2 py-1 text-[11.5px]">
            <ShieldCheck className="size-3.5 shrink-0 text-[var(--brand)]" aria-hidden />
            <span className="truncate">{row.insuranceCase.insurer.name}</span>
            <span className="ml-auto shrink-0 text-[var(--muted)]">{row.insuranceCase.status.replace(/_/g, ' ').toLowerCase()}</span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--muted)]">
          <span className="inline-flex items-center gap-1" data-tooltip-id="ts-tip" data-tooltip-content="Técnico asignado">
            <Wrench className="size-3.5 shrink-0" aria-hidden />
            {row.technician ? row.technician.firstName : 'sin asignar'}
          </span>
          {row._count && (
            <span className="inline-flex items-center gap-1" data-tooltip-id="ts-tip" data-tooltip-content="Ítems cargados en la OT (repuestos y mano de obra)">
              <Package className="size-3.5 shrink-0" aria-hidden />
              {row._count.items} ítem{row._count.items === 1 ? '' : 's'}
            </span>
          )}
          <span
            className={cn('inline-flex items-center gap-1', atrasada && 'font-semibold text-[var(--falla)]')}
            data-tooltip-id="ts-tip"
            data-tooltip-content={row.promisedAt ? `Prometido para ${formatDate(row.promisedAt, true)}` : `Ingresó ${relativeTime(row.receivedAt)}`}
          >
            {atrasada ? <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> : <Clock className="size-3.5 shrink-0" aria-hidden />}
            {dias === 0 ? 'hoy' : `${dias} día${dias === 1 ? '' : 's'}`}
          </span>
        </div>

        <div>
          <ProcessBar kind={row.kind} status={row.status} showLabel />
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
          <span className="truncate text-[11px] text-[var(--subtle)]">
            {row.promisedAt
              ? `Entrega ${formatDate(row.promisedAt)}`
              : row.bay?.name
                ? row.bay.name
                : `Ingresó ${formatDate(row.receivedAt)}`}
          </span>
          <span className="mono shrink-0 text-[13px] font-bold">{formatMoney(row.grandTotal, row.currency)}</span>
        </div>
      </div>
    </Link>
  );
}
