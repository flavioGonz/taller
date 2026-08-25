'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus, Trash2, Save, User, Car, Gauge, Flag, MessageSquare, Wrench, Hammer,
  Stethoscope, SprayCan, CircleDot, ShieldCheck, FileWarning, ClipboardCheck,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Select, Textarea, Table, Th, Td } from '@/components/ui';
import { ProcessStepper } from '@/components/process-stepper';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/use-api';
import { customerName, cn } from '@/lib/utils';
import { computeTotals, formatMoney, PRIORITIES, WORKORDER_KINDS, WORKORDER_KIND_DEFS, type WorkOrderKind } from '@taller/shared';

const KIND_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Wrench, Hammer, Stethoscope, SprayCan, CircleDot, ShieldCheck, FileWarning, ClipboardCheck,
};

interface CustomerOpt { id: string; firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean }
interface VehicleOpt { id: string; plate: string; brand: string; model: string }
interface ServiceOpt { id: string; name: string; price: string; taxPct: string }
interface PartOpt { id: string; sku: string; name: string; price: string; taxPct: string; onHand: number }
interface TechOpt { id: string; firstName: string; lastName: string }

interface Item {
  kind: 'SERVICIO' | 'REPUESTO' | 'MANO_OBRA' | 'OTRO';
  serviceId?: string; partId?: string;
  description: string; quantity: number; unitPrice: number; taxPct: number; discountPct: number;
}

