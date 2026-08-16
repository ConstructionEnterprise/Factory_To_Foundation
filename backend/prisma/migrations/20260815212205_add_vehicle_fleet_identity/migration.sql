
-- CreateEnum
CREATE TYPE "VehicleClass" AS ENUM ('truck', 'autonomous_dolly', 'trailer', 'forklift');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('active', 'maintenance', 'retired');

-- AlterEnum
ALTER TYPE "InventoryItemKind" ADD VALUE 'vehicle';

-- AlterTable
ALTER TABLE "logistics_truck" ADD COLUMN     "vehicle_id" TEXT;

-- CreateTable
CREATE TABLE "vehicle" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "vehicle_class" "VehicleClass" NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'active',
    "location" TEXT,
    "inventory_item_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_identifier_key" ON "vehicle"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_inventory_item_id_key" ON "vehicle"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "logistics_truck_vehicle_id_key" ON "logistics_truck"("vehicle_id");

-- AddForeignKey
ALTER TABLE "logistics_truck" ADD CONSTRAINT "logistics_truck_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

