'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Truck, Plus, X, PackageCheck, Factory, ClipboardList, CalendarDays, Hash, StickyNote, Layers, Coins } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Select, Textarea, Skeleton, EmptyState, Table, Th, Td, Badge } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { useSocketEvent } from '@/hooks/use-socket';
import { api, qs } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PARTS_ORDER_STATUSES, PARTS_ORDER_LABELS, formatMoney, SOCKET_EVENTS, type Paginated, type PartsOrderStatus } from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';

interface OrderItem { id: string; description: string; quantity: string; received: string; unitCost: string; part?: { sku: string } | null }
interface Order {
  id: string; number: string; status: PartsOrderStatus; expectedAt: string | null; receivedAt: string | null;
  total: string; reference: string | null; notes: string | null;
  items: OrderItem[];
  supplier?: { id: string; name: string } | null;
  workOrder?: { id: string; number: string; vehicle: { plate: string; brand: string; model: string } } | null;
}
interface Supplier { id: string; name: string }
interface Part { id: string; sku: string; name: string; cost: string }
interface WO { id: string; number: string; vehicle: { plate: string } }

const TONE: Record<PartsOrderStatus, 'neutral' | 'info' | 'warn' | 'success' | 'danger'> = {
  BORRADOR: 'neutral', SOLICITADO: 'info', CONFIRMADO: 'info', EN_TRANSITO: 'warn',
  RECIBIDO_PARCIAL: 'warn', RECIBIDO: 'success', CANCELADO: 'danger',
};

