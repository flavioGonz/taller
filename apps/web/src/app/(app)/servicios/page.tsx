'use client';

import { useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Wrench } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, Skeleton, EmptyState, Table, Th, Td } from '@/components/ui';
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

  return (
    <>
      <Topbar
        title="Catálogo de servicios"
        actions={can('service:write') ? (
          <Button size="sm" onClick={() => setCreating(true)} tip="Los servicios del catálogo aceleran la carga de la OT y el presupuesto">
            <Plus className="size-4" aria-hidden /> Nuevo servicio
          </Button>
        ) : undefined}
      />

      <div className="space-y-4 p-6">
        <Card>
          <CardBody className="p-0">
            {loading && !data ? (
              <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (data?.rows.length ?? 0) === 0 ? (
              <EmptyState icon={<Wrench className="size-8" aria-hidden />} title="Sin servicios cargados" description="El catálogo acelera la carga de ítems en cada OT." />
            ) : (
              <Table>
                <thead><tr><Th>Código</Th><Th>Servicio</Th><Th>Categoría</Th><Th className="text-right">Horas</Th><Th className="text-right">Precio</Th><Th className="w-10" /></tr></thead>
                <tbody>
                  {data!.rows.map((s) => (
                    <tr key={s.id} className="transition-colors hover:bg-[var(--surface-2)]">
                      <Td className="font-mono text-xs">{s.code ?? '—'}</Td>
                      <Td>{s.name}</Td>
                      <Td className="text-xs text-[var(--text-muted)]">{s.category ?? '—'}</Td>
                      <Td className="mono text-right">{s.estimatedHours ? Number(s.estimatedHours) : '—'}</Td>
                      <Td className="mono text-right">{formatMoney(s.price)}</Td>
                      <Td>
                        <RowMenu
                          label={`Acciones de ${s.name}`}
                          actions={[
                            { label: 'Editar', icon: <Pencil className="size-3.5" aria-hidden />, onClick: () => setEditing(s), hidden: !can('service:write') },
                            { label: 'Dar de baja', icon: <Trash2 className="size-3.5" aria-hidden />, danger: true, onClick: () => setRemoving(s), hidden: !can('service:write') },
                          ]}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nuevo servicio" width="lg">
        <ServiceForm onSaved={() => { setCreating(false); refetch(); }} onCancel={() => setCreating(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Editar · ${editing.name}` : ''} width="lg">
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