export default function NuevaOrdenPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [kind, setKind] = useState<WorkOrderKind>('REPARACION');
  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState(search.get('vehicleId') ?? '');
  const [technicianId, setTechnicianId] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [complaint, setComplaint] = useState('');
  const [mileageIn, setMileageIn] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customers = useApi<CustomerOpt[]>('/customers');
  const vehicles = useApi<{ rows: VehicleOpt[] }>(customerId ? `/vehicles?page=1&limit=100&customerId=${customerId}` : null);
  const services = useApi<ServiceOpt[]>('/services');
  const parts = useApi<{ rows: PartOpt[] }>('/inventory/parts?page=1&limit=200');
  const techs = useApi<{ rows: TechOpt[] }>('/users?page=1&limit=100&role=TECNICO');

  const prefilled = useApi<{ id: string; customerId: string }>(search.get('vehicleId') ? `/vehicles/${search.get('vehicleId')}` : null);

  useEffect(() => {
    if (prefilled.data?.customerId) setCustomerId(prefilled.data.customerId);
  }, [prefilled.data]);

  // Se puede llegar desde la ficha del cliente o desde Ingresos con parte ya elegida
  useEffect(() => {
    const fromQuery = search.get('customerId');
    if (fromQuery) setCustomerId(fromQuery);
    const k = search.get('kind') as WorkOrderKind | null;
    if (k && WORKORDER_KINDS.includes(k)) setKind(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!search.get('vehicleId')) setVehicleId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const totals = useMemo(() => computeTotals(items), [items]);

  const addItem = (kind: Item['kind']) =>
    setItems((prev) => [...prev, { kind, description: '', quantity: 1, unitPrice: 0, taxPct: 22, discountPct: 0 }]);

  const updateItem = (idx: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!customerId || !vehicleId) {
      setError('Seleccioná cliente y vehículo');
      return;
    }
    setSaving(true);
    try {
      const created = await api.post<{ id: string }>('/work-orders', {
        customerId, vehicleId, kind,
        technicianId: technicianId || undefined,
        priority, complaint: complaint || undefined,
        mileageIn: mileageIn ? Number(mileageIn) : undefined,
        items: items.filter((i) => i.description.trim().length > 0),
      });
      router.push(`/ordenes/${created.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <>
      <Topbar title="Nueva orden de trabajo" />
      <form onSubmit={onSubmit} className="space-y-4 p-6">
        {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>}

        {/* ------------------------------- tipo de ingreso: define el flujo */}
        <Card>
          <CardHeader>
            <CardTitle>Tipo de ingreso</CardTitle>
            <span className="text-[12px] text-[var(--muted)]">Define por qué etapas pasa el vehículo</span>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {WORKORDER_KINDS.map((k) => {
                const def = WORKORDER_KIND_DEFS[k];
                const Icon = KIND_ICONS[def.icon] ?? Wrench;
                const on = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    aria-pressed={on}
                    data-tooltip-id="ts-tip"
                    data-tooltip-content={def.description}
                    className={cn(
                      'focus-ring flex items-start gap-2.5 rounded-[var(--r)] border p-3 text-left transition-colors',
                      on ? 'border-[var(--brand-200)] bg-[var(--brand-soft)]' : 'border-[var(--border)] hover:bg-[var(--surface-2)]',
                    )}
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-[10px]"
                      style={{ background: `color-mix(in srgb, ${def.color} 15%, transparent)`, color: def.color }}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold">{def.short}</span>
                      <span className="block text-[11px] text-[var(--muted)]">{def.steps.length} etapas</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="rounded-[var(--r)] bg-[var(--surface-2)] p-3">
              <ProcessStepper kind={kind} status="RECEPCION" />
            </div>
          </CardBody>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Recepción</CardTitle></CardHeader>
            <CardBody className="grid gap-4 md:grid-cols-2">
              <Select label="Cliente" name="customerId" icon={<User className="size-3.5" aria-hidden />} value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                <option value="">Seleccionar…</option>
                {(customers.data ?? []).map((c) => <option key={c.id} value={c.id}>{customerName(c)}</option>)}
              </Select>

              <Select label="Vehículo" name="vehicleId" icon={<Car className="size-3.5" aria-hidden />} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required disabled={!customerId}>
                <option value="">{customerId ? 'Seleccionar…' : 'Elegí un cliente primero'}</option>
                {(vehicles.data?.rows ?? []).map((v) => <option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>)}
              </Select>

              <Select label="Técnico asignado" name="technicianId" icon={<Wrench className="size-3.5" aria-hidden />} value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
                <option value="">Sin asignar</option>
                {(techs.data?.rows ?? []).map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
              </Select>

              <Select label="Prioridad" name="priority" icon={<Flag className="size-3.5" aria-hidden />} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
              </Select>

              <Input label="Kilometraje de ingreso" name="mileageIn" type="number" min={0} icon={<Gauge className="size-3.5" aria-hidden />} value={mileageIn} onChange={(e) => setMileageIn(e.target.value)} placeholder="84500" tip="Queda en la ficha del vehículo y sirve para el próximo service" />

              <div className="md:col-span-2">
                <Textarea label="Relato del cliente" name="complaint" rows={3} icon={<MessageSquare className="size-3.5" aria-hidden />} value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="Ruido en tren delantero, vibración al frenar…" tip="Con las palabras del cliente: es lo que después se contrasta con el diagnóstico" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
            <CardBody className="space-y-2 text-sm">
              <div className="flex justify-between text-xs text-[var(--text-muted)]"><span>Servicios / mano de obra</span><span className="tabular-nums">{formatMoney(totals.laborTotal)}</span></div>
              <div className="flex justify-between text-xs text-[var(--text-muted)]"><span>Repuestos</span><span className="tabular-nums">{formatMoney(totals.partsTotal)}</span></div>
              <div className="flex justify-between text-xs text-[var(--text-muted)]"><span>IVA</span><span className="tabular-nums">{formatMoney(totals.taxTotal)}</span></div>
              <div className="flex justify-between border-t border-[var(--border)] pt-2 font-semibold"><span>Total</span><span className="tabular-nums">{formatMoney(totals.grandTotal)}</span></div>
              <Button type="submit" className="mt-3 w-full" loading={saving}>
                <Save className="size-4" aria-hidden /> Crear orden
              </Button>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ítems</CardTitle>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => addItem('SERVICIO')}><Plus className="size-3.5" aria-hidden /> Servicio</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addItem('REPUESTO')}><Plus className="size-3.5" aria-hidden /> Repuesto</Button>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <Table>
              <thead>
                <tr><Th>Tipo</Th><Th>Detalle</Th><Th className="w-24 text-right">Cant.</Th><Th className="w-32 text-right">P. unit.</Th><Th className="w-28 text-right">Total</Th><Th className="w-12" /></tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <Td className="text-xs uppercase text-[var(--text-muted)]">{item.kind.toLowerCase()}</Td>
                    <Td>
                      {item.kind === 'SERVICIO' ? (
                        <Select
                          aria-label={`Servicio ${idx + 1}`}
                          value={item.serviceId ?? ''}
                          onChange={(e) => {
                            const s = (services.data ?? []).find((x) => x.id === e.target.value);
                            updateItem(idx, { serviceId: e.target.value, description: s?.name ?? '', unitPrice: Number(s?.price ?? 0), taxPct: Number(s?.taxPct ?? 22) });
                          }}
                        >
                          <option value="">Seleccionar servicio…</option>
                          {(services.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                      ) : (
                        <Select
                          aria-label={`Repuesto ${idx + 1}`}
                          value={item.partId ?? ''}
                          onChange={(e) => {
                            const p = (parts.data?.rows ?? []).find((x) => x.id === e.target.value);
                            updateItem(idx, { partId: e.target.value, description: p?.name ?? '', unitPrice: Number(p?.price ?? 0), taxPct: Number(p?.taxPct ?? 22) });
                          }}
                        >
                          <option value="">Seleccionar repuesto…</option>
                          {(parts.data?.rows ?? []).map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name} (stock {p.onHand})</option>)}
                        </Select>
                      )}
                    </Td>
                    <Td><Input aria-label={`Cantidad ${idx + 1}`} type="number" min={0.01} step="0.01" value={item.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} className="text-right" /></Td>
                    <Td><Input aria-label={`Precio unitario ${idx + 1}`} type="number" min={0} step="0.01" value={item.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })} className="text-right" /></Td>
                    <Td className="text-right tabular-nums">{formatMoney(item.quantity * item.unitPrice * (1 + item.taxPct / 100))}</Td>
                    <Td>
                      <button type="button" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} className="focus-ring rounded-lg p-1.5 text-red-500 hover:bg-red-500/10" aria-label={`Quitar ítem ${idx + 1}`}>
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </Td>
                  </tr>
                ))}
                {items.length === 0 && <tr><Td colSpan={6} className="py-8 text-center text-xs text-[var(--text-muted)]">Agregá servicios o repuestos (podés hacerlo también después del diagnóstico).</Td></tr>}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </form>
    </>
  );
}
