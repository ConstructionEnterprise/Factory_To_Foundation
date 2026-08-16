
-- AlterEnum
ALTER TYPE "InventoryItemKind" ADD VALUE 'logistics_module';

-- AlterTable
ALTER TABLE "logistics_module" ADD COLUMN     "building_tree_node_id" TEXT,
ADD COLUMN     "construction_project_id" TEXT,
ADD COLUMN     "inventory_item_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "logistics_module_inventory_item_id_key" ON "logistics_module"("inventory_item_id");

-- AddForeignKey
ALTER TABLE "logistics_module" ADD CONSTRAINT "logistics_module_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_module" ADD CONSTRAINT "logistics_module_construction_project_id_fkey" FOREIGN KEY ("construction_project_id") REFERENCES "construction_project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_module" ADD CONSTRAINT "logistics_module_building_tree_node_id_fkey" FOREIGN KEY ("building_tree_node_id") REFERENCES "construction_tree_node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

