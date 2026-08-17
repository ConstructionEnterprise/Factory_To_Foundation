
-- CreateTable
CREATE TABLE "cost_assembly" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT,
    "assumption_notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_assembly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_assembly_component" (
    "id" TEXT NOT NULL,
    "assembly_id" TEXT NOT NULL,
    "market_cost_record_id" TEXT NOT NULL,
    "quantity_per_unit" DOUBLE PRECISION NOT NULL,
    "quantity_source_name" TEXT NOT NULL,
    "quantity_notes" TEXT,

    CONSTRAINT "cost_assembly_component_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cost_assembly_component_assembly_id_market_cost_record_id_key" ON "cost_assembly_component"("assembly_id", "market_cost_record_id");

-- AddForeignKey
ALTER TABLE "cost_assembly" ADD CONSTRAINT "cost_assembly_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_assembly_component" ADD CONSTRAINT "cost_assembly_component_assembly_id_fkey" FOREIGN KEY ("assembly_id") REFERENCES "cost_assembly"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_assembly_component" ADD CONSTRAINT "cost_assembly_component_market_cost_record_id_fkey" FOREIGN KEY ("market_cost_record_id") REFERENCES "market_cost_record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

