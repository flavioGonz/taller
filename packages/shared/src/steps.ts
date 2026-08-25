// =============================================================================
//  CAMPOS DE CADA ETAPA
//  Mover una OT de etapa no es sólo cambiar un estado: en cada paso hay datos
//  que hay que dejar registrados. Acá se define qué pide cada uno, quién puede
//  hacerlo y a qué columna de la OT va cada campo.
// =============================================================================
import type { Permission } from './roles.js';
import type { WorkOrderStatus } from './constants.js';

export type StepFieldKind =
  | 'text' | 'textarea' | 'number' | 'money' | 'date' | 'datetime'
  | 'select' | 'bool' | 'tecnico' | 'bahia';

export interface StepField {
  name: string;
  label: string;
  kind: StepFieldKind;
  required?: boolean;
  hint?: string;
  icon?: string;
  placeholder?: string;
  suffix?: string;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  /** Ocupa toda la fila del formulario. */
  wide?: boolean;
  /** Valor sugerido cuando el campo viene vacío. */
  defaultValue?: string | number | boolean;
}

export interface StepDefinition {
  status: WorkOrderStatus;
  title: string;
  description: string;
  icon: string;
  confirmLabel: string;
  /** Permiso necesario para ejecutar el paso. */
  permission: Permission;
  fields: StepField[];
  /** Aviso cuando el grueso del trabajo se hace en otra pantalla. */
  notice?: { text: string; href?: (workOrderId: string) => string; linkLabel?: string };
}

/**
 * Columnas de la OT que un paso puede escribir. Cualquier otro campo del
 * formulario se guarda como parte de la nota del historial, nunca se pierde
 * pero tampoco pisa datos del negocio.
 */
export const STEP_WRITABLE_COLUMNS = [
  'complaint', 'diagnosis', 'workPerformed', 'internalNotes',
  'mileageIn', 'fuelLevel', 'promisedAt', 'technicianId', 'bayId',
  'rejectionReason', 'warrantyDays',
] as const;
export type StepWritableColumn = (typeof STEP_WRITABLE_COLUMNS)[number];

const CANALES = [
  { value: 'TELEFONO', label: 'Por teléfono' },
  { value: 'WHATSAPP', label: 'Por WhatsApp' },
  { value: 'EMAIL', label: 'Por correo' },
  { value: 'PRESENCIAL', label: 'En persona' },
];

