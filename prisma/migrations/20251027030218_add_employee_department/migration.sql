-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "department" VARCHAR(50);

-- AlterTable
ALTER TABLE "Quote" ALTER COLUMN "number" SET DEFAULT nextval('quote_number_seq')::text;

-- CreateIndex
CREATE INDEX "Employee_tenantId_department_idx" ON "Employee"("tenantId", "department");
