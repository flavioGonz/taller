'use client';

import { use, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Save, ShieldCheck, FileCheck2, Wrench, Wallet, CalendarClock, Users, Plus,
  Trash2, Phone, Mail, Globe, ExternalLink, ClipboardList, AlertTriangle, Check,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import {
  Button, Card, CardBody, CardHeader, CardTitle, Input, Select, Textarea, Skeleton, Badge,
  Table, Th, Td, EmptyState,
} from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/modal';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/components/toast';
import { customerName, formatDate } from '@/lib/utils';
import { InsurerAvatar } from '@/components/insurer-avatar';
import {
  AUTHORIZATION_CHANNELS, AUTH_CHANNEL_LABELS,
  PARTS_POLICIES, PARTS_POLICY_LABELS,
  PARTS_SUPPLIERS, PARTS_SUPPLIER_LABELS,
  INVOICE_TARGETS, INVOICE_TO_LABELS,
  DEDUCTIBLE_COLLECTORS, DEDUCTIBLE_LABELS,
  DOCUMENT_REQUIREMENTS, formatMoney,
} from '@taller/shared';
import { cn } from '@/lib/utils';

interface Contact { id: string; name: string; role: string | null; phone: string | null; email: string | null; notes: string | null }
interface Terms {
  requiresAuthorization: boolean; authorizationChannel: string; authorizationSlaHours: number | null;
  requiresClaimNumber: boolean; requiresAdjuster: boolean; requiresPhotos: boolean; minPhotos: number;
  requiresDamageMap: boolean; requiresQuoteFormat: string | null; requiredDocuments: string[];
  partsPolicy: string; partsSuppliedBy: string; partsMarkupPct: string | null; requiresPartsQuotes: number;
  laborRate: string | null; laborDiscountPct: string | null; partsDiscountPct: string | null;
  currency: string; invoiceTo: string; deductibleBy: string; paymentTermDays: number; retentionPct: string | null;
  maxRepairDays: number | null; warrantyDays: number; agreementRef: string | null; notes: string | null;
}
interface Insurer {
  id: string; name: string; legalName: string | null; taxId: string | null; logoFile: string | null;
  phone: string | null; email: string | null; website: string | null;
  claimsPhone: string | null; claimsEmail: string | null; portalUrl: string | null;
  worksAuto: boolean; isActive: boolean; notes: string | null;
  terms: Terms | null;
  contacts: Contact[];
  cases: {
    id: string; status: string; claimNumber: string | null; createdAt: string;
    insurerAmount: string | null; customerAmount: string | null;
    workOrder: {
      id: string; number: string; status: string; receivedAt: string; grandTotal: string;
      vehicle: { plate: string; brand: string; model: string };
      customer: { firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean };
    };
  }[];
  _count: { cases: number };
}

const EMPTY: Terms = {
  requiresAuthorization: true, authorizationChannel: 'EMAIL', authorizationSlaHours: null,
  requiresClaimNumber: true, requiresAdjuster: true, requiresPhotos: true, minPhotos: 6,
  requiresDamageMap: true, requiresQuoteFormat: null, requiredDocuments: [],
  partsPolicy: 'MIXTO', partsSuppliedBy: 'TALLER', partsMarkupPct: null, requiresPartsQuotes: 0,
  laborRate: null, laborDiscountPct: null, partsDiscountPct: null,
  currency: 'UYU', invoiceTo: 'ASEGURADORA', deductibleBy: 'TALLER', paymentTermDays: 30, retentionPct: null,
  maxRepairDays: null, warrantyDays: 90, agreementRef: null, notes: null,
};

/** Interruptor con etiqueta y explicación, para las condiciones booleanas. */
function Toggle({ label, hint, checked, onChange, disabled }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface-2)] p-2.5', disabled && 'cursor-default opacity-70')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium leading-tight">{label}</span>
        {hint && <span className="block text-[11.5px] leading-tight text-[var(--muted)]">{hint}</span>}
      </span>
    </label>
  );
}

