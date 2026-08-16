import * as repo from "../repositories/inventoryItemRepository";
import * as permissionRepo from "../repositories/permissionRepository";
import type { InventoryItemWithDetail } from "../repositories/inventoryItemRepository";

/**
 * Real Inventory list/detail — the shared identity layer over Asset and
 * GenealogyNode (see schema.prisma's InventoryItem doc comment). No new
 * RBAC module: a caller sees `asset`-kind items only with real
 * `assets:read`, `genealogy_node`-kind items only with real
 * `genealogy:read` — the exact same per-role visibility those two
 * existing modules already grant, not a new/wider permission surface
 * invented for Inventory.
 */

export type InventoryItemDto = {
  id: string;
  title: string;
  kind: string;
  location: string | null;
  asset: {
    id: string;
    category: string;
    family: string;
    status: string;
    manufacturer: string;
    model: string;
    serialNumber: string;
    assetTag: string;
    acquisitionDate: string;
    lastService: string;
    nextService: string | null;
    notes: string | null;
  } | null;
  genealogyNode: {
    id: string;
    tier: string;
    qr: string | null;
  } | null;
};

function toDto(row: InventoryItemWithDetail): InventoryItemDto {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    location: row.location,
    asset: row.asset
      ? {
          id: row.asset.id,
          category: row.asset.category,
          family: row.asset.family,
          status: row.asset.status,
          manufacturer: row.asset.manufacturer,
          model: row.asset.model,
          serialNumber: row.asset.serialNumber,
          assetTag: row.asset.assetTag,
          acquisitionDate: row.asset.acquisitionDate.toISOString(),
          lastService: row.asset.lastService.toISOString(),
          nextService: row.asset.nextService ? row.asset.nextService.toISOString() : null,
          notes: row.asset.notes,
        }
      : null,
    genealogyNode: row.genealogyNode
      ? { id: row.genealogyNode.id, tier: row.genealogyNode.tier, qr: row.genealogyNode.qr }
      : null,
  };
}

async function resolveVisibility(roleId: string): Promise<{ canSeeAssets: boolean; canSeeGenealogy: boolean }> {
  const [canSeeAssets, canSeeGenealogy] = await Promise.all([
    permissionRepo.hasPermission(roleId, "assets", "read"),
    permissionRepo.hasPermission(roleId, "genealogy", "read"),
  ]);
  return { canSeeAssets, canSeeGenealogy };
}

function visibleTo(row: InventoryItemWithDetail, visibility: { canSeeAssets: boolean; canSeeGenealogy: boolean }): boolean {
  if (row.kind === "asset") return visibility.canSeeAssets;
  if (row.kind === "genealogy_node") return visibility.canSeeGenealogy;
  return false;
}

export async function listItems(roleId: string, query?: string): Promise<InventoryItemDto[]> {
  const visibility = await resolveVisibility(roleId);
  const rows = await repo.findAllItems();
  const visible = rows.filter((r) => visibleTo(r, visibility));
  const filtered = query
    ? visible.filter((r) => r.title.toLowerCase().includes(query.toLowerCase()))
    : visible;
  return filtered.map(toDto);
}

export async function getItem(roleId: string, id: string): Promise<InventoryItemDto | null> {
  const row = await repo.findItemById(id);
  if (!row) return null;
  const visibility = await resolveVisibility(roleId);
  if (!visibleTo(row, visibility)) return null;
  return toDto(row);
}
