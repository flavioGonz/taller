'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Search, Send, CheckCircle2, Clock, Filter } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Card, CardBody, Select, Badge, Input, Stat } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { useApi } from '@/hooks/use-api';
import { useSocketEvent } from '@/hooks/use-socket';
import { qs } from '@/lib/api';
import { customerName, formatDate } from '@/lib/utils';
import { PdfLink } from '@/components/pdf-link';
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

  const pendientes = rows.filter((r) => r.status === 'ENVIADO').length;
  const aprobados = rows.filter((r) => r.status === 'APROBADO' || r.status === 'APROBADO_PARCIAL');
  const montoAprobado = aprobados.reduce((a, r) => a + Number(r.approvedTotal), 0);
  const borradores = rows.filter((r) => r.status === 'BORRADOR').length;

  const columns: Column<Quote>[] = [
    {
      key: 'numero',
      header: 'Presupuesto',
      sortValue: (r) => r.number,
      cell: (r) => (
        <div className="min-w-0">
          <Link href={`/presupuestos/${r.id}`} className="focus-ring mono rounded text-[13px] font-bold hover:text-[var(--brand)]">
            {r.number} <span className="font-normal text-[var(--subtle)]">v{r.version}</span>
          </Link>
          <div className="text-[11.5px] text-[var(--muted)]">{formatDate(r.createdAt)}</div>
        </div>
      ),
    },
    {
      key: 'ot',
      header: 'OT / vehículo',
      sortValue: (r) => r.workOrder.vehicle.plate,
      cell: (r) => (
        <div className="min-w-0">
          <Link href={`/ordenes/${r.workOrder.id}`} className="focus-ring mono rounded text-[12.5px] hover:text-[var(--brand)]">
            {r.workOrder.number}
          </Link>
          <div className="mono truncate text-[11.5px] text-[var(--muted)]">
            {r.workOrder.vehicle.plate} · {r.workOrder.vehicle.brand} {r.workOrder.vehicle.model}
          </div>
        </div>
      ),
    },
    {
      key: 'cliente',
      header: 'Cliente',
      hideBelow: 'md',
      sortValue: (r) => customerName(r.workOrder.customer),
      cell: (r) => <span className="block max-w-[190px] truncate text-[13px]">{customerName(r.workOrder.customer)}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      sortValue: (r) => QUOTE_STATUS_LABELS[r.status],
      cell: (r) => (
        <div className="space-y-1">
          <Badge tone={TONE[r.status]}>{QUOTE_STATUS_LABELS[r.status]}</Badge>
          {r.sentAt && !r.decidedAt && (
            <p className="text-[10.5px] text-[var(--muted)]">enviado {formatDate(r.sentAt)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      sortValue: (r) => Number(r.total),
      cell: (r) => <span className="mono text-[13px]">{formatMoney(r.total)}</span>,
    },
    {
      key: 'aprobado',
      header: 'Aprobado',
      align: 'right',
      hideBelow: 'sm',
      tip: 'Lo que el cliente aprobó, ítem por ítem',
      sortValue: (r) => Number(r.approvedTotal),
      cell: (r) => (
        <span className="mono text-[13px] font-bold text-[var(--ok)]">
          {Number(r.approvedTotal) > 0 ? formatMoney(r.approvedTotal) : <span className="font-normal text-[var(--subtle)]">—</span>}
        </span>
      ),
    },
    {
      key: 'pdf',
      header: '',
      width: '52px',
      align: 'right',
      cell: (r) => <PdfLink path={`/quotes/${r.id}/pdf`} label="" className="!h-7 !px-2" tip={`Ver el PDF de ${r.number}`} />,
    },
  ];

  return (
    <>
      <Topbar title="Presupuestos" description="Lo que se le ofreció a cada cliente y qué contestó" />

      <div className="space-y-4 p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={<FileText className="size-4" aria-hidden />} label="Presupuestos" value={String(rows.length)} hint="Con el filtro actual" />
          <Stat icon={<Clock className="size-4" aria-hidden />} label="En borrador" value={String(borradores)} hint="Todavía sin enviar" tone={borradores > 0 ? 'warn' : 'ok'} />
          <Stat icon={<Send className="size-4" aria-hidden />} label="Esperando respuesta" value={String(pendientes)} hint="Enviados al cliente" tone={pendientes > 0 ? 'warn' : 'ok'} />
          <Stat icon={<CheckCircle2 className="size-4" aria-hidden />} label="Aprobado" value={formatMoney(montoAprobado)} hint={`${aprobados.length} presupuestos`} tone="ok" />
        </div>

        <Card>
          <CardBody className="p-0">
            <DataTable
              id="presupuestos"
              rows={rows}
              loading={loading && !data}
              getKey={(r) => r.id}
              rowHref={(r) => `/presupuestos/${r.id}`}
              columns={columns}
              zebra
              initialSort={{ key: 'numero', dir: 'desc' }}
              emptyIcon={<FileText className="size-6" aria-hidden />}
              emptyTitle={q || status ? 'Ningún presupuesto coincide' : 'Todavía no hay presupuestos'}
              emptyDescription="Los presupuestos se crean desde la orden de trabajo, después del diagnóstico."
              toolbar={
                <>
                  <Input
                    aria-label="Buscar presupuesto"
                    icon={<Search className="size-3.5" aria-hidden />}
                    placeholder="Nº, OT, matrícula o cliente"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="!w-full sm:!w-72"
                  />
                  <Select aria-label="Estado" icon={<Filter className="size-3.5" aria-hidden />} value={status} onChange={(e) => setStatus(e.target.value)} className="!w-48">
                    <option value="">Todos los estados</option>
                    {QUOTE_STATUSES.map((s) => <option key={s} value={s}>{QUOTE_STATUS_LABELS[s]}</option>)}
                  </Select>
                </>
              }
              footer={<span>{rows.length} presupuestos</span>}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
