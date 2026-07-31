-- Permissions migration (Option A, true rename) + real Networking module.
--
-- Phase 1: the module that shipped as "networking" (id='networking') in
-- commit 8fdf35e was always the real RBAC/Permissions subsystem wearing the
-- wrong name. This does a true rename: insert a new 'permissions' Module
-- row, repoint every real role_permission row referencing 'networking' to
-- 'permissions', then delete the old row — freeing the 'networking' id to
-- mean networking for the first time. Investigation confirmed exactly 12
-- real role_permission rows reference 'networking' (CEO + Administrator,
-- full grants each) out of 166 total, and zero rows in schedule_stage/
-- schedule_task reference it — so this data migration only ever touches
-- those 12 rows.

INSERT INTO "module" (id, name) VALUES ('permissions', 'Permissions')
  ON CONFLICT (id) DO NOTHING;

UPDATE "role_permission" SET module_id = 'permissions' WHERE module_id = 'networking';

DELETE FROM "module" WHERE id = 'networking';

-- Phase 2: recreate 'networking' as the real IT/OT network-infrastructure
-- module (seed.ts re-seeds its real role grants on next `prisma db seed`).
INSERT INTO "module" (id, name) VALUES ('networking', 'Networking')
  ON CONFLICT (id) DO NOTHING;

-- Real Networking schema — device inventory + VLAN topology, from the real
-- Cisco Packet Tracer diagram (CE_Factory_Production_LAN). Read-only
-- visualization only, per the brief's explicit scope.

CREATE TYPE "NetworkDeviceRole" AS ENUM (
  'firewall', 'core_switch', 'distribution_switch', 'access_switch', 'server',
  'workstation', 'plc', 'remote_io', 'robot_controller', 'hmi', 'vision_system',
  'quality_station', 'scanner', 'shipping_pc', 'access_point', 'tablet', 'laptop',
  'camera', 'door_controller', 'card_reader', 'supervisor_pc', 'printer'
);

CREATE TABLE "network_vlan" (
  "id" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "subnet" TEXT NOT NULL,

  CONSTRAINT "network_vlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "network_vlan_number_key" ON "network_vlan"("number");

CREATE TABLE "network_device" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "NetworkDeviceRole" NOT NULL,
  "model" TEXT,
  "ip_address" TEXT,
  "vlan_id" TEXT,
  "uplink_device_id" TEXT,

  CONSTRAINT "network_device_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "network_device_vlan_id_idx" ON "network_device"("vlan_id");
CREATE INDEX "network_device_uplink_device_id_idx" ON "network_device"("uplink_device_id");

ALTER TABLE "network_device" ADD CONSTRAINT "network_device_vlan_id_fkey"
  FOREIGN KEY ("vlan_id") REFERENCES "network_vlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "network_device" ADD CONSTRAINT "network_device_uplink_device_id_fkey"
  FOREIGN KEY ("uplink_device_id") REFERENCES "network_device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
