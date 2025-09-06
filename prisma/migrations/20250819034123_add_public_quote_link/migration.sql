/*
  Warnings:

  - A unique constraint covering the columns `[publicId]` on the table `Quote` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicId" TEXT,
ALTER COLUMN "number" SET DEFAULT nextval('quote_number_seq')::text;

-- CreateIndex
CREATE UNIQUE INDEX "Quote_publicId_key" ON "Quote"("publicId");
