import { z } from 'zod';
import { ROLES } from './roles.js';
import { WORKORDER_STATUSES, PRIORITIES, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './constants.js';

// ---------- comunes ----------
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  q: z.string().trim().max(120).optional(),
  sort: z.string().max(60).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type PaginationQuery = z.infer<typeof paginationSchema>;

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export const idParamSchema = z.object({ id: z.string().min(1) });

// ---------- auth ----------
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  tenantSlug: z.string().min(1).max(60).optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8).max(128),
});

export interface SessionUser {
  id: string;
  tenantId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: (typeof ROLES)[number];
  avatarUrl?: string | null;
  tenant?: { id: string; slug: string; name: string; logoUrl?: string | null } | null;
}

// ---------- usuarios ----------
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  phone: z.string().max(40).optional(),
  role: z.enum(ROLES),
  specialty: z.string().max(80).optional(),
  hourlyRate: z.coerce.number().nonnegative().optional(),
  isActive: z.boolean().default(true),
});
export const updateUserSchema = createUserSchema.partial().omit({ password: true });

// ---------- clientes ----------
export const createCustomerSchema = z
  .object({
    isCompany: z.boolean().default(false),
    firstName: z.string().max(60).optional(),
    lastName: z.string().max(60).optional(),
    companyName: z.string().max(120).optional(),
    docType: z.string().max(10).optional(),
    docNumber: z.string().max(30).optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().max(40).optional(),
    phoneAlt: z.string().max(40).optional(),
    address: z.string().max(160).optional(),
    city: z.string().max(60).optional(),
    notes: z.string().max(2000).optional(),
    creditLimit: z.coerce.number().nonnegative().optional(),
  })
  .refine((v) => (v.isCompany ? !!v.companyName : !!v.firstName && !!v.lastName), {
    message: 'Razón social requerida para empresas; nombre y apellido para personas',
    path: ['companyName'],
  });
export const updateCustomerSchema = createCustomerSchema.innerType().partial();

// ---------- vehículos ----------
export const createVehicleSchema = z.object({
  customerId: z.string().min(1),
  brandId: z.string().optional(),
  modelId: z.string().optional(),
  photoUrl: z.string().max(500).optional(),
  features: z.record(z.unknown()).optional(),
  plate: z.string().min(3).max(15).transform((s) => s.toUpperCase().replace(/\s+/g, '')),
  vin: z.string().max(25).optional(),
  engineNumber: z.string().max(30).optional(),
  brand: z.string().min(1).max(40),
  model: z.string().min(1).max(60),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  color: z.string().max(30).optional(),
  fuel: z.enum(['NAFTA', 'DIESEL', 'GNC', 'ELECTRICO', 'HIBRIDO', 'OTRO']).default('NAFTA'),
  transmission: z.string().max(30).optional(),
  engineSize: z.string().max(20).optional(),
  mileage: z.coerce.number().int().nonnegative().optional(),
  insurance: z.string().max(60).optional(),
  policyNumber: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
});
export const updateVehicleSchema = createVehicleSchema.partial();

// ---------- órdenes de trabajo ----------
export const workOrderItemSchema = z.object({
  kind: z.enum(['SERVICIO', 'REPUESTO', 'MANO_OBRA', 'OTRO']).default('SERVICIO'),
  serviceId: z.string().optional(),
  partId: z.string().optional(),
  description: z.string().min(1).max(300),
  quantity: z.coerce.number().positive().default(1),
  unitPrice: z.coerce.number().nonnegative(),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  taxPct: z.coerce.number().min(0).max(100).default(22),
  hours: z.coerce.number().nonnegative().optional(),
});

export const createWorkOrderSchema = z.object({
  customerId: z.string().min(1),
  vehicleId: z.string().min(1),
  kind: z
    .enum(['MANTENIMIENTO', 'REPARACION', 'DIAGNOSTICO', 'CHAPA_PINTURA', 'NEUMATICOS', 'GARANTIA', 'SINIESTRO', 'PREENTREGA'])
    .default('REPARACION'),
  technicianId: z.string().optional(),
  bayId: z.string().optional(),
  priority: z.enum(PRIORITIES).default('NORMAL'),
  complaint: z.string().max(4000).optional(),
  mileageIn: z.coerce.number().int().nonnegative().optional(),
  fuelLevel: z.coerce.number().int().min(0).max(100).optional(),
  promisedAt: z.coerce.date().optional(),
  checklistIn: z.record(z.unknown()).optional(),
  items: z.array(workOrderItemSchema).default([]),
});

