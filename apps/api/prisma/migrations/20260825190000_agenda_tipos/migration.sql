-- La agenda deja de ser sólo de vehículos: también lleva entregas, llegadas de
-- proveedor, pagos y cobros.
CREATE TYPE "AppointmentKind" AS ENUM ('INGRESO', 'ENTREGA', 'ENTREGA_PROVEEDOR', 'PAGO', 'COBRO', 'OTRO');

ALTER TABLE "appointments"
  ADD COLUMN "kind" "AppointmentKind" NOT NULL DEFAULT 'INGRESO',
  ADD COLUMN "title" TEXT,
  ADD COLUMN "amount" DECIMAL(12,2),
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'UYU',
  ADD COLUMN "method" TEXT,
  ADD COLUMN "reference" TEXT,
  ADD COLUMN "supplierId" TEXT,
  ADD COLUMN "partsOrderId" TEXT,
  ADD COLUMN "documentId" TEXT;

CREATE INDEX "appointments_tenantId_kind_idx" ON "appointments"("tenantId", "kind");

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_partsOrderId_fkey"
  FOREIGN KEY ("partsOrderId") REFERENCES "parts_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
