import { useSelection } from "@/context/SelectionContext";
import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";

import { translateManifest } from "../twinTranslator";
import { useTwinManifest } from "../useTwinManifest";
import { useTwinState } from "../useTwinState";

/**
 * A flat list of the real twin subsystems from the manifest — no grouping,
 * since the real cell has no "line" concept at all (13 peer subsystems:
 * gantry, roller, tilt, 4 robots, 2 rails, 4 ATCs). The old fixture's
 * Line -> Machines tree was fixture-only and didn't correspond to
 * anything real, so it isn't preserved as a fallback here — no manifest
 * connection means no items, not stale sample data.
 */
export default function FactoryBrowse() {
  const { selected, setSelected } = useSelection();
  const { connected: manifestConnected, manifest } = useTwinManifest();
  const { state } = useTwinState();
  const activeId = selected?.feature === "factory" ? selected.objectId : undefined;

  const liveNodes = manifestConnected && manifest ? translateManifest(manifest, state) : [];
  const items: BrowseListItem[] = liveNodes.map((n) => ({ id: n.node.id, title: n.node.title }));

  return (
    <PanelCard title="Factory" className="h-full">
      <div className="mb-2 flex px-1">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={
            manifestConnected
              ? { background: "var(--ff-status-positive)", color: "white" }
              : { background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }
          }
        >
          {manifestConnected ? "Live Twin Data" : "Twin Offline"}
        </span>
      </div>
      <BrowseList
        items={items}
        activeId={activeId}
        onSelect={(id) => {
          const live = liveNodes.find((n) => n.node.id === id);
          if (!live) return;
          setSelected({
            feature: "factory",
            objectType: live.node.subtitle,
            objectId: live.node.id,
            payload: live.payload,
          });
        }}
      />
    </PanelCard>
  );
}
