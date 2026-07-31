-- CreateEnum
CREATE TYPE "ScheduleTaskStatus" AS ENUM ('planned', 'in_progress', 'complete', 'blocked');

-- CreateTable
CREATE TABLE "user_preference" (
    "user_id" TEXT NOT NULL,
    "workspace_json" JSONB,
    "appearance_json" JSONB,
    "notifications_json" JSONB,
    "accessibility_json" JSONB,
    "preferences_json" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preference_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "schedule_task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage_id" TEXT,
    "owned_by_module_id" TEXT,
    "planned_start" TIMESTAMP(3) NOT NULL,
    "planned_end" TIMESTAMP(3) NOT NULL,
    "actual_start" TIMESTAMP(3),
    "actual_end" TIMESTAMP(3),
    "status" "ScheduleTaskStatus" NOT NULL DEFAULT 'planned',

    CONSTRAINT "schedule_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_task_dependency" (
    "id" TEXT NOT NULL,
    "predecessor_id" TEXT NOT NULL,
    "successor_id" TEXT NOT NULL,

    CONSTRAINT "schedule_task_dependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_task_status_event" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "from_status" "ScheduleTaskStatus",
    "to_status" "ScheduleTaskStatus" NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "schedule_task_status_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_document" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT,
    "subcategory" TEXT,
    "file_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "original_filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "s3_key" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" TEXT,

    CONSTRAINT "compliance_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_task_stage_id_idx" ON "schedule_task"("stage_id");

-- CreateIndex
CREATE INDEX "schedule_task_owned_by_module_id_idx" ON "schedule_task"("owned_by_module_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_task_dependency_predecessor_id_successor_id_key" ON "schedule_task_dependency"("predecessor_id", "successor_id");

-- CreateIndex
CREATE INDEX "schedule_task_status_event_task_id_idx" ON "schedule_task_status_event"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_document_s3_key_key" ON "compliance_document"("s3_key");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_document_file_id_version_key" ON "compliance_document"("file_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "instruction_set_source_object_id_generated_at_key" ON "instruction_set"("source_object_id", "generated_at");

-- CreateIndex
CREATE UNIQUE INDEX "instruction_step_instruction_set_id_sequence_key" ON "instruction_step"("instruction_set_id", "sequence");

-- AddForeignKey
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_task" ADD CONSTRAINT "schedule_task_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "schedule_stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_task" ADD CONSTRAINT "schedule_task_owned_by_module_id_fkey" FOREIGN KEY ("owned_by_module_id") REFERENCES "module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_task_dependency" ADD CONSTRAINT "schedule_task_dependency_predecessor_id_fkey" FOREIGN KEY ("predecessor_id") REFERENCES "schedule_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_task_dependency" ADD CONSTRAINT "schedule_task_dependency_successor_id_fkey" FOREIGN KEY ("successor_id") REFERENCES "schedule_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_task_status_event" ADD CONSTRAINT "schedule_task_status_event_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "schedule_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_task_status_event" ADD CONSTRAINT "schedule_task_status_event_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_document" ADD CONSTRAINT "compliance_document_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_document" ADD CONSTRAINT "compliance_document_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

