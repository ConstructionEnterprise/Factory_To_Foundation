
-- CreateTable
CREATE TABLE "cost_estimate_scenario" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "square_footage" DOUBLE PRECISION NOT NULL,
    "rate_per_square_foot_cents" INTEGER NOT NULL,
    "overhead_percent" DOUBLE PRECISION,
    "markup_percent" DOUBLE PRECISION,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_estimate_scenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cost_estimate_scenario_project_id_idx" ON "cost_estimate_scenario"("project_id");

-- AddForeignKey
ALTER TABLE "cost_estimate_scenario" ADD CONSTRAINT "cost_estimate_scenario_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "construction_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_estimate_scenario" ADD CONSTRAINT "cost_estimate_scenario_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

