'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Plus, Search, X, User, Building2, IdCard, Phone, Mail, MapPin, Home, StickyNote, Wallet } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Select, Skeleton, EmptyState, Table, Th, Td, Textarea } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { api, qs } from '@/lib/api';
import { customerName } from '@/lib/utils';
import type { Paginated } from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';

interface Row {
  id: string; isCompany: boolean; firstName: string | null; lastName: string | null; companyName: string | null;
  docNumber: string | null; phone: string | null; email: string | null; city: string | null;
  _count: { vehicles: number; workOrders: number };
}

export default function ClientesPage() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const { data, loading, refetch } = useApi<Paginated<Row>>(`/customers${qs({ page, limit: 20, q })}`);

  return (
    <>
      <Topbar
        title="Clientes"
        actions={can('customer:write') ? <Button size="sm" onClick={() => setOpen((o) => !o)}>{open ? <X className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}{open ? 'Cerrar' : 'Nuevo cliente'}</Button> : undefined}
      />

      <div className="space-y-4 p-6">
        {open && <NuevoCliente onDone={() => { setOpen(false); refetch(); }} />}

        <Card>
          <CardBody>
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-[34px] size-4 text-[var(--text-muted)]" aria-hidden />
              <Input label="Buscar" name="q" className="pl-9" placeholder="Nombre, documento, teléfono o email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
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
                  <thead><tr><Th>Cliente</Th><Th>Documento</Th><Th>Contacto</Th><Th className="text-right">Vehículos</Th><Th className="text-right">OT</Th></tr></thead>
                  <tbody>
                    {data!.rows.map((c) => (
                      <tr key={c.id} className="transition-colors hover:bg-[var(--surface-2)]">
                        <Td className="font-medium">{customerName(c)}<div className="text-[11px] font-normal text-[var(--text-muted)]">{c.city ?? ''}</div></Td>
                        <Td className="text-xs">{c.docNumber ?? '—'}</Td>
                        <Td className="text-xs">{c.phone ?? '—'}<div className="text-[11px] text-[var(--text-muted)]">{c.email ?? ''}</div></Td>
                        <Td className="text-right tabular-nums">{c._count.vehicles}</Td>
                        <Td className="text-right tabular-nums">{c._count.workOrders}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--text-muted)]">
                  <span>{data!.total} clientes · página {data!.page} de {data!.pages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={page >= data!.pages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
                  </div>
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <p className="text-xs text-[var(--text-muted)]">
          ¿Buscás un vehículo en particular? Mirá el <Link href="/vehiculos" className="underline">listado de vehículos</Link>.
        </p>
      </div>
    </>
  );
}

function NuevoCliente({ onDone }: { onDone: () => void }) {
  const [isCompany, setIsCompany] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setError(null);
    try {
      await api.post('/customers', {
        isCompany,
        firstName: fd.get('firstName') || undefined,
        lastName: fd.get('lastName') || undefined,
        companyName: fd.get('companyName') || undefined,
        docType: fd.get('docType') || undefined,
        docNumber: fd.get('docNumber') || undefined,
        phone: fd.get('phone') || undefined,
        email: fd.get('email') || undefined,
        address: fd.get('address') || undefined,
        city: fd.get('city') || undefined,
        notes: fd.get('notes') || undefined,
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Nuevo cliente</CardTitle></CardHeader>
      <CardBody>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-3">
          <Select label="Tipo" name="type" icon={isCompany ? <Building2 className="size-3.5" aria-hidden /> : <User className="size-3.5" aria-hidden />} value={isCompany ? 'empresa' : 'persona'} onChange={(e) => setIsCompany(e.target.value === 'empresa')} tip="Una empresa se identifica por razón social y RUT; una persona por nombre y cédula">
            <option value="persona">Persona</option>
            <option value="empresa">Empresa</option>
          </Select>

          {isCompany ? (
            <div className="md:col-span-2"><Input label="Razón social" name="companyName" icon={<Building2 className="size-3.5" aria-hidden />} required /></div>
          ) : (
            <>
              <Input label="Nombre" name="firstName" icon={<User className="size-3.5" aria-hidden />} required />
              <Input label="Apellido" name="lastName" icon={<User className="size-3.5" aria-hidden />} required />
            </>
          )}

          <Select label="Tipo de documento" name="docType" icon={<IdCard className="size-3.5" aria-hidden />} defaultValue="CI">
            <option value="CI">CI</option><option value="RUT">RUT</option><option value="DNI">DNI</option>
          </Select>
          <Input label="Documento" name="docNumber" icon={<IdCard className="size-3.5" aria-hidden />} tip="Es único por taller: evita fichas duplicadas del mismo cliente" />
          <Input label="Teléfono" name="phone" icon={<Phone className="size-3.5" aria-hidden />} tip="Por acá se avisa el presupuesto y la entrega" />
          <Input label="Email" name="email" type="email" icon={<Mail className="size-3.5" aria-hidden />} />
          <Input label="Dirección" name="address" icon={<Home className="size-3.5" aria-hidden />} />
          <Input label="Ciudad" name="city" icon={<MapPin className="size-3.5" aria-hidden />} defaultValue="Montevideo" />
          <div className="md:col-span-3"><Textarea label="Notas" name="notes" icon={<StickyNote className="size-3.5" aria-hidden />} rows={2} /></div>

          {error && <p role="alert" className="md:col-span-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>}
          <div className="md:col-span-3"><Button type="submit" loading={saving}>Guardar cliente</Button></div>
        </form>
      </CardBody>
    </Card>
  );
}
