-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InstructionStepStatus" AS ENUM ('planned');

-- CreateEnum
CREATE TYPE "GenealogyTier" AS ENUM ('material', 'framing_package', 'component', 'subassembly', 'module', 'building', 'project');

-- CreateEnum
CREATE TYPE "OwningModule" AS ENUM ('logistics', 'factory', 'construction');

-- CreateEnum
CREATE TYPE "PortDirection" AS ENUM ('input', 'output');

-- CreateTable
CREATE TABLE "module" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruction_set" (
    "id" TEXT NOT NULL,
    "source_object_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "element_spec_json" JSONB,
    "fabrication_notes_json" JSONB,

    CONSTRAINT "instruction_set_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruction_step" (
    "id" TEXT NOT NULL,
    "instruction_set_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "target_subsystem_id" TEXT NOT NULL,
    "real_command_target" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "related_object_id" TEXT,
    "status" "InstructionStepStatus" NOT NULL DEFAULT 'planned',
    "estimated_duration_sec" INTEGER NOT NULL,
    "dispatch_json" JSONB,
    "code_json" JSONB,
    "reachability_issue" TEXT,

    CONSTRAINT "instruction_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruction_execution" (
    "id" TEXT NOT NULL,
    "instruction_step_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ok" BOOLEAN NOT NULL,
    "commands_json" JSONB NOT NULL,
    "twin_frame_at_dispatch" INTEGER,

    CONSTRAINT "instruction_execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring_session" (
    "id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "monitoring_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collision_event" (
    "id" TEXT NOT NULL,
    "monitoring_session_id" TEXT NOT NULL,
    "subsystem_a" TEXT NOT NULL,
    "subsystem_b" TEXT NOT NULL,
    "start_frame" INTEGER NOT NULL,
    "end_frame" INTEGER NOT NULL,
    "max_penetration" DOUBLE PRECISION NOT NULL,
    "samples" INTEGER NOT NULL,
    "ongoing" BOOLEAN NOT NULL,
    "persistent" BOOLEAN NOT NULL,

    CONSTRAINT "collision_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "construction_project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "real_location_source" TEXT,

    CONSTRAINT "construction_project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "construction_site" (
    "project_id" TEXT NOT NULL,
    "address" TEXT,
    "coords_x" DOUBLE PRECISION,
    "coords_z" DOUBLE PRECISION,

    CONSTRAINT "construction_site_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "construction_tree_node" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "title" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "progress" TEXT,
    "trade" TEXT,
    "inspector" TEXT,
    "punch_list_count" TEXT,

    CONSTRAINT "construction_tree_node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genealogy_node" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tier" "GenealogyTier" NOT NULL,
    "qr" TEXT,

    CONSTRAINT "genealogy_node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genealogy_edge" (
    "id" TEXT NOT NULL,
    "from_id" TEXT NOT NULL,
    "to_id" TEXT NOT NULL,

    CONSTRAINT "genealogy_edge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_stage" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "owned_by_module_id" TEXT,

    CONSTRAINT "schedule_stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_port" (
    "id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "port_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "direction" "PortDirection" NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BOOL',

    CONSTRAINT "schedule_port_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_wire" (
    "id" TEXT NOT NULL,
    "from_port_id" TEXT NOT NULL,
    "to_port_id" TEXT NOT NULL,

    CONSTRAINT "schedule_wire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_name_key" ON "role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_permission_role_id_module_id_permission_id_key" ON "role_permission"("role_id", "module_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "genealogy_edge_from_id_to_id_key" ON "genealogy_edge"("from_id", "to_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_port_stage_id_port_key_key" ON "schedule_port"("stage_id", "port_key");

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instruction_step" ADD CONSTRAINT "instruction_step_instruction_set_id_fkey" FOREIGN KEY ("instruction_set_id") REFERENCES "instruction_set"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instruction_execution" ADD CONSTRAINT "instruction_execution_instruction_step_id_fkey" FOREIGN KEY ("instruction_step_id") REFERENCES "instruction_step"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instruction_execution" ADD CONSTRAINT "instruction_execution_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collision_event" ADD CONSTRAINT "collision_event_monitoring_session_id_fkey" FOREIGN KEY ("monitoring_session_id") REFERENCES "monitoring_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "construction_site" ADD CONSTRAINT "construction_site_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "construction_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "construction_tree_node" ADD CONSTRAINT "construction_tree_node_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "construction_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "construction_tree_node" ADD CONSTRAINT "construction_tree_node_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "construction_tree_node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "genealogy_edge" ADD CONSTRAINT "genealogy_edge_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "genealogy_node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "genealogy_edge" ADD CONSTRAINT "genealogy_edge_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "genealogy_node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_stage" ADD CONSTRAINT "schedule_stage_owned_by_module_id_fkey" FOREIGN KEY ("owned_by_module_id") REFERENCES "module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_port" ADD CONSTRAINT "schedule_port_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "schedule_stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_wire" ADD CONSTRAINT "schedule_wire_from_port_id_fkey" FOREIGN KEY ("from_port_id") REFERENCES "schedule_port"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_wire" ADD CONSTRAINT "schedule_wire_to_port_id_fkey" FOREIGN KEY ("to_port_id") REFERENCES "schedule_port"("id") ON DELETE CASCADE ON UPDATE CASCADE;
