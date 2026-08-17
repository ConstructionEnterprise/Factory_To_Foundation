
-- AlterTable
ALTER TABLE "project_quantity_takeoff" ADD COLUMN     "cost_estimate_scenario_id" TEXT;

-- AddForeignKey
ALTER TABLE "project_quantity_takeoff" ADD CONSTRAINT "project_quantity_takeoff_cost_estimate_scenario_id_fkey" FOREIGN KEY ("cost_estimate_scenario_id") REFERENCES "cost_estimate_scenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

