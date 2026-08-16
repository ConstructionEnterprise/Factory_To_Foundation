-- CreateEnum
CREATE TYPE "InventoryItemKind" AS ENUM ('asset', 'genealogy_node');

-- AlterTable
ALTER TABLE "asset" ADD COLUMN     "inventory_item_id" TEXT;

-- AlterTable
ALTER TABLE "genealogy_node" ADD COLUMN     "inventory_item_id" TEXT;

-- CreateTable
CREATE TABLE "inventory_item" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "InventoryItemKind" NOT NULL,
    "location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_inventory_item_id_key" ON "asset"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "genealogy_node_inventory_item_id_key" ON "genealogy_node"("inventory_item_id");

-- AddForeignKey
ALTER TABLE "genealogy_node" ADD CONSTRAINT "genealogy_node_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

