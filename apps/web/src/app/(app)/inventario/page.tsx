'use client';

import { useState, type FormEvent } from 'react';
import { Plus, Search, X, ArrowDownToLine, ArrowUpFromLine, Hash, Tag, Factory, Layers, Coins, DollarSign, TriangleAlert, StickyNote } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Select, Skeleton, EmptyState, Table, Th, Td, Badge } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { useSocketEvent } from '@/hooks/use-socket';
import { api, qs } from '@/lib/api';
import { SOCKET_EVENTS, formatMoney, type Paginated } from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';

interface Part {
  id: string; sku: string; name: string; brand: string | null; category: string | null;
  cost: string; price: string; minStock: string; onHand: number; isLow: boolean;
  supplier?: { id: string; name: string } | null;
}

export default function InventarioPage() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [lowOnly, setLowOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [move, setMove] = useState<{ part: Part; type: 'ENTRADA' | 'SALIDA' } | null>(null);
  const { data, loading, refetch } = useApi<Paginated<Part>>(`/inventory/parts${qs({ page, limit: 20, q, lowStock: lowOnly ? 'true' : '' })}`);

  useSocketEvent(SOCKET_EVENTS.STOCK_MOVED, () => refetch());

  async function crearRepuesto(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api.post('/inventory/parts', {
      sku: fd.get('sku'), name: fd.get('name'), brand: fd.get('brand') || undefined,
      category: fd.get('category') || undefined, cost: Number(fd.get('cost') ?? 0),
      price: Number(fd.get('price') ?? 0), minStock: Number(fd.get('minStock') ?? 0),
    });
    setOpen(false);
    refetch();
  }

  async function registrarMovimiento(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!move) return;
    const fd = new FormData(e.currentTarget);
    await api.post('/inventory/movements', {
      partId: move.part.id, type: move.type,
      quantity: Number(fd.get('quantity')),
      unitCost: fd.get('unitCost') ? Number(fd.get('unitCost')) : undefined,
      note: fd.get('note') || undefined,
    });
    setMove(null);
    refetch();
  }

  return (
    <>
      <Topbar title="Inventario" actions={can('inventory:write') ? <Button size="sm" onClick={() => setOpen((o) => !o)}>{open ? <X className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}{open ? 'Cerrar' : 'Nuevo repuesto'}</Button> : undefined} />

      <div className="space-y-4 p-6">
        {open && (
          <Card>
            <CardHeader><CardTitle>Nuevo repuesto</CardTitle></CardHeader>
            <CardBody>
              <form onSubmit={crearRepuesto} className="grid gap-4 md:grid-cols-4">
                <Input label="SKU" name="sku" icon={<Hash className="size-3.5" aria-hidden />} required tip="Código interno único del repuesto" />
                <div className="md:col-span-2"><Input label="Nombre" name="name" icon={<Tag className="size-3.5" aria-hidden />} required /></div>
                <Input label="Marca" name="brand" icon={<Factory className="size-3.5" aria-hidden />} />
                <Input label="Categoría" name="category" icon={<Layers className="size-3.5" aria-hidden />} />
                <Input label="Costo" name="cost" type="number" step="0.01" min={0} defaultValue={0} icon={<Coins className="size-3.5" aria-hidden />} tip="Se actualiza solo al recibir un pedido del proveedor" />
                <Input label="Precio de venta" name="price" type="number" step="0.01" min={0} defaultValue={0} icon={<DollarSign className="size-3.5" aria-hidden />} />
                <Input label="Stock mínimo" name="minStock" type="number" step="1" min={0} defaultValue={0} icon={<TriangleAlert className="size-3.5" aria-hidden />} tip="Por debajo de este valor el repuesto aparece en el tablero" />
                <div className="md:col-span-4"><Button type="submit">Guardar repuesto</Button></div>
              </form>
            </CardBody>
          </Card>
        )}

        {move && (
          <Card>
            <CardHeader><CardTitle>{move.type === 'ENTRADA' ? 'Ingreso' : 'Egreso'} de stock — {move.part.name}</CardTitle>
              <button onClick={() => setMove(null)} className="focus-ring rounded-lg p-1.5 hover:bg-[var(--surface-2)]" aria-label="Cerrar"><X className="size-4" aria-hidden /></button>
            </CardHeader>
            <CardBody>
              <form onSubmit={registrarMovimiento} className="grid gap-4 md:grid-cols-4">
                <Input label="Cantidad" name="quantity" type="number" step="0.01" min={0.01} icon={<Layers className="size-3.5" aria-hidden />} required autoFocus />
                {move.type === 'ENTRADA' && <Input label="Costo unitario" name="unitCost" type="number" step="0.01" min={0} icon={<Coins className="size-3.5" aria-hidden />} />}
                <div className="md:col-span-2"><Input label="Nota / remito" name="note" icon={<StickyNote className="size-3.5" aria-hidden />} /></div>
                <div className="md:col-span-4"><Button type="submit">Registrar movimiento</Button></div>
              </form>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody className="flex flex-wrap items-end gap-4">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-[34px] size-4 text-[var(--text-muted)]" aria-hidden />
              <Input label="Buscar" name="q" className="pl-9" placeholder="SKU, nombre, marca o código de barras" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
            <label className="flex items-center gap-2 pb-2.5 text-xs">
              <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="focus-ring size-4 rounded" />
              Sólo stock bajo
            </label>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-0">
            {loading && !data ? (
              <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (data?.rows.length ?? 0) === 0 ? (
              <EmptyState title="Inventario vacío" description="Cargá repuestos para poder consumirlos desde las órdenes de trabajo." />
            ) : (
              <Table>
                <thead><tr><Th>SKU</Th><Th>Repuesto</Th><Th className="text-right">Stock</Th><Th className="text-right">Costo</Th><Th className="text-right">Precio</Th><Th className="w-28" /></tr></thead>
                <tbody>
                  {data!.rows.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-[var(--surface-2)]">
                      <Td className="font-mono text-xs">{p.sku}</Td>
                      <Td>{p.name}<div className="text-[11px] text-[var(--text-muted)]">{[p.brand, p.category].filter(Boolean).join(' · ')}</div></Td>
                      <Td className="text-right">
                        <Badge tone={p.isLow ? 'danger' : 'success'}>{p.onHand} {p.isLow ? `· mín ${Number(p.minStock)}` : ''}</Badge>
                      </Td>
                      <Td className="text-right tabular-nums">{formatMoney(p.cost)}</Td>
                      <Td className="text-right tabular-nums">{formatMoney(p.price)}</Td>
                      <Td>
                        {can('inventory:write') && (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setMove({ part: p, type: 'ENTRADA' })} className="focus-ring rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-500/10" aria-label={`Ingresar stock de ${p.name}`} title="Ingreso"><ArrowDownToLine className="size-4" aria-hidden /></button>
                            <button onClick={() => setMove({ part: p, type: 'SALIDA' })} className="focus-ring rounded-lg p-1.5 text-amber-600 hover:bg-amber-500/10" aria-label={`Egresar stock de ${p.name}`} title="Egreso"><ArrowUpFromLine className="size-4" aria-hidden /></button>
                          </div>
                        )}
                      </Td>
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
