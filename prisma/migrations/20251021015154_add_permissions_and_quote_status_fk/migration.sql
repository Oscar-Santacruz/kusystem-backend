-- AlterTable
ALTER TABLE "Quote" ALTER COLUMN "number" SET DEFAULT nextval('quote_number_seq')::text;

-- AddForeignKey
ALTER TABLE "QuoteStatusHistory" ADD CONSTRAINT "QuoteStatusHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
