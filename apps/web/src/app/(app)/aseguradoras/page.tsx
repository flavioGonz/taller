'use client';

import { useCallback, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ShieldCheck, Plus, Search, Car, FileCheck2, Clock, Wallet, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import {
  Button, Card, CardBody, CardHeader, CardTitle, Input, Skeleton, EmptyState, Badge, Stat,
} from '@/components/ui';
import { Modal } from '@/components/modal';
import { useToast } from '@/components/toast';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { InsurerAvatar } from '@/components/insurer-avatar';
import { cn } from '@/lib/utils';
import {
  PARTS_POLICY_LABELS, INVOICE_TO_LABELS, AUTH_CHANNEL_LABELS, AUTH_STATUS_LABELS,
  type PartsPolicy, type InvoiceTo, type AuthorizationChannel, type AuthorizationStatus,
} from '@taller/shared';

interface Insurer {
  id: string; slug: string; name: string; legalName: string | null;
  phone: string | null; claimsPhone: string | null; claimsEmail: string | null;
  portalUrl: string | null; website: string | null;
  worksAuto: boolean; isActive: boolean; notes: string | null; logoFile: string | null;
  terms: {
    requiresAuthorization: boolean; authorizationChannel: AuthorizationChannel;
    authorizationSlaHours: number | null; partsPolicy: PartsPolicy;
    invoiceTo: InvoiceTo; paymentTermDays: number; warrantyDays: number;
    laborRate: string | null; agreementRef: string | null;
  } | null;
  _count: { cases: number };
}

interface PendingCase {
  id: string; status: AuthorizationStatus; claimNumber: string | null; createdAt: string;
  insurer: { id: string; name: string };
  workOrder: { id: string; number: string; status: string; vehicle: { plate: string; brand: string; model: string } };
}

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warn' | 'success' | 'danger'> = {
  SIN_ENVIAR: 'neutral', ENVIADO: 'info', EN_ANALISIS: 'warn',
  AUTORIZADO: 'success', AUTORIZADO_PARCIAL: 'warn', RECHAZADO: 'danger', VENCIDO: 'danger',
};

