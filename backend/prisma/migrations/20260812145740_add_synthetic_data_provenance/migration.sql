-- CreateEnum
CREATE TYPE "SyntheticDataSource" AS ENUM ('CE_FORGE');

-- CreateTable
CREATE TABLE "synthetic_data_provenance" (
    "id" TEXT NOT NULL,
    "source" "SyntheticDataSource" NOT NULL,
    "dataset_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "record_type" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "synthetic_data_provenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "synthetic_data_provenance_run_id_idx" ON "synthetic_data_provenance"("run_id");

-- CreateIndex
CREATE INDEX "synthetic_data_provenance_dataset_id_idx" ON "synthetic_data_provenance"("dataset_id");

-- CreateIndex
CREATE INDEX "synthetic_data_provenance_record_type_record_id_idx" ON "synthetic_data_provenance"("record_type", "record_id");
