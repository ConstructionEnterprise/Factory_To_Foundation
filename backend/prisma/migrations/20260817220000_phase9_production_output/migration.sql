-- CreateEnum
CREATE TYPE "ProductionRunStatus" AS ENUM ('in_progress', 'complete');

-- CreateEnum
CREATE TYPE "ProductionOutputStatus" AS ENUM ('in_production', 'complete');

-- CreateEnum
CREATE TYPE "QcStatus" AS ENUM ('pending', 'passed', 'failed');

-- AlterEnum
ALTER TYPE "InventoryItemKind" ADD VALUE 'production_output';

-- DropForeignKey
ALTER TABLE "logistics_material" DROP CONSTRAINT "logistics_material_inventory_item_id_fkey";

-- AlterTable
ALTER TABLE "logistics_module" ADD COLUMN     "production_output_id" TEXT;

-- CreateTable
CREATE TABLE "production_run" (
    "id" TEXT NOT NULL,
    "assembly_id" TEXT NOT NULL,
    "cell_ref" TEXT,
    "status" "ProductionRunStatus" NOT NULL DEFAULT 'in_progress',
    "planned_quantity" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_output" (
    "id" TEXT NOT NULL,
    "production_run_id" TEXT NOT NULL,
    "assembly_id" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "destination_project_id" TEXT,
    "destination_tree_node_id" TEXT,
    "status" "ProductionOutputStatus" NOT NULL DEFAULT 'in_production',
    "qc_status" "QcStatus" NOT NULL DEFAULT 'pending',
    "produced_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_output_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_output_status_event" (
    "id" TEXT NOT NULL,
    "production_output_id" TEXT NOT NULL,
    "from_status" "ProductionOutputStatus",
    "to_status" "ProductionOutputStatus" NOT NULL,
    "from_qc_status" "QcStatus",
    "to_qc_status" "QcStatus",
    "reason" TEXT,
    "changed_by_id" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_output_status_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_output_serial_number_key" ON "production_output"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "production_output_inventory_item_id_key" ON "production_output"("inventory_item_id");

-- CreateIndex
CREATE INDEX "production_output_status_event_production_output_id_idx" ON "production_output_status_event"("production_output_id");

-- CreateIndex
CREATE UNIQUE INDEX "logistics_module_production_output_id_key" ON "logistics_module"("production_output_id");

-- AddForeignKey
ALTER TABLE "production_run" ADD CONSTRAINT "production_run_assembly_id_fkey" FOREIGN KEY ("assembly_id") REFERENCES "cost_assembly"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_run" ADD CONSTRAINT "production_run_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_output" ADD CONSTRAINT "production_output_production_run_id_fkey" FOREIGN KEY ("production_run_id") REFERENCES "production_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_output" ADD CONSTRAINT "production_output_assembly_id_fkey" FOREIGN KEY ("assembly_id") REFERENCES "cost_assembly"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_output" ADD CONSTRAINT "production_output_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_output" ADD CONSTRAINT "production_output_destination_project_id_fkey" FOREIGN KEY ("destination_project_id") REFERENCES "construction_project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_output" ADD CONSTRAINT "production_output_destination_tree_node_id_fkey" FOREIGN KEY ("destination_tree_node_id") REFERENCES "construction_tree_node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_output" ADD CONSTRAINT "production_output_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_output_status_event" ADD CONSTRAINT "production_output_status_event_production_output_id_fkey" FOREIGN KEY ("production_output_id") REFERENCES "production_output"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_output_status_event" ADD CONSTRAINT "production_output_status_event_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_material" ADD CONSTRAINT "logistics_material_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_module" ADD CONSTRAINT "logistics_module_production_output_id_fkey" FOREIGN KEY ("production_output_id") REFERENCES "production_output"("id") ON DELETE SET NULL ON UPDATE CASCADE;

