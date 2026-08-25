'use client';

import { useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Skeleton, EmptyState, Table, Th, Td } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { formatMoney, type Paginated } from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';

interface Service { id: string; code: string | null; name: string; category: string | null; estimatedHours: string | null; price: string }

export default function ServiciosPage() {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const { data, loading, refetch } = useApi<Paginated<Service>>('/services?page=1&limit=100');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api.post('/services', {
      code: fd.get('code') || undefined,
      name: fd.get('name'),
      category: fd.get('category') || undefined,
      estimatedHours: fd.get('estimatedHours') ? Number(fd.get('estimatedHours')) : undefined,
      price: Number(fd.get('price')),
    });
    setOpen(false);
    refetch();
  }

  return (
    <>
      <Topbar title="Catálogo de servicios" actions={can('service:write') ? <Button size="sm" onClick={() => setOpen((o) => !o)}>{open ? <X className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}{open ? 'Cerrar' : 'Nuevo servicio'}</Button> : undefined} />

      <div className="space-y-4 p-6">
        {open && (
          <Card>
            <CardHeader><CardTitle>Nuevo servicio</CardTitle></CardHeader>
            <CardBody>
              <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-5">
                <Input label="Código" name="code" placeholder="SRV-010" />
                <div className="md:col-span-2"><Input label="Nombre" name="name" required /></div>
                <Input label="Categoría" name="category" />
                <Input label="Horas estimadas" name="estimatedHours" type="number" step="0.25" min={0} />
                <Input label="Precio" name="price" type="number" step="0.01" min={0} required />
                <div className="md:col-span-5"><Button type="submit">Guardar servicio</Button></div>
              </form>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody className="p-0">
            {loading && !data ? (
              <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (data?.rows.length ?? 0) === 0 ? (
              <EmptyState title="Sin servicios cargados" description="El catálogo acelera la carga de ítems en cada OT." />
            ) : (
              <Table>
                <thead><tr><Th>Código</Th><Th>Servicio</Th><Th>Categoría</Th><Th className="text-right">Horas</Th><Th className="text-right">Precio</Th></tr></thead>
                <tbody>
                  {data!.rows.map((s) => (
                    <tr key={s.id} className="transition-colors hover:bg-[var(--surface-2)]">
                      <Td className="font-mono text-xs">{s.code ?? '—'}</Td>
                      <Td>{s.name}</Td>
                      <Td className="text-xs text-[var(--text-muted)]">{s.category ?? '—'}</Td>
                      <Td className="text-right tabular-nums">{s.estimatedHours ? Number(s.estimatedHours) : '—'}</Td>
                      <Td className="text-right tabular-nums">{formatMoney(s.price)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
