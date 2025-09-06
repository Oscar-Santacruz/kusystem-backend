-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "branchName" TEXT,
ADD COLUMN     "printNotes" BOOLEAN DEFAULT true,
ALTER COLUMN "number" SET DEFAULT nextval('quote_number_seq')::text;

-- CreateTable
CREATE TABLE "QuoteAdditionalCharge" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "QuoteAdditionalCharge_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "ClientBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAdditionalCharge" ADD CONSTRAINT "QuoteAdditionalCharge_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
