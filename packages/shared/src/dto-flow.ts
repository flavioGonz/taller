import { z } from 'zod';
import { paginationSchema } from './dto.js';
import {
  PART_CODES, DAMAGE_TYPES, DAMAGE_SEVERITIES, PHOTO_ANGLES,
  APPROVAL_CHANNELS, ITEM_DECISIONS, PARTS_ORDER_STATUSES, APPOINTMENT_STATUSES,
  FOLLOWUP_KINDS, QUALITY_RESULTS,
} from './workshop.js';

/* ------------------------------------------------------------- Citas */

export const createAppointmentSchema = z.object({
  customerId: z.string().optional(),
  vehicleId: z.string().optional(),
  contactName: z.string().max(120).optional(),
  contactPhone: z.string().max(40).optional(),
  plate: z.string().max(15).optional(),
  reason: z.string().max(600).optional(),
  scheduledAt: z.coerce.date(),
  durationMin: z.coerce.number().int().min(15).max(600).default(60),
  bayId: z.string().optional(),
  technicianId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});
export const updateAppointmentSchema = createAppointmentSchema.partial().extend({
  status: z.enum(APPOINTMENT_STATUSES).optional(),
});
export const appointmentQuerySchema = paginationSchema.extend({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
});

/* ------------------------------------------------------- Inspección */

