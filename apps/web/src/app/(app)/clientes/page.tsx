'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Pencil, Trash2, Car, Building2, User, IdCard, Phone, Mail, MapPin, ClipboardList } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, Input, Badge } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { Modal, ConfirmDialog } from '@/components/modal';
import { RowMenu } from '@/components/row-menu';
import { CustomerForm, type CustomerRecord } from '@/components/forms/customer-form';
import { useApi } from '@/hooks/use-api';
import { api, qs } from '@/lib/api';
import { customerName, cn } from '@/lib/utils';
import type { Paginated } from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/components/toast';

interface Row extends CustomerRecord {
  id: string;
  isCompany: boolean;
  city: string | null;
  _count: { vehicles: number; workOrders: number };
}

export default function ClientesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, refetch } = useApi<Paginated<Row>>(`/customers${qs({ page, limit: 20, q })}`);

  async function eliminar() {
    if (!removing) return;
    setBusy(true);
    try {
      await api.del(`/customers/${removing.id}`);
      toast.ok('Cliente dado de baja', `${customerName(removing)} ya no aparece en las listas.`);
      setRemoving(null);
      refetch();
    } catch (e) {
      toast.error('No se pudo dar de baja', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Row>[] = [
    {
      key: 'cliente',
      header: 'Cliente',
      sortValue: (c) => customerName(c),
      cell: (c) => (
        <span className="flex items-center gap-2.5">
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-[var(--r-sm)]', c.isCompany ? 'bg-[var(--info-bg)] text-[var(--info)]' : 'bg-[var(--brand-soft)] text-[var(--brand-700)]')}>
            {c.isCompany ? <Building2 className="size-4" aria-hidden /> : <User className="size-4" aria-hidden />}
          </span>
          <span className="min-w-0">
            <Link href={`/clientes/${c.id}`} className="focus-ring block truncate rounded font-semibold hover:text-[var(--brand)]">
              {customerName(c)}
            </Link>
            <span className="flex items-center gap-1 text-[11.5px] text-[var(--muted)]">
              {c.city ? <><MapPin className="size-3 shrink-0" aria-hidden />{c.city}</> : <span className="text-[var(--subtle)]">sin ciudad</span>}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      hideBelow: 'lg',
      sortValue: (c) => (c.isCompany ? 'Empresa' : 'Particular'),
      cell: (c) => <Badge tone={c.isCompany ? 'info' : 'neutral'}>{c.isCompany ? 'Empresa' : 'Particular'}</Badge>,
    },
    {
      key: 'documento',
      header: 'Documento',
      hideBelow: 'md',
      sortValue: (c) => c.docNumber ?? '',
      cell: (c) => (
        <span className="mono text-[12.5px]">
          {c.docNumber ? `${c.docType ? `${c.docType} ` : ''}${c.docNumber}` : <span className="text-[var(--subtle)]">—</span>}
        </span>
      ),
    },
    {
      key: 'contacto',
      header: 'Contacto',
      sortValue: (c) => c.phone ?? '',
      cell: (c) => (
        <span className="block min-w-0">
          {c.phone && (
            <a href={`tel:${c.phone}`} className="focus-ring mono flex items-center gap-1.5 rounded text-[12.5px] hover:text-[var(--brand)]">
              <Phone className="size-3 shrink-0 text-[var(--subtle)]" aria-hidden />{c.phone}
            </a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} className="focus-ring flex items-center gap-1.5 truncate rounded text-[11.5px] text-[var(--muted)] hover:text-[var(--brand)]">
              <Mail className="size-3 shrink-0" aria-hidden />{c.email}
            </a>
          )}
          {!c.phone && !c.email && <span className="text-[var(--subtle)]">sin contacto</span>}
        </span>
      ),
    },
    {
      key: 'vehiculos',
      header: 'Vehículos',
      align: 'right',
      tip: 'Cantidad de vehículos asociados al cliente',
      sortValue: (c) => c._count.vehicles,
      cell: (c) => (
        <span className="mono inline-flex items-center gap-1 text-[12.5px]">
          <Car className="size-3.5 text-[var(--subtle)]" aria-hidden />{c._count.vehicles}
        </span>
      ),
    },
    {
      key: 'ots',
      header: 'Órdenes',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (c) => c._count.workOrders,
      cell: (c) => (
        <span className="mono inline-flex items-center gap-1 text-[12.5px]">
          <ClipboardList className="size-3.5 text-[var(--subtle)]" aria-hidden />{c._count.workOrders}
        </span>
      ),
    },
    {
      key: 'acciones',
      header: '',
      width: '48px',
      align: 'right',
      cell: (c) => (
        <RowMenu
          label={`Acciones de ${customerName(c)}`}
          actions={[
            { label: 'Abrir ficha', icon: <IdCard className="size-3.5" aria-hidden />, onClick: () => window.location.assign(`/clientes/${c.id}`) },
            { label: 'Editar', icon: <Pencil className="size-3.5" aria-hidden />, onClick: () => setEditing(c), hidden: !can('customer:write') },
            { label: 'Ver vehículos', icon: <Car className="size-3.5" aria-hidden />, onClick: () => window.location.assign(`/vehiculos?q=${encodeURIComponent(c.docNumber ?? customerName(c))}`) },
            { label: 'Eliminar', icon: <Trash2 className="size-3.5" aria-hidden />, danger: true, onClick: () => setRemoving(c), hidden: !can('customer:write') },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <Topbar
        title="Clientes"
        description="Personas y empresas que dejan sus vehículos en el taller"
        actions={can('customer:write') ? (
          <Button size="sm" onClick={() => setCreating(true)} tip="Alta de persona o empresa">
            <Plus className="size-4" aria-hidden /> Nuevo cliente
          </Button>
        ) : undefined}
      />

      <div className="p-6">
        <Card>
          <CardBody className="p-0">
            <DataTable
              id="clientes"
              error={error}
              onRetry={refetch}
              rows={data?.rows}
              loading={loading}
              getKey={(c) => c.id}
              rowHref={(c) => `/clientes/${c.id}`}
              zebra
              columns={columns}
              initialSort={{ key: 'cliente', dir: 'asc' }}
              emptyIcon={<User className="size-6" aria-hidden />}
              emptyTitle={q ? 'Ningún cliente coincide' : 'Todavía no hay clientes'}
              emptyDescription={q ? 'Probá con otro nombre, documento o teléfono.' : 'Cargá el primer cliente para poder abrir órdenes de trabajo.'}
              emptyAction={can('customer:write') ? (
                <Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" aria-hidden /> Nuevo cliente</Button>
              ) : undefined}
              toolbar={
                <Input
                  aria-label="Buscar cliente"
                  icon={<Search className="size-3.5" aria-hidden />}
                  placeholder="Nombre, documento, teléfono o email"
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setPage(1); }}
                  className="!w-full sm:!w-80"
                />
              }
              footer={
                <>
                  <span>{data?.total ?? 0} clientes · página {data?.page ?? 1} de {data?.pages ?? 1}</span>
                  <span className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                    <Button variant="secondary" size="sm" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
                  </span>
                </>
              }
            />
          </CardBody>
        </Card>
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nuevo cliente"
        description="Persona o empresa; después le asociás los vehículos."
        icon={<User className="size-[19px]" aria-hidden />}
        width="lg"
        persistent
      >
        <CustomerForm onSaved={() => { setCreating(false); refetch(); }} onCancel={() => setCreating(false)} />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? customerName(editing) : ''}
        description="Datos de contacto, documento y condiciones comerciales"
        icon={<User className="size-[19px]" aria-hidden />}
        width="lg"
      >
        {editing && <CustomerForm value={editing} onSaved={() => { setEditing(null); refetch(); }} onCancel={() => setEditing(null)} />}
      </Modal>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => void eliminar()}
        loading={busy}
        title="Dar de baja el cliente"
        confirmLabel="Dar de baja"
        message={removing ? `${customerName(removing)} deja de aparecer para abrir órdenes nuevas.` : ''}
        detail="Sus vehículos, órdenes, presupuestos y facturas quedan intactos en el historial."
      />
    </>
  );
}
