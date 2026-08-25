'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, Check, X, Copy, Ban, AlertTriangle } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Select, Textarea, Skeleton, Badge, Table, Th, Td } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { customerName, formatDate } from '@/lib/utils';
import {
  QUOTE_STATUS_LABELS, APPROVAL_CHANNELS, CHANNEL_LABELS, formatMoney, computeTotals,
  type QuoteStatus, type ItemDecision,
} from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface Item {
  id: string; kind: string; description: string; detail: string | null;
  quantity: string; unitPrice: string; discountPct: string; taxPct: string; total: string;
  optional: boolean; urgent: boolean; decision: ItemDecision; decisionNote: string | null;
}
interface Quote {
  id: string; number: string; version: number; status: QuoteStatus; currency: string;
  notes: string | null; terms: string | null; validUntil: string | null;
  subtotal: string; taxTotal: string; total: string; approvedTotal: string;
  sentAt: string | null; sentChannel: string | null;
  decidedAt: string | null; decisionChannel: string | null; decidedByName: string | null;
  decisionNote: string | null; rejectionReason: string | null;
  items: Item[];
  workOrder: {
    id: string; number: string; status: string;
    customer: { firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean; phone?: string | null };
    vehicle: { plate: string; brand: string; model: string; year: number | null };
  };
}

const TONE: Record<QuoteStatus, 'neutral' | 'info' | 'success' | 'warn' | 'danger' | 'accent'> = {
  BORRADOR: 'neutral', ENVIADO: 'info', APROBADO: 'success', APROBADO_PARCIAL: 'warn',
  RECHAZADO: 'danger', VENCIDO: 'danger', ANULADO: 'neutral', SUPERSEDIDO: 'neutral',
};

