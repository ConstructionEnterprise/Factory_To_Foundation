import { Handle, Position, type NodeProps } from "@xyflow/react";

/**
 * A small, generic differentiation palette — deliberately NOT the Genealogy
 * tier tokens (--ff-tier-*), since those carry their own real Genealogy-tier
 * meaning and reusing them here for an unrelated taxonomy would be
 * misleading. Deliberately NOT a hardcoded type->color map either, since
 * FlowPoint.type is an intentionally open, extensible vocabulary (see
 * logisticsFlowApi.ts's SUGGESTED_FLOW_POINT_TYPES doc comment) — a stable
 * string hash picks a color from this palette instead, so a brand-new type
 * string a user types in gets a real, stable (if arbitrary) color without
 * any code change.
 */
const NODE_ACCENT_PALETTE = ["#d9631e", "#2f80c4", "#6b8e4e", "#a2559c", "#c0392b", "#5b7a99", "#b8763f", "#4a7c74"];

function accentForType(type: string): string {
  let hash = 0;
  for (let i = 0; i < type.length; i++) hash = (hash * 31 + type.charCodeAt(i)) >>> 0;
  return NODE_ACCENT_PALETTE[hash % NODE_ACCENT_PALETTE.length];
}

/**
 * Real operational-status color language (Phase 5, 2026-08-17) —
 * green/yellow/red, per the explicit spec: normal = operating, held =
 * constrained (with a real reason), halted = emergency stop. Only applied
 * when this node is rendered inside a single, flow-scoped live monitor
 * (`effectiveStatus` present) — the unscoped cross-flow view has no real
 * per-flow blockage graph to derive it from, so it stays neutral there.
 */
export const STATUS_COLOR: Record<string, string> = {
  normal: "var(--ff-status-positive)",
  held: "var(--ff-status-warning)",
  halted: "var(--ff-status-critical)",
};

export type FlowMapNodeData = {
  name: string;
  type: string;
  status: string | null;
  /** Real, blockage-propagated status (Phase 5) — undefined outside a flow-scoped live monitor. */
  effectiveStatus?: string;
  blockedBy?: string[];
  assetRef: string | null;
  /** Real resolved display name for assetRef (see flowPointResolution.ts) — set only for load_assignment/transportation_handoff; null otherwise, falls back to assetRef. */
  resolvedAssetLabel: string | null;
};

/**
 * Real node for Logistics Flow's react-flow graph — same custom-node
 * pattern as Genealogy's GenealogyFlowNode.tsx, styled inline (no dedicated
 * CSS file) since this node's visual surface is small. Left/right handles
 * (not top/bottom like Genealogy's tree) since flow reads naturally
 * left-to-right, not as a hierarchy.
 */
export default function FlowMapNode({ data, selected }: NodeProps & { data: FlowMapNodeData }) {
  const accent = accentForType(data.type);
  const statusColor = data.effectiveStatus ? STATUS_COLOR[data.effectiveStatus] : undefined;
  const constrainedOnly = data.effectiveStatus && data.effectiveStatus !== "normal" && data.status === "normal";
  return (
    <div
      className="rounded-md border-2 px-3 py-2 shadow-sm"
      style={{
        width: 200,
        background: "var(--ff-content-bg)",
        borderColor: statusColor ?? (selected ? "var(--ff-accent)" : "var(--ff-panel-border)"),
        borderLeftColor: accent,
        borderLeftWidth: 5,
        boxShadow: selected ? "0 0 0 2px var(--ff-accent)" : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="truncate text-sm font-semibold" style={{ color: "var(--ff-text-primary)" }} title={data.name}>
        {data.name}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className="text-[0.65rem] font-medium uppercase tracking-wide" style={{ color: accent }}>
          {data.type}
        </span>
        {data.effectiveStatus ? (
          <span
            className="rounded px-1 text-[0.6rem] font-semibold uppercase"
            style={{ background: statusColor, color: "white" }}
            title={constrainedOnly ? "Constrained by a downstream hold/halt" : undefined}
          >
            {data.status === data.effectiveStatus ? data.effectiveStatus : `${data.effectiveStatus} (backed up)`}
          </span>
        ) : (
          data.status &&
          data.status !== "normal" && (
            <span className="rounded px-1 text-[0.6rem]" style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-secondary)" }}>
              {data.status}
            </span>
          )
        )}
      </div>
      {data.assetRef && (
        <div
          className="mt-0.5 truncate text-[0.6rem]"
          style={{ color: "var(--ff-text-muted)" }}
          title={data.resolvedAssetLabel ? `${data.resolvedAssetLabel} (${data.assetRef})` : `References asset: ${data.assetRef}`}
        >
          {data.resolvedAssetLabel ?? `asset: ${data.assetRef}`}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}
