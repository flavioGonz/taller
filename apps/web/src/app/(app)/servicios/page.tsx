'use client';

import { useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Wrench, Search, Timer, Coins, Tag } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, Badge, Input } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { Modal, ConfirmDialog } from '@/components/modal';
import { RowMenu } from '@/components/row-menu';
import { ServiceForm, type ServiceRecord } from '@/components/forms/service-form';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { formatMoney, type Paginated } from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';

interface Service extends ServiceRecord { id: string; name: string; price: string }

export default function ServiciosPage() {
  const { can } = useAuth();
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Service | null>(null);
  const [removing, setRemoving] = useState<Service | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, refetch } = useApi<Paginated<Service>>('/services?page=1&limit=100');

  async function eliminar() {
    if (!removing) return;
    setBusy(true);
    try {
      await api.del(`/services/${removing.id}`);
      setRemoving(null);
      refetch();
    } finally {
      setBusy(false);
    }
  }

  const filtrados = (data?.rows ?? []).filter((s) => {
    if (!q) return true;
    const t = q.toLowerCase();
    return s.name.toLowerCase().includes(t)
      || (s.code ?? '').toLowerCase().includes(t)
      || (s.category ?? '').toLowerCase().includes(t);
  });

  const columns: Column<Service>[] = [
    {
      key: 'servicio',
      header: 'Servicio',
      sortValue: (s) => s.name,
      cell: (s) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{s.name}</p>
          {s.code && <p className="mono text-[11.5px] text-[var(--muted)]">{s.code}</p>}
        </div>
      ),
    },
    {
      key: 'categoria',
      header: 'Categoría',
      hideBelow: 'sm',
      sortValue: (s) => s.category ?? '',
      cell: (s) => s.category
        ? <Badge tone="neutral"><Tag className="size-3" aria-hidden /> {s.category}</Badge>
        : <span className="text-[var(--subtle)]">—</span>,
    },
    {
      key: 'horas',
      header: 'Horas',
      align: 'right',
      tip: 'Tiempo estimado de mano de obra',
      sortValue: (s) => Number(s.estimatedHours ?? 0),
      cell: (s) => (
        <span className="mono inline-flex items-center gap-1 text-[12.5px]">
          {s.estimatedHours ? <><Timer className="size-3.5 text-[var(--subtle)]" aria-hidden />{Number(s.estimatedHours)}</> : <span className="text-[var(--subtle)]">—</span>}
        </span>
      ),
    },
    {
      key: 'precio',
      header: 'Precio',
      align: 'right',
      sortValue: (s) => Number(s.price),
      cell: (s) => <span className="mono text-[13px] font-semibold">{formatMoney(s.price)}</span>,
    },
    {
      key: 'acciones',
      header: '',
      width: '48px',
      align: 'right',
      cell: (s) => can('service:write') ? (
        <RowMenu
          label={`Acciones de ${s.name}`}
          actions={[
            { label: 'Editar', icon: <Pencil className="size-3.5" aria-hidden />, onClick: () => setEditing(s) },
            { label: 'Dar de baja', icon: <Trash2 className="size-3.5" aria-hidden />, danger: true, onClick: () => setRemoving(s) },
          ]}
        />
      ) : null,
    },
  ];

  return (
    <>
      <Topbar
        title="Catálogo de servicios"
        description="Trabajos con precio y tiempo ya definidos"
        actions={can('service:write') ? (
          <Button size="sm" onClick={() => setCreating(true)} tip="Los servicios del catálogo aceleran la carga de la OT y el presupuesto">
            <Plus className="size-4" aria-hidden /> Nuevo servicio
          </Button>
        ) : undefined}
      />

      <div className="p-6">
        <Card>
          <CardBody className="p-0">
            <DataTable
              id="servicios"
              rows={filtrados}
              loading={loading && !data}
              getKey={(s) => s.id}
              columns={columns}
              zebra
              initialSort={{ key: 'servicio', dir: 'asc' }}
              emptyIcon={<Wrench className="size-6" aria-hidden />}
              emptyTitle={q ? 'Ningún servicio coincide' : 'Sin servicios cargados'}
              emptyDescription="El catálogo acelera la carga de ítems en cada OT y en el presupuesto."
              emptyAction={can('service:write') ? (
                <Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" aria-hidden /> Nuevo servicio</Button>
              ) : undefined}
              toolbar={
                <Input
                  aria-label="Buscar servicio"
                  icon={<Search className="size-3.5" aria-hidden />}
                  placeholder="Nombre, código o categoría"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="!w-full sm:!w-80"
                />
              }
              footer={<span>{filtrados.length} servicios en el catálogo</span>}
            />
          </CardBody>
        </Card>
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nuevo servicio"
        description="Un trabajo con precio y tiempo definidos, para cargarlo de un clic en la OT."
        icon={<Wrench className="size-[19px]" aria-hidden />}
        width="lg"
        persistent
      >
        <ServiceForm onSaved={() => { setCreating(false); refetch(); }} onCancel={() => setCreating(false)} />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.name ?? ''}
        description="Precio, horas estimadas y categoría"
        icon={<Wrench className="size-[19px]" aria-hidden />}
        width="lg"
      >
        {editing && <ServiceForm value={editing} onSaved={() => { setEditing(null); refetch(); }} onCancel={() => setEditing(null)} />}
      </Modal>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => void eliminar()}
        loading={busy}
        title="Dar de baja el servicio"
        message={removing ? `${removing.name} deja de aparecer en el catálogo. Las OT que ya lo usaron no cambian.` : ''}
      />
    </>
  );
}
