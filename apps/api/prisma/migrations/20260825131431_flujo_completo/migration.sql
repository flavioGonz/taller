-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PROGRAMADA', 'CONFIRMADA', 'EN_TALLER', 'NO_ASISTIO', 'CANCELADA');

-- CreateEnum
CREATE TYPE "InspectionKind" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "PhotoAngle" AS ENUM ('FRENTE', 'TRASERA', 'LATERAL_IZQ', 'LATERAL_DER', 'TECHO', 'INTERIOR', 'TABLERO', 'MOTOR', 'BAUL', 'RUEDAS', 'DETALLE', 'OTRO');

-- CreateEnum
CREATE TYPE "DamageType" AS ENUM ('RAYON', 'ABOLLADURA', 'ROTURA', 'FALTANTE', 'OXIDO', 'FISURA', 'DESGASTE', 'MANCHA', 'REPARACION_PREVIA', 'OTRO');

-- CreateEnum
CREATE TYPE "DamageSeverity" AS ENUM ('LEVE', 'MODERADO', 'GRAVE');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('BORRADOR', 'ENVIADO', 'APROBADO', 'APROBADO_PARCIAL', 'RECHAZADO', 'VENCIDO', 'ANULADO', 'SUPERSEDIDO');

-- CreateEnum
CREATE TYPE "ItemDecision" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "ApprovalChannel" AS ENUM ('TELEFONO', 'WHATSAPP', 'EMAIL', 'PRESENCIAL', 'OTRO');