export default function PresupuestoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useAuth();
  const { data, loading, refetch } = useApi<Quote>(`/quotes/${id}`);

  const [decisions, setDecisions] = useState<Record<string, ItemDecision>>({});
  const [channel, setChannel] = useState('TELEFONO');
  const [decidedBy, setDecidedBy] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setDecisions(Object.fromEntries(data.items.map((i) => [i.id, i.decision])));
      if (!decidedBy) setDecidedBy(customerName(data.workOrder.customer));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (loading && !data) {
    return (<><Topbar title="Presupuesto" /><div className="space-y-4 p-6"><Skeleton className="h-24" /><Skeleton className="h-80" /></div></>);
  }
  if (!data) return null;

  const editable = data.status === 'BORRADOR' || data.status === 'ENVIADO';
  const decidable = editable || data.status === 'APROBADO_PARCIAL';

  const preview = computeTotals(
    data.items
      .filter((i) => decisions[i.id] === 'APROBADO')
      .map((i) => ({ kind: i.kind, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), discountPct: Number(i.discountPct), taxPct: Number(i.taxPct) })),
  );

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const setAll = (d: ItemDecision) =>
    setDecisions(Object.fromEntries(data.items.map((i) => [i.id, d])));

  return (
    <>
      <Topbar
        title={`${data.number} · v${data.version}`}
        actions={
          <>
            <Badge tone={TONE[data.status]}>{QUOTE_STATUS_LABELS[data.status]}</Badge>
            {can('quote:write') && data.status === 'BORRADOR' && (
              <Button size="sm" loading={busy} onClick={() => void act(() => api.post(`/quotes/${id}/send`, { channel }))}>
                <Send className="size-4" aria-hidden /> Marcar como enviado
              </Button>
            )}
            {can('quote:write') && (data.status === 'RECHAZADO' || data.status === 'APROBADO_PARCIAL') && (
              <Button variant="secondary" size="sm" loading={busy} onClick={() => void act(async () => {
                const nuevo = await api.post<{ id: string }>('/quotes', { workOrderId: data.workOrder.id, fromQuoteId: id });
                window.location.href = `/presupuestos/${nuevo.id}`;
              })}>
                <Copy className="size-4" aria-hidden /> Nueva versión
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-4 p-6">
        <Link href={`/ordenes/${data.workOrder.id}`} className="focus-ring inline-flex items-center gap-1.5 rounded text-[13px] text-[var(--muted)] hover:text-[var(--brand)]">
          <ArrowLeft className="size-3.5" aria-hidden /> OT {data.workOrder.number}
        </Link>

        {error && <p role="alert" className="rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[13px] text-[var(--falla)]">{error}</p>}

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Ítems presupuestados</CardTitle>
                <span className="text-[12px] text-[var(--muted)]">{data.items.length} ítems</span>
              </CardHeader>
              <CardBody className="p-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>Detalle</Th><Th className="text-right">Cant.</Th><Th className="text-right">Unitario</Th>
                      <Th className="text-right">Total</Th>{decidable && <Th className="text-center">Decisión</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((i) => (
                      <tr key={i.id} className={cn(decisions[i.id] === 'RECHAZADO' && 'opacity-55')}>
                        <Td>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{i.description}</span>
                            {i.urgent && <Badge tone="danger" className="!px-1.5 !py-0 !text-[10px]"><AlertTriangle className="size-2.5" aria-hidden /> Seguridad</Badge>}
                            {i.optional && <Badge tone="neutral" className="!px-1.5 !py-0 !text-[10px]">Opcional</Badge>}
                          </div>
                          {i.detail && <div className="text-[11.5px] text-[var(--muted)]">{i.detail}</div>}
                          <div className="text-[11px] uppercase text-[var(--subtle)]">{i.kind.toLowerCase()}</div>
                        </Td>
                        <Td className="mono text-right">{Number(i.quantity)}</Td>
                        <Td className="mono text-right">{formatMoney(i.unitPrice, data.currency)}</Td>
                        <Td className="mono text-right font-semibold">{formatMoney(i.total, data.currency)}</Td>
                        {decidable && (
                          <Td>
                            <div className="flex justify-center gap-1">
                              <button
                                type="button"
                                aria-label={`Aprobar ${i.description}`}
                                aria-pressed={decisions[i.id] === 'APROBADO'}
                                onClick={() => setDecisions((d) => ({ ...d, [i.id]: 'APROBADO' }))}
                                className={cn('focus-ring grid size-7 place-items-center rounded-lg border border-[var(--border)] text-[var(--subtle)]',
                                  decisions[i.id] === 'APROBADO' && 'border-[var(--ok-bd)] bg-[var(--ok-bg)] text-[var(--ok)]')}
                              >
                                <Check className="size-3.5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                aria-label={`Rechazar ${i.description}`}
                                aria-pressed={decisions[i.id] === 'RECHAZADO'}
                                onClick={() => setDecisions((d) => ({ ...d, [i.id]: 'RECHAZADO' }))}
                                className={cn('focus-ring grid size-7 place-items-center rounded-lg border border-[var(--border)] text-[var(--subtle)]',
                                  decisions[i.id] === 'RECHAZADO' && 'border-[var(--falla-bd)] bg-[var(--falla-bg)] text-[var(--falla)]')}
                              >
                                <X className="size-3.5" aria-hidden />
                              </button>
                            </div>
                          </Td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </Table>

                <dl className="space-y-1 border-t border-[var(--border)] px-4 py-3 text-[13.5px]">
                  <div className="flex justify-between text-[var(--muted)]"><dt>Subtotal</dt><dd className="mono">{formatMoney(data.subtotal, data.currency)}</dd></div>
                  <div className="flex justify-between text-[var(--muted)]"><dt>IVA</dt><dd className="mono">{formatMoney(data.taxTotal, data.currency)}</dd></div>
                  <div className="flex justify-between border-t border-[var(--border)] pt-2 font-bold"><dt>Total presupuestado</dt><dd className="mono">{formatMoney(data.total, data.currency)}</dd></div>
                  {decidable && (
                    <div className="flex justify-between font-bold text-[var(--ok)]"><dt>Total a aprobar</dt><dd className="mono">{formatMoney(preview.grandTotal, data.currency)}</dd></div>
                  )}
                </dl>
              </CardBody>
            </Card>

            {data.notes && (
              <Card>
                <CardHeader><CardTitle>Notas</CardTitle></CardHeader>
                <CardBody className="text-[13.5px] whitespace-pre-wrap">{data.notes}</CardBody>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Cliente y vehículo</CardTitle></CardHeader>
              <CardBody className="space-y-1 text-[13.5px]">
                <p className="font-semibold">{customerName(data.workOrder.customer)}</p>
                <p className="text-[var(--muted)]">{data.workOrder.customer.phone ?? '—'}</p>
                <p className="mono pt-2">{data.workOrder.vehicle.plate}</p>
                <p className="text-[var(--muted)]">{data.workOrder.vehicle.brand} {data.workOrder.vehicle.model} {data.workOrder.vehicle.year ?? ''}</p>
              </CardBody>
            </Card>

            {decidable && can('quote:decide') && (
              <Card>
                <CardHeader><CardTitle>Registrar respuesta del cliente</CardTitle></CardHeader>
                <CardBody className="space-y-3">
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => setAll('APROBADO')}>
                      <Check className="size-3.5" aria-hidden /> Aprobar todo
                    </Button>
                    <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => setAll('RECHAZADO')}>
                      <X className="size-3.5" aria-hidden /> Rechazar todo
                    </Button>
                  </div>

                  <Select label="Cómo respondió" value={channel} onChange={(e) => setChannel(e.target.value)}>
                    {APPROVAL_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
                  </Select>
                  <Input label="Quién respondió" value={decidedBy} onChange={(e) => setDecidedBy(e.target.value)} />
                  <Textarea label="Nota / motivo" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: aprueba pastillas, deja los discos para el mes que viene" />

                  <Button
                    className="w-full"
                    loading={busy}
                    onClick={() => void act(() =>
                      api.post(`/quotes/${id}/decide`, {
                        channel, decidedByName: decidedBy || undefined, note: note || undefined,
                        rejectionReason: Object.values(decisions).every((d) => d === 'RECHAZADO') ? note || undefined : undefined,
                        decisions: Object.entries(decisions).map(([itemId, decision]) => ({ itemId, decision })),
                        applyToWorkOrder: true,
                      }),
                    )}
                  >
                    Guardar respuesta y actualizar la OT
                  </Button>
                  <p className="text-[11.5px] text-[var(--muted)]">
                    Los ítems aprobados pasan a la OT y el estado cambia solo: aprobado o rechazado.
                  </p>
                </CardBody>
              </Card>
            )}

            {data.decidedAt && (
              <Card>
                <CardHeader><CardTitle>Respuesta registrada</CardTitle></CardHeader>
                <CardBody className="space-y-1 text-[13px]">
                  <p><span className="text-[var(--muted)]">Fecha:</span> {formatDate(data.decidedAt, true)}</p>
                  <p><span className="text-[var(--muted)]">Canal:</span> {data.decisionChannel ? CHANNEL_LABELS[data.decisionChannel as keyof typeof CHANNEL_LABELS] : '—'}</p>
                  <p><span className="text-[var(--muted)]">Respondió:</span> {data.decidedByName ?? '—'}</p>
                  {data.decisionNote && <p className="text-[var(--muted)]">“{data.decisionNote}”</p>}
                  {data.rejectionReason && <p className="text-[var(--falla)]">Motivo del rechazo: {data.rejectionReason}</p>}
                  <p className="pt-2 font-semibold text-[var(--ok)]">Aprobado: {formatMoney(data.approvedTotal, data.currency)}</p>
                </CardBody>
              </Card>
            )}

            {can('quote:write') && data.status !== 'ANULADO' && (
              <Button variant="ghost" size="sm" className="w-full" loading={busy} onClick={() => void act(() => api.post(`/quotes/${id}/void`))}>
                <Ban className="size-3.5" aria-hidden /> Anular presupuesto
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

