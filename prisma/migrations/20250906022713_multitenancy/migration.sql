/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,taxId]` on the table `Client` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,sku]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,number]` on the table `Quote` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tenantId` to the `Client` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `ClientBranch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Quote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `QuoteAdditionalCharge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `QuoteItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Quote_number_key";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "tenantId" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "ClientBranch" ADD COLUMN     "tenantId" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "tenantId" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "tenantId" BIGINT NOT NULL,
ALTER COLUMN "number" SET DEFAULT nextval('quote_number_seq')::text;

-- AlterTable
ALTER TABLE "QuoteAdditionalCharge" ADD COLUMN     "tenantId" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN     "tenantId" BIGINT NOT NULL;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Client_tenantId_idx" ON "Client"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_tenantId_taxId_key" ON "Client"("tenantId", "taxId");

-- CreateIndex
CREATE INDEX "ClientBranch_tenantId_idx" ON "ClientBranch"("tenantId");

-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "Product"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "Quote_tenantId_idx" ON "Quote"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_tenantId_number_key" ON "Quote"("tenantId", "number");

-- CreateIndex
CREATE INDEX "QuoteAdditionalCharge_tenantId_idx" ON "QuoteAdditionalCharge"("tenantId");

-- CreateIndex
CREATE INDEX "QuoteItem_tenantId_idx" ON "QuoteItem"("tenantId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBranch" ADD CONSTRAINT "ClientBranch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAdditionalCharge" ADD CONSTRAINT "QuoteAdditionalCharge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