-- CreateEnum
CREATE TYPE "PartsOrderStatus" AS ENUM ('BORRADOR', 'SOLICITADO', 'CONFIRMADO', 'EN_TRANSITO', 'RECIBIDO_PARCIAL', 'RECIBIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "QualityResult" AS ENUM ('APROBADO', 'APROBADO_CON_OBSERVACIONES', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "FollowUpKind" AS ENUM ('SATISFACCION', 'RECORDATORIO_SERVICE', 'GARANTIA', 'COBRANZA', 'OTRO');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDIENTE', 'HECHO', 'DESCARTADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'JEFE_TALLER';
ALTER TYPE "Role" ADD VALUE 'REPUESTOS';
ALTER TYPE "Role" ADD VALUE 'CAJA';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkOrderStatus" ADD VALUE 'RECHAZADO';
ALTER TYPE "WorkOrderStatus" ADD VALUE 'LAVADO';

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "brandId" TEXT,
ADD COLUMN     "modelId" TEXT;

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "warrantyUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "vehicle_brands" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoFile" TEXT,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'catalog',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_models" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bodyType" TEXT,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'catalog',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "vehicleId" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "plate" TEXT,
    "reason" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "bayId" TEXT,
    "technicianId" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PROGRAMADA',
    "notes" TEXT,
    "workOrderId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "kind" "InspectionKind" NOT NULL DEFAULT 'INGRESO',
    "mileage" INTEGER,
    "fuelLevel" INTEGER,
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "observations" TEXT,
    "signatureUrl" TEXT,
    "signedName" TEXT,
    "signedDoc" TEXT,
    "signedAt" TIMESTAMP(3),
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_photos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "angle" "PhotoAngle" NOT NULL DEFAULT 'OTRO',
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "damage_marks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "photoId" TEXT,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "partCode" TEXT NOT NULL,
    "type" "DamageType" NOT NULL DEFAULT 'RAYON',
    "severity" "DamageSeverity" NOT NULL DEFAULT 'LEVE',
    "preexisting" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "damage_marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "QuoteStatus" NOT NULL DEFAULT 'BORRADOR',
    "validUntil" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'UYU',
    "notes" TEXT,
    "terms" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "approvedTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "sentChannel" "ApprovalChannel",
    "decidedAt" TIMESTAMP(3),
    "decisionChannel" "ApprovalChannel",
    "decidedByName" TEXT,
    "decisionNote" TEXT,
    "rejectionReason" TEXT,
    "registeredById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "kind" "WorkOrderItemKind" NOT NULL DEFAULT 'SERVICIO',
    "serviceId" TEXT,
    "partId" TEXT,
    "description" TEXT NOT NULL,
    "detail" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxPct" DECIMAL(5,2) NOT NULL DEFAULT 22,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hours" DECIMAL(8,2),
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "decision" "ItemDecision" NOT NULL DEFAULT 'PENDIENTE',
    "decisionNote" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "workOrderId" TEXT,
    "supplierId" TEXT,
    "status" "PartsOrderStatus" NOT NULL DEFAULT 'BORRADOR',
    "expectedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "reference" TEXT,
    "notes" TEXT,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts_order_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partsOrderId" TEXT NOT NULL,
    "partId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "received" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "parts_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_checks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "result" "QualityResult" NOT NULL DEFAULT 'APROBADO',
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "roadTest" BOOLEAN NOT NULL DEFAULT false,
    "roadTestKm" INTEGER,
    "observations" TEXT,
    "inspectorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedBy" TEXT,
    "receivedDoc" TEXT,
    "mileageOut" INTEGER,
    "fuelLevelOut" INTEGER,
    "signatureUrl" TEXT,
    "observations" TEXT,
    "warrantyDays" INTEGER DEFAULT 90,
    "warrantyUntil" TIMESTAMP(3),
    "nextServiceKm" INTEGER,
    "nextServiceAt" TIMESTAMP(3),
    "deliveredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "customerId" TEXT,
    "vehicleId" TEXT,
    "kind" "FollowUpKind" NOT NULL DEFAULT 'SATISFACCION',
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDIENTE',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),
    "channel" "ApprovalChannel",
    "rating" INTEGER,
    "notes" TEXT,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_brands_name_idx" ON "vehicle_brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_brands_tenantId_slug_key" ON "vehicle_brands"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "vehicle_models_brandId_name_idx" ON "vehicle_models"("brandId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_models_brandId_name_tenantId_key" ON "vehicle_models"("brandId", "name", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_workOrderId_key" ON "appointments"("workOrderId");

-- CreateIndex
CREATE INDEX "appointments_tenantId_scheduledAt_idx" ON "appointments"("tenantId", "scheduledAt");

-- CreateIndex
CREATE INDEX "appointments_tenantId_status_idx" ON "appointments"("tenantId", "status");

-- CreateIndex
CREATE INDEX "inspections_tenantId_createdAt_idx" ON "inspections"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "inspections_workOrderId_kind_key" ON "inspections"("workOrderId", "kind");

-- CreateIndex
CREATE INDEX "inspection_photos_inspectionId_position_idx" ON "inspection_photos"("inspectionId", "position");

-- CreateIndex
CREATE INDEX "damage_marks_inspectionId_idx" ON "damage_marks"("inspectionId");

-- CreateIndex
CREATE INDEX "damage_marks_tenantId_partCode_idx" ON "damage_marks"("tenantId", "partCode");

-- CreateIndex
CREATE INDEX "quotes_workOrderId_version_idx" ON "quotes"("workOrderId", "version");

-- CreateIndex
CREATE INDEX "quotes_tenantId_status_idx" ON "quotes"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_tenantId_number_version_key" ON "quotes"("tenantId", "number", "version");

-- CreateIndex
CREATE INDEX "quote_items_quoteId_position_idx" ON "quote_items"("quoteId", "position");

-- CreateIndex
CREATE INDEX "parts_orders_tenantId_status_idx" ON "parts_orders"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "parts_orders_tenantId_number_key" ON "parts_orders"("tenantId", "number");

-- CreateIndex
CREATE INDEX "parts_order_items_partsOrderId_idx" ON "parts_order_items"("partsOrderId");

-- CreateIndex
CREATE INDEX "quality_checks_workOrderId_createdAt_idx" ON "quality_checks"("workOrderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_workOrderId_key" ON "deliveries"("workOrderId");

-- CreateIndex
CREATE INDEX "deliveries_tenantId_deliveredAt_idx" ON "deliveries"("tenantId", "deliveredAt");

-- CreateIndex
CREATE INDEX "follow_ups_tenantId_status_dueAt_idx" ON "follow_ups"("tenantId", "status", "dueAt");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "vehicle_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "vehicle_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "vehicle_brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_bayId_fkey" FOREIGN KEY ("bayId") REFERENCES "bays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_marks" ADD CONSTRAINT "damage_marks_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_marks" ADD CONSTRAINT "damage_marks_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "inspection_photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts_orders" ADD CONSTRAINT "parts_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts_orders" ADD CONSTRAINT "parts_orders_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts_orders" ADD CONSTRAINT "parts_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts_order_items" ADD CONSTRAINT "parts_order_items_partsOrderId_fkey" FOREIGN KEY ("partsOrderId") REFERENCES "parts_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts_order_items" ADD CONSTRAINT "parts_order_items_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
