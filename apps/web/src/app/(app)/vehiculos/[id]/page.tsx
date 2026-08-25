'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Camera, Car, Calendar, Gauge, Fuel, Cog, IdCard, ShieldCheck, User, Phone,
  Wrench, Wallet, History, AlertTriangle, X, Star, Plus,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Skeleton, Badge, Table, Th, Td, EmptyState, Stat } from '@/components/ui';
import { PlateTag } from '@/components/vehicle-bits';
import { StatusBadge } from '@/components/status-badge';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { uploadPhoto } from '@/lib/upload';
import { customerName, formatDate, relativeTime } from '@/lib/utils';
import {
  colorHex, formatMoney, partLabel, DAMAGE_TYPE_LABELS, SEVERITY_LABELS, SEVERITY_COLORS,
  ANGLE_LABELS, VEHICLE_FEATURES, WORKORDER_KIND_DEFS, type WorkOrderKind,
} from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';

interface Photo { id: string; url: string; angle: string; caption: string | null; isPrimary: boolean; createdAt: string }
interface Damage {
  id: string; partCode: string; type: string; severity: string; note: string | null; preexisting: boolean; createdAt: string;
  photo?: { id: string; url: string; angle: string } | null;
  inspection: { kind: string; createdAt: string; workOrder: { id: string; number: string } };
}
interface WO {
  id: string; number: string; kind: WorkOrderKind; status: string; receivedAt: string; deliveredAt: string | null;
  mileageIn: number | null; grandTotal: string; diagnosis: string | null; workPerformed: string | null; warrantyUntil: string | null;
  technician?: { firstName: string; lastName: string } | null;
  items: { id: string; kind: string; description: string; total: string }[];
}
interface Vehicle {
  id: string; plate: string; brand: string; model: string; year: number | null; color: string | null;
  vin: string | null; engineNumber: string | null; fuel: string; transmission: string | null; engineSize: string | null;
  mileage: number | null; insurance: string | null; policyNumber: string | null; notes: string | null;
  photoUrl: string | null; features: Record<string, unknown>;
  customer: { id: string; firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean; phone?: string | null; email?: string | null };
  brandRef?: { id: string; name: string; logoFile: string | null } | null;
  modelRef?: { id: string; name: string; bodyType: string | null } | null;
  photos: Photo[];
  damages: Damage[];
  workOrders: WO[];
  stats: { visits: number; spent: number; lastVisit: string | null; openOrders: number; nextService: { km: number | null; at: string | null } | null; warrantyUntil: string | null };
}

