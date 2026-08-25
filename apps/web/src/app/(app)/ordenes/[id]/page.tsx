'use client';

import { use, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Car, User, Wrench, Clock, FileText, CheckCircle2, Camera,
  Truck, ClipboardCheck, KeyRound, ShieldCheck, Plus, AlertTriangle, Fingerprint, Copy, Check,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Skeleton, Table, Th, Td, Textarea, Badge, Input, Select } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { ProcessStepper } from '@/components/process-stepper';
import { Checklist, type ChecklistValue } from '@/components/checklist';
import { SignaturePad } from '@/components/signature-pad';
import { useApi } from '@/hooks/use-api';
import { useSocketEvent, useWorkOrderRoom } from '@/hooks/use-socket';
import { api } from '@/lib/api';
import { customerName, formatDate, relativeTime } from '@/lib/utils';
import {
  SOCKET_EVENTS, STATUS_TRANSITIONS, STATUS_LABELS, QUOTE_STATUS_LABELS, PARTS_ORDER_LABELS,
  QUALITY_CHECKLIST, QUALITY_RESULTS, QUALITY_RESULT_LABELS, formatMoney,
  WORKORDER_KIND_DEFS, suggestedNext,
  type WorkOrderStatus, type WorkOrderKind,
} from '@taller/shared';
import { InsurancePanel } from '@/components/insurance-panel';
import { useAuth } from '@/hooks/use-auth';

interface Detail {
  id: string; number: string; auditId: string; kind: WorkOrderKind; status: WorkOrderStatus; priority: string;
  receivedAt: string; promisedAt: string | null; warrantyUntil: string | null;
  complaint: string | null; diagnosis: string | null; workPerformed: string | null; internalNotes: string | null;
  mileageIn: number | null; fuelLevel: number | null; customerApproved: boolean; rejectionReason: string | null;
  laborTotal: string; partsTotal: string; taxTotal: string; grandTotal: string; currency: string;
  customer: { id: string; firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean; phone?: string | null; email?: string | null };
  vehicle: { id: string; plate: string; brand: string; model: string; year: number | null; vin: string | null; color: string | null; mileage: number | null };
  technician: { id: string; firstName: string; lastName: string; specialty: string | null } | null;
  bay: { id: string; name: string } | null;
  items: { id: string; kind: string; description: string; quantity: string; unitPrice: string; total: string }[];
  history: { id: string; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string; user?: { firstName: string; lastName: string } | null }[];
}

interface Timeline {
  inspections: { id: string; kind: string; createdAt: string; signedAt: string | null; _count: { photos: number; damages: number } }[];
  quotes: { id: string; number: string; version: number; status: string; total: string; approvedTotal: string; decidedAt: string | null }[];
  partsOrders: { id: string; number: string; status: string; expectedAt: string | null; total: string; supplier?: { name: string } | null }[];
  qualityChecks: { id: string; result: string; createdAt: string; observations: string | null }[];
  delivery: { id: string; deliveredAt: string; receivedBy: string | null; warrantyUntil: string | null } | null;
}

interface Tech { id: string; firstName: string; lastName: string }

