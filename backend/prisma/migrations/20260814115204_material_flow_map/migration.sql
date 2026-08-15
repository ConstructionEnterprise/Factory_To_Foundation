-- CreateTable
CREATE TABLE "flow_point" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position_x" DOUBLE PRECISION NOT NULL,
    "position_y" DOUBLE PRECISION NOT NULL,
    "asset_ref" TEXT,
    "status" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_point_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_connection" (
    "id" TEXT NOT NULL,
    "source_point_id" TEXT NOT NULL,
    "target_point_id" TEXT NOT NULL,
    "relationship" TEXT,
    "distance_meters" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flow_connection_source_point_id_idx" ON "flow_connection"("source_point_id");

-- CreateIndex
CREATE INDEX "flow_connection_target_point_id_idx" ON "flow_connection"("target_point_id");

-- AddForeignKey
ALTER TABLE "flow_connection" ADD CONSTRAINT "flow_connection_source_point_id_fkey" FOREIGN KEY ("source_point_id") REFERENCES "flow_point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_connection" ADD CONSTRAINT "flow_connection_target_point_id_fkey" FOREIGN KEY ("target_point_id") REFERENCES "flow_point"("id") ON DELETE CASCADE ON UPDATE CASCADE;
