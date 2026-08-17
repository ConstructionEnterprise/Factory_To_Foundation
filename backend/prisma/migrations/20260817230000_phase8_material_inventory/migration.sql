-- CreateEnum
CREATE TYPE "MaterialInventoryEventType" AS ENUM ('receive', 'reserve', 'release', 'consume');

-- AlterTable: add new columns first so the real existing `quantity` data
-- can be preserved into quantity_on_hand before the old column is dropped.
ALTER TABLE "logistics_material" ADD COLUMN     "material_catalog_item_id" TEXT,
ADD COLUMN     "quantity_consumed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quantity_on_hand" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quantity_reserved" INTEGER NOT NULL DEFAULT 0;

-- Data-preserving backfill: every real existing LogisticsMaterial row's
-- old `quantity` becomes its real starting quantity_on_hand, reserved/
-- consumed correctly starting at 0 for pre-Phase-8 data.
UPDATE "logistics_material" SET "quantity_on_hand" = COALESCE("quantity", 0);

-- AlterTable
ALTER TABLE "logistics_material" DROP COLUMN "quantity";

-- AlterTable
ALTER TABLE "market_cost_record" ADD COLUMN     "material_catalog_item_id" TEXT;

-- AlterTable
ALTER TABLE "production_run" ADD COLUMN     "source_dimensions" JSONB,
ADD COLUMN     "source_extras" JSONB,
ADD COLUMN     "source_model_node_id" TEXT;

-- CreateTable
CREATE TABLE "material_catalog_item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_catalog_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_inventory_event" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "event_type" "MaterialInventoryEventType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "production_run_id" TEXT,
    "reason" TEXT,
    "changed_by_id" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_inventory_event_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "market_cost_record" ADD CONSTRAINT "market_cost_record_material_catalog_item_id_fkey" FOREIGN KEY ("material_catalog_item_id") REFERENCES "material_catalog_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_material" ADD CONSTRAINT "logistics_material_material_catalog_item_id_fkey" FOREIGN KEY ("material_catalog_item_id") REFERENCES "material_catalog_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_catalog_item" ADD CONSTRAINT "material_catalog_item_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_inventory_event" ADD CONSTRAINT "material_inventory_event_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "logistics_material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_inventory_event" ADD CONSTRAINT "material_inventory_event_production_run_id_fkey" FOREIGN KEY ("production_run_id") REFERENCES "production_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_inventory_event" ADD CONSTRAINT "material_inventory_event_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
