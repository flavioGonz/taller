// =============================================================================
//  INGRESOS — cómo entra un vehículo al taller
//  El menú "Ingresos" y las páginas /ingresos/* se arman con esta tabla.
// =============================================================================
import { WORKORDER_KINDS, type WorkOrderKind } from './workshop.js';

export interface IntakeChannel {
  /** Segmento de la URL: /ingresos/<slug> */
  slug: string;
  label: string;
  short: string;
  description: string;
  /** Ícono de lucide-react. */
  icon: string;
  /** Hex de referencia. */
  color: string;
  /** Token CSS del tema: es lo que usa la interfaz. */
  token: string;
  /** Tipos de OT que agrupa. Vacío = todos. */
  kinds: WorkOrderKind[];
  /** true = sólo con expediente de seguro; false = sólo particulares. */
  insured?: boolean;
  /** Aparece en el menú lateral, dentro de "Ingresos". */
  inMenu?: boolean;
}

const SIN_SEGURO = WORKORDER_KINDS.filter((k) => k !== 'SINIESTRO');

/**
 * Las tres puertas de entrada del taller, tal como se trabaja el día a día,
 * más una entrada por cada tipo de OT para el tablero de /ingresos.
 */
export const INTAKE_CHANNELS: IntakeChannel[] = [
  {
    slug: 'siniestros',
    label: 'Siniestros',
    short: 'Siniestros',
    description: 'Choques y daños con compañía de por medio: peritaje, autorización y orden de reparación.',
    icon: 'FileWarning',
    color: '#dc2626', token: 'var(--kind-siniestro)',
    kinds: ['SINIESTRO'],
    inMenu: true,
  },
  {
    slug: 'particulares',
    label: 'Presupuestos particulares',
    short: 'Particulares',
    description: 'El cliente paga de su bolsillo: se presupuesta, se aprueba y se trabaja.',
    icon: 'Receipt',
    color: '#2563eb', token: 'var(--kind-particulares)',
    kinds: SIN_SEGURO,
    insured: false,
    inMenu: true,
  },
  {
    slug: 'aseguradora',
    label: 'Ingreso por aseguradora',
    short: 'Por compañía',
    description: 'Todo lo que tiene expediente de seguro abierto, sea siniestro o no.',
    icon: 'ShieldCheck',
    color: '#7c3aed', token: 'var(--kind-aseguradora)',
    kinds: [],
    insured: true,
    inMenu: true,
  },

  // --- una entrada por tipo de OT, para el tablero de /ingresos ---
  { slug: 'mantenimiento', label: 'Mantenimiento programado', short: 'Service', description: 'Service por kilometraje o tiempo.', icon: 'Wrench', color: '#2563eb', token: 'var(--kind-mantenimiento)', kinds: ['MANTENIMIENTO'] },
  { slug: 'reparacion', label: 'Reparación correctiva', short: 'Reparación', description: 'Entra con una falla: se diagnostica y después se presupuesta.', icon: 'Hammer', color: '#f97316', token: 'var(--kind-reparacion)', kinds: ['REPARACION'] },
  { slug: 'diagnostico', label: 'Diagnóstico / peritaje', short: 'Diagnóstico', description: 'Revisar y dictaminar; puede terminar sin trabajo.', icon: 'Stethoscope', color: '#8b5cf6', token: 'var(--kind-diagnostico)', kinds: ['DIAGNOSTICO'] },
  { slug: 'chapa-pintura', label: 'Chapa y pintura', short: 'Chapa', description: 'Carrocería: peritaje fotográfico y tiempos de secado.', icon: 'SprayCan', color: '#0ea5e9', token: 'var(--kind-chapa)', kinds: ['CHAPA_PINTURA'] },
  { slug: 'neumaticos', label: 'Neumáticos y alineación', short: 'Neumáticos', description: 'Entrada rápida, se resuelve en el día.', icon: 'CircleDot', color: '#14b8a6', token: 'var(--kind-neumaticos)', kinds: ['NEUMATICOS'] },
  { slug: 'garantia', label: 'Retrabajo por garantía', short: 'Garantía', description: 'Vuelve un trabajo del taller: se corrige sin cobrar.', icon: 'BadgeCheck', color: '#16a34a', token: 'var(--kind-garantia)', kinds: ['GARANTIA'] },
  { slug: 'preentrega', label: 'Inspección de preentrega', short: 'Preentrega', description: 'Revisión completa antes de entregar o comprar.', icon: 'ClipboardCheck', color: '#64748b', token: 'var(--kind-preentrega)', kinds: ['PREENTREGA'] },
];

export const MENU_INTAKES = INTAKE_CHANNELS.filter((c) => c.inMenu);

export const intakeBySlug = (slug: string): IntakeChannel | undefined =>
  INTAKE_CHANNELS.find((c) => c.slug === slug);

/** Query string que hay que mandarle a `/api/work-orders` para este canal. */
export function intakeQuery(channel: IntakeChannel): Record<string, string> {
  const q: Record<string, string> = {};
  if (channel.kinds.length > 0) q.kinds = channel.kinds.join(',');
  if (channel.insured !== undefined) q.insured = String(channel.insured);
  return q;
}
