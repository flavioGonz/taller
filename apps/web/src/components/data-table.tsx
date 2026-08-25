'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ChevronsUpDown, Rows2, Rows3, Rows4, Inbox, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';
import { Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

export type Density = 'compact' | 'normal' | 'cozy';
type Align = 'left' | 'center' | 'right';

export interface Column<T> {
  /** Identificador estable de la columna. */
  key: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  /** Valor por el que ordenar; si se pasa, la columna es ordenable. */
  sortValue?: (row: T) => string | number | null | undefined;
  align?: Align;
  width?: string;
  /** Oculta la columna en pantallas chicas. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  /** Explicación de la columna, en el encabezado. */
  tip?: string;
  className?: string;
}

const ALIGN: Record<Align, string> = { left: 'text-left', center: 'text-center', right: 'text-right' };
const HIDE: Record<string, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};
const DENSITY_CLASS: Record<Density, string> = { compact: 'compact', normal: '', cozy: 'cozy' };
const DENSITY_ICON: Record<Density, typeof Rows2> = { compact: Rows4, normal: Rows3, cozy: Rows2 };
const DENSITY_LABEL: Record<Density, string> = { compact: 'Compacta', normal: 'Normal', cozy: 'Cómoda' };
const NEXT_DENSITY: Record<Density, Density> = { compact: 'normal', normal: 'cozy', cozy: 'compact' };

/**
 * Tabla de trabajo del sistema: ordenable, con cabecera fija, densidad
 * regulable, filas animadas al entrar y estados de carga y vacío propios.
 * Todas las pantallas de listado usan esta misma tabla para que se vean y se
 * comporten igual.
 */
