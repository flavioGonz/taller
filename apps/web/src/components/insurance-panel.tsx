'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck, Send, Check, X, AlertTriangle, Save, UserCheck, Hash, CalendarClock,
  Wallet, FileCheck2, ExternalLink, Loader2, ClipboardList,
} from 'lucide-react';
import {
  Button, Card, CardBody, CardHeader, CardTitle, Input, Select, Textarea, Badge,
} from '@/components/ui';
import { Modal } from '@/components/modal';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/components/toast';
import { cn, formatDate } from '@/lib/utils';
import {
  DOCUMENT_REQUIREMENTS, DEDUCTIBLE_COLLECTORS, DEDUCTIBLE_LABELS,
  AUTHORIZATION_STATUSES, AUTH_STATUS_LABELS, AUTH_CHANNEL_LABELS,
  PARTS_POLICY_LABELS, INVOICE_TO_LABELS, formatMoney,
  type AuthorizationStatus,
} from '@taller/shared';

interface InsurerLite {
  id: string; name: string; worksAuto: boolean;
  terms: { authorizationChannel: string; partsPolicy: string; invoiceTo: string; deductibleBy: string; warrantyDays: number; maxRepairDays: number | null; requiresQuoteFormat: string | null; notes: string | null } | null;
}

interface Requirement { code: string; label: string; ok: boolean; detail?: string }

interface Kase {
  id: string; insurerId: string; status: AuthorizationStatus;
  policyNumber: string | null; claimNumber: string | null; claimDate: string | null;
  adjusterName: string | null; adjusterPhone: string | null; adjusterVisitAt: string | null;
  deductible: string | null; deductibleBy: string;
  insurerAmount: string | null; customerAmount: string | null;
  authorizationRef: string | null; authorizedAmount: string | null; authorizedBy: string | null;
  authorizedAt: string | null; rejectionReason: string | null; sentAt: string | null;
  documents: Record<string, boolean>; notes: string | null;
  insurer: InsurerLite;
  readiness: { requirements: Requirement[]; ready: boolean };
  counts: { photos: number; damages: number };
}

const TONE: Record<AuthorizationStatus, 'neutral' | 'info' | 'warn' | 'success' | 'danger'> = {
  SIN_ENVIAR: 'neutral', ENVIADO: 'info', EN_ANALISIS: 'warn',
  AUTORIZADO: 'success', AUTORIZADO_PARCIAL: 'warn', RECHAZADO: 'danger', VENCIDO: 'danger',
};

const dateInput = (v: string | null | undefined) => (v ? v.slice(0, 10) : '');

/**
 * Expediente del siniestro dentro de la OT: datos de la compañía, checklist de
 * lo que exige para autorizar, envío a autorización y registro de la respuesta.
 */
