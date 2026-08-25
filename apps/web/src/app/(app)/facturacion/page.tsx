'use client';

import { useState } from 'react';
import { CreditCard, Hash, DollarSign, FileText, Filter, Receipt, Wallet, AlertTriangle } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, Select, Badge, Input, Stat } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { useApi } from '@/hooks/use-api';
import { api, qs } from '@/lib/api';
import { customerName, formatDate, cn } from '@/lib/utils';
import { formatMoney, type Paginated } from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';

interface Doc {
  id: string; type: string; number: string; status: string; issueDate: string; total: string; paid: string; currency: string;
  customer: { firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean };
  workOrder?: { id: string; number: string } | null;
}

const TONE: Record<string, 'neutral' | 'success' | 'warn' | 'danger' | 'info'> = {
  BORRADOR: 'neutral', EMITIDO: 'info', PAGADO: 'success', PARCIAL: 'warn', ANULADO: 'danger', VENCIDO: 'danger',
};

export default function FacturacionPage() {
  const { can } = useAuth();
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState<Doc | null>(null);
  const { data, loading, refetch } = useApi<Paginated<Doc>>(`/billing/documents${qs({ page, limit: 20, type, status })}`);

  async function registrarPago(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!paying) return;
    const fd = new FormData(e.currentTarget);
    await api.post(`/billing/documents/${paying.id}/payments`, {
      method: fd.get('method'),
      amount: Number(fd.get('amount')),
      reference: fd.get('reference') || undefined,
    });
    setPaying(null);
    refetch();
  }

  const rowsNow = data?.rows ?? [];
  const totalFacturado = rowsNow.reduce((a, d) => a + Number(d.total), 0);
  const totalCobrado = rowsNow.reduce((a, d) => a + Number(d.paid), 0);
  const totalSaldo = Math.max(0, totalFacturado - totalCobrado);
  const conSaldo = rowsNow.filter((d) => Number(d.total) - Number(d.paid) > 0 && d.status !== 'ANULADO').length;

  const columns: Column<Doc>[] = [
    {
      key: 'documento',
      header: 'Documento',
      sortValue: (d) => d.number,
      cell: (d) => (
        <div className="min-w-0">
          <p className="mono text-[13px] font-bold">{d.number}</p>
          <p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">{d.type.toLowerCase()}</p>
        </div>
      ),
    },
    {
      key: 'cliente',
      header: 'Cliente',
      sortValue: (d) => customerName(d.customer),
      cell: (d) => <span className="block max-w-[210px] truncate text-[13px]">{customerName(d.customer)}</span>,
    },
    {
      key: 'ot',
      header: 'OT',
      hideBelow: 'lg',
      sortValue: (d) => d.workOrder?.number ?? '',
      cell: (d) => d.workOrder
        ? <a href={`/ordenes/${d.workOrder.id}`} className="focus-ring mono rounded text-[12.5px] hover:text-[var(--brand)]">{d.workOrder.number}</a>
        : <span className="text-[var(--subtle)]">—</span>,
    },
    {
      key: 'fecha',
      header: 'Fecha',
      hideBelow: 'md',
      sortValue: (d) => new Date(d.issueDate).getTime(),
      cell: (d) => <span className="text-[12.5px] text-[var(--muted)]">{formatDate(d.issueDate)}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      sortValue: (d) => d.status,
      cell: (d) => <Badge tone={TONE[d.status] ?? 'neutral'}>{d.status.toLowerCase()}</Badge>,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      sortValue: (d) => Number(d.total),
      cell: (d) => <span className="mono text-[13px]">{formatMoney(d.total, d.currency)}</span>,
    },
    {
      key: 'saldo',
      header: 'Saldo',
      align: 'right',
      tip: 'Lo que falta cobrar de este documento',
      sortValue: (d) => Number(d.total) - Number(d.paid),
      cell: (d) => {
        const saldo = Number(d.total) - Number(d.paid);
        return (
          <span className={cn('mono text-[13px] font-semibold', saldo > 0 ? 'text-[var(--falla)]' : 'text-[var(--ok)]')}>
            {formatMoney(saldo, d.currency)}
          </span>
        );
      },
    },
    {
      key: 'accion',
      header: '',
      width: '84px',
      align: 'right',
      cell: (d) => {
        const saldo = Number(d.total) - Number(d.paid);
        return can('billing:write') && saldo > 0 && d.status !== 'ANULADO' ? (
          <Button size="sm" variant="secondary" onClick={() => setPaying(d)} tip="Registrar un cobro sobre este documento">
            <CreditCard className="size-3.5" aria-hidden /> Cobrar
          </Button>
        ) : null;
      },
    },
  ];

  return (
    <>
      <Topbar title="Facturación" />

      <div className="space-y-4 p-6">
        {paying && (
          <Card>
            <CardBody>
              <form onSubmit={registrarPago} className="grid items-end gap-4 md:grid-cols-5">
                <div className="md:col-span-2">
                  <p className="text-xs text-[var(--text-muted)]">Registrar pago</p>
                  <p className="text-sm font-medium">{paying.number} · saldo {formatMoney(Number(paying.total) - Number(paying.paid), paying.currency)}</p>
                </div>
                <Select label="Método" name="method" icon={<CreditCard className="size-3.5" aria-hidden />} defaultValue="EFECTIVO">
                  <option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option>
                  <option value="DEBITO">Débito</option><option value="CREDITO">Crédito</option><option value="CHEQUE">Cheque</option>
                </Select>
                <Input label="Importe" name="amount" type="number" step="0.01" min={0.01} icon={<DollarSign className="size-3.5" aria-hidden />} defaultValue={Number(paying.total) - Number(paying.paid)} required />
                <Input label="Referencia" name="reference" icon={<Hash className="size-3.5" aria-hidden />} tip="Nº de transferencia, cheque o voucher" />
                <div className="flex gap-2 md:col-span-5">
                  <Button type="submit" size="sm">Guardar pago</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPaying(null)}>Cancelar</Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={<Receipt className="size-4" aria-hidden />} label="Documentos" value={String(data?.total ?? 0)} hint="Con el filtro actual" />
          <Stat icon={<Wallet className="size-4" aria-hidden />} label="Facturado" value={formatMoney(totalFacturado)} />
          <Stat icon={<CreditCard className="size-4" aria-hidden />} label="Cobrado" value={formatMoney(totalCobrado)} tone="ok" />
          <Stat icon={<AlertTriangle className="size-4" aria-hidden />} label="Por cobrar" value={formatMoney(totalSaldo)} hint={`${conSaldo} documentos`} tone={totalSaldo > 0 ? 'warn' : 'ok'} />
        </div>

        <Card>
          <CardBody className="p-0">
            <DataTable
              id="facturacion"
              rows={data?.rows}
              loading={loading}
              getKey={(d) => d.id}
              columns={columns}
              zebra
              emptyIcon={<Receipt className="size-6" aria-hidden />}
              emptyTitle="Sin documentos"
              emptyDescription="Las facturas y recibos se emiten al entregar el vehículo, desde la orden de trabajo."
              toolbar={
                <>
                  <Select aria-label="Tipo de documento" icon={<FileText className="size-3.5" aria-hidden />} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="!w-44">
                    <option value="">Todos los tipos</option><option value="PRESUPUESTO">Presupuesto</option>
                    <option value="FACTURA">Factura</option><option value="REMITO">Remito</option><option value="RECIBO">Recibo</option>
                  </Select>
                  <Select aria-label="Estado" icon={<Filter className="size-3.5" aria-hidden />} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="!w-44">
                    <option value="">Todos los estados</option><option value="EMITIDO">Emitido</option><option value="PARCIAL">Parcial</option>
                    <option value="PAGADO">Pagado</option><option value="ANULADO">Anulado</option>
                  </Select>
                </>
              }
              footer={
                <>
                  <span>{data?.total ?? 0} documentos · página {data?.page ?? 1} de {data?.pages ?? 1}</span>
                  <span className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                    <Button variant="secondary" size="sm" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
                  </span>
                </>
              }
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
