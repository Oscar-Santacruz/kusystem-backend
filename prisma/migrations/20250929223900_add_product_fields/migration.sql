-- AlterTable
ALTER TABLE "Product" ADD COLUMN "description" TEXT,
ADD COLUMN "barcode" VARCHAR(100),
ADD COLUMN "cost" DECIMAL(18,2),
ADD COLUMN "stock" DECIMAL(18,2),
ADD COLUMN "minStock" DECIMAL(18,2),
ADD COLUMN "imageUrl" TEXT;
