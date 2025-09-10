-- AlterTable
ALTER TABLE "Quote" ALTER COLUMN "number" SET DEFAULT nextval('quote_number_seq')::text;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;
