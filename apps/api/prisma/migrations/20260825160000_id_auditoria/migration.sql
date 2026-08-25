-- Identificador de auditoría inmutable por reparación.
-- Se agrega nullable, se rellenan las OT existentes y recién ahí se exige.
ALTER TABLE "work_orders" ADD COLUMN "auditId" TEXT;

-- Backfill: TS-XXXX-XXXX con alfabeto legible (sin 0/1/I/L/O/U)
DO $$
DECLARE
  r RECORD;
  alfabeto TEXT := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  codigo TEXT;
  i INT;
BEGIN
  FOR r IN SELECT "id" FROM "work_orders" WHERE "auditId" IS NULL LOOP
    LOOP
      codigo := 'TS-';
      FOR i IN 1..4 LOOP
        codigo := codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
      END LOOP;
      codigo := codigo || '-';
      FOR i IN 1..4 LOOP
        codigo := codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "work_orders" WHERE "auditId" = codigo);
    END LOOP;
    UPDATE "work_orders" SET "auditId" = codigo WHERE "id" = r."id";
  END LOOP;
END $$;

ALTER TABLE "work_orders" ALTER COLUMN "auditId" SET NOT NULL;
CREATE UNIQUE INDEX "work_orders_auditId_key" ON "work_orders"("auditId");
