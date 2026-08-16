
-- CreateEnum
CREATE TYPE "ModuleSequenceStatus" AS ENUM ('pending', 'site_arrival', 'site_acceptance', 'installation', 'placement', 'complete');

-- CreateTable
CREATE TABLE "module_sequence_entry" (
    "id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "construction_project_id" TEXT NOT NULL,
    "building_tree_node_id" TEXT NOT NULL,
    "status" "ModuleSequenceStatus" NOT NULL DEFAULT 'pending',
    "sequence_position" INTEGER,
    "source_dispatch_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_sequence_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_sequence_dependency" (
    "id" TEXT NOT NULL,
    "blocking_entry_id" TEXT NOT NULL,
    "blocked_entry_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_sequence_dependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_sequence_event" (
    "id" TEXT NOT NULL,
    "sequence_entry_id" TEXT NOT NULL,
    "from_status" "ModuleSequenceStatus",
    "to_status" "ModuleSequenceStatus" NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "module_sequence_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "module_sequence_entry_inventory_item_id_key" ON "module_sequence_entry"("inventory_item_id");

-- CreateIndex
CREATE INDEX "module_sequence_entry_construction_project_id_idx" ON "module_sequence_entry"("construction_project_id");

-- CreateIndex
CREATE INDEX "module_sequence_entry_building_tree_node_id_idx" ON "module_sequence_entry"("building_tree_node_id");

-- CreateIndex
CREATE UNIQUE INDEX "module_sequence_dependency_blocking_entry_id_blocked_entry__key" ON "module_sequence_dependency"("blocking_entry_id", "blocked_entry_id");

-- CreateIndex
CREATE INDEX "module_sequence_event_sequence_entry_id_idx" ON "module_sequence_event"("sequence_entry_id");

-- AddForeignKey
ALTER TABLE "module_sequence_entry" ADD CONSTRAINT "module_sequence_entry_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_sequence_entry" ADD CONSTRAINT "module_sequence_entry_construction_project_id_fkey" FOREIGN KEY ("construction_project_id") REFERENCES "construction_project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_sequence_entry" ADD CONSTRAINT "module_sequence_entry_building_tree_node_id_fkey" FOREIGN KEY ("building_tree_node_id") REFERENCES "construction_tree_node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_sequence_dependency" ADD CONSTRAINT "module_sequence_dependency_blocking_entry_id_fkey" FOREIGN KEY ("blocking_entry_id") REFERENCES "module_sequence_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_sequence_dependency" ADD CONSTRAINT "module_sequence_dependency_blocked_entry_id_fkey" FOREIGN KEY ("blocked_entry_id") REFERENCES "module_sequence_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_sequence_event" ADD CONSTRAINT "module_sequence_event_sequence_entry_id_fkey" FOREIGN KEY ("sequence_entry_id") REFERENCES "module_sequence_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_sequence_event" ADD CONSTRAINT "module_sequence_event_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

