export const WORKORDER_STATUSES = [
  'RECEPCION', 'DIAGNOSTICO', 'PRESUPUESTADO', 'APROBADO', 'RECHAZADO', 'EN_PROCESO',
  'ESPERA_REPUESTO', 'CONTROL_CALIDAD', 'LAVADO', 'FINALIZADO', 'ENTREGADO', 'CANCELADO',
] as const;
export type WorkOrderStatus = (typeof WORKORDER_STATUSES)[number];

/** Transiciones permitidas de la máquina de estados de la OT. */
export const STATUS_TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  RECEPCION: ['DIAGNOSTICO', 'CANCELADO'],
  DIAGNOSTICO: ['PRESUPUESTADO', 'EN_PROCESO', 'CANCELADO'],
  PRESUPUESTADO: ['APROBADO', 'RECHAZADO', 'CANCELADO'],
  APROBADO: ['EN_PROCESO', 'ESPERA_REPUESTO', 'CANCELADO'],
  // El cliente no aprobó: o se devuelve el vehículo, o se rehace el presupuesto
  RECHAZADO: ['PRESUPUESTADO', 'FINALIZADO', 'CANCELADO'],
  EN_PROCESO: ['ESPERA_REPUESTO', 'CONTROL_CALIDAD', 'FINALIZADO', 'CANCELADO'],
  ESPERA_REPUESTO: ['EN_PROCESO', 'CANCELADO'],
  CONTROL_CALIDAD: ['EN_PROCESO', 'LAVADO', 'FINALIZADO'],
  LAVADO: ['FINALIZADO'],
  FINALIZADO: ['ENTREGADO', 'EN_PROCESO'],
  ENTREGADO: [],
  CANCELADO: [],
};

export function canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  RECEPCION: 'Recepción',
  DIAGNOSTICO: 'Diagnóstico',
  PRESUPUESTADO: 'Presupuestado',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  EN_PROCESO: 'En proceso',
  ESPERA_REPUESTO: 'Espera repuesto',
  CONTROL_CALIDAD: 'Control de calidad',
  LAVADO: 'Lavado',
  FINALIZADO: 'Finalizado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export const PRIORITIES = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Etapas "vivas": el vehículo está en el taller. Alimentan el tablero. */
export const ACTIVE_STATUSES = WORKORDER_STATUSES.filter(
  (s) => s !== 'ENTREGADO' && s !== 'CANCELADO',
);

/** Orden de las columnas del tablero kanban. */
export const BOARD_STATUSES = [
  'RECEPCION', 'DIAGNOSTICO', 'PRESUPUESTADO', 'APROBADO', 'ESPERA_REPUESTO',
  'EN_PROCESO', 'CONTROL_CALIDAD', 'LAVADO', 'FINALIZADO',
] as const;

export const DEFAULT_TAX_PCT = 22; // IVA básico Uruguay
export const DEFAULT_CURRENCY = 'UYU';
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;
