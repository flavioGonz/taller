-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "estimatedDays" INTEGER,
ADD COLUMN     "pdfUrl" TEXT,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "warrantyDays" INTEGER DEFAULT 90;
