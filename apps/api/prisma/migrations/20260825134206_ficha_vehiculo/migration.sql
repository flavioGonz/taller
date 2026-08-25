-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "features" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "vehicle_photos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "angle" "PhotoAngle" NOT NULL DEFAULT 'OTRO',
    "caption" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "workOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_photos_vehicleId_createdAt_idx" ON "vehicle_photos"("vehicleId", "createdAt");

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
