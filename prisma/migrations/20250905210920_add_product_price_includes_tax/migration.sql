-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "priceIncludesTax" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Quote" ALTER COLUMN "number" SET DEFAULT nextval('quote_number_seq')::text;
