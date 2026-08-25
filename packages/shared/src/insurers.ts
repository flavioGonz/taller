// =============================================================================
//  ASEGURADORAS — vocabulario del trabajo con compañías de seguros
// =============================================================================
import type { ChecklistItem } from './workshop.js';

export const PARTS_POLICIES = ['ORIGINAL', 'ALTERNATIVO', 'USADO', 'MIXTO'] as const;
export type PartsPolicy = (typeof PARTS_POLICIES)[number];
export const PARTS_POLICY_LABELS: Record<PartsPolicy, string> = {
  ORIGINAL: 'Sólo original',
  ALTERNATIVO: 'Acepta alternativo',
  USADO: 'Acepta usado / reciclado',
  MIXTO: 'Según pieza (lo define el perito)',
};

export const PARTS_SUPPLIERS = ['TALLER', 'ASEGURADORA', 'MIXTO'] as const;
export type PartsSuppliedBy = (typeof PARTS_SUPPLIERS)[number];
export const PARTS_SUPPLIER_LABELS: Record<PartsSuppliedBy, string> = {
  TALLER: 'Los consigue el taller',
  ASEGURADORA: 'Los provee la compañía',
  MIXTO: 'Mixto',
};

export const INVOICE_TARGETS = ['ASEGURADORA', 'CLIENTE', 'MIXTO'] as const;
export type InvoiceTo = (typeof INVOICE_TARGETS)[number];
export const INVOICE_TO_LABELS: Record<InvoiceTo, string> = {
  ASEGURADORA: 'Todo a la compañía',
  CLIENTE: 'Al cliente (después le reintegran)',
  MIXTO: 'Franquicia al cliente, resto a la compañía',
};

export const DEDUCTIBLE_COLLECTORS = ['TALLER', 'ASEGURADORA', 'NO_APLICA'] as const;
export type DeductibleCollectedBy = (typeof DEDUCTIBLE_COLLECTORS)[number];
export const DEDUCTIBLE_LABELS: Record<DeductibleCollectedBy, string> = {
  TALLER: 'La cobra el taller',
  ASEGURADORA: 'La cobra la compañía',
  NO_APLICA: 'Sin franquicia',
};

export const AUTHORIZATION_CHANNELS = ['PORTAL', 'EMAIL', 'TELEFONO', 'APP', 'PERITO_PRESENCIAL', 'WHATSAPP'] as const;
export type AuthorizationChannel = (typeof AUTHORIZATION_CHANNELS)[number];
export const AUTH_CHANNEL_LABELS: Record<AuthorizationChannel, string> = {
  PORTAL: 'Portal web de la compañía',
  EMAIL: 'Correo a mesa de autorizaciones',
  TELEFONO: 'Teléfono',
  APP: 'App del taller',
  PERITO_PRESENCIAL: 'Perito en el taller',
  WHATSAPP: 'WhatsApp',
};

export const AUTHORIZATION_STATUSES = [
  'SIN_ENVIAR', 'ENVIADO', 'EN_ANALISIS', 'AUTORIZADO', 'AUTORIZADO_PARCIAL', 'RECHAZADO', 'VENCIDO',
] as const;
export type AuthorizationStatus = (typeof AUTHORIZATION_STATUSES)[number];
export const AUTH_STATUS_LABELS: Record<AuthorizationStatus, string> = {
  SIN_ENVIAR: 'Sin enviar',
  ENVIADO: 'Enviado a la compañía',
  EN_ANALISIS: 'En análisis',
  AUTORIZADO: 'Autorizado',
  AUTORIZADO_PARCIAL: 'Autorizado parcial',
  RECHAZADO: 'Rechazado',
  VENCIDO: 'Vencido',
};

