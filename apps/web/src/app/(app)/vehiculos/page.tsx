'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Plus, Search, X, Car, User, Gauge, Calendar, Fuel, Hash, IdCard,
  Camera, ShieldCheck, Cog, LayoutGrid, List as ListIcon,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Select, Skeleton, EmptyState, Table, Th, Td, Badge } from '@/components/ui';
import { BrandModelPicker, type VehiclePick } from '@/components/brand-model-picker';
import { ColorPicker } from '@/components/color-picker';
import { PlateTag, VehicleThumb } from '@/components/vehicle-bits';
import { Checklist, type ChecklistValue } from '@/components/checklist';
import { useApi } from '@/hooks/use-api';
import { api, qs } from '@/lib/api';
import { uploadPhoto } from '@/lib/upload';
import { customerName, formatDate, cn } from '@/lib/utils';
import { VEHICLE_FEATURES, colorHex, type Paginated } from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';

interface Row {
  id: string; plate: string; brand: string; model: string; year: number | null; color: string | null;
  vin: string | null; mileage: number | null; fuel: string; photoUrl: string | null;
  customer: { id: string; firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean };
  brandRef?: { id: string; name: string; logoFile: string | null } | null;
  workOrders?: { id: string; number: string; status: string; receivedAt: string }[];
  _count: { workOrders: number };
}
interface CustomerOpt { id: string; firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean }

