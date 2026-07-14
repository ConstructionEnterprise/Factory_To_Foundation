import type { GraphTier } from "./graphData";

/**
 * Ported from CE_Genealogy_AllInOne-5.py (PREFIX_REGISTRY) and cross-checked
 * against CE_QR_Prefix_Registry.docx — the single source of truth mapping
 * an object-type prefix to exactly one tier. Full table, not just the
 * prefixes this thread uses, so future genealogy expansion is a one-line
 * registry entry, not a re-derivation.
 */
export const PREFIX_REGISTRY: Record<string, { tier: GraphTier; name: string }> = {
  // Framing Packages — cut kits of roll-formed steel, consume materials only. Never finished products.
  FPW: { tier: "framing-package", name: "Wall Framing Package" },
  FPF: { tier: "framing-package", name: "Floor Framing Package" },
  FPR: { tier: "framing-package", name: "Roof Framing Package" },
  FPC: { tier: "framing-package", name: "Ceiling Framing Package" },
  // Components — a framing package plus loose materials (e.g. screws). Never finished products.
  EWF: { tier: "component", name: "Exterior Wall Frame" },
  IWF: { tier: "component", name: "Interior Wall Frame" },
  PWF: { tier: "component", name: "Partition Wall Frame" },
  FF: { tier: "component", name: "Floor Frame" },
  RF: { tier: "component", name: "Roof Frame" },
  CF: { tier: "component", name: "Ceiling Frame" },
  // Sub-Assemblies — a component plus materials (sheathing, MEP, insulation, windows). CAN be finished products.
  EWP: { tier: "subassembly", name: "Exterior Wall Panel" },
  IWP: { tier: "subassembly", name: "Interior Wall Panel" },
  PWP: { tier: "subassembly", name: "Partition Wall Panel" },
  FA: { tier: "subassembly", name: "Floor Assembly" },
  RA: { tier: "subassembly", name: "Roof Assembly" },
  CA: { tier: "subassembly", name: "Ceiling Assembly" },
  // Modules — shippable, installable units built from sub-assemblies. CAN be finished products.
  MLV: { tier: "module", name: "Living Module" },
  MBP: { tier: "module", name: "Bath Pod" },
  MEP: { tier: "module", name: "MEP Core" },
};

/** Only Sub-Assembly and Module tiers may be finished products — derived from tier, never flagged manually. */
export const FINISHED_PRODUCT_TIERS: GraphTier[] = ["subassembly", "module"];

export function canBeFinishedProduct(tier: GraphTier): boolean {
  return FINISHED_PRODUCT_TIERS.includes(tier);
}

/** Longest matching registered prefix wins (e.g. EWP before any shorter prefix), so prefixes stay unambiguous. */
function prefixOf(objectCode: string): string | undefined {
  let best: string | undefined;
  for (const prefix of Object.keys(PREFIX_REGISTRY)) {
    if (objectCode.startsWith(prefix) && (!best || prefix.length > best.length)) {
      best = prefix;
    }
  }
  return best;
}

export function tierForObjectCode(objectCode: string): GraphTier | undefined {
  const prefix = prefixOf(objectCode);
  return prefix ? PREFIX_REGISTRY[prefix].tier : undefined;
}

export function nameForObjectCode(objectCode: string): string | undefined {
  const prefix = prefixOf(objectCode);
  return prefix ? PREFIX_REGISTRY[prefix].name : undefined;
}

/** Assembled-object QR: PROJECT-BUILDING-OBJECTCODE-SEQUENCE. e.g. CWF-BLD1-EWP03S-0001 */
export function makeObjectQr(project: string, building: string, objectCode: string, sequence: number): string {
  const code = objectCode.replace(/-/g, "");
  return `${project}-${building}-${code}-${String(sequence).padStart(4, "0")}`;
}

/** Raw material stock QR: PROJECT-STOCK-MATERIALID-SEQUENCE — stock isn't placed in a building yet. */
export function makeMaterialQr(project: string, materialId: string, sequence: number): string {
  const code = materialId.replace(/-/g, "");
  return `${project}-STOCK-${code}-${String(sequence).padStart(4, "0")}`;
}
