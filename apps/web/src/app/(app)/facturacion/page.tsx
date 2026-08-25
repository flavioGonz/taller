'use client';

import { useState } from 'react';
import { CreditCard, Hash, DollarSign, FileText, Filter } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, Select, Skeleton, EmptyState, Table, Th, Td, Badge, Input } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { api, qs } from '@/lib/api';
import { customerName, formatDate } from '@/lib/utils';
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

        <Card>
          <CardBody className="flex flex-wrap gap-4">
            <div className="w-48">
              <Select label="Tipo" name="type" icon={<FileText className="size-3.5" aria-hidden />} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
                <option value="">Todos</option><option value="PRESUPUESTO">Presupuesto</option>
                <option value="FACTURA">Factura</option><option value="REMITO">Remito</option><option value="RECIBO">Recibo</option>
              </Select>
            </div>
            <div className="w-48">
              <Select label="Estado" name="status" icon={<Filter className="size-3.5" aria-hidden />} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">Todos</option><option value="EMITIDO">Emitido</option><option value="PARCIAL">Parcial</option>
                <option value="PAGADO">Pagado</option><option value="ANULADO">Anulado</option>
              </Select>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-0">
            {loading && !data ? (
              <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (data?.rows.length ?? 0) === 0 ? (
              <EmptyState title="Sin documentos" description="Los presupuestos se generan desde el detalle de cada orden de trabajo." />
            ) : (
              <>
                <Table>
                  <thead><tr><Th>Documento</Th><Th>Cliente</Th><Th>OT</Th><Th>Fecha</Th><Th>Estado</Th><Th className="text-right">Total</Th><Th className="text-right">Saldo</Th><Th /></tr></thead>
                  <tbody>
                    {data!.rows.map((d) => {
                      const saldo = Number(d.total) - Number(d.paid);
                      return (
                        <tr key={d.id} className="transition-colors hover:bg-[var(--surface-2)]">
                          <Td className="font-medium">{d.number}<div className="text-[11px] font-normal text-[var(--text-muted)]">{d.type.toLowerCase()}</div></Td>
                          <Td className="max-w-[200px] truncate">{customerName(d.customer)}</Td>
                          <Td className="text-xs">{d.workOrder?.number ?? '—'}</Td>
                          <Td className="text-xs">{formatDate(d.issueDate)}</Td>
                          <Td><Badge tone={TONE[d.status] ?? 'neutral'}>{d.status.toLowerCase()}</Badge></Td>
                          <Td className="text-right tabular-nums">{formatMoney(d.total, d.currency)}</Td>
                          <Td className="text-right tabular-nums">{formatMoney(saldo, d.currency)}</Td>
                          <Td className="text-right">
                            {can('billing:write') && saldo > 0 && d.status !== 'ANULADO' && (
                              <Button size="sm" variant="outline" onClick={() => setPaying(d)}>Pagar</Button>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
                <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--text-muted)]">
                  <span>{data!.total} documentos · página {data!.page} de {data!.pages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={page >= data!.pages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
                  </div>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
