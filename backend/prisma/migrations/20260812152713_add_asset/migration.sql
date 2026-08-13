-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('active', 'maintenance', 'retired');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('Vehicles', 'Equipment', 'Tools', 'Infrastructure');

-- CreateTable
CREATE TABLE "asset" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "family" TEXT NOT NULL,
    "status" "AssetStatus" NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "asset_tag" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "acquisition_date" TIMESTAMP(3) NOT NULL,
    "last_service" TIMESTAMP(3) NOT NULL,
    "next_service" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_serial_number_key" ON "asset"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "asset_asset_tag_key" ON "asset"("asset_tag");
