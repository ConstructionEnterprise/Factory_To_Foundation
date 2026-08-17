
-- CreateTable
CREATE TABLE "project_quantity_takeoff" (
    "id" TEXT NOT NULL,
    "construction_project_id" TEXT NOT NULL,
    "building_tree_node_id" TEXT,
    "assembly_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "methodology" TEXT NOT NULL,
    "source_notes" TEXT,
    "entered_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_quantity_takeoff_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "project_quantity_takeoff" ADD CONSTRAINT "project_quantity_takeoff_construction_project_id_fkey" FOREIGN KEY ("construction_project_id") REFERENCES "construction_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_quantity_takeoff" ADD CONSTRAINT "project_quantity_takeoff_building_tree_node_id_fkey" FOREIGN KEY ("building_tree_node_id") REFERENCES "construction_tree_node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_quantity_takeoff" ADD CONSTRAINT "project_quantity_takeoff_assembly_id_fkey" FOREIGN KEY ("assembly_id") REFERENCES "cost_assembly"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_quantity_takeoff" ADD CONSTRAINT "project_quantity_takeoff_entered_by_id_fkey" FOREIGN KEY ("entered_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

