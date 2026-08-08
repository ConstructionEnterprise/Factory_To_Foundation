-- AlterTable
ALTER TABLE "logistics_dispatch" ADD COLUMN     "business_purpose" TEXT,
ADD COLUMN     "miles" DOUBLE PRECISION,
ADD COLUMN     "odometer_end" DOUBLE PRECISION,
ADD COLUMN     "odometer_start" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "mileage_rate_config" (
    "id" TEXT NOT NULL,
    "cents_per_mile" DOUBLE PRECISION NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,

    CONSTRAINT "mileage_rate_config_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "mileage_rate_config" ADD CONSTRAINT "mileage_rate_config_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
