
-- AlterTable
ALTER TABLE "flow_point" ADD COLUMN     "flow_id" TEXT;

-- CreateTable
CREATE TABLE "logistics_flow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "construction_project_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logistics_flow_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "logistics_flow" ADD CONSTRAINT "logistics_flow_construction_project_id_fkey" FOREIGN KEY ("construction_project_id") REFERENCES "construction_project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_flow" ADD CONSTRAINT "logistics_flow_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_point" ADD CONSTRAINT "flow_point_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "logistics_flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

