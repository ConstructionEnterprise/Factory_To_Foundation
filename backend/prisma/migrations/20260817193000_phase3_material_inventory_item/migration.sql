
-- AlterEnum
ALTER TYPE "InventoryItemKind" ADD VALUE 'material';

-- AlterTable
ALTER TABLE "logistics_material" ADD COLUMN     "inventory_item_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "logistics_material_inventory_item_id_key" ON "logistics_material"("inventory_item_id");

-- AddForeignKey
ALTER TABLE "logistics_material" ADD CONSTRAINT "logistics_material_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
