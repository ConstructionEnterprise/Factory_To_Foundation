-- CreateEnum
CREATE TYPE "LogisticsStatus" AS ENUM ('staged', 'in_transit', 'delivered');

-- CreateTable
CREATE TABLE "logistics_material" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER,
    "location" TEXT,

    CONSTRAINT "logistics_material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistics_module" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "dispatch_id" TEXT,

    CONSTRAINT "logistics_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistics_truck" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,

    CONSTRAINT "logistics_truck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistics_driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "logistics_driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistics_dispatch" (
    "id" TEXT NOT NULL,
    "truck_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "destination_project_id" TEXT NOT NULL,
    "status" "LogisticsStatus" NOT NULL DEFAULT 'staged',
    "route" TEXT,
    "traffic" TEXT,
    "dispatched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logistics_dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "logistics_truck_identifier_key" ON "logistics_truck"("identifier");

-- AddForeignKey
ALTER TABLE "logistics_module" ADD CONSTRAINT "logistics_module_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "logistics_dispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_dispatch" ADD CONSTRAINT "logistics_dispatch_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "logistics_truck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_dispatch" ADD CONSTRAINT "logistics_dispatch_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "logistics_driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_dispatch" ADD CONSTRAINT "logistics_dispatch_destination_project_id_fkey" FOREIGN KEY ("destination_project_id") REFERENCES "construction_project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
