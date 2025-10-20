-- CreateTable
CREATE TABLE "QuoteStatusHistory" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "fromStatus" VARCHAR(20),
    "toStatus" VARCHAR(20) NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" BIGINT NOT NULL,

    CONSTRAINT "QuoteStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteStatusHistory_quoteId_idx" ON "QuoteStatusHistory"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteStatusHistory_tenantId_idx" ON "QuoteStatusHistory"("tenantId");

-- AddForeignKey
ALTER TABLE "QuoteStatusHistory" ADD CONSTRAINT "QuoteStatusHistory_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
