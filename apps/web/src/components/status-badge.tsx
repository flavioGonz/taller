'use client';

import { Badge } from '@/components/ui';
import { STATUS_LABELS, type WorkOrderStatus } from '@taller/shared';

const TONES: Record<WorkOrderStatus, 'neutral' | 'info' | 'warn' | 'success' | 'danger' | 'accent'> = {
  RECEPCION: 'neutral',
  DIAGNOSTICO: 'info',
  PRESUPUESTADO: 'accent',
  APROBADO: 'info',
  RECHAZADO: 'danger',
  EN_PROCESO: 'warn',
  ESPERA_REPUESTO: 'danger',
  CONTROL_CALIDAD: 'info',
  LAVADO: 'accent',
  FINALIZADO: 'success',
  ENTREGADO: 'success',
  CANCELADO: 'neutral',
};

export function StatusBadge({ status }: { status: WorkOrderStatus | string }) {
  const s = status as WorkOrderStatus;
  return <Badge tone={TONES[s] ?? 'neutral'}>{STATUS_LABELS[s] ?? status}</Badge>;
}

export function PriorityDot({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    BAJA: 'bg-[var(--subtle)]',
    NORMAL: 'bg-[var(--brand-500)]',
    ALTA: 'bg-[var(--warn)]',
    URGENTE: 'bg-[var(--falla)]',
  };
  return <span className={`inline-block size-2 rounded-full ${map[priority] ?? map.NORMAL}`} title={`Prioridad ${priority.toLowerCase()}`} aria-label={`Prioridad ${priority.toLowerCase()}`} />;
}