export const updateWorkOrderSchema = z.object({
  kind: z
    .enum(['MANTENIMIENTO', 'REPARACION', 'DIAGNOSTICO', 'CHAPA_PINTURA', 'NEUMATICOS', 'GARANTIA', 'SINIESTRO', 'PREENTREGA'])
    .optional(),
  technicianId: z.string().nullable().optional(),
  bayId: z.string().nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  complaint: z.string().max(4000).optional(),
  diagnosis: z.string().max(4000).optional(),
  workPerformed: z.string().max(4000).optional(),
  internalNotes: z.string().max(4000).optional(),
  promisedAt: z.coerce.date().nullable().optional(),
  customerApproved: z.boolean().optional(),
  items: z.array(workOrderItemSchema).optional(),
});

export const changeStatusSchema = z.object({
  status: z.enum(WORKORDER_STATUSES),
  note: z.string().max(500).optional(),
  /**
   * Datos propios del paso. Los que corresponden a una columna de la OT se
   * guardan ahí; el resto se resume en la nota del historial.
   */
  fields: z.record(z.unknown()).optional(),
});

export const workOrderQuerySchema = paginationSchema.extend({
  status: z.enum(WORKORDER_STATUSES).optional(),
  kind: z
    .enum(['MANTENIMIENTO', 'REPARACION', 'DIAGNOSTICO', 'CHAPA_PINTURA', 'NEUMATICOS', 'GARANTIA', 'SINIESTRO', 'PREENTREGA'])
    .optional(),
  priority: z.enum(PRIORITIES).optional(),
  technicianId: z.string().optional(),
  customerId: z.string().optional(),
  vehicleId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  promisedFrom: z.coerce.date().optional(),
  promisedTo: z.coerce.date().optional(),
});

// ---------- inventario / servicios ----------
export const createPartSchema = z.object({
  sku: z.string().min(1).max(40),
  barcode: z.string().max(60).optional(),
  name: z.string().min(1).max(140),
  description: z.string().max(1000).optional(),
  brand: z.string().max(60).optional(),
  category: z.string().max(60).optional(),
  unit: z.string().max(10).default('UN'),
  cost: z.coerce.number().nonnegative().default(0),
  price: z.coerce.number().nonnegative().default(0),
  taxPct: z.coerce.number().min(0).max(100).default(22),
  minStock: z.coerce.number().nonnegative().default(0),
  supplierId: z.string().optional(),
  location: z.string().max(60).optional(),
  imageUrl: z.string().max(500).optional(),
});
export const updatePartSchema = createPartSchema.partial();

export const stockMovementSchema = z.object({
  partId: z.string().min(1),
  warehouseId: z.string().optional(),
  type: z.enum(['ENTRADA', 'SALIDA', 'AJUSTE', 'DEVOLUCION', 'MERMA']),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative().optional(),
  workOrderId: z.string().optional(),
  reference: z.string().max(60).optional(),
  note: z.string().max(300).optional(),
});

export const createServiceSchema = z.object({
  code: z.string().max(30).optional(),
  name: z.string().min(1).max(140),
  description: z.string().max(1000).optional(),
  category: z.string().max(60).optional(),
  estimatedHours: z.coerce.number().nonnegative().optional(),
  price: z.coerce.number().nonnegative(),
  taxPct: z.coerce.number().min(0).max(100).default(22),
});
export const updateServiceSchema = createServiceSchema.partial();

// ---------- facturación ----------
export const createDocumentSchema = z.object({
  type: z.enum(['PRESUPUESTO', 'FACTURA', 'REMITO', 'RECIBO']),
  customerId: z.string().min(1),
  workOrderId: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  currency: z.string().length(3).default('UYU'),
  notes: z.string().max(1000).optional(),
  lines: z
    .array(
      z.object({
        description: z.string().min(1).max(300),
        quantity: z.coerce.number().positive().default(1),
        unitPrice: z.coerce.number().nonnegative(),
        discountPct: z.coerce.number().min(0).max(100).default(0),
        taxPct: z.coerce.number().min(0).max(100).default(22),
      }),
    )
    .min(1),
});

export const createPaymentSchema = z.object({
  method: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO', 'CHEQUE', 'OTRO']),
  amount: z.coerce.number().positive(),
  reference: z.string().max(60).optional(),
  paidAt: z.coerce.date().optional(),
});

// ---------- tenants ----------
export const createTenantSchema = z.object({
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, 'slug inválido'),
  name: z.string().min(2).max(120),
  legalName: z.string().max(160).optional(),
  taxId: z.string().max(30).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  address: z.string().max(160).optional(),
  city: z.string().max(60).optional(),
  plan: z.enum(['FREE', 'PRO', 'ENTERPRISE']).default('PRO'),
  admin: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
  }),
});
