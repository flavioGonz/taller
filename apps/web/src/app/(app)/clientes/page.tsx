'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Pencil, Trash2, Car, Building2, User, IdCard } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, Input, Skeleton, EmptyState, Table, Th, Td, Badge } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/modal';
import { RowMenu } from '@/components/row-menu';
import { CustomerForm, type CustomerRecord } from '@/components/forms/customer-form';
import { useApi } from '@/hooks/use-api';
import { api, qs } from '@/lib/api';
import { customerName } from '@/lib/utils';
import type { Paginated } from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';

interface Row extends CustomerRecord {
  id: string;
  isCompany: boolean;
  city: string | null;
  _count: { vehicles: number; workOrders: number };
}

export default function ClientesPage() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, refetch } = useApi<Paginated<Row>>(`/customers${qs({ page, limit: 20, q })}`);

  async function eliminar() {
    if (!removing) return;
    setBusy(true);
    try {
      await api.del(`/customers/${removing.id}`);
      setRemoving(null);
      refetch();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Topbar
        title="Clientes"
        actions={can('customer:write') ? (
          <Button size="sm" onClick={() => setCreating(true)} tip="Alta de persona o empresa">
            <Plus className="size-4" aria-hidden /> Nuevo cliente
          </Button>
        ) : undefined}
      />

      <div className="space-y-4 p-6">
        <Card>
          <CardBody>
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-[34px] size-4 text-[var(--subtle)]" aria-hidden />
              <Input label="Buscar" className="pl-9" placeholder="Nombre, documento, teléfono o email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-0">
            {loading && !data ? (
              <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (data?.rows.length ?? 0) === 0 ? (
              <EmptyState title="Sin clientes" description="Cargá el primer cliente para poder abrir órdenes de trabajo." />
            ) : (
              <>
                <Table>
                  <thead>
                    <tr><Th>Cliente</Th><Th>Documento</Th><Th>Contacto</Th><Th className="text-right">Vehículos</Th><Th className="text-right">OT</Th><Th className="w-10" /></tr>
                  </thead>
                  <tbody>
                    {data!.rows.map((c) => (
                      <tr key={c.id}>
                        <Td>
                          <span className="flex items-center gap-2">
                            <span className="ts-stat-ic size-7">
                              {c.isCompany ? <Building2 className="size-3.5" aria-hidden /> : <User className="size-3.5" aria-hidden />}
                            </span>
                            <span>
                              <Link
                                href={`/clientes/${c.id}`}
                                className="focus-ring block rounded font-semibold hover:text-[var(--brand)]"
                                data-tooltip-id="ts-tip"
                                data-tooltip-content="Abrir la ficha del cliente"
                              >
                                {customerName(c)}
                              </Link>
                              <span className="block text-[11.5px] text-[var(--muted)]">{c.city ?? ''}</span>
                            </span>
                          </span>
                        </Td>
                        <Td className="text-[13px]">{c.docType ? `${c.docType} ` : ''}{c.docNumber ?? '—'}</Td>
                        <Td className="text-[13px]">{c.phone ?? '—'}<div className="text-[11.5px] text-[var(--muted)]">{c.email ?? ''}</div></Td>
                        <Td className="mono text-right">
                          <Link href={`/vehiculos?q=${encodeURIComponent(c.docNumber ?? '')}`} className="focus-ring rounded hover:underline">
                            {c._count.vehicles}
                          </Link>
                        </Td>
                        <Td className="mono text-right">{c._count.workOrders}</Td>
                        <Td>
                          <RowMenu
                            label={`Acciones de ${customerName(c)}`}
                            actions={[
                              { label: 'Editar', icon: <Pencil className="size-3.5" aria-hidden />, onClick: () => setEditing(c), hidden: !can('customer:write') },
                              { label: 'Abrir ficha', icon: <IdCard className="size-3.5" aria-hidden />, onClick: () => window.location.assign(`/clientes/${c.id}`) },
                              { label: 'Ver vehículos', icon: <Car className="size-3.5" aria-hidden />, onClick: () => window.location.assign(`/vehiculos?q=${encodeURIComponent(c.docNumber ?? customerName(c))}`) },
                              { label: 'Eliminar', icon: <Trash2 className="size-3.5" aria-hidden />, danger: true, onClick: () => setRemoving(c), hidden: !can('customer:write') },
                            ]}
                          />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>

                <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-[12.5px] text-[var(--muted)]">
                  <span>{data!.total} clientes · página {data!.page} de {data!.pages}</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                    <Button variant="secondary" size="sm" disabled={page >= data!.pages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
                  </div>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nuevo cliente" width="lg">
        <CustomerForm onSaved={() => { setCreating(false); refetch(); }} onCancel={() => setCreating(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Editar · ${customerName(editing)}` : ''} width="lg">
        {editing && <CustomerForm value={editing} onSaved={() => { setEditing(null); refetch(); }} onCancel={() => setEditing(null)} />}
      </Modal>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => void eliminar()}
        loading={busy}
        title="Eliminar cliente"
        message={removing ? `Se dará de baja a ${customerName(removing)}. Sus vehículos y órdenes quedan en el historial, pero no vas a poder abrir OT nuevas a su nombre.` : ''}
      />
    </>
  );
}
