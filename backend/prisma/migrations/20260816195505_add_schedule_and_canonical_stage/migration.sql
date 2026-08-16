-- AlterTable
ALTER TABLE "schedule_stage" ADD COLUMN     "canonical_stage_id" TEXT,
ADD COLUMN     "position" INTEGER NOT NULL,
ADD COLUMN     "schedule_id" TEXT NOT NULL,
ALTER COLUMN "subtitle" DROP NOT NULL,
ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "schedule_task" ADD COLUMN     "schedule_id" TEXT;

-- CreateTable
CREATE TABLE "schedule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "construction_project_id" TEXT,

    CONSTRAINT "schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical_stage" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "canonical_stage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "canonical_stage_title_key" ON "canonical_stage"("title");

-- CreateIndex
CREATE INDEX "schedule_stage_schedule_id_idx" ON "schedule_stage"("schedule_id");

-- CreateIndex
CREATE INDEX "schedule_task_schedule_id_idx" ON "schedule_task"("schedule_id");

-- AddForeignKey
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_construction_project_id_fkey" FOREIGN KEY ("construction_project_id") REFERENCES "construction_project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_stage" ADD CONSTRAINT "schedule_stage_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_stage" ADD CONSTRAINT "schedule_stage_canonical_stage_id_fkey" FOREIGN KEY ("canonical_stage_id") REFERENCES "canonical_stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_task" ADD CONSTRAINT "schedule_task_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
