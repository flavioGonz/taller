// =============================================================================
//  TIPOS DE EVENTO DE LA AGENDA
//  En el taller no se agenda sólo la entrada de un auto: también la entrega al
//  cliente, la llegada de mercadería, un pago y un cobro. Cada uno pide datos
//  distintos y lo puede ver y cargar sólo quien tiene el permiso.
// =============================================================================
import type { Permission } from './roles.js';

export const AGENDA_KINDS = ['INGRESO', 'ENTREGA', 'ENTREGA_PROVEEDOR', 'PAGO', 'COBRO', 'OTRO'] as const;
export type AgendaKind = (typeof AGENDA_KINDS)[number];

export type AgendaFieldKind =
  | 'text' | 'textarea' | 'number' | 'money' | 'date' | 'datetime' | 'time'
  | 'select' | 'cliente' | 'vehiculo' | 'tecnico' | 'bahia' | 'proveedor' | 'orden';

export interface AgendaField {
  name: string;
  label: string;
  kind: AgendaFieldKind;
  required?: boolean;
  hint?: string;
  icon?: string;
  placeholder?: string;
  suffix?: string;
  options?: { value: string; label: string }[];
  wide?: boolean;
  defaultValue?: string | number;
}

export interface AgendaKindDefinition {
  kind: AgendaKind;
  label: string;
  short: string;
  description: string;
  icon: string;
  token: string;
  /** Permiso para crear o editar un evento de este tipo. */
  write: Permission;
  /** Permiso para verlo en el calendario. */
  read: Permission;
  /** Duración sugerida en minutos. */
  defaultMinutes: number;
  fields: AgendaField[];
}

const METODOS = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'DEBITO', label: 'Débito' },
  { value: 'CREDITO', label: 'Crédito' },
  { value: 'CHEQUE', label: 'Cheque' },
];