export function InsurancePanel({
  workOrderId, grandTotal, currency, onChange,
}: {
  workOrderId: string; grandTotal: string; currency: string; onChange: () => void;
}) {
  const { can } = useAuth();
  const toast = useToast();
  const { data: kase, loading, refetch } = useApi<Kase | null>(`/work-orders/${workOrderId}/insurance`);
  const { data: insurers } = useApi<InsurerLite[]>('/insurers?auto=true');
  const editable = can('workorder:write');

  const [form, setForm] = useState({
    insurerId: '', policyNumber: '', claimNumber: '', claimDate: '',
    adjusterName: '', adjusterPhone: '', adjusterVisitAt: '', deductible: '', deductibleBy: 'TALLER',
    notes: '',
  });
  const [docs, setDocs] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [auth, setAuth] = useState({ status: 'AUTORIZADO' as AuthorizationStatus, authorizationRef: '', authorizedAmount: '', authorizedBy: '', rejectionReason: '', notes: '' });

  useEffect(() => {
    if (!kase) return;
    setForm({
      insurerId: kase.insurerId,
      policyNumber: kase.policyNumber ?? '',
      claimNumber: kase.claimNumber ?? '',
      claimDate: dateInput(kase.claimDate),
      adjusterName: kase.adjusterName ?? '',
      adjusterPhone: kase.adjusterPhone ?? '',
      adjusterVisitAt: dateInput(kase.adjusterVisitAt),
      deductible: kase.deductible ? String(Number(kase.deductible)) : '',
      deductibleBy: kase.deductibleBy,
      notes: kase.notes ?? '',
    });
    setDocs((kase.documents ?? {}) as Record<string, boolean>);
    setAuth((a) => ({ ...a, authorizedAmount: kase.insurerAmount ? String(Number(kase.insurerAmount)) : '' }));
  }, [kase]);

  const selected = useMemo(
    () => (insurers ?? []).find((i) => i.id === form.insurerId) ?? kase?.insurer ?? null,
    [insurers, form.insurerId, kase],
  );

  const faltantes = (kase?.readiness.requirements ?? []).filter((r) => !r.ok);
  const decidido = kase && ['AUTORIZADO', 'AUTORIZADO_PARCIAL', 'RECHAZADO'].includes(kase.status);

  async function run(fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      refetch();
      onChange();
      if (okMsg) toast.ok(okMsg);
    } catch (e) {
      setError((e as Error).message);
      toast.error('La compañía no acepta el expediente todavía', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const guardar = () => run(() => api.put(`/work-orders/${workOrderId}/insurance`, {
    insurerId: form.insurerId,
    policyNumber: form.policyNumber.trim() || undefined,
    claimNumber: form.claimNumber.trim() || undefined,
    claimDate: form.claimDate || undefined,
    adjusterName: form.adjusterName.trim() || undefined,
    adjusterPhone: form.adjusterPhone.trim() || undefined,
    adjusterVisitAt: form.adjusterVisitAt || undefined,
    deductible: form.deductible === '' ? undefined : Number(form.deductible),
    deductibleBy: form.deductibleBy,
    documents: docs,
    notes: form.notes.trim() || undefined,
  }), 'Expediente guardado');

  const enviar = (force = false) => run(
    () => api.post(`/work-orders/${workOrderId}/insurance/submit`, { force }),
    force ? 'Enviado igual, bajo tu responsabilidad' : 'Expediente enviado a autorizar',
  );

  const registrar = () => run(async () => {
    await api.post(`/work-orders/${workOrderId}/insurance/authorization`, {
      status: auth.status,
      authorizationRef: auth.authorizationRef.trim() || undefined,
      authorizedAmount: auth.authorizedAmount === '' ? undefined : Number(auth.authorizedAmount),
      authorizedBy: auth.authorizedBy.trim() || undefined,
      rejectionReason: auth.rejectionReason.trim() || undefined,
      notes: auth.notes.trim() || undefined,
    });
    setAuthOpen(false);
  }, 'Respuesta registrada: la OT ya se movió sola');

  const requiredDocs = useMemo(() => {
    const codes = (kase?.readiness.requirements ?? []).filter((r) => r.code.startsWith('doc_')).map((r) => r.code.slice(4));
    return DOCUMENT_REQUIREMENTS.filter((d) => codes.includes(d.code));
  }, [kase]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4" aria-hidden /> Siniestro y aseguradora
        </CardTitle>
        <div className="flex items-center gap-2">
          {kase && <Badge tone={TONE[kase.status]}>{AUTH_STATUS_LABELS[kase.status]}</Badge>}
          {kase && (
            <Link href={`/aseguradoras/${kase.insurerId}`} className="focus-ring rounded text-[12px] text-[var(--muted)] hover:text-[var(--brand)]" data-tooltip-id="ts-tip" data-tooltip-content="Ver las condiciones de esta compañía">
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        {loading && !kase && <p className="flex items-center gap-2 text-[13px] text-[var(--muted)]"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Cargando expediente…</p>}

        {error && <p role="alert" className="rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[12.5px] text-[var(--falla)]">{error}</p>}

        {/* ------------------------------------------------ datos del caso */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Compañía"
            icon={<ShieldCheck className="size-3.5" aria-hidden />}
            value={form.insurerId}
            disabled={!editable || !!decidido}
            onChange={(e) => setForm({ ...form, insurerId: e.target.value })}
            tip="Sólo se listan las compañías que trabajan automotor"
          >
            <option value="">Elegí la aseguradora…</option>
            {(insurers ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </Select>
          <Input label="Nº de póliza" icon={<Hash className="size-3.5" aria-hidden />} value={form.policyNumber} disabled={!editable} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} />
          <Input label="Nº de denuncia / siniestro" icon={<Hash className="size-3.5" aria-hidden />} value={form.claimNumber} disabled={!editable} onChange={(e) => setForm({ ...form, claimNumber: e.target.value })} tip="El número que le dio la compañía al asegurado" />
          <Input label="Fecha del siniestro" type="date" icon={<CalendarClock className="size-3.5" aria-hidden />} value={form.claimDate} disabled={!editable} onChange={(e) => setForm({ ...form, claimDate: e.target.value })} />
          <Input label="Perito" icon={<UserCheck className="size-3.5" aria-hidden />} value={form.adjusterName} disabled={!editable} onChange={(e) => setForm({ ...form, adjusterName: e.target.value })} />
          <Input label="Teléfono del perito" value={form.adjusterPhone} disabled={!editable} onChange={(e) => setForm({ ...form, adjusterPhone: e.target.value })} />
          <Input label="Visita del perito" type="date" value={form.adjusterVisitAt} disabled={!editable} onChange={(e) => setForm({ ...form, adjusterVisitAt: e.target.value })} tip="Cuándo pasa a ver el vehículo" />
          <Input label="Franquicia" type="number" min={0} icon={<Wallet className="size-3.5" aria-hidden />} value={form.deductible} disabled={!editable} onChange={(e) => setForm({ ...form, deductible: e.target.value })} tip="Lo que la póliza deja a cargo del asegurado" />
          <Select label="Quién cobra la franquicia" value={form.deductibleBy} disabled={!editable} onChange={(e) => setForm({ ...form, deductibleBy: e.target.value })}>
            {DEDUCTIBLE_COLLECTORS.map((d) => <option key={d} value={d}>{DEDUCTIBLE_LABELS[d]}</option>)}
          </Select>
          <Input label="Reparto del total" value={kase ? `${formatMoney(kase.insurerAmount ?? 0, currency)} compañía · ${formatMoney(kase.customerAmount ?? 0, currency)} cliente` : formatMoney(grandTotal, currency)} readOnly tip="Se calcula solo con la franquicia y quién la cobra" />
        </div>

        {selected?.terms && (
          <div className="grid gap-2 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface-2)] p-3 text-[12px] sm:grid-cols-2 xl:grid-cols-4">
            <p><span className="text-[var(--muted)]">Autoriza por:</span> {AUTH_CHANNEL_LABELS[selected.terms.authorizationChannel as keyof typeof AUTH_CHANNEL_LABELS]}</p>
            <p><span className="text-[var(--muted)]">Repuestos:</span> {PARTS_POLICY_LABELS[selected.terms.partsPolicy as keyof typeof PARTS_POLICY_LABELS]}</p>
            <p><span className="text-[var(--muted)]">Factura:</span> {INVOICE_TO_LABELS[selected.terms.invoiceTo as keyof typeof INVOICE_TO_LABELS]}</p>
            <p><span className="text-[var(--muted)]">Plazo máx.:</span> {selected.terms.maxRepairDays ? `${selected.terms.maxRepairDays} días` : 'sin tope'}</p>
            {selected.terms.requiresQuoteFormat && <p className="sm:col-span-2 xl:col-span-4"><span className="text-[var(--muted)]">Formato de presupuesto:</span> {selected.terms.requiresQuoteFormat}</p>}
          </div>
        )}

        <Textarea label="Notas del expediente" rows={2} value={form.notes} disabled={!editable} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ej: el perito pidió foto del VIN antes de autorizar." />

        {/* -------------------------------------------- documentación */}
        {requiredDocs.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              <ClipboardList className="size-3.5" aria-hidden /> Documentación que pide {selected?.name ?? 'la compañía'}
            </p>
            <div className="grid gap-1 sm:grid-cols-2">
              {requiredDocs.map((d) => (
                <label key={d.code} className={cn('flex cursor-pointer items-center gap-2 rounded-[var(--r-sm)] border border-[var(--border)] px-2.5 py-1.5 text-[12.5px]', docs[d.code] && 'border-[var(--ok-bd)] bg-[var(--ok-bg)]', !editable && 'cursor-default')}>
                  <input type="checkbox" checked={!!docs[d.code]} disabled={!editable} onChange={(e) => setDocs({ ...docs, [d.code]: e.target.checked })} className="size-3.5 accent-[var(--brand)]" />
                  {d.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ----------------------------------------------- checklist */}
        {kase && (
          <div className={cn('rounded-[var(--r)] border p-3', kase.readiness.ready ? 'border-[var(--ok-bd)] bg-[var(--ok-bg)]' : 'border-[var(--warn-bd)] bg-[var(--warn-bg)]')}>
            <p className={cn('mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold', kase.readiness.ready ? 'text-[var(--ok)]' : 'text-[var(--warn)]')}>
              {kase.readiness.ready
                ? <><Check className="size-4" aria-hidden /> El expediente cumple todo lo que pide {kase.insurer.name}</>
                : <><AlertTriangle className="size-4" aria-hidden /> Faltan {faltantes.length} cosa{faltantes.length === 1 ? '' : 's'} para poder enviarlo</>}
            </p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {kase.readiness.requirements.map((r) => (
                <li key={r.code} className="flex items-center gap-1.5 text-[12px]">
                  {r.ok
                    ? <Check className="size-3.5 shrink-0 text-[var(--ok)]" aria-hidden />
                    : <X className="size-3.5 shrink-0 text-[var(--falla)]" aria-hidden />}
                  <span className={cn(!r.ok && 'font-medium')}>{r.label}</span>
                  {r.detail && <span className="text-[var(--muted)]">({r.detail})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* -------------------------------------------- respuesta */}
        {kase?.authorizedAt && (
          <div className="rounded-[var(--r)] border border-[var(--border)] p-3 text-[12.5px]">
            <p className="font-semibold text-[var(--ok)]">Autorizado el {formatDate(kase.authorizedAt, true)}</p>
            {kase.authorizationRef && <p><span className="text-[var(--muted)]">Orden de reparación:</span> <span className="mono">{kase.authorizationRef}</span></p>}
            {kase.authorizedBy && <p><span className="text-[var(--muted)]">Autorizó:</span> {kase.authorizedBy}</p>}
            {kase.authorizedAmount && <p><span className="text-[var(--muted)]">Monto autorizado:</span> {formatMoney(kase.authorizedAmount, currency)}</p>}
          </div>
        )}
        {kase?.rejectionReason && (
          <p className="rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[12.5px] text-[var(--falla)]">
            Rechazado: {kase.rejectionReason}
          </p>
        )}

        {/* -------------------------------------------------- acciones */}
        {editable && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
            {kase?.sentAt && <span className="mr-auto text-[11.5px] text-[var(--muted)]">Enviado a la compañía el {formatDate(kase.sentAt, true)}</span>}
            <Button variant="secondary" size="sm" loading={busy} disabled={!form.insurerId} onClick={() => void guardar()} tip="Guarda los datos del expediente y recalcula el reparto del monto">
              <Save className="size-3.5" aria-hidden /> Guardar expediente
            </Button>
            {kase && !decidido && (
              <Button
                size="sm"
                loading={busy}
                onClick={() => void enviar(false)}
                tip={kase.readiness.ready ? 'Marca el expediente como enviado a autorizar' : 'Primero completá lo que falta'}
              >
                <Send className="size-3.5" aria-hidden /> Mandar a autorizar
              </Button>
            )}
            {kase && !kase.readiness.ready && !decidido && (
              <Button variant="ghost" size="sm" loading={busy} onClick={() => void enviar(true)} tip="Enviarlo igual, bajo tu responsabilidad">
                Enviar igual
              </Button>
            )}
            {kase && can('quote:decide') && (
              <Button variant="secondary" size="sm" onClick={() => setAuthOpen(true)} tip="Registrar lo que contestó la compañía">
                <FileCheck2 className="size-3.5" aria-hidden /> Registrar respuesta
              </Button>
            )}
          </div>
        )}
      </CardBody>

      <Modal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        title="Respuesta de la compañía"
        description="Al registrarla, la OT pasa sola a aprobada o rechazada."
        icon={<FileCheck2 className="size-[19px]" aria-hidden />}
        width="sm"
      >
        <div className="space-y-3">
          <Select label="Qué contestaron" value={auth.status} onChange={(e) => setAuth({ ...auth, status: e.target.value as AuthorizationStatus })}>
            {AUTHORIZATION_STATUSES.filter((s) => s !== 'SIN_ENVIAR').map((s) => <option key={s} value={s}>{AUTH_STATUS_LABELS[s]}</option>)}
          </Select>
          {auth.status !== 'RECHAZADO' && (
            <>
              <Input label="Nº de orden de reparación" value={auth.authorizationRef} onChange={(e) => setAuth({ ...auth, authorizationRef: e.target.value })} tip="El número con el que la compañía autoriza el trabajo" />
              <Input label="Monto autorizado" type="number" min={0} value={auth.authorizedAmount} onChange={(e) => setAuth({ ...auth, authorizedAmount: e.target.value })} tip="Lo que se hace cargo la compañía; el resto queda al cliente" />
              <Input label="Quién autorizó" value={auth.authorizedBy} onChange={(e) => setAuth({ ...auth, authorizedBy: e.target.value })} />
            </>
          )}
          {auth.status === 'RECHAZADO' && (
            <Textarea label="Motivo del rechazo" rows={3} value={auth.rejectionReason} onChange={(e) => setAuth({ ...auth, rejectionReason: e.target.value })} />
          )}
          <Textarea label="Notas" rows={2} value={auth.notes} onChange={(e) => setAuth({ ...auth, notes: e.target.value })} />
          {error && <p role="alert" className="rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[12.5px] text-[var(--falla)]">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAuthOpen(false)}>Cancelar</Button>
            <Button loading={busy} onClick={() => void registrar()}>Guardar respuesta</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