/** Documentación que las compañías suelen exigir para autorizar la reparación. */
export const DOCUMENT_REQUIREMENTS: readonly ChecklistItem[] = [
  { code: 'denuncia', label: 'Denuncia del siniestro', group: 'Del asegurado', kind: 'bool' },
  { code: 'cedula', label: 'Cédula del asegurado / conductor', group: 'Del asegurado', kind: 'bool' },
  { code: 'libreta', label: 'Libreta de propiedad del vehículo', group: 'Del asegurado', kind: 'bool' },
  { code: 'licencia', label: 'Licencia de conducir vigente', group: 'Del asegurado', kind: 'bool' },
  { code: 'poliza', label: 'Póliza vigente', group: 'Del asegurado', kind: 'bool' },
  { code: 'constancia_policial', label: 'Constancia policial', group: 'Del siniestro', kind: 'bool' },
  { code: 'fotos_dano', label: 'Fotos de los daños', group: 'Del siniestro', kind: 'bool' },
  { code: 'foto_matricula', label: 'Foto de la matrícula', group: 'Del siniestro', kind: 'bool' },
  { code: 'foto_vin', label: 'Foto del número de chasis (VIN)', group: 'Del siniestro', kind: 'bool' },
  { code: 'foto_tablero', label: 'Foto del tablero con kilometraje', group: 'Del siniestro', kind: 'bool' },
  { code: 'presupuesto', label: 'Presupuesto en el formato de la compañía', group: 'Del taller', kind: 'bool' },
  { code: 'cotizacion_repuestos', label: 'Cotización de repuestos', group: 'Del taller', kind: 'bool' },
  { code: 'orden_reparacion', label: 'Orden de reparación firmada', group: 'Del taller', kind: 'bool' },
  { code: 'peritaje', label: 'Informe del perito', group: 'De la compañía', kind: 'bool' },
];

export interface Requirement {
  code: string;
  label: string;
  ok: boolean;
  detail?: string;
}

/**
 * Verifica si el expediente cumple lo que pide la compañía antes de mandarlo a
 * autorizar. Devuelve la lista completa para mostrarla como checklist.
 */
export function checkInsuranceReadiness(input: {
  terms?: {
    requiresClaimNumber?: boolean;
    requiresAdjuster?: boolean;
    requiresPhotos?: boolean;
    minPhotos?: number;
    requiresDamageMap?: boolean;
    requiredDocuments?: string[];
    requiresPartsQuotes?: number;
  } | null;
  claimNumber?: string | null;
  policyNumber?: string | null;
  adjusterName?: string | null;
  photoCount: number;
  damageCount: number;
  documents: Record<string, unknown>;
  hasQuote: boolean;
}): { requirements: Requirement[]; ready: boolean } {
  const t = input.terms ?? {};
  const reqs: Requirement[] = [];

  reqs.push({ code: 'poliza', label: 'Nº de póliza cargado', ok: !!input.policyNumber });

  if (t.requiresClaimNumber !== false) {
    reqs.push({ code: 'denuncia', label: 'Nº de denuncia / siniestro', ok: !!input.claimNumber });
  }
  if (t.requiresAdjuster) {
    reqs.push({ code: 'perito', label: 'Perito asignado', ok: !!input.adjusterName });
  }
  if (t.requiresPhotos !== false) {
    const min = t.minPhotos ?? 6;
    reqs.push({
      code: 'fotos',
      label: `Fotos del vehículo (mínimo ${min})`,
      ok: input.photoCount >= min,
      detail: `${input.photoCount} cargadas`,
    });
  }
  if (t.requiresDamageMap !== false) {
    reqs.push({
      code: 'danos',
      label: 'Daños marcados sobre las fotos',
      ok: input.damageCount > 0,
      detail: `${input.damageCount} marcados`,
    });
  }
  reqs.push({ code: 'presupuesto', label: 'Presupuesto emitido', ok: input.hasQuote });

  for (const code of t.requiredDocuments ?? []) {
    const doc = DOCUMENT_REQUIREMENTS.find((d) => d.code === code);
    if (!doc) continue;
    reqs.push({ code: `doc_${code}`, label: doc.label, ok: input.documents[code] === true });
  }

  return { requirements: reqs, ready: reqs.every((r) => r.ok) };
}
