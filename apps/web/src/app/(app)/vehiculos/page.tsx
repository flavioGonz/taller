'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Car, User, Gauge, Calendar, Fuel, Pencil, Trash2, LayoutGrid, List as ListIcon, FileText } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, Input, Skeleton, EmptyState, Table, Th, Td, Badge } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/modal';
import { RowMenu } from '@/components/row-menu';
import { VehicleForm, type VehicleRecord } from '@/components/forms/vehicle-form';
import { PlateTag, VehicleThumb } from '@/components/vehicle-bits';
import { useApi } from '@/hooks/use-api';
import { api, qs } from '@/lib/api';
import { customerName, formatDate, cn } from '@/lib/utils';
import { colorHex, type Paginated } from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';

interface Row extends VehicleRecord {
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
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [removing, setRemoving] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, refetch } = useApi<Paginated<Row>>(`/vehicles${qs({ page, limit: 24, q })}`);
  const customers = useApi<CustomerOpt[]>('/customers');

  async function eliminar() {
    if (!removing) return;
    setBusy(true);
    try {
      await api.del(`/vehicles/${removing.id}`);
      setRemoving(null);
      refetch();
    } finally {
      setBusy(false);
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
              <Button size="sm" onClick={() => setCreating(true)} tip="Registrar un vehículo con su ficha y relevamiento fotográfico">
                <Plus className="size-4" aria-hidden /> Nuevo vehículo
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-4 p-6">
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
            {data!.rows.map((v) => (
              <VehicleCard key={v.id} v={v} actions={<VehicleActions v={v} can={can} onEdit={setEditing} onRemove={setRemoving} />} />
            ))}
          </div>
        ) : (
          <Card><CardBody className="p-0">
            <Table>
              <thead>
                <tr><Th>Vehículo</Th><Th>Matrícula</Th><Th>Cliente</Th><Th>VIN</Th><Th className="text-right">Km</Th><Th className="text-right">Visitas</Th><Th className="w-10" /></tr>
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
                    <Td><VehicleActions v={v} can={can} onEdit={setEditing} onRemove={setRemoving} /></Td>
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

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nuevo vehículo"
        description="Marca, modelo, color y detalles visuales; después se le hace el relevamiento fotográfico."
        icon={<Car className="size-[19px]" aria-hidden />}
        width="lg"
        persistent
      >
        <VehicleForm
          customers={customers.data ?? []}
          onSaved={() => { setCreating(false); refetch(); }}
          onCancel={() => setCreating(false)}
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.plate ?? ''}
        description="Datos del vehículo y su dueño"
        icon={<Car className="size-[19px]" aria-hidden />}
        width="lg"
      >
        {editing && (
          <VehicleForm
            value={editing}
            customers={customers.data ?? []}
            onSaved={() => { setEditing(null); refetch(); }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => void eliminar()}
        loading={busy}
        title="Eliminar vehículo"
        message={removing ? `Se dará de baja ${removing.plate} (${removing.brand} ${removing.model}). Su historial de OT y fotos queda guardado.` : ''}
      />
    </>
  );
}

function VehicleActions({
  v, can, onEdit, onRemove,
}: {
  v: Row; can: (p: 'vehicle:write') => boolean; onEdit: (v: Row) => void; onRemove: (v: Row) => void;
}) {
  return (
    <RowMenu
      label={`Acciones de ${v.plate}`}
      actions={[
        { label: 'Ver ficha', icon: <FileText className="size-3.5" aria-hidden />, onClick: () => window.location.assign(`/vehiculos/${v.id}`) },
        { label: 'Editar', icon: <Pencil className="size-3.5" aria-hidden />, onClick: () => onEdit(v), hidden: !can('vehicle:write') },
        { label: 'Nueva OT', icon: <Car className="size-3.5" aria-hidden />, onClick: () => window.location.assign(`/ordenes/nueva?vehicleId=${v.id}`) },
        { label: 'Eliminar', icon: <Trash2 className="size-3.5" aria-hidden />, danger: true, onClick: () => onRemove(v), hidden: !can('vehicle:write') },
      ]}
    />
  );
}

function VehicleCard({ v, actions }: { v: Row; actions?: React.ReactNode }) {
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
          {actions && (
            <span className="absolute right-2 bottom-2 rounded-lg bg-[var(--surface)]/90 backdrop-blur" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} role="presentation">
              {actions}
            </span>
          )}
          {hex && (
            <span
              className="absolute right-2 top-2 size-5 rounded-full border-2 border-white shadow"
              style={{ background: hex }}
              data-color-source="vehiculo"
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
