'use client';

/**
 * Lo que se ve cuando una pantalla no pudo traer sus datos.
 *
 * Antes estas páginas devolvían `null` y el usuario se encontraba con la
 * pantalla en blanco, sin saber si estaba cargando, si no existía o si se
 * había caído algo. Ahora dice qué pasó y ofrece reintentar.
 */
import { AlertTriangle, RefreshCw, ArrowLeft, SearchX } from 'lucide-react';
import Link from 'next/link';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody } from '@/components/ui';
import type { ApiError } from '@/lib/api';

export function LoadError({
  title,
  error,
  onRetry,
  backHref,
  backLabel = 'Volver',
}: {
  /** Título de la pantalla, para que la barra superior no quede vacía. */
  title: string;
  error?: ApiError | Error | null;
  onRetry?: () => void;
  backHref?: string;
  backLabel?: string;
}) {
  const status = (error as ApiError | undefined)?.status;
  const noExiste = status === 404;
  const sinPermiso = status === 403;

  const texto = noExiste
    ? 'No encontramos este registro. Puede que lo hayan borrado o que el enlace esté mal.'
    : sinPermiso
      ? 'Tu rol no tiene permiso para ver esta pantalla.'
      : (error?.message ?? 'No pudimos traer los datos. Puede ser la conexión con el servidor.');

  return (
    <>
      <Topbar title={title} />
      <div className="p-6">
        <Card>
          <CardBody className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span
              className="grid size-14 place-items-center rounded-2xl"
              style={{
                background: `color-mix(in srgb, ${noExiste ? 'var(--muted)' : 'var(--falla)'} 12%, transparent)`,
                color: noExiste ? 'var(--muted)' : 'var(--falla)',
              }}
            >
              {noExiste ? <SearchX className="size-7" aria-hidden /> : <AlertTriangle className="size-7" aria-hidden />}
            </span>
            <p className="text-[15px] font-semibold">
              {noExiste ? 'No existe o ya no está' : sinPermiso ? 'Sin permiso' : 'No se pudo cargar'}
            </p>
            <p className="max-w-md text-[13px] leading-relaxed text-[var(--muted)]">{texto}</p>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              {onRetry && !noExiste && !sinPermiso && (
                <Button size="sm" onClick={onRetry}>
                  <RefreshCw className="size-4" aria-hidden /> Reintentar
                </Button>
              )}
              {backHref && (
                <Link href={backHref}>
                  <Button size="sm" variant="secondary">
                    <ArrowLeft className="size-4" aria-hidden /> {backLabel}
                  </Button>
                </Link>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
