'use client';

import { useState, type FormEvent } from 'react';
import { Plus, Search, X, ArrowDownToLine, ArrowUpFromLine, Hash, Tag, Factory, Layers, Coins, DollarSign, TriangleAlert, StickyNote, Package } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Select, Badge, Stat } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { useApi } from '@/hooks/use-api';
import { useSocketEvent } from '@/hooks/use-socket';
import { api, qs } from '@/lib/api';
import { SOCKET_EVENTS, formatMoney, type Paginated } from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';
import { ImagePicker } from '@/components/image-picker';

interface Part {
  id: string; sku: string; name: string; brand: string | null; category: string | null;
  cost: string; price: string; minStock: string; onHand: number; isLow: boolean; imageUrl: string | null;
  supplier?: { id: string; name: string } | null;
}

export default function InventarioPage() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [lowOnly, setLowOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [move, setMove] = useState<{ part: Part; type: 'ENTRADA' | 'SALIDA' } | null>(null);
  const [nuevaFoto, setNuevaFoto] = useState<string | null>(null);
  const { data, loading, refetch } = useApi<Paginated<Part>>(`/inventory/parts${qs({ page, limit: 20, q, lowStock: lowOnly ? 'true' : '' })}`);

  useSocketEvent(SOCKET_EVENTS.STOCK_MOVED, () => refetch());

  async function crearRepuesto(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api.post('/inventory/parts', {
      sku: fd.get('sku'), name: fd.get('name'), brand: fd.get('brand') || undefined,
      category: fd.get('category') || undefined, cost: Number(fd.get('cost') ?? 0),
      price: Number(fd.get('price') ?? 0), minStock: Number(fd.get('minStock') ?? 0),
      imageUrl: nuevaFoto ?? undefined,
    });
    setOpen(false);
    setNuevaFoto(null);
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

  const rowsNow = data?.rows ?? [];
  const bajos = rowsNow.filter((p) => p.isLow).length;
  const unidades = rowsNow.reduce((a, p) => a + p.onHand, 0);
  const valorizado = rowsNow.reduce((a, p) => a + p.onHand * Number(p.cost), 0);

  const columns: Column<Part>[] = [
    {
      key: 'foto',
      header: '',
      width: '56px',
      cell: (p) => (
        <ImagePicker
          value={p.imageUrl}
          size={40}
          label="Foto del repuesto"
          disabled={!can('inventory:write')}
          fallback={<Package className="size-1/2" aria-hidden />}
          onChange={(url) => void api.patch(`/inventory/parts/${p.id}`, { imageUrl: url ?? '' }).then(() => refetch())}
        />
      ),
    },
    {
      key: 'repuesto',
      header: 'Repuesto',
      sortValue: (p) => p.name,
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{p.name}</p>
          <p className="mono truncate text-[11.5px] text-[var(--muted)]">
            {p.sku}{[p.brand, p.category].filter(Boolean).length ? ` · ${[p.brand, p.category].filter(Boolean).join(' · ')}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'proveedor',
      header: 'Proveedor',
      hideBelow: 'xl',
      sortValue: (p) => p.supplier?.name ?? '',
      cell: (p) => <span className="text-[12.5px] text-[var(--muted)]">{p.supplier?.name ?? '—'}</span>,
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      tip: 'Unidades disponibles; en rojo cuando está por debajo del mínimo',
      sortValue: (p) => p.onHand,
      cell: (p) => (
        <Badge tone={p.isLow ? 'danger' : 'success'}>
          {p.onHand}{p.isLow ? ` · mín ${Number(p.minStock)}` : ''}
        </Badge>
      ),
    },
    {
      key: 'costo',
      header: 'Costo',
      align: 'right',
      hideBelow: 'md',
      sortValue: (p) => Number(p.cost),
      cell: (p) => <span className="mono text-[12.5px] text-[var(--muted)]">{formatMoney(p.cost)}</span>,
    },
    {
      key: 'precio',
      header: 'Precio',
      align: 'right',
      sortValue: (p) => Number(p.price),
      cell: (p) => (
        <div>
          <p className="mono text-[13px] font-semibold">{formatMoney(p.price)}</p>
          {Number(p.cost) > 0 && (
            <p className="mono text-[10.5px] text-[var(--muted)]">
              +{Math.round(((Number(p.price) - Number(p.cost)) / Number(p.cost)) * 100)}%
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'acciones',
      header: '',
      width: '86px',
      align: 'right',
      cell: (p) => can('inventory:write') ? (
        <span className="flex justify-end gap-1">
          <button
            onClick={() => setMove({ part: p, type: 'ENTRADA' })}
            className="focus-ring rounded-lg p-1.5 text-[var(--ok)] hover:bg-[var(--ok-bg)]"
            aria-label={`Ingresar stock de ${p.name}`}
            data-tooltip-id="ts-tip"
            data-tooltip-content="Ingreso de stock"
          >
            <ArrowDownToLine className="size-4" aria-hidden />
          </button>
          <button
            onClick={() => setMove({ part: p, type: 'SALIDA' })}
            className="focus-ring rounded-lg p-1.5 text-[var(--warn)] hover:bg-[var(--warn-bg)]"
            aria-label={`Egresar stock de ${p.name}`}
            data-tooltip-id="ts-tip"
            data-tooltip-content="Egreso de stock"
          >
            <ArrowUpFromLine className="size-4" aria-hidden />
          </button>
        </span>
      ) : null,
    },
  ];

  return (
    <>
      <Topbar title="Inventario" description="Repuestos, stock y valorizado del depósito" actions={can('inventory:write') ? <Button size="sm" onClick={() => setOpen((o) => !o)}>{open ? <X className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}{open ? 'Cerrar' : 'Nuevo repuesto'}</Button> : undefined} />

      <div className="space-y-4 p-6">
        {open && (
          <Card>
            <CardHeader><CardTitle>Nuevo repuesto</CardTitle></CardHeader>
            <CardBody>
              <form onSubmit={crearRepuesto} className="grid gap-4 md:grid-cols-4">
                <div className="flex items-end gap-3 md:col-span-4">
                  <ImagePicker
                    value={nuevaFoto}
                    onChange={setNuevaFoto}
                    size={72}
                    label="Foto del repuesto"
                    fallback={<Package className="size-1/2" aria-hidden />}
                  />
                  <p className="pb-1 text-[12px] text-[var(--muted)]">
                    Subí una foto del repuesto: aparece en el listado y ayuda a identificarlo en el mostrador.
                  </p>
                </div>
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={<Package className="size-4" aria-hidden />} label="Repuestos en catálogo" value={String(data?.total ?? 0)} />
          <Stat icon={<TriangleAlert className="size-4" aria-hidden />} label="Con stock bajo" value={String(bajos)} hint="Por debajo del mínimo" tone={bajos > 0 ? 'danger' : 'ok'} />
          <Stat icon={<Layers className="size-4" aria-hidden />} label="Unidades en depósito" value={String(unidades)} />
          <Stat icon={<Coins className="size-4" aria-hidden />} label="Valorizado al costo" value={formatMoney(valorizado)} hint="Stock actual × costo" />
        </div>

        <Card>
          <CardBody className="p-0">
            <DataTable
              id="inventario"
              rows={data?.rows}
              loading={loading}
              getKey={(p) => p.id}
              columns={columns}
              zebra
              initialSort={{ key: 'repuesto', dir: 'asc' }}
              emptyIcon={<Package className="size-6" aria-hidden />}
              emptyTitle={q ? 'Ningún repuesto coincide' : 'Inventario vacío'}
              emptyDescription="Cargá repuestos para poder consumirlos desde las órdenes de trabajo."
              emptyAction={can('inventory:write') ? (
                <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" aria-hidden /> Nuevo repuesto</Button>
              ) : undefined}
              toolbar={
                <>
                  <Input
                    aria-label="Buscar repuesto"
                    icon={<Search className="size-3.5" aria-hidden />}
                    placeholder="SKU, nombre, marca o código de barras"
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setPage(1); }}
                    className="!w-full sm:!w-80"
                  />
                  <button
                    type="button"
                    onClick={() => { setLowOnly((v) => !v); setPage(1); }}
                    aria-pressed={lowOnly}
                    data-tooltip-id="ts-tip"
                    data-tooltip-content="Mostrar sólo lo que está por debajo del stock mínimo"
                    className={`focus-ring inline-flex h-8 items-center gap-1.5 rounded-[var(--r-sm)] border px-2.5 text-[13px] font-medium transition ${lowOnly ? 'border-[var(--falla-bd)] bg-[var(--falla-bg)] text-[var(--falla)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]'}`}
                  >
                    <TriangleAlert className="size-3.5" aria-hidden /> Stock bajo
                  </button>
                </>
              }
              footer={
                <>
                  <span>{data?.total ?? 0} repuestos · página {data?.page ?? 1} de {data?.pages ?? 1}</span>
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
    </>
  );
}
