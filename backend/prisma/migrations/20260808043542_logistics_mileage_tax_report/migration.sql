-- AlterTable
ALTER TABLE "logistics_dispatch" ADD COLUMN     "tax_reported_at" TIMESTAMP(3),
ADD COLUMN     "tax_reported_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "logistics_dispatch" ADD CONSTRAINT "logistics_dispatch_tax_reported_by_id_fkey" FOREIGN KEY ("tax_reported_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
