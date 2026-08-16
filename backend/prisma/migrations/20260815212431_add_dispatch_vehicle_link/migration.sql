
-- AlterTable
ALTER TABLE "logistics_dispatch" ADD COLUMN     "vehicle_id" TEXT;

-- AddForeignKey
ALTER TABLE "logistics_dispatch" ADD CONSTRAINT "logistics_dispatch_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