export const AGENDA_KIND_DEFS: Record<AgendaKind, AgendaKindDefinition> = {
  INGRESO: {
    kind: 'INGRESO',
    label: 'Ingreso de vehículo',
    short: 'Ingreso',
    description: 'El cliente trae el auto. Al llegar se convierte en orden de trabajo.',
    icon: 'CarFront',
    token: 'var(--kind-mantenimiento)',
    write: 'appointment:write',
    read: 'appointment:read',
    defaultMinutes: 60,
    fields: [
      { name: 'customerId', label: 'Cliente', kind: 'cliente', icon: 'User', hint: 'Si es cliente nuevo, dejalo vacío y cargá el contacto abajo' },
      { name: 'vehicleId', label: 'Vehículo', kind: 'vehiculo', icon: 'Car' },
      { name: 'contactName', label: 'Contacto (si no está en el sistema)', kind: 'text', icon: 'User' },
      { name: 'contactPhone', label: 'Teléfono', kind: 'text', icon: 'Phone' },
      { name: 'plate', label: 'Matrícula', kind: 'text', icon: 'Hash', placeholder: 'ABC1234' },
      { name: 'reason', label: 'Por qué viene', kind: 'textarea', wide: true, icon: 'MessageSquare', placeholder: 'Service de 30.000, ruido al frenar…' },
      { name: 'technicianId', label: 'Técnico', kind: 'tecnico', icon: 'Wrench' },
      { name: 'bayId', label: 'Bahía', kind: 'bahia', icon: 'Warehouse' },
    ],
  },

  ENTREGA: {
    kind: 'ENTREGA',
    label: 'Entrega al cliente',
    short: 'Entrega',
    description: 'Cuándo pasa el cliente a retirar el vehículo terminado.',
    icon: 'KeyRound',
    token: 'var(--kind-garantia)',
    write: 'delivery:write',
    read: 'appointment:read',
    defaultMinutes: 30,
    fields: [
      { name: 'workOrderId', label: 'Orden de trabajo', kind: 'orden', required: true, icon: 'ClipboardList', hint: 'Se listan las que están para entregar' },
      { name: 'contactName', label: 'Quién retira', kind: 'text', icon: 'User' },
      { name: 'contactPhone', label: 'Teléfono', kind: 'text', icon: 'Phone' },
      { name: 'amount', label: 'Saldo a cobrar en la entrega', kind: 'money', icon: 'Wallet', hint: 'Dejalo vacío si ya está pago' },
      { name: 'notes', label: 'Aclaraciones', kind: 'textarea', wide: true, icon: 'StickyNote' },
    ],
  },

  ENTREGA_PROVEEDOR: {
    kind: 'ENTREGA_PROVEEDOR',
    label: 'Llegada de proveedor',
    short: 'Proveedor',
    description: 'Cuándo llega la mercadería de un pedido.',
    icon: 'Truck',
    token: 'var(--kind-chapa)',
    write: 'partsorder:write',
    read: 'partsorder:read',
    defaultMinutes: 30,
    fields: [
      { name: 'supplierId', label: 'Proveedor', kind: 'proveedor', required: true, icon: 'Factory' },
      { name: 'reference', label: 'Nº de pedido o remito', kind: 'text', icon: 'Hash' },
      { name: 'title', label: 'Qué llega', kind: 'text', wide: true, icon: 'Package', placeholder: 'Ej: faro VW Gol + grillas' },
      { name: 'amount', label: 'Importe del remito', kind: 'money', icon: 'Wallet' },
      { name: 'notes', label: 'Observaciones', kind: 'textarea', wide: true, icon: 'StickyNote' },
    ],
  },

  PAGO: {
    kind: 'PAGO',
    label: 'Pago a realizar',
    short: 'Pago',
    description: 'Una salida de dinero agendada: proveedor, alquiler, sueldos.',
    icon: 'ArrowUpFromLine',
    token: 'var(--kind-siniestro)',
    write: 'billing:write',
    read: 'billing:read',
    defaultMinutes: 15,
    fields: [
      { name: 'title', label: 'A quién y por qué', kind: 'text', required: true, wide: true, icon: 'FileText', placeholder: 'Ej: Distribuidora Sur — factura A-1234' },
      { name: 'supplierId', label: 'Proveedor', kind: 'proveedor', icon: 'Factory', hint: 'Si el pago es a un proveedor cargado' },
      { name: 'amount', label: 'Importe', kind: 'money', required: true, icon: 'Wallet' },
      { name: 'method', label: 'Forma de pago', kind: 'select', icon: 'CreditCard', options: METODOS, defaultValue: 'TRANSFERENCIA' },
      { name: 'reference', label: 'Comprobante', kind: 'text', icon: 'Hash' },
      { name: 'notes', label: 'Notas', kind: 'textarea', wide: true, icon: 'StickyNote' },
    ],
  },

  COBRO: {
    kind: 'COBRO',
    label: 'Cobro a recibir',
    short: 'Cobro',
    description: 'Una entrada de dinero agendada: un cliente o una compañía.',
    icon: 'ArrowDownToLine',
    token: 'var(--kind-neumaticos)',
    write: 'billing:write',
    read: 'billing:read',
    defaultMinutes: 15,
    fields: [
      { name: 'title', label: 'De quién y por qué', kind: 'text', required: true, wide: true, icon: 'FileText', placeholder: 'Ej: BSE — siniestro SN-2026-99881' },
      { name: 'customerId', label: 'Cliente', kind: 'cliente', icon: 'User' },
      { name: 'workOrderId', label: 'Orden relacionada', kind: 'orden', icon: 'ClipboardList' },
      { name: 'amount', label: 'Importe', kind: 'money', required: true, icon: 'Wallet' },
      { name: 'method', label: 'Forma de cobro', kind: 'select', icon: 'CreditCard', options: METODOS, defaultValue: 'TRANSFERENCIA' },
      { name: 'reference', label: 'Comprobante', kind: 'text', icon: 'Hash' },
      { name: 'notes', label: 'Notas', kind: 'textarea', wide: true, icon: 'StickyNote' },
    ],
  },

  OTRO: {
    kind: 'OTRO',
    label: 'Otro compromiso',
    short: 'Otro',
    description: 'Cualquier cosa que convenga tener en el calendario del taller.',
    icon: 'CalendarPlus',
    token: 'var(--kind-preentrega)',
    write: 'appointment:write',
    read: 'appointment:read',
    defaultMinutes: 30,
    fields: [
      { name: 'title', label: 'De qué se trata', kind: 'text', required: true, wide: true, icon: 'FileText' },
      { name: 'notes', label: 'Detalle', kind: 'textarea', wide: true, icon: 'StickyNote' },
    ],
  },
};

export const AGENDA_KIND_LIST = AGENDA_KINDS.map((k) => AGENDA_KIND_DEFS[k]);

/** Los tipos que un rol puede ver en el calendario. */
export function readableAgendaKinds(has: (p: Permission) => boolean): AgendaKind[] {
  return AGENDA_KINDS.filter((k) => has(AGENDA_KIND_DEFS[k].read));
}

/** Los tipos que un rol puede agendar. */
export function writableAgendaKinds(has: (p: Permission) => boolean): AgendaKind[] {
  return AGENDA_KINDS.filter((k) => has(AGENDA_KIND_DEFS[k].write));
}

/** Campos de un tipo que van a columnas propias del evento. */
export const AGENDA_COLUMNS = [
  'customerId', 'vehicleId', 'workOrderId', 'supplierId', 'partsOrderId', 'documentId',
  'contactName', 'contactPhone', 'plate', 'reason', 'title', 'notes',
  'technicianId', 'bayId', 'amount', 'currency', 'method', 'reference',
] as const;
