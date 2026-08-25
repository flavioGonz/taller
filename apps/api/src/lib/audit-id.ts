import { randomInt } from 'node:crypto';

/**
 * Alfabeto Crockford sin caracteres que se confunden al dictar por teléfono
 * o al leer de un papel: sin I, L, O, U, ni 0 ni 1.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

function block(len: number): string {
  let out = '';
  for (let i = 0; i < len; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/**
 * Identificador de auditoría de una reparación: inmutable, único y pensado para
 * dictarse. Acompaña a la OT toda su vida (peritos, aseguradoras, garantías).
 * Ej: `TS-K7M2-9QX4`.
 */
export function newAuditId(prefix = 'TS'): string {
  return `${prefix}-${block(4)}-${block(4)}`;
}