export default function PedidosPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [receiving, setReceiving] = useState<Order | null>(null);
  const [lines, setLines] = useState<{ partId?: string; description: string; quantity: number; unitCost: number }[]>([
    { description: '', quantity: 1, unitCost: 0 },
  ]);

  const { data, loading, refetch } = useApi<Paginated<Order>>(`/parts-orders${qs({ page: 1, limit: 50, status })}`);
  const suppliers = useApi<Supplier[]>('/inventory/suppliers');
  const parts = useApi<{ rows: Part[] }>('/inventory/parts?page=1&limit=200');
  const wos = useApi<{ rows: WO[] }>('/work-orders?page=1&limit=50&status=ESPERA_REPUESTO');

  useSocketEvent(SOCKET_EVENTS.PARTS_ORDER_CHANGED, () => refetch());
  useSocketEvent(SOCKET_EVENTS.PARTS_RECEIVED, () => refetch());

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api.post('/parts-orders', {
      supplierId: fd.get('supplierId') || undefined,
      workOrderId: fd.get('workOrderId') || undefined,
      expectedAt: fd.get('expectedAt') ? new Date(String(fd.get('expectedAt'))).toISOString() : undefined,
      reference: fd.get('reference') || undefined,
      notes: fd.get('notes') || undefined,
      items: lines.filter((l) => l.description.trim()),
    });
    setOpen(false);
    setLines([{ description: '', quantity: 1, unitCost: 0 }]);
    refetch();
  }

  async function recibir(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!receiving) return;
    const fd = new FormData(e.currentTarget);
    await api.post(`/parts-orders/${receiving.id}/receive`, {
      lines: receiving.items.map((i) => ({ itemId: i.id, received: Number(fd.get(`r_${i.id}`) ?? i.received) })),
      note: fd.get('note') || undefined,
    });
    setReceiving(null);
    refetch();
  }

  return (
    <>
      <Topbar
        title="Pedidos a proveedor"
        actions={can('partsorder:write') ? (
          <Button size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? <X className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            {open ? 'Cerrar' : 'Nuevo pedido'}
          </Button>
        ) : undefined}
      />

      <div className="space-y-4 p-6">
        {open && (
          <Card>
            <CardHeader><CardTitle>Nuevo pedido</CardTitle></CardHeader>
            <CardBody>
              <form onSubmit={crear} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <Select label="Proveedor" name="supplierId" icon={<Factory className="size-3.5" aria-hidden />}>
                    <option value="">Sin definir</option>
                    {(suppliers.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                  <Select label="OT asociada" name="workOrderId" icon={<ClipboardList className="size-3.5" aria-hidden />} tip="Si el pedido es para una OT puntual, queda enlazado a su etapa de espera de repuestos">
                    <option value="">Stock general</option>
                    {(wos.data?.rows ?? []).map((w) => <option key={w.id} value={w.id}>{w.number} — {w.vehicle.plate}</option>)}
                  </Select>
                  <Input label="Llegada estimada" name="expectedAt" type="date" icon={<CalendarDays className="size-3.5" aria-hidden />} />
                  <Input label="Referencia" name="reference" icon={<Hash className="size-3.5" aria-hidden />} placeholder="Nº de orden del proveedor" />
                </div>

                <div className="ts-card overflow-hidden">
                  <Table>
                    <thead>
                      <tr><Th>Repuesto</Th><Th>Detalle</Th><Th className="w-24 text-right">Cant.</Th><Th className="w-32 text-right">Costo</Th><Th className="w-10" /></tr>
                    </thead>
                    <tbody>
                      {lines.map((l, idx) => (
                        <tr key={idx}>
                          <Td>
                            <Select
                              aria-label={`Repuesto ${idx + 1}`}
                              value={l.partId ?? ''}
                              onChange={(e) => {
                                const p = (parts.data?.rows ?? []).find((x) => x.id === e.target.value);
                                setLines((prev) => prev.map((x, i) => i === idx ? { ...x, partId: e.target.value || undefined, description: p?.name ?? x.description, unitCost: p ? Number(p.cost) : x.unitCost } : x));
                              }}
                            >
                              <option value="">Libre (sin catálogo)</option>
                              {(parts.data?.rows ?? []).map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                            </Select>
                          </Td>
                          <Td>
                            <Input aria-label={`Detalle ${idx + 1}`} value={l.description} onChange={(e) => setLines((prev) => prev.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} placeholder="Descripción" />
                          </Td>
                          <Td><Input aria-label={`Cantidad ${idx + 1}`} type="number" min={0.01} step="0.01" value={l.quantity} onChange={(e) => setLines((prev) => prev.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} className="text-right" /></Td>
                          <Td><Input aria-label={`Costo ${idx + 1}`} type="number" min={0} step="0.01" value={l.unitCost} onChange={(e) => setLines((prev) => prev.map((x, i) => i === idx ? { ...x, unitCost: Number(e.target.value) } : x))} className="text-right" /></Td>
                          <Td>
                            <button type="button" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))} className="focus-ring rounded-lg p-1.5 text-[var(--falla)]" aria-label={`Quitar línea ${idx + 1}`}>
                              <X className="size-4" aria-hidden />
                            </button>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  <div className="border-t border-[var(--border)] p-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setLines((prev) => [...prev, { description: '', quantity: 1, unitCost: 0 }])}>
                      <Plus className="size-3.5" aria-hidden /> Agregar línea
                    </Button>
                  </div>
                </div>

                <Textarea label="Notas" name="notes" icon={<StickyNote className="size-3.5" aria-hidden />} rows={2} />
                <Button type="submit">Crear pedido</Button>
              </form>
            </CardBody>
          </Card>
        )}

        {receiving && (
          <Card>
            <CardHeader>
              <CardTitle>Recibir mercadería · {receiving.number}</CardTitle>
              <button onClick={() => setReceiving(null)} className="focus-ring rounded-lg p-1.5 hover:bg-[var(--surface-2)]" aria-label="Cerrar"><X className="size-4" aria-hidden /></button>
            </CardHeader>
            <CardBody>
              <form onSubmit={recibir} className="space-y-3">
                {receiving.items.map((i) => (
                  <div key={i.id} className="flex items-center gap-3">
                    <span className="flex-1 text-[13.5px]">{i.description} <span className="text-[var(--subtle)]">(pedido {Number(i.quantity)})</span></span>
                    <div className="w-28">
                      <Input aria-label={`Recibido de ${i.description}`} name={`r_${i.id}`} type="number" min={0} step="0.01" defaultValue={Number(i.quantity)} className="text-right" />
                    </div>
                  </div>
                ))}
                <Input label="Nota / remito" name="note" icon={<StickyNote className="size-3.5" aria-hidden />} />
                <Button type="submit"><PackageCheck className="size-4" aria-hidden /> Registrar recepción</Button>
                <p className="text-[11.5px] text-[var(--muted)]">Lo recibido entra al stock automáticamente y actualiza el costo del repuesto.</p>
              </form>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody className="flex flex-wrap gap-4">
            <div className="w-56">
              <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todos</option>
                {PARTS_ORDER_STATUSES.map((s) => <option key={s} value={s}>{PARTS_ORDER_LABELS[s]}</option>)}
              </Select>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-0">
            {loading && !data ? (
              <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (data?.rows.length ?? 0) === 0 ? (
              <EmptyState icon={<Truck className="size-8" aria-hidden />} title="Sin pedidos" description="Cuando una OT queda esperando repuestos, el pedido al proveedor se registra acá." />
            ) : (
              <Table>
                <thead>
                  <tr><Th>Pedido</Th><Th>Proveedor</Th><Th>OT</Th><Th>Ítems</Th><Th>Estado</Th><Th className="text-right">Total</Th><Th /></tr>
                </thead>
                <tbody>
                  {data!.rows.map((o) => (
                    <tr key={o.id}>
                      <Td>
                        <span className="font-semibold">{o.number}</span>
                        <div className="text-[11.5px] text-[var(--muted)]">
                          {o.expectedAt ? `Llega ${formatDate(o.expectedAt)}` : 'Sin fecha'}
                        </div>
                      </Td>
                      <Td className="text-[13px]">{o.supplier?.name ?? '—'}</Td>
                      <Td className="text-[13px]">
                        {o.workOrder ? (
                          <Link href={`/ordenes/${o.workOrder.id}`} className="focus-ring rounded hover:underline">
                            {o.workOrder.number}
                            <div className="mono text-[11.5px] text-[var(--muted)]">{o.workOrder.vehicle.plate}</div>
                          </Link>
                        ) : '—'}
                      </Td>
                      <Td className="text-[13px]">
                        {o.items.length}
                        <div className="text-[11.5px] text-[var(--muted)]">
                          {o.items.reduce((a, i) => a + Number(i.received), 0)} recibidos
                        </div>
                      </Td>
                      <Td><Badge tone={TONE[o.status]}>{PARTS_ORDER_LABELS[o.status]}</Badge></Td>
                      <Td className="mono text-right">{formatMoney(o.total)}</Td>
                      <Td className="text-right">
                        {can('partsorder:write') && o.status !== 'RECIBIDO' && o.status !== 'CANCELADO' && (
                          <Button size="sm" variant="secondary" onClick={() => setReceiving(o)}>Recibir</Button>
                        )}
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
