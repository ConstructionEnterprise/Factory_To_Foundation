-- AlterTable
ALTER TABLE "genealogy_node" ADD COLUMN     "construction_project_id" TEXT;

-- AddForeignKey
ALTER TABLE "genealogy_node" ADD CONSTRAINT "genealogy_node_construction_project_id_fkey" FOREIGN KEY ("construction_project_id") REFERENCES "construction_project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
