import { useSelection } from "@/context/SelectionContext";
import { Legend, PanelCard } from "@/framework/ui";
import { Viewport, ViewportControls } from "@/framework/viewport";

import FactoryCanvas from "./FactoryCanvas";
import { getLiveFactoryBounds, translateManifest, type FactoryNodeData } from "../twinTranslator";
import { useTwinManifest } from "../useTwinManifest";
import { useTwinState } from "../useTwinState";

// Shown only while no manifest has ever been read — Viewport still needs
// some bounds to mount with.
const EMPTY_BOUNDS = { minX: 0, maxX: 400, minY: 0, maxY: 200 };

/**
 * Interactive factory floor layout. Same shell as the genealogy graph —
 * PanelCard + Viewport (framework camera) + a domain-specific canvas —
 * reusing framework/viewport rather than a second implementation.
 *
 * Manifest-driven: every node comes from the twin's real subsystem
 * manifest, not a fixture. No manifest connection means no nodes — there
 * is no fixture fallback left to show instead.
 */
export default function FactoryLayout() {
  const { selected, setSelected } = useSelection();
  const { connected: manifestConnected, manifest } = useTwinManifest();
  const { state } = useTwinState();

  const liveNodes = manifestConnected && manifest ? translateManifest(manifest, state) : [];
  const nodes: FactoryNodeData[] = liveNodes.map((n) => n.node);
  const bounds = liveNodes.length ? getLiveFactoryBounds(liveNodes) : EMPTY_BOUNDS;

  const handleSelectNode = (node: FactoryNodeData) => {
    const live = liveNodes.find((n) => n.node.id === node.id);
    if (!live) return;
    setSelected({
      feature: "factory",
      objectType: node.subtitle,
      objectId: node.id,
      payload: live.payload,
    });
  };

  const selectedFactoryId =
    selected?.feature === "factory" ? selected.objectId : undefined;

  return (
    <PanelCard
      title="Factory Layout"
      className="h-[560px]"
      bodyClassName="flex flex-col flex-1"
    >

      {/* Legend + data-source indicator */}

      <div className="flex flex-wrap items-center gap-6 px-6 py-4 border-b border-gray-100">
        <Legend color="var(--ff-status-positive)" label="Running" />
        <Legend color="var(--ff-status-warning)" label="Idle" />
        <Legend color="var(--ff-status-critical)" label="Down" />
        <Legend color="var(--ff-text-muted)" label="No Live Data" />
        <span
          className="ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={
            manifestConnected
              ? { background: "var(--ff-status-positive)", color: "white" }
              : { background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }
          }
        >
          {manifestConnected ? "Live Twin Data" : "Twin Offline"}
        </span>
      </div>

      {/* Floor Viewport */}

      <div className="relative flex-1">
        <Viewport contentBounds={bounds}>
          <FactoryCanvas
            nodes={nodes}
            selectedId={selectedFactoryId}
            onSelectNode={handleSelectNode}
          />
          <ViewportControls />
        </Viewport>
      </div>

    </PanelCard>
  );
}
