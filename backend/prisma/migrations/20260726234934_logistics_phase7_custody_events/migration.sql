-- CreateTable
CREATE TABLE "logistics_custody_event" (
    "id" TEXT NOT NULL,
    "dispatch_id" TEXT NOT NULL,
    "from_status" "LogisticsStatus",
    "to_status" "LogisticsStatus" NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "logistics_custody_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "logistics_custody_event_dispatch_id_idx" ON "logistics_custody_event"("dispatch_id");

-- AddForeignKey
ALTER TABLE "logistics_custody_event" ADD CONSTRAINT "logistics_custody_event_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "logistics_dispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_custody_event" ADD CONSTRAINT "logistics_custody_event_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
