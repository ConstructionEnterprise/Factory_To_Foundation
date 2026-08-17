
-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('material', 'labor', 'equipment');

-- CreateTable
CREATE TABLE "market_cost_record" (
    "id" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL,
    "item_name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT NOT NULL,
    "unit_cost_cents" INTEGER NOT NULL,
    "region" TEXT,
    "source_name" TEXT NOT NULL,
    "source_url" TEXT,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_cost_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "market_cost_record_category_idx" ON "market_cost_record"("category");

-- AddForeignKey
ALTER TABLE "market_cost_record" ADD CONSTRAINT "market_cost_record_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