export default function VehiculosPage() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<VehiclePick>({ brand: '', model: '' });
  const [color, setColor] = useState('');
  const [features, setFeatures] = useState<ChecklistValue>({});
  const [shots, setShots] = useState<{ url: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, refetch } = useApi<Paginated<Row>>(`/vehicles${qs({ page, limit: 24, q })}`);
  const customers = useApi<CustomerOpt[]>('/customers');

  async function subirFotos(files: FileList | null) {
    if (!files?.length) return;
    for (const f of Array.from(files)) {
      const up = await uploadPhoto(f);
      setShots((prev) => [...prev, { url: up.url, name: f.name }]);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pick.brand || !pick.model) { setError('Elegí marca y modelo'); return; }
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setError(null);
    try {
      const vehicle = await api.post<{ id: string }>('/vehicles', {
        customerId: fd.get('customerId'),
        plate: fd.get('plate'),
        brandId: pick.brandId, modelId: pick.modelId, brand: pick.brand, model: pick.model,
        year: fd.get('year') ? Number(fd.get('year')) : undefined,
        color: color || undefined,
        vin: fd.get('vin') || undefined,
        engineNumber: fd.get('engineNumber') || undefined,
        fuel: fd.get('fuel') || 'NAFTA',
        transmission: fd.get('transmission') || undefined,
        mileage: fd.get('mileage') ? Number(fd.get('mileage')) : undefined,
        insurance: fd.get('insurance') || undefined,
        policyNumber: fd.get('policyNumber') || undefined,
        features,
        photoUrl: shots[0]?.url,
      });

      for (const [i, s] of shots.entries()) {
        await api.post(`/vehicles/${vehicle.id}/photos`, { url: s.url, angle: 'OTRO', isPrimary: i === 0 });
      }

      setOpen(false);
      setPick({ brand: '', model: '' });
      setColor('');
      setFeatures({});
      setShots([]);
      refetch();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Topbar
        title="Vehículos"
        actions={
          <>
            <div className="hidden items-center rounded-[var(--r)] border border-[var(--border)] p-0.5 md:flex" role="group" aria-label="Cambiar vista">
              <button onClick={() => setView('grid')} aria-pressed={view === 'grid'} aria-label="Vista de fichas" data-tooltip-id="ts-tip" data-tooltip-content="Fichas con foto" className={cn('focus-ring rounded-lg p-1.5', view === 'grid' && 'bg-[var(--brand-soft)] text-[var(--brand-700)]')}>
                <LayoutGrid className="size-4" aria-hidden />
              </button>
              <button onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label="Vista de tabla" data-tooltip-id="ts-tip" data-tooltip-content="Tabla compacta" className={cn('focus-ring rounded-lg p-1.5', view === 'list' && 'bg-[var(--brand-soft)] text-[var(--brand-700)]')}>
                <ListIcon className="size-4" aria-hidden />
              </button>
            </div>
            {can('vehicle:write') && (
              <Button size="sm" onClick={() => setOpen((o) => !o)} tip="Registrar un vehículo con su ficha y relevamiento fotográfico">
                {open ? <X className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                {open ? 'Cerrar' : 'Nuevo vehículo'}
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-4 p-6">
        {open && (
          <Card>
            <CardHeader><CardTitle>Nuevo vehículo</CardTitle></CardHeader>
            <CardBody>
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <Select label="Cliente" name="customerId" icon={<User className="size-3.5" aria-hidden />} required tip="Dueño del vehículo; después podés transferirlo">
                      <option value="">Seleccionar…</option>
                      {(customers.data ?? []).map((c) => <option key={c.id} value={c.id}>{customerName(c)}</option>)}
                    </Select>
                  </div>

                  <BrandModelPicker value={pick} onChange={setPick} />

                  <Input label="Matrícula" name="plate" icon={<Hash className="size-3.5" aria-hidden />} required placeholder="SAB1234" className="uppercase" tip="Se guarda en mayúsculas y es única por taller" />
                  <Input label="Año" name="year" type="number" min={1900} max={2100} icon={<Calendar className="size-3.5" aria-hidden />} />
                  <Input label="Kilometraje" name="mileage" type="number" min={0} icon={<Gauge className="size-3.5" aria-hidden />} tip="Se actualiza solo en cada ingreso" />
                  <Select label="Combustible" name="fuel" defaultValue="NAFTA" icon={<Fuel className="size-3.5" aria-hidden />}>
                    <option>NAFTA</option><option>DIESEL</option><option>GNC</option><option>ELECTRICO</option><option>HIBRIDO</option><option>OTRO</option>
                  </Select>
                  <Select label="Transmisión" name="transmission" icon={<Cog className="size-3.5" aria-hidden />}>
                    <option value="">—</option><option value="Manual">Manual</option><option value="Automática">Automática</option><option value="CVT">CVT</option>
                  </Select>
                  <Input label="VIN / Chasis" name="vin" icon={<IdCard className="size-3.5" aria-hidden />} tip="17 caracteres; sirve para pedir el repuesto exacto" />
                  <Input label="Nº de motor" name="engineNumber" icon={<Cog className="size-3.5" aria-hidden />} />
                  <Input label="Aseguradora" name="insurance" icon={<ShieldCheck className="size-3.5" aria-hidden />} />
                  <Input label="Nº de póliza" name="policyNumber" icon={<ShieldCheck className="size-3.5" aria-hidden />} />
                </div>

                <ColorPicker value={color} onChange={setColor} />

                <div>
                  <p className="ts-label flex items-center gap-1.5">
                    <Camera className="size-3.5 text-[var(--subtle)]" aria-hidden /> Relevamiento fotográfico
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {shots.map((s, i) => (
                      <div key={s.url} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.url} alt={s.name} className="size-20 rounded-[var(--r)] border border-[var(--border)] object-cover" />
                        {i === 0 && <span className="absolute left-1 top-1 rounded bg-[var(--brand)] px-1 text-[9px] font-bold text-white">Portada</span>}
                        <button type="button" onClick={() => setShots((p) => p.filter((x) => x.url !== s.url))} className="focus-ring absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[var(--falla)] text-white" aria-label={`Quitar ${s.name}`}>
                          <X className="size-3" aria-hidden />
                        </button>
                      </div>
                    ))}
                    <label className="focus-ring grid size-20 cursor-pointer place-items-center rounded-[var(--r)] border border-dashed border-[var(--border-strong)] text-[var(--subtle)] hover:border-[var(--brand-200)] hover:text-[var(--brand)]">
                      <Camera className="size-5" aria-hidden />
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void subirFotos(e.target.files)} aria-label="Agregar fotos del vehículo" />
                    </label>
                  </div>
                  <p className="mt-1 text-[11.5px] text-[var(--muted)]">Quedan en la ficha del vehículo, no en una orden puntual.</p>
                </div>

                <div>
                  <p className="ts-label">Detalles visuales aparentes</p>
                  <Checklist items={VEHICLE_FEATURES} value={features} onChange={setFeatures} />
                </div>

                {error && <p role="alert" className="rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[13px] text-[var(--falla)]">{error}</p>}
                <Button type="submit" loading={saving}>Guardar vehículo</Button>
              </form>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody>
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-[34px] size-4 text-[var(--subtle)]" aria-hidden />
              <Input label="Buscar" className="pl-9" placeholder="Matrícula, VIN, marca o modelo" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
          </CardBody>
        </Card>

        {loading && !data ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
          </div>
        ) : (data?.rows.length ?? 0) === 0 ? (
          <Card><CardBody className="p-0">
            <EmptyState icon={<Car className="size-8" aria-hidden />} title="Sin vehículos" description="Registrá el vehículo con su ficha: catálogo, color, detalles y fotos." />
          </CardBody></Card>
        ) : view === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data!.rows.map((v) => <VehicleCard key={v.id} v={v} />)}
          </div>
        ) : (
          <Card><CardBody className="p-0">
            <Table>
              <thead>
                <tr><Th>Vehículo</Th><Th>Matrícula</Th><Th>Cliente</Th><Th>VIN</Th><Th className="text-right">Km</Th><Th className="text-right">Visitas</Th></tr>
              </thead>
              <tbody>
                {data!.rows.map((v) => (
                  <tr key={v.id}>
                    <Td>
                      <Link href={`/vehiculos/${v.id}`} className="focus-ring flex items-center gap-2 rounded">
                        <VehicleThumb v={v} size={36} />
                        <span>
                          <span className="font-semibold">{v.brand} {v.model}</span>
                          <span className="block text-[11.5px] text-[var(--muted)]">{[v.year, v.color].filter(Boolean).join(' · ')}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td><PlateTag plate={v.plate} /></Td>
                    <Td className="max-w-[180px] truncate text-[13px]">{customerName(v.customer)}</Td>
                    <Td className="mono text-[11.5px]">{v.vin ?? '—'}</Td>
                    <Td className="mono text-right">{v.mileage?.toLocaleString('es-UY') ?? '—'}</Td>
                    <Td className="mono text-right">{v._count.workOrders}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody></Card>
        )}

        {(data?.pages ?? 1) > 1 && (
          <div className="flex items-center justify-between text-[12.5px] text-[var(--muted)]">
            <span>{data!.total} vehículos · página {data!.page} de {data!.pages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button variant="secondary" size="sm" disabled={page >= data!.pages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function VehicleCard({ v }: { v: Row }) {
  const hex = colorHex(v.color);
  const last = v.workOrders?.[0];
  return (
    <Link href={`/vehiculos/${v.id}`} className="focus-ring group rounded-[var(--r-lg)]">
      <article className="ts-card h-full overflow-hidden transition-shadow group-hover:shadow-[var(--sh-md)]">
        <div className="relative h-32 bg-[var(--surface-2)]">
          {v.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.photoUrl} alt={`${v.brand} ${v.model}`} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center">
              {v.brandRef?.logoFile ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/brands/${v.brandRef.logoFile}`} alt="" className="h-14 object-contain opacity-90" />
              ) : (
                <Car className="size-10 text-[var(--subtle)]" aria-hidden />
              )}
            </div>
          )}
          <span className="absolute left-2 top-2"><PlateTag plate={v.plate} /></span>
          {hex && (
            <span
              className="absolute right-2 top-2 size-5 rounded-full border-2 border-white shadow"
              style={{ background: hex }}
              data-tooltip-id="ts-tip"
              data-tooltip-content={`Color ${v.color}`}
              aria-label={`Color ${v.color}`}
            />
          )}
        </div>

        <div className="p-3">
          <div className="flex items-center gap-2">
            {v.brandRef?.logoFile && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/brands/${v.brandRef.logoFile}`} alt="" className="size-6 shrink-0 rounded bg-white object-contain" />
            )}
            <p className="truncate text-[14px] font-bold">{v.brand} {v.model}</p>
          </div>
          <p className="mt-0.5 truncate text-[12px] text-[var(--muted)]">
            <User className="mr-1 inline size-3" aria-hidden />{customerName(v.customer)}
          </p>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-[var(--muted)]">
            {v.year && <span className="flex items-center gap-1"><Calendar className="size-3" aria-hidden />{v.year}</span>}
            {v.mileage != null && <span className="flex items-center gap-1"><Gauge className="size-3" aria-hidden />{v.mileage.toLocaleString('es-UY')} km</span>}
            <span className="flex items-center gap-1"><Fuel className="size-3" aria-hidden />{v.fuel.toLowerCase()}</span>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2">
            <Badge tone="neutral">{v._count.workOrders} visita{v._count.workOrders === 1 ? '' : 's'}</Badge>
            {last && <span className="text-[11px] text-[var(--subtle)]">Última: {formatDate(last.receivedAt)}</span>}
          </div>
        </div>
      </article>
    </Link>
  );
}