export const STEP_FORMS: Partial<Record<WorkOrderStatus, StepDefinition>> = {
  RECEPCION: {
    status: 'RECEPCION',
    title: 'Recibir el vehículo',
    description: 'Lo que se anota al entrar es lo que después evita discusiones.',
    icon: 'ClipboardList',
    confirmLabel: 'Registrar la recepción',
    permission: 'workorder:status',
    fields: [
      { name: 'complaint', label: 'Qué dice el cliente', kind: 'textarea', required: true, wide: true, icon: 'MessageSquare', placeholder: 'Con las palabras del cliente: "hace un ruido al frenar"', hint: 'Tal cual lo cuenta; el diagnóstico va después' },
      { name: 'mileageIn', label: 'Kilometraje', kind: 'number', icon: 'Gauge', suffix: 'km', min: 0, hint: 'El del tablero al entrar' },
      { name: 'fuelLevel', label: 'Combustible', kind: 'number', icon: 'Fuel', suffix: '%', min: 0, max: 100 },
      { name: 'technicianId', label: 'Técnico que lo recibe', kind: 'tecnico', icon: 'Wrench' },
      { name: 'bayId', label: 'Dónde queda', kind: 'bahia', icon: 'Warehouse' },
      { name: 'promisedAt', label: 'Entrega prometida', kind: 'datetime', icon: 'CalendarClock', hint: 'Se puede ajustar después; sirve para el semáforo de atrasos' },
    ],
    notice: {
      text: 'Las fotos, el inventario y la firma del cliente se cargan en la pantalla de recepción.',
      href: (id) => `/ordenes/${id}/recepcion`,
      linkLabel: 'Ir al relevamiento',
    },
  },

  DIAGNOSTICO: {
    status: 'DIAGNOSTICO',
    title: 'Cargar el diagnóstico',
    description: 'Qué encontró el técnico y cuánto trabajo estima.',
    icon: 'Stethoscope',
    confirmLabel: 'Guardar diagnóstico',
    permission: 'workorder:status',
    fields: [
      { name: 'diagnosis', label: 'Diagnóstico técnico', kind: 'textarea', required: true, wide: true, icon: 'Stethoscope', placeholder: 'Qué se revisó, qué se encontró y qué hay que hacer' },
      { name: 'technicianId', label: 'Quién diagnosticó', kind: 'tecnico', icon: 'Wrench' },
      { name: 'horasEstimadas', label: 'Horas estimadas', kind: 'number', icon: 'Timer', suffix: 'h', min: 0, hint: 'Para cotizar la mano de obra' },
      { name: 'requiereRepuestos', label: 'Necesita repuestos que no hay en stock', kind: 'bool', icon: 'PackageSearch' },
    ],
  },

  PRESUPUESTADO: {
    status: 'PRESUPUESTADO',
    title: 'Marcar como presupuestado',
    description: 'La OT queda esperando la respuesta del cliente.',
    icon: 'FileText',
    confirmLabel: 'Marcar como presupuestado',
    permission: 'quote:write',
    fields: [
      { name: 'canal', label: 'Cómo se le hizo llegar', kind: 'select', icon: 'Send', options: CANALES, defaultValue: 'WHATSAPP' },
      { name: 'promisedAt', label: 'Entrega estimada si aprueba', kind: 'datetime', icon: 'CalendarClock' },
    ],
    notice: {
      text: 'El presupuesto con ítems, PDF y envío se arma desde la sección de presupuestos de la OT.',
    },
  },

  APROBADO: {
    status: 'APROBADO',
    title: 'Registrar la aprobación',
    description: 'Quién aprobó, por dónde y con qué alcance.',
    icon: 'ThumbsUp',
    confirmLabel: 'Registrar aprobación',
    permission: 'quote:decide',
    fields: [
      { name: 'aprobadoPor', label: 'Quién aprobó', kind: 'text', required: true, icon: 'User', placeholder: 'Nombre de quien dio el OK' },
      { name: 'canal', label: 'Por dónde', kind: 'select', icon: 'Send', options: CANALES, defaultValue: 'TELEFONO' },
      { name: 'promisedAt', label: 'Entrega comprometida', kind: 'datetime', icon: 'CalendarClock' },
      { name: 'internalNotes', label: 'Aclaraciones', kind: 'textarea', wide: true, icon: 'StickyNote', placeholder: 'Ej: aprueba pastillas, deja los discos para más adelante' },
    ],
  },

  ESPERA_REPUESTO: {
    status: 'ESPERA_REPUESTO',
    title: 'Queda esperando repuestos',
    description: 'Qué falta, a quién se le pidió y cuándo llega.',
    icon: 'PackageSearch',
    confirmLabel: 'Marcar en espera',
    permission: 'workorder:status',
    fields: [
      { name: 'repuestos', label: 'Qué se está esperando', kind: 'textarea', required: true, wide: true, icon: 'Package', placeholder: 'Ej: faro delantero derecho y grilla de paragolpes' },
      { name: 'proveedor', label: 'Proveedor', kind: 'text', icon: 'Factory' },
      { name: 'llegadaEstimada', label: 'Llegada estimada', kind: 'date', icon: 'Truck' },
      { name: 'promisedAt', label: 'Nueva entrega prometida', kind: 'datetime', icon: 'CalendarClock', hint: 'Si el repuesto corre la fecha, corregila acá' },
    ],
  },

  EN_PROCESO: {
    status: 'EN_PROCESO',
    title: 'Empezar el trabajo',
    description: 'Al iniciar se descuenta el stock de los repuestos aprobados.',
    icon: 'Wrench',
    confirmLabel: 'Empezar el trabajo',
    permission: 'workorder:status',
    fields: [
      { name: 'technicianId', label: 'Técnico a cargo', kind: 'tecnico', required: true, icon: 'Wrench' },
      { name: 'bayId', label: 'Bahía', kind: 'bahia', icon: 'Warehouse' },
      { name: 'internalNotes', label: 'Indicaciones para el técnico', kind: 'textarea', wide: true, icon: 'StickyNote' },
    ],
  },

  CONTROL_CALIDAD: {
    status: 'CONTROL_CALIDAD',
    title: 'Pasar a control de calidad',
    description: 'El trabajo está hecho y va a revisión antes de entregar.',
    icon: 'ShieldCheck',
    confirmLabel: 'Mandar a calidad',
    permission: 'workorder:status',
    fields: [
      { name: 'workPerformed', label: 'Trabajo realizado', kind: 'textarea', required: true, wide: true, icon: 'Wrench', placeholder: 'Qué se hizo finalmente, para que quede en la ficha del vehículo' },
      { name: 'quienRevisa', label: 'Quién va a revisar', kind: 'tecnico', icon: 'ShieldCheck' },
    ],
    notice: { text: 'El checklist de 13 puntos y la prueba de ruta se completan en el panel de control de calidad, más abajo.' },
  },

  LAVADO: {
    status: 'LAVADO',
    title: 'Mandar a lavado',
    description: 'El último paso antes de avisarle al cliente.',
    icon: 'Droplets',
    confirmLabel: 'Mandar a lavado',
    permission: 'workorder:status',
    fields: [
      { name: 'lavadoInterior', label: 'Incluye interior', kind: 'bool', icon: 'Armchair', defaultValue: true },
      { name: 'lavadoExterior', label: 'Incluye exterior', kind: 'bool', icon: 'Car', defaultValue: true },
      { name: 'quienLava', label: 'Quién lo lava', kind: 'text', icon: 'User' },
    ],
  },

  FINALIZADO: {
    status: 'FINALIZADO',
    title: 'Dar por terminado',
    description: 'Queda pronto para que el cliente lo retire.',
    icon: 'PartyPopper',
    confirmLabel: 'Dar por terminado',
    permission: 'workorder:status',
    fields: [
      { name: 'workPerformed', label: 'Trabajo realizado', kind: 'textarea', required: true, wide: true, icon: 'Wrench' },
      { name: 'warrantyDays', label: 'Garantía', kind: 'number', icon: 'ShieldCheck', suffix: 'días', min: 0, defaultValue: 90, hint: 'Se cuenta desde la entrega' },
      { name: 'avisarCliente', label: 'Avisarle al cliente que está pronto', kind: 'bool', icon: 'Bell', defaultValue: true },
    ],
  },

  ENTREGADO: {
    status: 'ENTREGADO',
    title: 'Entregar el vehículo',
    description: 'Quién lo retira y con qué kilometraje sale.',
    icon: 'KeyRound',
    confirmLabel: 'Registrar la entrega',
    permission: 'delivery:write',
    fields: [
      { name: 'retiraNombre', label: 'Quién lo retira', kind: 'text', required: true, icon: 'User' },
      { name: 'retiraDocumento', label: 'Documento', kind: 'text', icon: 'IdCard' },
      { name: 'kmSalida', label: 'Kilometraje de salida', kind: 'number', icon: 'Gauge', suffix: 'km', min: 0 },
      { name: 'internalNotes', label: 'Observaciones de la entrega', kind: 'textarea', wide: true, icon: 'StickyNote' },
    ],
    notice: { text: 'La firma de conformidad y la factura se cargan en el panel de entrega, más abajo.' },
  },

  RECHAZADO: {
    status: 'RECHAZADO',
    title: 'El cliente no aprobó',
    description: 'Se anota el motivo y qué se hace con el vehículo.',
    icon: 'ThumbsDown',
    confirmLabel: 'Registrar el rechazo',
    permission: 'quote:decide',
    fields: [
      { name: 'rejectionReason', label: 'Motivo del rechazo', kind: 'textarea', required: true, wide: true, icon: 'MessageSquare', placeholder: 'Ej: le pareció caro el faro original, va a conseguirlo por su cuenta' },
      { name: 'canal', label: 'Cómo lo comunicó', kind: 'select', icon: 'Send', options: CANALES, defaultValue: 'TELEFONO' },
    ],
  },

  CANCELADO: {
    status: 'CANCELADO',
    title: 'Cancelar la orden',
    description: 'La OT se cierra sin trabajo. Queda en el historial del vehículo.',
    icon: 'Ban',
    confirmLabel: 'Cancelar la orden',
    permission: 'workorder:write',
    fields: [
      { name: 'rejectionReason', label: 'Motivo', kind: 'textarea', required: true, wide: true, icon: 'MessageSquare' },
    ],
  },
};

export const stepFormFor = (status: WorkOrderStatus): StepDefinition | undefined => STEP_FORMS[status];
