/*
  Warnings:

  - The `status` column on the `flow_point` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "FlowPointStatus" AS ENUM ('normal', 'held', 'halted');

-- AlterTable
ALTER TABLE "flow_point" DROP COLUMN "status",
ADD COLUMN     "status" "FlowPointStatus" NOT NULL DEFAULT 'normal';

-- CreateTable
CREATE TABLE "flow_point_status_event" (
    "id" TEXT NOT NULL,
    "flow_point_id" TEXT NOT NULL,
    "from_status" "FlowPointStatus",
    "to_status" "FlowPointStatus" NOT NULL,
    "reason" TEXT,
    "changed_by_id" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_point_status_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flow_point_status_event_flow_point_id_idx" ON "flow_point_status_event"("flow_point_id");

-- AddForeignKey
ALTER TABLE "flow_point_status_event" ADD CONSTRAINT "flow_point_status_event_flow_point_id_fkey" FOREIGN KEY ("flow_point_id") REFERENCES "flow_point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_point_status_event" ADD CONSTRAINT "flow_point_status_event_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
