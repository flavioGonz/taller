'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Search } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Card, CardBody, Select, Skeleton, EmptyState, Table, Th, Td, Badge, Input } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { useSocketEvent } from '@/hooks/use-socket';
import { qs } from '@/lib/api';
import { customerName, formatDate } from '@/lib/utils';
import { QUOTE_STATUSES, QUOTE_STATUS_LABELS, formatMoney, SOCKET_EVENTS, type QuoteStatus } from '@taller/shared';

interface Quote {
  id: string; number: string; version: number; status: QuoteStatus;
  total: string; approvedTotal: string; createdAt: string; sentAt: string | null; decidedAt: string | null;
  workOrder: {
    id: string; number: string; status: string;
    customer: { firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean };
    vehicle: { plate: string; brand: string; model: string };
  };
}

const TONE: Record<QuoteStatus, 'neutral' | 'info' | 'success' | 'warn' | 'danger' | 'accent'> = {
  BORRADOR: 'neutral', ENVIADO: 'info', APROBADO: 'success', APROBADO_PARCIAL: 'warn',
  RECHAZADO: 'danger', VENCIDO: 'danger', ANULADO: 'neutral', SUPERSEDIDO: 'neutral',
};

export default function PresupuestosPage() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const { data, loading, refetch } = useApi<Quote[]>(`/quotes${qs({ status })}`);

  useSocketEvent(SOCKET_EVENTS.QUOTE_DECIDED, () => refetch());
  useSocketEvent(SOCKET_EVENTS.QUOTE_SENT, () => refetch());

  const rows = (data ?? []).filter((r) => {
    if (!q) return true;
    const t = q.toLowerCase();
    return (
      r.number.toLowerCase().includes(t) ||
      r.workOrder.number.toLowerCase().includes(t) ||
      r.workOrder.vehicle.plate.toLowerCase().includes(t) ||
      customerName(r.workOrder.customer).toLowerCase().includes(t)
    );
  });

  return (
    <>
      <Topbar title="Presupuestos" />

      <div className="space-y-4 p-6">
        <Card>
          <CardBody className="flex flex-wrap items-end gap-4">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-[34px] size-4 text-[var(--subtle)]" aria-hidden />
              <Input label="Buscar" className="pl-9" placeholder="Nº, OT, matrícula o cliente" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="w-56">
              <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todos</option>
                {QUOTE_STATUSES.map((s) => <option key={s} value={s}>{QUOTE_STATUS_LABELS[s]}</option>)}
              </Select>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-0">
            {loading && !data ? (
              <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<FileText className="size-8" aria-hidden />}
                title="Sin presupuestos"
                description="Los presupuestos se crean desde la orden de trabajo, después del diagnóstico."
              />
            ) : (
              <Table>
                <thead>
                  <tr><Th>Presupuesto</Th><Th>OT / vehículo</Th><Th>Cliente</Th><Th>Estado</Th><Th className="text-right">Total</Th><Th className="text-right">Aprobado</Th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <Td>
                        <Link href={`/presupuestos/${r.id}`} className="focus-ring rounded font-semibold hover:underline">
                          {r.number} <span className="text-[var(--subtle)]">v{r.version}</span>
                        </Link>
                        <div className="text-[11.5px] text-[var(--muted)]">{formatDate(r.createdAt)}</div>
                      </Td>
                      <Td>
                        <Link href={`/ordenes/${r.workOrder.id}`} className="focus-ring rounded text-[13px] hover:underline">{r.workOrder.number}</Link>
                        <div className="mono text-[11.5px] text-[var(--muted)]">{r.workOrder.vehicle.plate} · {r.workOrder.vehicle.brand}</div>
                      </Td>
                      <Td className="max-w-[190px] truncate">{customerName(r.workOrder.customer)}</Td>
                      <Td><Badge tone={TONE[r.status]}>{QUOTE_STATUS_LABELS[r.status]}</Badge></Td>
                      <Td className="mono text-right">{formatMoney(r.total)}</Td>
                      <Td className="mono text-right font-semibold text-[var(--ok)]">
                        {Number(r.approvedTotal) > 0 ? formatMoney(r.approvedTotal) : '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