export default function OrdenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useAuth();
  const { data, loading, refetch } = useApi<Detail>(`/work-orders/${id}`);
  const flow = useApi<Timeline>(`/work-orders/${id}/timeline`);
  const techs = useApi<{ rows: Tech[] }>('/users?page=1&limit=100&role=TECNICO');

  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'none' | 'quality' | 'delivery' | 'work'>('none');
  const [qaChecklist, setQaChecklist] = useState<ChecklistValue>({});
  const [signature, setSignature] = useState<string | null>(null);
  const [seguro, setSeguro] = useState(false);
  const [copied, setCopied] = useState(false);

  useWorkOrderRoom(id);
  const reload = () => { refetch(); flow.refetch(); };
  useSocketEvent(SOCKET_EVENTS.WORKORDER_STATUS_CHANGED, reload);
  useSocketEvent(SOCKET_EVENTS.WORKORDER_UPDATED, reload);
  useSocketEvent(SOCKET_EVENTS.QUOTE_DECIDED, reload);
  useSocketEvent(SOCKET_EVENTS.PARTS_RECEIVED, reload);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setNote('');
      setPanel('none');
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return (<><Topbar title="Orden de trabajo" /><div className="grid gap-4 p-6 lg:grid-cols-3"><Skeleton className="h-64 lg:col-span-2" /><Skeleton className="h-64" /></div></>);
  }
  if (!data) return null;

  const next = STATUS_TRANSITIONS[data.status] ?? [];
  const inspection = flow.data?.inspections.find((i) => i.kind === 'INGRESO');
  const lastQuote = flow.data?.quotes.at(-1);

  return (
    <>
      <Topbar
        title={`OT ${data.number}`}
        actions={
          <>
            <StatusBadge status={data.status} />
            {can('quote:write') && ['RECEPCION', 'DIAGNOSTICO', 'PRESUPUESTADO'].includes(data.status) && (
              <Button
                variant="secondary" size="sm" loading={busy}
                onClick={() => void act(async () => {
                  const q = await api.post<{ id: string }>('/quotes', {
                    workOrderId: id,
                    items: data.items.map((i) => ({
                      kind: i.kind, description: i.description,
                      quantity: Number(i.quantity), unitPrice: Number(i.unitPrice),
                    })),
                  });
                  window.location.href = `/presupuestos/${q.id}`;
                })}
              >
                <FileText className="size-4" aria-hidden /> Presupuestar
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-4 p-6">
        <Link href="/ordenes" className="focus-ring inline-flex items-center gap-1.5 rounded text-[13px] text-[var(--muted)] hover:text-[var(--brand)]">
          <ArrowLeft className="size-3.5" aria-hidden /> Volver a órdenes
        </Link>

        {error && <p role="alert" className="rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[13px] text-[var(--falla)]">{error}</p>}

        {/* ------------------------- recorrido según el tipo de ingreso ----- */}
        <Card>
          <CardBody className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="ts-badge"
                style={{
                  background: `color-mix(in srgb, ${WORKORDER_KIND_DEFS[data.kind]?.color ?? '#2563eb'} 14%, transparent)`,
                  color: WORKORDER_KIND_DEFS[data.kind]?.color,
                  borderColor: `color-mix(in srgb, ${WORKORDER_KIND_DEFS[data.kind]?.color ?? '#2563eb'} 34%, transparent)`,
                }}
                data-tooltip-id="ts-tip"
                data-tooltip-content={WORKORDER_KIND_DEFS[data.kind]?.description}
              >
                {WORKORDER_KIND_DEFS[data.kind]?.label ?? 'Reparación'}
              </span>
              <span className="text-[12px] text-[var(--muted)]">
                Etapa actual: <strong className="text-[var(--text)]">{STATUS_LABELS[data.status]}</strong>
              </span>
              {data.auditId && (
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(data.auditId).then(() => setCopied(true))}
                  data-tooltip-id="ts-tip"
                  data-tooltip-content="ID de auditoría de esta reparación: único, inmutable y para dictarlo por teléfono. Clic para copiar."
                  className="focus-ring mono ml-auto inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border border-dashed border-[var(--border-strong)] px-2 py-1 text-[11.5px] text-[var(--muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                >
                  <Fingerprint className="size-3.5" aria-hidden />
                  {data.auditId}
                  {copied ? <Check className="size-3.5 text-[var(--ok)]" aria-hidden /> : <Copy className="size-3" aria-hidden />}
                </button>
              )}
            </div>
            <ProcessStepper
              kind={data.kind}
              status={data.status}
              busy={busy}
              onSelect={can('workorder:write')
                ? (next) => void act(() => api.post(`/work-orders/${id}/status`, { status: next }))
                : undefined}
            />
          </CardBody>
        </Card>

        {/* ------------------------------------------- etapas del expediente */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <FlowCard
            icon={<Camera className="size-4" aria-hidden />}
            title="Recepción"
            done={!!inspection?.signedAt}
            detail={inspection ? `${inspection._count.photos} fotos · ${inspection._count.damages} daños` : 'Sin registrar'}
            href={`/ordenes/${id}/recepcion`}
            cta={inspection ? 'Ver / editar' : 'Registrar ingreso'}
          />
          <FlowCard
            icon={<FileText className="size-4" aria-hidden />}
            title="Presupuesto"
            done={!!lastQuote?.decidedAt}
            detail={lastQuote ? `${lastQuote.number} v${lastQuote.version} · ${QUOTE_STATUS_LABELS[lastQuote.status as keyof typeof QUOTE_STATUS_LABELS]}` : 'Sin presupuesto'}
            href={lastQuote ? `/presupuestos/${lastQuote.id}` : undefined}
            cta={lastQuote ? 'Abrir' : undefined}
          />
          <FlowCard
            icon={<Truck className="size-4" aria-hidden />}
            title="Repuestos"
            done={(flow.data?.partsOrders ?? []).every((p) => p.status === 'RECIBIDO') && (flow.data?.partsOrders.length ?? 0) > 0}
            detail={
              flow.data?.partsOrders.length
                ? flow.data.partsOrders.map((p) => `${p.number}: ${PARTS_ORDER_LABELS[p.status as keyof typeof PARTS_ORDER_LABELS]}`).join(' · ')
                : 'Sin pedidos'
            }
            href="/pedidos"
            cta="Pedidos"
          />
          <FlowCard
            icon={<ShieldCheck className="size-4" aria-hidden />}
            title="Control de calidad"
            done={(flow.data?.qualityChecks ?? []).some((c) => c.result !== 'RECHAZADO')}
            detail={flow.data?.qualityChecks.length ? QUALITY_RESULT_LABELS[flow.data.qualityChecks.at(-1)!.result as keyof typeof QUALITY_RESULT_LABELS] : 'Pendiente'}
            onClick={can('quality:write') && data.status === 'CONTROL_CALIDAD' ? () => setPanel('quality') : undefined}
            cta={can('quality:write') && data.status === 'CONTROL_CALIDAD' ? 'Hacer control' : undefined}
          />
          <FlowCard
            icon={<KeyRound className="size-4" aria-hidden />}
            title="Entrega"
            done={!!flow.data?.delivery}
            detail={flow.data?.delivery ? `${formatDate(flow.data.delivery.deliveredAt)} · ${flow.data.delivery.receivedBy ?? ''}` : 'Pendiente'}
            onClick={can('delivery:write') && ['FINALIZADO', 'LAVADO', 'RECHAZADO'].includes(data.status) ? () => setPanel('delivery') : undefined}
            cta={can('delivery:write') && ['FINALIZADO', 'LAVADO', 'RECHAZADO'].includes(data.status) ? 'Entregar' : undefined}
          />
        </div>

        {/* --------------------------------------------------- panel de QA */}
        {panel === 'quality' && (
          <Card>
            <CardHeader><CardTitle>Control de calidad</CardTitle></CardHeader>
            <CardBody>
              <form
                className="space-y-4"
                onSubmit={(e: FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  void act(() => api.post(`/work-orders/${id}/quality`, {
                    result: fd.get('result'),
                    checklist: qaChecklist,
                    roadTest: fd.get('roadTest') === 'on',
                    roadTestKm: fd.get('roadTestKm') ? Number(fd.get('roadTestKm')) : undefined,
                    observations: fd.get('observations') || undefined,
                  }));
                }}
              >
                <Checklist items={QUALITY_CHECKLIST} value={qaChecklist} onChange={setQaChecklist} />
                <div className="grid gap-4 md:grid-cols-3">
                  <Select label="Resultado" name="result" defaultValue="APROBADO">
                    {QUALITY_RESULTS.map((r) => <option key={r} value={r}>{QUALITY_RESULT_LABELS[r]}</option>)}
                  </Select>
                  <Input label="Km de prueba de ruta" name="roadTestKm" type="number" min={0} />
                  <label className="flex items-end gap-2 pb-2 text-[13.5px]">
                    <input type="checkbox" name="roadTest" className="size-4" defaultChecked /> Se hizo prueba de ruta
                  </label>
                </div>
                <Textarea label="Observaciones" name="observations" rows={2} />
                <div className="flex gap-2">
                  <Button type="submit" loading={busy}><ClipboardCheck className="size-4" aria-hidden /> Guardar control</Button>
                  <Button type="button" variant="secondary" onClick={() => setPanel('none')}>Cancelar</Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        {/* ---------------------------------------------- panel de entrega */}
        {panel === 'delivery' && (
          <Card>
            <CardHeader><CardTitle>Entrega del vehículo</CardTitle></CardHeader>
            <CardBody>
              <form
                className="space-y-4"
                onSubmit={(e: FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  void act(() => api.post(`/work-orders/${id}/deliver`, {
                    receivedBy: fd.get('receivedBy') || undefined,
                    receivedDoc: fd.get('receivedDoc') || undefined,
                    mileageOut: fd.get('mileageOut') ? Number(fd.get('mileageOut')) : undefined,
                    warrantyDays: Number(fd.get('warrantyDays') ?? 90),
                    nextServiceKm: fd.get('nextServiceKm') ? Number(fd.get('nextServiceKm')) : undefined,
                    observations: fd.get('observations') || undefined,
                    signatureUrl: signature ?? undefined,
                    invoice: fd.get('invoice') === 'on',
                  }));
                }}
              >
                <div className="grid gap-4 md:grid-cols-4">
                  <Input label="Quién retira" name="receivedBy" defaultValue={customerName(data.customer)} />
                  <Input label="Documento" name="receivedDoc" />
                  <Input label="Km de salida" name="mileageOut" type="number" min={0} defaultValue={data.mileageIn ?? undefined} />
                  <Input label="Garantía (días)" name="warrantyDays" type="number" min={0} defaultValue={90} />
                  <Input label="Próximo service (km)" name="nextServiceKm" type="number" min={0} />
                  <label className="flex items-end gap-2 pb-2 text-[13.5px] md:col-span-2">
                    <input type="checkbox" name="invoice" className="size-4" defaultChecked /> Emitir factura al entregar
                  </label>
                </div>
                <Textarea label="Observaciones de la entrega" name="observations" rows={2} />
                <SignaturePad label="Conformidad del cliente" value={signature} onChange={setSignature} />
                <div className="flex gap-2">
                  <Button type="submit" loading={busy}><KeyRound className="size-4" aria-hidden /> Registrar entrega</Button>
                  <Button type="button" variant="secondary" onClick={() => setPanel('none')}>Cancelar</Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Detalle del trabajo</CardTitle>
                <span className="text-[12px] text-[var(--muted)]">Ingreso {formatDate(data.receivedAt, true)}</span>
              </CardHeader>
              <CardBody className="space-y-4">
                <Field label="Relato del cliente" value={data.complaint} />
                <Field label="Diagnóstico técnico" value={data.diagnosis} />
                <Field label="Trabajo realizado" value={data.workPerformed} />
                {data.rejectionReason && (
                  <p className="flex items-start gap-2 rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[13px] text-[var(--falla)]">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Presupuesto rechazado: {data.rejectionReason}
                  </p>
                )}
                {can('workorder:write') && data.status !== 'ENTREGADO' && (
                  <Button variant="ghost" size="sm" onClick={() => setPanel(panel === 'work' ? 'none' : 'work')}>
                    <Plus className="size-3.5" aria-hidden /> Editar diagnóstico y trabajo
                  </Button>
                )}
                {panel === 'work' && (
                  <form
                    className="space-y-3 border-t border-[var(--border)] pt-3"
                    onSubmit={(e: FormEvent<HTMLFormElement>) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      void act(() => api.patch(`/work-orders/${id}`, {
                        diagnosis: fd.get('diagnosis') || undefined,
                        workPerformed: fd.get('workPerformed') || undefined,
                        internalNotes: fd.get('internalNotes') || undefined,
                        technicianId: fd.get('technicianId') || undefined,
                      }));
                    }}
                  >
                    <Textarea label="Diagnóstico" name="diagnosis" rows={3} defaultValue={data.diagnosis ?? ''} />
                    <Textarea label="Trabajo realizado" name="workPerformed" rows={3} defaultValue={data.workPerformed ?? ''} />
                    <Textarea label="Notas internas" name="internalNotes" rows={2} defaultValue={data.internalNotes ?? ''} />
                    {can('workorder:assign') && (
                      <Select label="Técnico asignado" name="technicianId" defaultValue={data.technician?.id ?? ''}>
                        <option value="">Sin asignar</option>
                        {(techs.data?.rows ?? []).map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                      </Select>
                    )}
                    <Button type="submit" size="sm" loading={busy}>Guardar</Button>
                  </form>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle>Trabajo aprobado</CardTitle></CardHeader>
              <CardBody className="p-0">
                <Table>
                  <thead>
                    <tr><Th>Descripción</Th><Th>Tipo</Th><Th className="text-right">Cant.</Th><Th className="text-right">P. unit.</Th><Th className="text-right">Total</Th></tr>
                  </thead>
                  <tbody>
                    {data.items.map((i) => (
                      <tr key={i.id}>
                        <Td>{i.description}</Td>
                        <Td><Badge tone={i.kind === 'REPUESTO' ? 'info' : 'neutral'}>{i.kind.toLowerCase()}</Badge></Td>
                        <Td className="mono text-right">{Number(i.quantity)}</Td>
                        <Td className="mono text-right">{formatMoney(i.unitPrice, data.currency)}</Td>
                        <Td className="mono text-right font-semibold">{formatMoney(i.total, data.currency)}</Td>
                      </tr>
                    ))}
                    {data.items.length === 0 && <tr><Td colSpan={5} className="py-8 text-center text-[13px] text-[var(--muted)]">Todavía no hay trabajo aprobado</Td></tr>}
                  </tbody>
                </Table>
                <dl className="space-y-1 border-t border-[var(--border)] px-4 py-3 text-[13.5px]">
                  <div className="flex justify-between text-[var(--muted)]"><dt>Mano de obra / servicios</dt><dd className="mono">{formatMoney(data.laborTotal, data.currency)}</dd></div>
                  <div className="flex justify-between text-[var(--muted)]"><dt>Repuestos</dt><dd className="mono">{formatMoney(data.partsTotal, data.currency)}</dd></div>
                  <div className="flex justify-between text-[var(--muted)]"><dt>IVA</dt><dd className="mono">{formatMoney(data.taxTotal, data.currency)}</dd></div>
                  <div className="flex justify-between border-t border-[var(--border)] pt-2 font-bold"><dt>Total</dt><dd className="mono">{formatMoney(data.grandTotal, data.currency)}</dd></div>
                </dl>
              </CardBody>
            </Card>

            {(data.kind === 'SINIESTRO' || seguro) && (
              <InsurancePanel
                workOrderId={id}
                grandTotal={data.grandTotal}
                currency={data.currency}
                onChange={reload}
              />
            )}

            {data.kind !== 'SINIESTRO' && !seguro && can('workorder:write') && (
              <button
                type="button"
                onClick={() => setSeguro(true)}
                data-tooltip-id="ts-tip"
                data-tooltip-content="Convierte la OT en siniestro y abre el expediente de la compañía"
                className="focus-ring flex w-full items-center justify-center gap-2 rounded-[var(--r)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] px-4 py-3 text-[13px] font-medium text-[var(--muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
              >
                <ShieldCheck className="size-4" aria-hidden /> Este trabajo lo cubre un seguro
              </button>
            )}

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="size-4" aria-hidden /> Trazabilidad</CardTitle></CardHeader>
              <CardBody>
                <ol className="relative space-y-4 border-l border-[var(--border)] pl-5">
                  {data.history.map((h) => (
                    <motion.li key={h.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="relative">
                      <span className="absolute -left-[23px] top-1 grid size-3.5 place-items-center rounded-full border-2 border-[var(--surface)] bg-[var(--brand-500)]" aria-hidden />
                      <p className="text-[13.5px]">
                        {h.fromStatus ? `${STATUS_LABELS[h.fromStatus as WorkOrderStatus]} → ` : ''}
                        <strong>{STATUS_LABELS[h.toStatus as WorkOrderStatus]}</strong>
                      </p>
                      <p className="text-[11.5px] text-[var(--muted)]">
                        {relativeTime(h.createdAt)} {h.user ? `· ${h.user.firstName} ${h.user.lastName}` : ''}
                      </p>
                      {h.note && <p className="mt-1 text-[12.5px] text-[var(--muted)]">{h.note}</p>}
                    </motion.li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Cambiar estado</CardTitle></CardHeader>
              <CardBody className="space-y-3">
                {next.length === 0 ? (
                  <p className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
                    <CheckCircle2 className="size-4 text-[var(--ok)]" aria-hidden /> La OT está cerrada.
                  </p>
                ) : (
                  <>
                    <Textarea label="Nota (opcional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Detalle del cambio…" />
                    <div className="flex flex-wrap gap-2">
                      {next.map((s) => {
                        const suggested = s === suggestedNext(data.kind, data.status);
                        return (
                          <Button
                            key={s} size="sm"
                            variant={s === 'CANCELADO' ? 'danger' : suggested ? 'primary' : 'secondary'}
                            loading={busy}
                            tip={suggested ? `Paso siguiente del recorrido de ${WORKORDER_KIND_DEFS[data.kind]?.short.toLowerCase()}` : undefined}
                            onClick={() => void act(() => api.post(`/work-orders/${id}/status`, { status: s, note: note || undefined }))}
                          >
                            {STATUS_LABELS[s]}
                          </Button>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><User className="size-4" aria-hidden /> Cliente</CardTitle></CardHeader>
              <CardBody className="space-y-1 text-[13.5px]">
                <p className="font-semibold">{customerName(data.customer)}</p>
                <p className="text-[var(--muted)]">{data.customer.phone ?? '—'}</p>
                <p className="text-[var(--muted)]">{data.customer.email ?? '—'}</p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Car className="size-4" aria-hidden /> Vehículo</CardTitle></CardHeader>
              <CardBody className="space-y-1 text-[13.5px]">
                <p className="mono font-semibold">{data.vehicle.plate}</p>
                <p>{data.vehicle.brand} {data.vehicle.model} {data.vehicle.year ?? ''}</p>
                <p className="text-[var(--muted)]">VIN: {data.vehicle.vin ?? '—'}</p>
                <p className="text-[var(--muted)]">Km ingreso: {data.mileageIn ?? '—'}</p>
                {data.warrantyUntil && <p className="pt-1 text-[var(--ok)]">Garantía hasta {formatDate(data.warrantyUntil)}</p>}
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="size-4" aria-hidden /> Asignación</CardTitle></CardHeader>
              <CardBody className="space-y-1 text-[13.5px]">
                <p>{data.technician ? `${data.technician.firstName} ${data.technician.lastName}` : 'Sin técnico asignado'}</p>
                <p className="text-[var(--muted)]">{data.technician?.specialty ?? ''}</p>
                <p className="text-[var(--muted)]">Bahía: {data.bay?.name ?? '—'}</p>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="ts-label !mb-1">{label}</p>
      <p className="whitespace-pre-wrap text-[13.5px]">{value || '—'}</p>
    </div>
  );
}

function FlowCard({ icon, title, detail, done, href, onClick, cta }: {
  icon: React.ReactNode; title: string; detail: string; done: boolean;
  href?: string; onClick?: () => void; cta?: string;
}) {
  const body = (
    <div className="ts-card h-full p-4">
      <div className="flex items-center gap-2">
        <span className={`ts-stat-ic size-8 ${done ? 'ok' : ''}`}>{icon}</span>
        <p className="flex-1 text-[13.5px] font-semibold">{title}</p>
        {done && <CheckCircle2 className="size-4 text-[var(--ok)]" aria-hidden />}
      </div>
      <p className="mt-2 line-clamp-2 text-[11.5px] text-[var(--muted)]">{detail}</p>
      {cta && <p className="mt-2 text-[12px] font-semibold text-[var(--brand)]">{cta} →</p>}
    </div>
  );

  if (href) return <Link href={href} className="focus-ring rounded-[var(--r-lg)]">{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className="focus-ring rounded-[var(--r-lg)] text-left">{body}</button>;
  return body;
}