export function DataTable<T>({
  id,
  rows,
  columns,
  getKey,
  loading,
  error,
  onRetry,
  emptyTitle = 'Nada por acá',
  emptyDescription,
  emptyAction,
  emptyIcon,
  onRowClick,
  rowHref,
  zebra = false,
  maxHeight,
  toolbar,
  footer,
  initialSort,
  rowClassName,
  density: densityProp,
  showDensityToggle = true,
}: {
  /** Se usa para recordar la densidad elegida en este listado. */
  id: string;
  rows: T[] | undefined;
  columns: Column<T>[];
  getKey: (row: T, index: number) => string;
  loading?: boolean;
  /** Si la carga falló, se muestra el motivo en vez de un listado vacío. */
  error?: { message: string } | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  emptyIcon?: React.ReactNode;
  onRowClick?: (row: T) => void;
  rowHref?: (row: T) => string;
  zebra?: boolean;
  maxHeight?: number | string;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  rowClassName?: (row: T) => string | undefined;
  density?: Density;
  showDensityToggle?: boolean;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);
  const [density, setDensity] = useState<Density>(densityProp ?? 'normal');

  useEffect(() => {
    if (densityProp) return;
    try {
      const saved = localStorage.getItem(`ts-dt-density:${id}`) as Density | null;
      if (saved) setDensity(saved);
    } catch {
      /* sin almacenamiento disponible */
    }
  }, [id, densityProp]);

  function cycleDensity() {
    const next = NEXT_DENSITY[density];
    setDensity(next);
    try {
      localStorage.setItem(`ts-dt-density:${id}`, next);
    } catch {
      /* sin almacenamiento disponible */
    }
  }

  const sorted = useMemo(() => {
    if (!rows || !sort) return rows ?? [];
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor;
      return String(va).localeCompare(String(vb), 'es', { numeric: true }) * factor;
    });
  }, [rows, sort, columns]);

  function toggleSort(col: Column<T>) {
    if (!col.sortValue) return;
    setSort((prev) =>
      prev?.key === col.key
        ? prev.dir === 'asc'
          ? { key: col.key, dir: 'desc' }
          : null
        : { key: col.key, dir: 'asc' },
    );
  }

  const DensityIcon = DENSITY_ICON[density];
  const showing = sorted.length;

  return (
    <div className="w-full">
      {(toolbar || showDensityToggle) && (
        <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-1">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
          {showDensityToggle && (
            <button
              type="button"
              onClick={cycleDensity}
              aria-label={`Densidad de la tabla: ${DENSITY_LABEL[density]}`}
              data-tooltip-id="ts-tip"
              data-tooltip-content={`Densidad ${DENSITY_LABEL[density].toLowerCase()} — clic para cambiar`}
              className="focus-ring grid size-8 shrink-0 place-items-center rounded-[var(--r-sm)] border border-[var(--border)] text-[var(--subtle)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
            >
              <DensityIcon className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}

      {error ? (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-[var(--falla-bg)] text-[var(--falla)]">
            <AlertTriangle className="size-6" aria-hidden />
          </span>
          <p className="text-[15px] font-semibold">No se pudo cargar el listado</p>
          <p className="max-w-md text-[13px] text-[var(--muted)]">{error.message}</p>
          {onRetry && (
            <Button size="sm" variant="secondary" className="mt-2" onClick={onRetry}>
              <RefreshCw className="size-3.5" aria-hidden /> Reintentar
            </Button>
          )}
        </div>
      ) : loading && !rows ? (
        <div className="space-y-2 p-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}
        </div>
      ) : showing === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--subtle)]">
            {emptyIcon ?? <Inbox className="size-6" aria-hidden />}
          </span>
          <p className="text-[15px] font-semibold">{emptyTitle}</p>
          {emptyDescription && <p className="max-w-md text-[13px] text-[var(--muted)]">{emptyDescription}</p>}
          {emptyAction && <div className="mt-2">{emptyAction}</div>}
        </div>
      ) : (
        <div
          className="ts-dt-wrap"
          style={maxHeight ? ({ ['--dt-max' as string]: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }) : undefined}
        >
          <table className={cn('ts-dt', DENSITY_CLASS[density])}>
            <thead>
              <tr>
                {columns.map((col) => {
                  const active = sort?.key === col.key;
                  const sortable = !!col.sortValue;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      style={col.width ? { width: col.width } : undefined}
                      aria-sort={sortable ? (active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                      onClick={sortable ? () => toggleSort(col) : undefined}
                      className={cn(ALIGN[col.align ?? 'left'], col.hideBelow && HIDE[col.hideBelow])}
                      data-tooltip-id={col.tip ? 'ts-tip' : undefined}
                      data-tooltip-content={col.tip}
                    >
                      <span className={cn('inline-flex items-center gap-1', col.align === 'right' && 'flex-row-reverse')}>
                        {col.header}
                        {sortable && (
                          active
                            ? sort!.dir === 'asc'
                              ? <ArrowUp className="size-3" aria-hidden />
                              : <ArrowDown className="size-3" aria-hidden />
                            : <ChevronsUpDown className="size-3 opacity-40" aria-hidden />
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const clickable = !!onRowClick || !!rowHref;
                return (
                  <motion.tr
                    key={getKey(row, i)}
                    layout="position"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(i, 12) * 0.012 }}
                    data-clickable={clickable || undefined}
                    data-zebra={zebra && i % 2 === 1 ? 'true' : undefined}
                    className={rowClassName?.(row)}
                    onClick={
                      clickable
                        ? (e) => {
                            // no robar el clic a los links y botones de la fila
                            if ((e.target as HTMLElement).closest('a,button,input,select,label')) return;
                            if (rowHref) window.location.assign(rowHref(row));
                            else onRowClick?.(row);
                          }
                        : undefined
                    }
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(ALIGN[col.align ?? 'left'], col.hideBelow && HIDE[col.hideBelow], col.className)}
                      >
                        {col.cell(row, i)}
                      </td>
                    ))}
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {footer && showing > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 text-[12px] text-[var(--muted)]">
          {footer}
        </div>
      )}
    </div>
  );
}
