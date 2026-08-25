import type { Paginated } from '@taller/shared';

export function toPaginated<T>(rows: T[], total: number, page: number, limit: number): Paginated<T> {
  return { rows, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export function skipTake(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}

/** Construye un orderBy seguro a partir de una lista blanca de campos. */
export function safeOrderBy<T extends string>(
  sort: string | undefined,
  order: 'asc' | 'desc',
  allowed: readonly T[],
  fallback: T,
): Record<string, 'asc' | 'desc'> {
  const field = sort && (allowed as readonly string[]).includes(sort) ? sort : fallback;
  return { [field]: order };
}