export const damageMarkSchema = z.object({
  photoId: z.string().optional(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  partCode: z.enum(PART_CODES as [string, ...string[]]),
  type: z.enum(DAMAGE_TYPES).default('RAYON'),
  severity: z.enum(DAMAGE_SEVERITIES).default('LEVE'),
  preexisting: z.boolean().default(true),
  note: z.string().max(400).optional(),
});

export const saveInspectionSchema = z.object({
  kind: z.enum(['INGRESO', 'EGRESO']).default('INGRESO'),
  mileage: z.coerce.number().int().nonnegative().optional(),
  fuelLevel: z.coerce.number().int().min(0).max(100).optional(),
  checklist: z.record(z.unknown()).default({}),
  observations: z.string().max(4000).optional(),
  signatureUrl: z.string().max(500).optional(),
  signedName: z.string().max(120).optional(),
  signedDoc: z.string().max(40).optional(),
  damages: z.array(damageMarkSchema).default([]),
});

export const addPhotoSchema = z.object({
  angle: z.enum(PHOTO_ANGLES).default('OTRO'),
  url: z.string().min(1).max(500),
  width: z.coerce.number().int().positive().optional(),
  height: z.coerce.number().int().positive().optional(),
  position: z.coerce.number().int().nonnegative().default(0),
});

/* ------------------------------------------------------ Presupuestos */

export const quoteItemSchema = z.object({
  kind: z.enum(['SERVICIO', 'REPUESTO', 'MANO_OBRA', 'OTRO']).default('SERVICIO'),
  serviceId: z.string().optional(),
  partId: z.string().optional(),
  description: z.string().min(1).max(300),
  detail: z.string().max(1000).optional(),
  quantity: z.coerce.number().positive().default(1),
  unitPrice: z.coerce.number().nonnegative(),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  taxPct: z.coerce.number().min(0).max(100).default(22),
  hours: z.coerce.number().nonnegative().optional(),
  optional: z.boolean().default(false),
  urgent: z.boolean().default(false),
});

export const createQuoteSchema = z.object({
  workOrderId: z.string().min(1),
  validUntil: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
  /** Si se pasa, la nueva versión arranca copiando este presupuesto. */
  fromQuoteId: z.string().optional(),
  items: z.array(quoteItemSchema).default([]),
});

export const updateQuoteSchema = z.object({
  validUntil: z.coerce.date().nullable().optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
  items: z.array(quoteItemSchema).optional(),
});

export const sendQuoteSchema = z.object({
  channel: z.enum(APPROVAL_CHANNELS).default('WHATSAPP'),
  note: z.string().max(500).optional(),
});

/** Registro interno de lo que el cliente contestó, ítem por ítem. */
export const decideQuoteSchema = z.object({
  channel: z.enum(APPROVAL_CHANNELS).default('TELEFONO'),
  decidedByName: z.string().max(120).optional(),
  note: z.string().max(1000).optional(),
  rejectionReason: z.string().max(500).optional(),
  decisions: z
    .array(z.object({ itemId: z.string().min(1), decision: z.enum(ITEM_DECISIONS), note: z.string().max(300).optional() }))
    .default([]),
  /** Atajo: aprobar o rechazar todo de una. */
  all: z.enum(ITEM_DECISIONS).optional(),
  /** Vuelca los ítems aprobados a la OT y la mueve de estado. */
  applyToWorkOrder: z.boolean().default(true),
});

/* --------------------------------------------- Pedidos de repuestos */

export const partsOrderItemSchema = z.object({
  partId: z.string().optional(),
  description: z.string().min(1).max(300),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative().default(0),
});

export const createPartsOrderSchema = z.object({
  workOrderId: z.string().optional(),
  supplierId: z.string().optional(),
  expectedAt: z.coerce.date().optional(),
  reference: z.string().max(60).optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(partsOrderItemSchema).min(1),
});

export const updatePartsOrderSchema = z.object({
  supplierId: z.string().nullable().optional(),
  status: z.enum(PARTS_ORDER_STATUSES).optional(),
  expectedAt: z.coerce.date().nullable().optional(),
  reference: z.string().max(60).optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(partsOrderItemSchema).optional(),
});

export const receivePartsSchema = z.object({
  lines: z.array(z.object({ itemId: z.string().min(1), received: z.coerce.number().nonnegative() })).min(1),
  warehouseId: z.string().optional(),
  note: z.string().max(300).optional(),
});

/* ------------------------------------------- Control de calidad */

export const qualityCheckSchema = z.object({
  result: z.enum(QUALITY_RESULTS).default('APROBADO'),
  checklist: z.record(z.unknown()).default({}),
  roadTest: z.boolean().default(false),
  roadTestKm: z.coerce.number().int().nonnegative().optional(),
  observations: z.string().max(2000).optional(),
});

/* --------------------------------------------------------- Entrega */

export const deliverySchema = z.object({
  receivedBy: z.string().max(120).optional(),
  receivedDoc: z.string().max(40).optional(),
  mileageOut: z.coerce.number().int().nonnegative().optional(),
  fuelLevelOut: z.coerce.number().int().min(0).max(100).optional(),
  signatureUrl: z.string().max(500).optional(),
  observations: z.string().max(2000).optional(),
  warrantyDays: z.coerce.number().int().min(0).max(3650).default(90),
  nextServiceKm: z.coerce.number().int().nonnegative().optional(),
  nextServiceAt: z.coerce.date().optional(),
  /** Emite la factura al entregar. */
  invoice: z.boolean().default(false),
});

/* ------------------------------------------------------- Postventa */

export const createFollowUpSchema = z.object({
  workOrderId: z.string().optional(),
  customerId: z.string().optional(),
  vehicleId: z.string().optional(),
  kind: z.enum(FOLLOWUP_KINDS).default('SATISFACCION'),
  dueAt: z.coerce.date(),
  notes: z.string().max(1000).optional(),
  assignedToId: z.string().optional(),
});

export const closeFollowUpSchema = z.object({
  status: z.enum(['HECHO', 'DESCARTADO']).default('HECHO'),
  channel: z.enum(APPROVAL_CHANNELS).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  notes: z.string().max(1000).optional(),
});

/* --------------------------------------------------------- Catálogo */

export const createBrandSchema = z.object({
  name: z.string().min(1).max(60),
  logoFile: z.string().max(120).optional(),
  country: z.string().max(60).optional(),
});

export const createModelSchema = z.object({
  brandId: z.string().min(1),
  name: z.string().min(1).max(80),
  bodyType: z.string().max(40).optional(),
  yearFrom: z.coerce.number().int().min(1900).max(2100).optional(),
  yearTo: z.coerce.number().int().min(1900).max(2100).optional(),
});