export default function AseguradorasPage() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [soloAuto, setSoloAuto] = useState(true);
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState('');
  const [busy, setBusy] = useState(false);
  // Los errores salen como aviso flotante, no como cartel pegado a la página
  const toast = useToast();
  const setError = useCallback(
    (m: string | null) => { if (m) toast.error('No se pudo guardar', m); },
    [toast],
  );
  const { data, loading, refetch } = useApi<Insurer[]>('/insurers');
  const { data: pending } = useApi<PendingCase[]>('/insurers/board/pending');

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? [])
      .filter((i) => (soloAuto ? i.worksAuto : true))
      .filter((i) => !t || i.name.toLowerCase().includes(t) || (i.legalName ?? '').toLowerCase().includes(t));
  }, [data, q, soloAuto]);

  const conConvenio = (data ?? []).filter((i) => i.terms?.agreementRef).length;
  const esperando = (pending ?? []).filter((c) => c.status !== 'SIN_ENVIAR').length;

  async function crear(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const nueva = await api.post<{ id: string }>('/insurers', { name: nombre.trim() });
      window.location.href = `/aseguradoras/${nueva.id}`;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <Topbar
        title="Aseguradoras"
        description="Las compañías con las que trabaja el taller y sus condiciones"
        actions={can('catalog:write') ? (
          <Button size="sm" onClick={() => setCreating(true)} tip="Agregá una compañía que no esté en el catálogo">
            <Plus className="size-4" aria-hidden /> Nueva aseguradora
          </Button>
        ) : undefined}
      />

      <div className="space-y-4 p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={<ShieldCheck className="size-4" aria-hidden />} label="Compañías en el catálogo" value={String(data?.length ?? 0)} hint="Todas las que operan en Uruguay" />
          <Stat icon={<Car className="size-4" aria-hidden />} label="Trabajan automotor" value={String((data ?? []).filter((i) => i.worksAuto).length)} tone="ok" />
          <Stat icon={<FileCheck2 className="size-4" aria-hidden />} label="Con convenio cargado" value={String(conConvenio)} hint="Tienen nº de convenio con el taller" tone="brand" />
          <Stat icon={<Clock className="size-4" aria-hidden />} label="Esperando autorización" value={String(esperando)} hint="Expedientes enviados o en análisis" tone={esperando > 0 ? 'warn' : 'ok'} />
        </div>

        {(pending ?? []).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Expedientes abiertos</CardTitle>
              <span className="text-[12px] text-[var(--muted)]">{pending!.length} en curso</span>
            </CardHeader>
            <CardBody className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {pending!.map((c) => (
                <Link
                  key={c.id}
                  href={`/ordenes/${c.workOrder.id}`}
                  className="focus-ring flex items-center justify-between gap-3 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 transition hover:border-[var(--brand)]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold">{c.insurer.name}</p>
                    <p className="mono truncate text-[12px] text-[var(--muted)]">
                      {c.workOrder.vehicle.plate} · OT {c.workOrder.number}
                    </p>
                    {c.claimNumber && <p className="truncate text-[11.5px] text-[var(--subtle)]">Denuncia {c.claimNumber}</p>}
                  </div>
                  <Badge tone={STATUS_TONE[c.status] ?? 'neutral'}>{AUTH_STATUS_LABELS[c.status]}</Badge>
                </Link>
              ))}
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Compañías</CardTitle>
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-[var(--muted)]">
                <input type="checkbox" checked={soloAuto} onChange={(e) => setSoloAuto(e.target.checked)} className="accent-[var(--brand)]" />
                Sólo automotor
              </label>
              <Input
                aria-label="Buscar aseguradora"
                icon={<Search className="size-3.5" aria-hidden />}
                placeholder="Buscar…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="!w-56"
              />
            </div>
          </CardHeader>
          <CardBody>
            {loading && !data ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
              </div>
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck className="size-6" aria-hidden />}
                title="No hay compañías que coincidan"
                description="Probá cambiando el filtro o agregá una nueva aseguradora."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((i) => (
                  <Link
                    key={i.id}
                    href={`/aseguradoras/${i.id}`}
                    className={cn(
                      'focus-ring group flex flex-col gap-2.5 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-3.5 transition hover:border-[var(--brand)] hover:shadow-[var(--sh-md)]',
                      !i.isActive && 'opacity-60',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <InsurerAvatar name={i.name} logoFile={i.logoFile} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold">{i.name}</p>
                        <p className="truncate text-[11.5px] text-[var(--muted)]">{i.legalName ?? '—'}</p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-[var(--subtle)] transition group-hover:translate-x-0.5 group-hover:text-[var(--brand)]" aria-hidden />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {i.terms?.agreementRef
                        ? <Badge tone="success">Convenio {i.terms.agreementRef}</Badge>
                        : <Badge tone="neutral">Sin convenio</Badge>}
                      {i._count.cases > 0 && <Badge tone="info">{i._count.cases} siniestro{i._count.cases === 1 ? '' : 's'}</Badge>}
                      {!i.worksAuto && <Badge tone="warn">No automotor</Badge>}
                    </div>

                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-[var(--muted)]">
                      <div className="flex items-center gap-1.5">
                        <FileCheck2 className="size-3.5 shrink-0" aria-hidden />
                        <dd className="truncate">{i.terms ? AUTH_CHANNEL_LABELS[i.terms.authorizationChannel] : 'Sin condiciones'}</dd>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Car className="size-3.5 shrink-0" aria-hidden />
                        <dd className="truncate">{i.terms ? PARTS_POLICY_LABELS[i.terms.partsPolicy] : '—'}</dd>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Wallet className="size-3.5 shrink-0" aria-hidden />
                        <dd className="truncate">{i.terms ? INVOICE_TO_LABELS[i.terms.invoiceTo] : '—'}</dd>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 shrink-0" aria-hidden />
                        <dd className="truncate">{i.terms ? `Paga a ${i.terms.paymentTermDays} días` : '—'}</dd>
                      </div>
                    </dl>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <p className="flex items-start gap-2 text-[12px] text-[var(--muted)]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Las condiciones que vienen cargadas son un punto de partida conservador. Confirmá cada una con la compañía
          antes de apoyarte en ellas para aceptar una reparación.
        </p>
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nueva aseguradora"
        description="Cargá el nombre y después completás las condiciones del convenio."
        icon={<ShieldCheck className="size-[19px]" aria-hidden />}
        width="sm"
      >
        <form onSubmit={crear} className="space-y-3">
          <Input
            label="Nombre comercial"
            icon={<ShieldCheck className="size-3.5" aria-hidden />}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            autoFocus
            placeholder="Ej: Nueva Compañía de Seguros"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button type="submit" loading={busy} disabled={!nombre.trim()}>Crear y configurar</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
