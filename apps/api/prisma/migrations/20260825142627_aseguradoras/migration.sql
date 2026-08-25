-- CreateEnum
CREATE TYPE "PartsPolicy" AS ENUM ('ORIGINAL', 'ALTERNATIVO', 'USADO', 'MIXTO');

-- CreateEnum
CREATE TYPE "PartsSuppliedBy" AS ENUM ('TALLER', 'ASEGURADORA', 'MIXTO');

-- CreateEnum
CREATE TYPE "InvoiceTo" AS ENUM ('ASEGURADORA', 'CLIENTE', 'MIXTO');

-- CreateEnum
CREATE TYPE "DeductibleCollectedBy" AS ENUM ('TALLER', 'ASEGURADORA', 'NO_APLICA');

-- CreateEnum
CREATE TYPE "AuthorizationChannel" AS ENUM ('PORTAL', 'EMAIL', 'TELEFONO', 'APP', 'PERITO_PRESENCIAL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "AuthorizationStatus" AS ENUM ('SIN_ENVIAR', 'ENVIADO', 'EN_ANALISIS', 'AUTORIZADO', 'AUTORIZADO_PARCIAL', 'RECHAZADO', 'VENCIDO');

-- AlterTable
ALTER TABLE "parts" ADD COLUMN     "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "insurers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "logoFile" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "claimsPhone" TEXT,
    "claimsEmail" TEXT,
    "portalUrl" TEXT,
    "worksAuto" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'catalog',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurer_terms" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "requiresAuthorization" BOOLEAN NOT NULL DEFAULT true,
    "authorizationChannel" "AuthorizationChannel" NOT NULL DEFAULT 'EMAIL',
    "authorizationSlaHours" INTEGER,
    "requiresClaimNumber" BOOLEAN NOT NULL DEFAULT true,
    "requiresAdjuster" BOOLEAN NOT NULL DEFAULT true,
    "requiresPhotos" BOOLEAN NOT NULL DEFAULT true,
    "minPhotos" INTEGER NOT NULL DEFAULT 6,
    "requiresDamageMap" BOOLEAN NOT NULL DEFAULT true,
    "requiresQuoteFormat" TEXT,
    "requiredDocuments" JSONB NOT NULL DEFAULT '[]',
    "partsPolicy" "PartsPolicy" NOT NULL DEFAULT 'MIXTO',
    "partsSuppliedBy" "PartsSuppliedBy" NOT NULL DEFAULT 'TALLER',
    "partsMarkupPct" DECIMAL(5,2),
    "requiresPartsQuotes" INTEGER NOT NULL DEFAULT 0,
    "laborRate" DECIMAL(12,2),
    "laborDiscountPct" DECIMAL(5,2),
    "partsDiscountPct" DECIMAL(5,2),
    "currency" TEXT NOT NULL DEFAULT 'UYU',
    "invoiceTo" "InvoiceTo" NOT NULL DEFAULT 'ASEGURADORA',
    "deductibleBy" "DeductibleCollectedBy" NOT NULL DEFAULT 'TALLER',
    "paymentTermDays" INTEGER NOT NULL DEFAULT 30,
    "retentionPct" DECIMAL(5,2),
    "maxRepairDays" INTEGER,
    "warrantyDays" INTEGER NOT NULL DEFAULT 90,
    "agreementRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurer_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurer_contacts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_cases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "policyNumber" TEXT,
    "claimNumber" TEXT,
    "claimDate" TIMESTAMP(3),
    "adjusterName" TEXT,
    "adjusterPhone" TEXT,
    "adjusterVisitAt" TIMESTAMP(3),
    "deductible" DECIMAL(12,2),
    "deductibleBy" "DeductibleCollectedBy" NOT NULL DEFAULT 'TALLER',
    "insurerAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "customerAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "AuthorizationStatus" NOT NULL DEFAULT 'SIN_ENVIAR',
    "authorizationRef" TEXT,
    "authorizedAmount" DECIMAL(12,2),
    "authorizedAt" TIMESTAMP(3),
    "authorizedBy" TEXT,
    "sentAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "documents" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insurers_name_idx" ON "insurers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "insurers_tenantId_slug_key" ON "insurers"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "insurer_terms_insurerId_key" ON "insurer_terms"("insurerId");

-- CreateIndex
CREATE INDEX "insurer_terms_tenantId_idx" ON "insurer_terms"("tenantId");

-- CreateIndex
CREATE INDEX "insurer_contacts_insurerId_idx" ON "insurer_contacts"("insurerId");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_cases_workOrderId_key" ON "insurance_cases"("workOrderId");

-- CreateIndex
CREATE INDEX "insurance_cases_tenantId_status_idx" ON "insurance_cases"("tenantId", "status");

-- CreateIndex
CREATE INDEX "insurance_cases_insurerId_idx" ON "insurance_cases"("insurerId");

-- AddForeignKey
ALTER TABLE "insurer_terms" ADD CONSTRAINT "insurer_terms_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "insurers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurer_contacts" ADD CONSTRAINT "insurer_contacts_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "insurers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_cases" ADD CONSTRAINT "insurance_cases_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_cases" ADD CONSTRAINT "insurance_cases_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "insurers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
