-- CreateEnum
CREATE TYPE "SyntheticDataContentStatus" AS ENUM ('RECOVERED', 'RECONSTRUCTED', 'GENERATED');

-- AlterTable
ALTER TABLE "synthetic_data_provenance" ADD COLUMN     "content_generated_at" TIMESTAMP(3),
ADD COLUMN     "content_generator" TEXT,
ADD COLUMN     "content_status" "SyntheticDataContentStatus";
