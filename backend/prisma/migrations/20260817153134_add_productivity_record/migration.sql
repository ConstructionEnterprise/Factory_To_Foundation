
-- AlterTable
ALTER TABLE "cost_assembly_component" ADD COLUMN     "productivity_record_id" TEXT;

-- CreateTable
CREATE TABLE "productivity_record" (
    "id" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "crew_size" INTEGER,
    "applicability_notes" TEXT,
    "region" TEXT,
    "source_name" TEXT NOT NULL,
    "source_url" TEXT,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productivity_record_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cost_assembly_component" ADD CONSTRAINT "cost_assembly_component_productivity_record_id_fkey" FOREIGN KEY ("productivity_record_id") REFERENCES "productivity_record"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productivity_record" ADD CONSTRAINT "productivity_record_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