function Section({ icon, title, description, children }: {
  icon: React.ReactNode; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header className="flex items-start gap-2.5 border-b border-[var(--border)] pb-2">
        <span className="mt-0.5 text-[var(--brand)]">{icon}</span>
        <div>
          <h3 className="text-[13.5px] font-bold">{title}</h3>
          <p className="text-[11.5px] text-[var(--muted)]">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

const num = (v: string) => (v === '' ? undefined : Number(v));
const str = (v: string | number | null | undefined) => (v == null ? '' : String(v));

export default function AseguradoraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, refetch } = useApi<Insurer>(`/insurers/${id}`);
  const editable = can('catalog:write');

  const [t, setT] = useState<Terms>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState({ name: '', role: '', phone: '', email: '' });
  const [removing, setRemoving] = useState<Contact | null>(null);

  useEffect(() => {
    if (data) {
      setT({
        ...EMPTY,
        ...(data.terms ?? {}),
        requiredDocuments: (data.terms?.requiredDocuments as string[] | undefined) ?? [],
      });
    }
  }, [data]);

  if (loading && !data) {
    return (<><Topbar title="Aseguradora" /><div className="space-y-4 p-6"><Skeleton className="h-24" /><Skeleton className="h-96" /></div></>);
  }
  if (!data) return null;

  const set = <K extends keyof Terms>(k: K, v: Terms[K]) => { setT((p) => ({ ...p, [k]: v })); setSaved(false); };
  const toggleDoc = (code: string) =>
    set('requiredDocuments', t.requiredDocuments.includes(code)
      ? t.requiredDocuments.filter((c) => c !== code)
      : [...t.requiredDocuments, code]);

  async function guardar() {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/insurers/${id}/terms`, {
        requiresAuthorization: t.requiresAuthorization,
        authorizationChannel: t.authorizationChannel,
        authorizationSlaHours: num(str(t.authorizationSlaHours)),
        requiresClaimNumber: t.requiresClaimNumber,
        requiresAdjuster: t.requiresAdjuster,
        requiresPhotos: t.requiresPhotos,
        minPhotos: Number(t.minPhotos) || 0,
        requiresDamageMap: t.requiresDamageMap,
        requiresQuoteFormat: t.requiresQuoteFormat || undefined,
        requiredDocuments: t.requiredDocuments,
        partsPolicy: t.partsPolicy,
        partsSuppliedBy: t.partsSuppliedBy,
        partsMarkupPct: num(str(t.partsMarkupPct)),
        requiresPartsQuotes: Number(t.requiresPartsQuotes) || 0,
        laborRate: num(str(t.laborRate)),
        laborDiscountPct: num(str(t.laborDiscountPct)),
        partsDiscountPct: num(str(t.partsDiscountPct)),
        currency: t.currency || 'UYU',
        invoiceTo: t.invoiceTo,
        deductibleBy: t.deductibleBy,
        paymentTermDays: Number(t.paymentTermDays) || 0,
        retentionPct: num(str(t.retentionPct)),
        maxRepairDays: num(str(t.maxRepairDays)),
        warrantyDays: Number(t.warrantyDays) || 0,
        agreementRef: t.agreementRef || undefined,
        notes: t.notes || undefined,
      });
      setSaved(true);
      refetch();
      toast.ok('Condiciones guardadas', `Ya se validan al armar un expediente de ${data?.name ?? 'esta compañía'}.`);
    } catch (e) {
      setError((e as Error).message);
      toast.error('No se pudo guardar', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function agregarContacto(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/insurers/${id}/contacts`, {
        name: contactDraft.name.trim(),
        role: contactDraft.role.trim() || undefined,
        phone: contactDraft.phone.trim() || undefined,
        email: contactDraft.email.trim() || undefined,
      });
      setContactDraft({ name: '', role: '', phone: '', email: '' });
      setContactOpen(false);
      refetch();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const grouped = DOCUMENT_REQUIREMENTS.reduce<Record<string, typeof DOCUMENT_REQUIREMENTS[number][]>>((acc, d) => {
    (acc[d.group ?? 'Otros'] ??= []).push(d);
    return acc;
  }, {});

  return (
    <>
      <Topbar
        title={data.name}
        actions={
          <>
            {data.terms?.agreementRef && <Badge tone="success">Convenio {data.terms.agreementRef}</Badge>}
            {!data.worksAuto && <Badge tone="warn">No opera automotor</Badge>}
            {editable && (
              <Button size="sm" onClick={() => void guardar()} loading={busy} tip="Guarda las condiciones con las que esta compañía acepta una reparación">
                <Save className="size-4" aria-hidden /> Guardar condiciones
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-4 p-6">
        <Link href="/aseguradoras" className="focus-ring inline-flex items-center gap-1.5 rounded text-[13px] text-[var(--muted)] hover:text-[var(--brand)]">
          <ArrowLeft className="size-3.5" aria-hidden /> Aseguradoras
        </Link>

        {error && <p role="alert" className="rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[13px] text-[var(--falla)]">{error}</p>}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* ------------------------------------------------ condiciones */}
          <Card>
            <CardHeader>
              <CardTitle>Condiciones para aceptar una reparación</CardTitle>
              <span className="text-[12px] text-[var(--muted)]">Se validan antes de mandar el expediente</span>
            </CardHeader>
            <CardBody className="space-y-6">
              <Section
                icon={<FileCheck2 className="size-4" aria-hidden />}
                title="Autorización"
                description="Qué exige la compañía antes de dar la orden de reparación."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Toggle label="Requiere autorización previa" hint="Sin orden no se toca el vehículo" checked={t.requiresAuthorization} onChange={(v) => set('requiresAuthorization', v)} disabled={!editable} />
                  <Toggle label="Pide nº de denuncia" hint="Número de siniestro del asegurado" checked={t.requiresClaimNumber} onChange={(v) => set('requiresClaimNumber', v)} disabled={!editable} />
                  <Toggle label="Peritaje previo" hint="Un perito revisa antes de autorizar" checked={t.requiresAdjuster} onChange={(v) => set('requiresAdjuster', v)} disabled={!editable} />
                  <Toggle label="Exige fotos" hint="Relevamiento fotográfico del vehículo" checked={t.requiresPhotos} onChange={(v) => set('requiresPhotos', v)} disabled={!editable} />
                  <Toggle label="Exige daños marcados" hint="Mapa de daños sobre las fotos" checked={t.requiresDamageMap} onChange={(v) => set('requiresDamageMap', v)} disabled={!editable} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Select label="Canal de autorización" icon={<ClipboardList className="size-3.5" aria-hidden />} value={t.authorizationChannel} disabled={!editable} onChange={(e) => set('authorizationChannel', e.target.value)} tip="Por dónde se manda el expediente">
                    {AUTHORIZATION_CHANNELS.map((c) => <option key={c} value={c}>{AUTH_CHANNEL_LABELS[c]}</option>)}
                  </Select>
                  <Input label="Respuesta esperada (horas)" type="number" min={0} value={str(t.authorizationSlaHours)} disabled={!editable} onChange={(e) => set('authorizationSlaHours', e.target.value === '' ? null : Number(e.target.value))} placeholder="Ej: 48" tip="Cuánto suele demorar la compañía en contestar" />
                  <Input label="Mínimo de fotos" type="number" min={0} value={String(t.minPhotos)} disabled={!editable || !t.requiresPhotos} onChange={(e) => set('minPhotos', Number(e.target.value))} tip="Cuántas fotos pide como mínimo" />
                </div>
                <Input label="Formato de presupuesto exigido" value={str(t.requiresQuoteFormat)} disabled={!editable} onChange={(e) => set('requiresQuoteFormat', e.target.value)} placeholder="Ej: planilla propia de la compañía, Audatex…" tip="Si la compañía pide su propia planilla, anotalo acá" />
              </Section>

              <Section
                icon={<ClipboardList className="size-4" aria-hidden />}
                title="Documentación obligatoria"
                description="Lo que tiene que estar cargado en la OT para poder enviar el expediente."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(grouped).map(([group, docs]) => (
                    <div key={group} className="rounded-[var(--r)] border border-[var(--border)] p-2.5">
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{group}</p>
                      <ul className="space-y-1">
                        {docs.map((d) => {
                          const on = t.requiredDocuments.includes(d.code);
                          return (
                            <li key={d.code}>
                              <label className={cn('flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[12.5px]', !editable && 'cursor-default')}>
                                <input type="checkbox" checked={on} disabled={!editable} onChange={() => toggleDoc(d.code)} className="size-3.5 accent-[var(--brand)]" />
                                <span className={cn(on && 'font-medium')}>{d.label}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </Section>

              <Section
                icon={<Wrench className="size-4" aria-hidden />}
                title="Repuestos"
                description="Qué tipo de repuesto acepta y quién los consigue."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select label="Política de repuestos" value={t.partsPolicy} disabled={!editable} onChange={(e) => set('partsPolicy', e.target.value)} tip="Original, alternativo o según lo que diga el perito">
                    {PARTS_POLICIES.map((p) => <option key={p} value={p}>{PARTS_POLICY_LABELS[p]}</option>)}
                  </Select>
                  <Select label="Quién provee los repuestos" value={t.partsSuppliedBy} disabled={!editable} onChange={(e) => set('partsSuppliedBy', e.target.value)}>
                    {PARTS_SUPPLIERS.map((p) => <option key={p} value={p}>{PARTS_SUPPLIER_LABELS[p]}</option>)}
                  </Select>
                  <Input label="Cotizaciones a adjuntar" type="number" min={0} max={10} value={String(t.requiresPartsQuotes)} disabled={!editable} onChange={(e) => set('requiresPartsQuotes', Number(e.target.value))} tip="Cuántos presupuestos de proveedor pide la compañía" />
                  <Input label="Margen permitido sobre repuestos (%)" type="number" min={0} value={str(t.partsMarkupPct)} disabled={!editable} onChange={(e) => set('partsMarkupPct', e.target.value)} placeholder="Ej: 15" />
                </div>
              </Section>

              <Section
                icon={<Wallet className="size-4" aria-hidden />}
                title="Dinero"
                description="Valor hora acordado, descuentos, franquicia y forma de cobro."
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input label="Valor hora acordado" type="number" min={0} value={str(t.laborRate)} disabled={!editable} onChange={(e) => set('laborRate', e.target.value)} placeholder="Ej: 1200" tip="Valor de la hora de mano de obra que reconoce la compañía" />
                  <Input label="Descuento en mano de obra (%)" type="number" min={0} max={100} value={str(t.laborDiscountPct)} disabled={!editable} onChange={(e) => set('laborDiscountPct', e.target.value)} />
                  <Input label="Descuento en repuestos (%)" type="number" min={0} max={100} value={str(t.partsDiscountPct)} disabled={!editable} onChange={(e) => set('partsDiscountPct', e.target.value)} />
                  <Select label="A quién se factura" value={t.invoiceTo} disabled={!editable} onChange={(e) => set('invoiceTo', e.target.value)}>
                    {INVOICE_TARGETS.map((v) => <option key={v} value={v}>{INVOICE_TO_LABELS[v]}</option>)}
                  </Select>
                  <Select label="Quién cobra la franquicia" value={t.deductibleBy} disabled={!editable} onChange={(e) => set('deductibleBy', e.target.value)} tip="Define cuánto le queda a pagar al cliente en la OT">
                    {DEDUCTIBLE_COLLECTORS.map((v) => <option key={v} value={v}>{DEDUCTIBLE_LABELS[v]}</option>)}
                  </Select>
                  <Input label="Plazo de pago (días)" type="number" min={0} value={String(t.paymentTermDays)} disabled={!editable} onChange={(e) => set('paymentTermDays', Number(e.target.value))} tip="A cuántos días paga la compañía la factura" />
                  <Input label="Retención (%)" type="number" min={0} max={100} value={str(t.retentionPct)} disabled={!editable} onChange={(e) => set('retentionPct', e.target.value)} />
                  <Input label="Moneda" value={t.currency} disabled={!editable} onChange={(e) => set('currency', e.target.value.toUpperCase().slice(0, 3))} />
                </div>
              </Section>

              <Section
                icon={<CalendarClock className="size-4" aria-hidden />}
                title="Plazos, garantía y convenio"
                description="Los límites que después se controlan desde la OT."
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input label="Plazo máximo de reparación (días)" type="number" min={0} value={str(t.maxRepairDays)} disabled={!editable} onChange={(e) => set('maxRepairDays', e.target.value === '' ? null : Number(e.target.value))} placeholder="Ej: 20" />
                  <Input label="Garantía exigida (días)" type="number" min={0} value={String(t.warrantyDays)} disabled={!editable} onChange={(e) => set('warrantyDays', Number(e.target.value))} />
                  <Input label="Nº de convenio con el taller" value={str(t.agreementRef)} disabled={!editable} onChange={(e) => set('agreementRef', e.target.value)} placeholder="Ej: CV-2026-118" />
                </div>
                <Textarea label="Notas del convenio" rows={3} value={str(t.notes)} disabled={!editable} onChange={(e) => set('notes', e.target.value)} placeholder="Particularidades: a quién llamar, qué no aceptan, cómo cargan los repuestos…" />
              </Section>

              {editable && (
                <div className="flex justify-end border-t border-[var(--border)] pt-3">
                  <Button onClick={() => void guardar()} loading={busy}>
                    <Save className="size-4" aria-hidden /> Guardar condiciones
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          {/* ------------------------------------------------ lateral */}
          <aside className="space-y-4">
            <Card>
              <CardBody className="space-y-3">
                <div className="flex items-start gap-3">
                  <InsurerAvatar name={data.name} logoFile={data.logoFile} size={48} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold leading-tight">{data.name}</p>
                    <p className="text-[12px] text-[var(--muted)]">{data.legalName ?? '—'}</p>
                    {data.taxId && <p className="mono text-[11.5px] text-[var(--subtle)]">RUT {data.taxId}</p>}
                  </div>
                </div>
                <dl className="space-y-1.5 text-[12.5px]">
                  {data.claimsPhone && <div className="flex items-center gap-2"><Phone className="size-3.5 shrink-0 text-[var(--subtle)]" aria-hidden /><dd>{data.claimsPhone} <span className="text-[var(--muted)]">(siniestros)</span></dd></div>}
                  {data.phone && <div className="flex items-center gap-2"><Phone className="size-3.5 shrink-0 text-[var(--subtle)]" aria-hidden /><dd>{data.phone}</dd></div>}
                  {data.claimsEmail && <div className="flex items-center gap-2"><Mail className="size-3.5 shrink-0 text-[var(--subtle)]" aria-hidden /><dd className="truncate">{data.claimsEmail}</dd></div>}
                  {data.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="size-3.5 shrink-0 text-[var(--subtle)]" aria-hidden />
                      <a href={data.website} target="_blank" rel="noreferrer" className="focus-ring truncate rounded text-[var(--brand)] hover:underline">{data.website.replace(/^https?:\/\//, '')}</a>
                    </div>
                  )}
                  {data.portalUrl && (
                    <div className="flex items-center gap-2">
                      <ExternalLink className="size-3.5 shrink-0 text-[var(--subtle)]" aria-hidden />
                      <a href={data.portalUrl} target="_blank" rel="noreferrer" className="focus-ring truncate rounded text-[var(--brand)] hover:underline">Portal de autorizaciones</a>
                    </div>
                  )}
                </dl>
                {data.notes && (
                  <p className="flex items-start gap-2 rounded-[var(--r)] bg-[var(--warn-bg)] px-2.5 py-2 text-[11.5px] text-[var(--warn)]">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {data.notes}
                  </p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contactos</CardTitle>
                {editable && (
                  <Button size="sm" variant="ghost" onClick={() => setContactOpen(true)} tip="Perito, mesa de autorizaciones, liquidador…">
                    <Plus className="size-3.5" aria-hidden /> Agregar
                  </Button>
                )}
              </CardHeader>
              <CardBody className="space-y-2">
                {data.contacts.length === 0 ? (
                  <p className="text-[12.5px] text-[var(--muted)]">Todavía no cargaste contactos de esta compañía.</p>
                ) : data.contacts.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-2 rounded-[var(--r)] border border-[var(--border)] p-2.5">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[13px] font-semibold"><Users className="size-3.5 shrink-0 text-[var(--subtle)]" aria-hidden /> {c.name}</p>
                      {c.role && <p className="text-[11.5px] text-[var(--muted)]">{c.role}</p>}
                      {c.phone && <p className="mono text-[11.5px] text-[var(--muted)]">{c.phone}</p>}
                      {c.email && <p className="truncate text-[11.5px] text-[var(--muted)]">{c.email}</p>}
                    </div>
                    {editable && (
                      <button
                        type="button"
                        onClick={() => setRemoving(c)}
                        aria-label={`Borrar contacto ${c.name}`}
                        data-tooltip-id="ts-tip"
                        data-tooltip-content="Borrar contacto"
                        className="focus-ring grid size-7 shrink-0 place-items-center rounded-lg text-[var(--subtle)] hover:bg-[var(--falla-bg)] hover:text-[var(--falla)]"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Últimos siniestros</CardTitle>
                <span className="text-[12px] text-[var(--muted)]">{data._count.cases} en total</span>
              </CardHeader>
              <CardBody className="p-0">
                {data.cases.length === 0 ? (
                  <div className="p-4">
                    <EmptyState icon={<ShieldCheck className="size-5" aria-hidden />} title="Sin siniestros" description="Cuando una OT se asocie a esta compañía va a aparecer acá." />
                  </div>
                ) : (
                  <Table>
                    <thead><tr><Th>OT / vehículo</Th><Th>Estado</Th><Th className="text-right">Compañía</Th></tr></thead>
                    <tbody>
                      {data.cases.map((c) => (
                        <tr key={c.id}>
                          <Td>
                            <Link href={`/ordenes/${c.workOrder.id}`} className="focus-ring rounded font-medium hover:text-[var(--brand)]">{c.workOrder.number}</Link>
                            <div className="mono text-[11.5px] text-[var(--muted)]">{c.workOrder.vehicle.plate}</div>
                            <div className="truncate text-[11px] text-[var(--subtle)]">{customerName(c.workOrder.customer)} · {formatDate(c.workOrder.receivedAt)}</div>
                          </Td>
                          <Td><Badge tone={c.status.startsWith('AUTORIZADO') ? 'success' : c.status === 'RECHAZADO' ? 'danger' : 'info'}>{c.status.replace(/_/g, ' ').toLowerCase()}</Badge></Td>
                          <Td className="mono text-right">{c.insurerAmount ? formatMoney(c.insurerAmount) : '—'}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </CardBody>
            </Card>
          </aside>
        </div>
      </div>

      <Modal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        title="Nuevo contacto"
        description="Perito, mesa de autorizaciones, liquidador: quién atiende de esta compañía."
        icon={<Users className="size-[19px]" aria-hidden />}
        width="sm"
      >
        <form onSubmit={agregarContacto} className="space-y-3">
          <Input label="Nombre" value={contactDraft.name} onChange={(e) => setContactDraft({ ...contactDraft, name: e.target.value })} required autoFocus />
          <Input label="Rol" value={contactDraft.role} onChange={(e) => setContactDraft({ ...contactDraft, role: e.target.value })} placeholder="Perito, mesa de autorizaciones, liquidador…" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Teléfono" icon={<Phone className="size-3.5" aria-hidden />} value={contactDraft.phone} onChange={(e) => setContactDraft({ ...contactDraft, phone: e.target.value })} />
            <Input label="Correo" icon={<Mail className="size-3.5" aria-hidden />} type="email" value={contactDraft.email} onChange={(e) => setContactDraft({ ...contactDraft, email: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setContactOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={busy} disabled={!contactDraft.name.trim()}><Check className="size-4" aria-hidden /> Agregar</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Borrar contacto"
        message={`¿Borrar a ${removing?.name ?? ''} de los contactos de ${data.name}?`}
        detail="No afecta a los expedientes ya cargados: sólo deja de aparecer en la lista de contactos."
        confirmLabel="Borrar"
        loading={busy}
        onConfirm={() => void (async () => {
          if (!removing) return;
          setBusy(true);
          try {
            await api.del(`/insurers/contacts/${removing.id}`);
            setRemoving(null);
            refetch();
          } finally {
            setBusy(false);
          }
        })()}
      />
    </>
  );
}