export default function FichaVehiculoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useAuth();
  const { data, loading, refetch } = useApi<Vehicle>(`/vehicles/${id}`);
  const [tab, setTab] = useState<'fotos' | 'danos' | 'ficha'>('fotos');
  const [uploading, setUploading] = useState(false);

  async function subir(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const up = await uploadPhoto(f);
        await api.post(`/vehicles/${id}/photos`, { url: up.url, angle: 'OTRO' });
      }
      refetch();
    } finally {
      setUploading(false);
    }
  }

  if (loading && !data) {
    return (<><Topbar title="Ficha del vehículo" /><div className="space-y-4 p-6"><Skeleton className="h-48" /><Skeleton className="h-80" /></div></>);
  }
  if (!data) return null;

  const hex = colorHex(data.color);
  const cover = data.photoUrl ?? data.photos[0]?.url ?? null;

  const TABS = [
    { id: 'fotos', label: 'Fotos', icon: Camera, count: data.photos.length },
    { id: 'danos', label: 'Daños', icon: AlertTriangle, count: data.damages.length },
    { id: 'ficha', label: 'Datos técnicos', icon: IdCard },
  ] as const;

  return (
    <>
      <Topbar
        title={`${data.brand} ${data.model}`}
        actions={
          <>
            <PlateTag plate={data.plate} />
            {can('workorder:write') && (
              <Link href={`/ordenes/nueva?vehicleId=${data.id}`}>
                <Button size="sm" tip="Abrir una orden de trabajo para este vehículo">
                  <Wrench className="size-4" aria-hidden /> Nueva OT
                </Button>
              </Link>
            )}
          </>
        }
      />

      <div className="space-y-4 p-6">
        <Link href="/vehiculos" className="focus-ring inline-flex items-center gap-1.5 rounded text-[13px] text-[var(--muted)] hover:text-[var(--brand)]">
          <ArrowLeft className="size-3.5" aria-hidden /> Volver a vehículos
        </Link>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-4">

        {/* ------------------------------------------------------------ hero */}
        <Card className="overflow-hidden">
          <div className="grid md:grid-cols-[320px_1fr]">
            <div className="relative h-52 bg-[var(--surface-2)] md:h-full">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt={`${data.brand} ${data.model}`} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center">
                  {data.brandRef?.logoFile ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/brands/${data.brandRef.logoFile}`} alt="" className="h-20 object-contain opacity-90" />
                  ) : <Car className="size-12 text-[var(--subtle)]" aria-hidden />}
                </div>
              )}
            </div>

            <CardBody className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {data.brandRef?.logoFile && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/brands/${data.brandRef.logoFile}`} alt="" className="size-11 rounded-[var(--r)] border border-[var(--border)] bg-white object-contain p-1" />
                )}
                <div className="min-w-0">
                  <h2 className="text-[20px] font-extrabold tracking-tight">{data.brand} {data.model}</h2>
                  <p className="text-[13px] text-[var(--muted)]">
                    {[data.year, data.modelRef?.bodyType, data.color].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {hex && <span className="size-6 rounded-full border-2 border-[var(--border-strong)]" style={{ background: hex }} data-tooltip-id="ts-tip" data-tooltip-content={`Color ${data.color}`} aria-label={`Color ${data.color}`} />}
              </div>

              <div className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
                <Spec icon={<User className="size-3.5" aria-hidden />} label="Titular" value={customerName(data.customer)} href={`/clientes`} />
                <Spec icon={<Phone className="size-3.5" aria-hidden />} label="Teléfono" value={data.customer.phone ?? '—'} />
                <Spec icon={<Gauge className="size-3.5" aria-hidden />} label="Kilometraje" value={data.mileage ? `${data.mileage.toLocaleString('es-UY')} km` : '—'} />
                <Spec icon={<Fuel className="size-3.5" aria-hidden />} label="Combustible" value={data.fuel.toLowerCase()} />
                <Spec icon={<Cog className="size-3.5" aria-hidden />} label="Transmisión" value={data.transmission ?? '—'} />
                <Spec icon={<IdCard className="size-3.5" aria-hidden />} label="VIN" value={data.vin ?? '—'} mono />
              </div>

              {(data.stats.warrantyUntil || data.stats.nextService?.km || data.stats.nextService?.at) && (
                <div className="flex flex-wrap gap-2">
                  {data.stats.warrantyUntil && new Date(data.stats.warrantyUntil) > new Date() && (
                    <Badge tone="success"><ShieldCheck className="size-3" aria-hidden /> Garantía hasta {formatDate(data.stats.warrantyUntil)}</Badge>
                  )}
                  {data.stats.nextService?.km && <Badge tone="info">Próximo service: {data.stats.nextService.km.toLocaleString('es-UY')} km</Badge>}
                  {data.stats.nextService?.at && <Badge tone="info">Próximo service: {formatDate(data.stats.nextService.at)}</Badge>}
                </div>
              )}
            </CardBody>
          </div>
        </Card>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={<History className="size-4" aria-hidden />} label="Visitas al taller" value={data.stats.visits} hint={data.stats.lastVisit ? `Última ${relativeTime(data.stats.lastVisit)}` : 'Todavía sin visitas'} />
          <Stat icon={<Wallet className="size-4" aria-hidden />} label="Invertido en el vehículo" value={formatMoney(data.stats.spent)} tone="ok" />
          <Stat icon={<Wrench className="size-4" aria-hidden />} label="OT abiertas" value={data.stats.openOrders} tone={data.stats.openOrders > 0 ? 'warn' : 'brand'} />
          <Stat icon={<AlertTriangle className="size-4" aria-hidden />} label="Daños relevados" value={data.damages.length} tone={data.damages.length > 0 ? 'danger' : 'brand'} />
        </section>

        {/* ----------------------------------------------------------- tabs */}
        <div className="flex flex-wrap gap-1 border-b border-[var(--border)]">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'true' : undefined}
                className={`focus-ring -mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13.5px] font-semibold transition-colors ${
                  tab === t.id ? 'border-[var(--brand)] text-[var(--brand-700)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                <Icon className="size-4" aria-hidden /> {t.label}
                {'count' in t && t.count !== undefined && <span className="rounded-full bg-[var(--surface-2)] px-1.5 text-[11px]">{t.count}</span>}
              </button>
            );
          })}
        </div>

        {tab === 'fotos' && (
          <Card>
            <CardHeader>
              <CardTitle>Relevamiento fotográfico</CardTitle>
              {can('vehicle:write') && (
                <label className="ts-btn sec focus-ring cursor-pointer px-[11px] py-[6px] text-[13px]">
                  <Camera className="size-3.5" aria-hidden /> {uploading ? 'Subiendo…' : 'Agregar fotos'}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void subir(e.target.files)} aria-label="Agregar fotos al vehículo" />
                </label>
              )}
            </CardHeader>
            <CardBody>
              {data.photos.length === 0 ? (
                <EmptyState icon={<Camera className="size-8" aria-hidden />} title="Sin fotos" description="El relevamiento fotográfico queda en la ficha y sirve de referencia en cada ingreso." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {data.photos.map((p) => (
                    <figure key={p.id} className="group relative overflow-hidden rounded-[var(--r)] border border-[var(--border)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.caption ?? ANGLE_LABELS[p.angle as keyof typeof ANGLE_LABELS] ?? ''} className="h-32 w-full object-cover" />
                      <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 px-2 py-1 text-[10.5px] text-white">
                        <span>{ANGLE_LABELS[p.angle as keyof typeof ANGLE_LABELS] ?? 'Foto'}</span>
                        <span>{formatDate(p.createdAt)}</span>
                      </figcaption>
                      {p.isPrimary && <Star className="absolute left-1.5 top-1.5 size-4 fill-[var(--warn)] text-[var(--warn)]" aria-label="Portada" />}
                      {can('vehicle:write') && (
                        <button
                          onClick={() => void api.del(`/vehicles/photos/${p.id}`).then(refetch)}
                          className="focus-ring absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-[var(--falla)] text-white opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label="Eliminar foto"
                        >
                          <X className="size-3.5" aria-hidden />
                        </button>
                      )}
                    </figure>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {tab === 'danos' && (
          <Card>
            <CardBody className="p-0">
              {data.damages.length === 0 ? (
                <EmptyState icon={<AlertTriangle className="size-8" aria-hidden />} title="Sin daños registrados" description="Los marcadores puestos sobre las fotos de recepción se acumulan acá, visita tras visita." />
              ) : (
                <Table>
                  <thead>
                    <tr><Th>Parte</Th><Th>Daño</Th><Th>Origen</Th><Th>Foto</Th><Th>Fecha</Th></tr>
                  </thead>
                  <tbody>
                    {data.damages.map((d) => (
                      <tr key={d.id}>
                        <Td className="font-medium">{partLabel(d.partCode)}</Td>
                        <Td>
                          <span className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-full" style={{ background: SEVERITY_COLORS[d.severity as keyof typeof SEVERITY_COLORS] }} aria-hidden />
                            {DAMAGE_TYPE_LABELS[d.type as keyof typeof DAMAGE_TYPE_LABELS]} · {SEVERITY_LABELS[d.severity as keyof typeof SEVERITY_LABELS]}
                          </span>
                          {d.note && <div className="text-[11.5px] text-[var(--muted)]">{d.note}</div>}
                        </Td>
                        <Td className="text-[12.5px]">
                          <Link href={`/ordenes/${d.inspection.workOrder.id}`} className="focus-ring rounded text-[var(--brand)] hover:underline">{d.inspection.workOrder.number}</Link>
                          <div className="text-[11px] text-[var(--muted)]">{d.preexisting ? 'Preexistente' : 'Detectado en taller'}</div>
                        </Td>
                        <Td>
                          {d.photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={d.photo.url} alt="" className="size-12 rounded border border-[var(--border)] object-cover" />
                          ) : '—'}
                        </Td>
                        <Td className="text-[12.5px]">{formatDate(d.createdAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardBody>
          </Card>
        )}

        {tab === 'ficha' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Datos técnicos</CardTitle></CardHeader>
              <CardBody>
                <dl className="divide-y divide-[var(--border)] text-[13.5px]">
                  {[
                    ['Matrícula', data.plate], ['Marca', data.brand], ['Modelo', data.model],
                    ['Año', data.year], ['Color', data.color], ['Carrocería', data.modelRef?.bodyType],
                    ['Combustible', data.fuel], ['Transmisión', data.transmission], ['Cilindrada', data.engineSize],
                    ['VIN / Chasis', data.vin], ['Nº de motor', data.engineNumber],
                    ['Aseguradora', data.insurance], ['Nº de póliza', data.policyNumber],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between gap-4 py-2">
                      <dt className="text-[var(--muted)]">{k}</dt>
                      <dd className="text-right font-medium">{v ? String(v) : '—'}</dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle>Detalles visuales</CardTitle></CardHeader>
              <CardBody>
                <ul className="space-y-1.5 text-[13.5px]">
                  {VEHICLE_FEATURES.map((f) => {
                    const v = (data.features ?? {})[f.code];
                    if (v === undefined || v === null || v === '') return null;
                    return (
                      <li key={f.code} className="flex justify-between gap-4 border-b border-[var(--border)] pb-1.5">
                        <span className="text-[var(--muted)]">{f.label}</span>
                        <span className="font-medium">{typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v)}</span>
                      </li>
                    );
                  })}
                  {Object.keys(data.features ?? {}).length === 0 && (
                    <li className="py-4 text-center text-[13px] text-[var(--muted)]">Sin detalles cargados.</li>
                  )}
                </ul>
              </CardBody>
            </Card>
          </div>
        )}

          </div>

          {/* ------------------------------ historial: columna dedicada ---- */}
          <aside className="xl:sticky xl:top-[84px]">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="size-4" aria-hidden /> Historial del vehículo
                </CardTitle>
                <Badge tone="neutral">{data.workOrders.length}</Badge>
              </CardHeader>
              <CardBody className="max-h-[70vh] overflow-y-auto p-0">
                {data.workOrders.length === 0 ? (
                  <EmptyState
                    icon={<History className="size-7" aria-hidden />}
                    title="Sin visitas"
                    description="Cada ingreso al taller se va a listar acá, con lo que se hizo y cuánto costó."
                  />
                ) : (
                  <ol className="divide-y divide-[var(--border)]">
                    {data.workOrders.map((w) => {
                      const def = WORKORDER_KIND_DEFS[w.kind] ?? WORKORDER_KIND_DEFS.REPARACION;
                      return (
                        <motion.li key={w.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="p-3.5">
                          <div className="flex items-center gap-2">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ background: def.color }} aria-hidden />
                            <Link href={`/ordenes/${w.id}`} className="focus-ring rounded text-[13.5px] font-bold hover:underline">{w.number}</Link>
                            <span className="mono ml-auto text-[13px] font-semibold">{formatMoney(w.grandTotal)}</span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge tone="neutral" className="!px-1.5 !py-0 !text-[10.5px]">{def.short}</Badge>
                            <StatusBadge status={w.status} />
                          </div>

                          <p className="mt-1 text-[11.5px] text-[var(--muted)]">
                            {formatDate(w.receivedAt)}
                            {w.mileageIn ? ` · ${w.mileageIn.toLocaleString('es-UY')} km` : ''}
                            {w.technician ? ` · ${w.technician.firstName}` : ''}
                          </p>

                          {(w.workPerformed || w.diagnosis) && (
                            <p className="mt-1 line-clamp-2 text-[12px] text-[var(--muted)]">{w.workPerformed || w.diagnosis}</p>
                          )}

                          {w.items.length > 0 && (
                            <ul className="mt-1.5 flex flex-wrap gap-1">
                              {w.items.slice(0, 4).map((i) => (
                                <li key={i.id} className="ts-chip !cursor-default !px-2 !py-0.5 !text-[11px]">{i.description}</li>
                              ))}
                              {w.items.length > 4 && <li className="ts-chip !cursor-default !px-2 !py-0.5 !text-[11px]">+{w.items.length - 4}</li>}
                            </ul>
                          )}

                          {w.warrantyUntil && new Date(w.warrantyUntil) > new Date() && (
                            <p className="mt-1 text-[11px] text-[var(--ok)]">Garantía hasta {formatDate(w.warrantyUntil)}</p>
                          )}
                        </motion.li>
                      );
                    })}
                  </ol>
                )}
              </CardBody>
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
}

function Spec({ icon, label, value, mono, href }: { icon: React.ReactNode; label: string; value: string; mono?: boolean; href?: string }) {
  const content = (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-[var(--subtle)]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[11px] uppercase tracking-wide text-[var(--subtle)]">{label}</span>
        <span className={`block truncate font-medium ${mono ? 'mono text-[12px]' : ''}`}>{value}</span>
      </span>
    </div>
  );
  return href ? <Link href={href} className="focus-ring rounded">{content}</Link> : content;
}
