import { useEffect, useState } from "react";

import { useSelection } from "@/context/SelectionContext";
import { usePermission } from "@/context/AuthContext";
import { BrowseList, DetailRow, PanelCard, type BrowseListItem } from "@/framework/ui";

import { constructionProjects, findConstructionNode, type ConstructionTreeNode } from "../constructionData";
import { FACTORY_NODE, isConstructionProjectId, resolveSite, type SitePrecision } from "../constructionLocations";
import {
  cancelPlacement,
  clearSite,
  setHoveredSite,
  setSiteAddress,
  startPlacement,
  useSiteState,
} from "../constructionSiteStore";
import { clearDocumentPreview } from "../constructionDocumentPreviewStore";

const PRECISION_LABEL: Record<SitePrecision, string> = {
  unlocated: "Unlocated — no real location data",
  region: "County-level (approximate)",
  address: "Sited — address assigned",
  sited: "Sited — placed on map",
};

function toBrowseItems(nodes: ConstructionTreeNode[]): BrowseListItem[] {
  return nodes.map((node) => ({
    id: node.id,
    title: node.title,
    children: node.children ? toBrowseItems(node.children) : undefined,
  }));
}

/**
 * "Site this project" — assign/edit an address string and place the
 * project on the Construction Enterprises Map. The address is metadata
 * only (no geocoding service, deliberately); placement is a user-picked
 * map click. Assignments persist to real Postgres via the ff-backend API;
 * clearing falls back to the honest fixture state (county-level for Garden
 * Lofts, unlocated for the rest).
 *
 * Unchanged from the old ConstructionInspector.tsx (Construction tab reorg
 * only moved which panel this renders in, not its own behavior).
 */
function SiteSection({ projectId }: { projectId: string }) {
  const { overrides, placementFor, loading, error } = useSiteState();
  const site = resolveSite(projectId, overrides);
  const hasOverride = projectId in overrides;
  const placing = placementFor === projectId;
  const updatePermission = usePermission("construction", "update");
  const deletePermission = usePermission("construction", "delete");

  const [draft, setDraft] = useState(site.address ?? "");
  useEffect(() => {
    setDraft(site.address ?? "");
  }, [projectId, site.address]);

  const commitAddress = () => {
    if ((site.address ?? "") !== draft.trim()) setSiteAddress(projectId, draft);
  };

  return (
    <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--ff-panel-border)" }}>
      <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-secondary)" }}>
        Site this project
      </h3>

      {loading ? (
        <p className="mt-2 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
          Loading site data…
        </p>
      ) : (
        <>
          <div className="mt-2 space-y-0.5">
            <DetailRow label="Placement" value={PRECISION_LABEL[site.precision]} />
            {site.region && <DetailRow label="County" value={`${site.region} County`} />}
          </div>
          <p className="mt-1 text-[0.65rem] leading-snug" style={{ color: "var(--ff-text-muted)" }}>
            {site.source}
          </p>

          <label className="mt-3 block text-[0.65rem] font-medium" style={{ color: "var(--ff-text-secondary)" }}>
            Address (metadata only — placement is picked on the map)
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitAddress}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              disabled={!updatePermission.allowed}
              title={updatePermission.reason}
              placeholder="e.g. 1200 Main St, Lewisville, TX"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm disabled:opacity-60"
              style={{ borderColor: "var(--ff-panel-border)", color: "var(--ff-text-primary)" }}
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => (placing ? cancelPlacement() : startPlacement(projectId))}
              disabled={!updatePermission.allowed}
              title={updatePermission.reason}
              className="rounded-[0.2rem] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              style={{ background: placing ? "var(--ff-status-critical)" : "var(--ff-accent)" }}
            >
              {placing ? "Cancel placement" : "Place on map"}
            </button>
            {hasOverride && (
              <button
                type="button"
                onClick={() => clearSite(projectId)}
                disabled={!deletePermission.allowed}
                className="rounded-[0.2rem] border px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                style={{ borderColor: "var(--ff-panel-border)", color: "var(--ff-text-secondary)" }}
                title={deletePermission.reason ?? "Remove the in-app assignment and fall back to the honest fixture state"}
              >
                Clear site
              </button>
            )}
          </div>
          {placing && (
            <p className="mt-2 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
              Click anywhere on the map to set this project’s location (Esc cancels).
            </p>
          )}
        </>
      )}

      {error && (
        <p className="mt-2 text-[0.65rem]" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Construction tab reorganization — new right panel, "Project Objects."
 * Merges what used to be two separate panels:
 *  - ConstructionBrowse.tsx's tree (Project -> Building/Floor/Floor Plans),
 *    including its two-way hover sync with the map and project/building/
 *    floor selection driving SelectionContext — moved here verbatim.
 *  - ConstructionInspector.tsx's generic detail view (name/progress/trade/
 *    inspector/punchlist), SiteSection, and the Factory-node location
 *    block — moved here verbatim, MINUS the ConstructionDocuments mount,
 *    which relocated to the new left panel (ConstructionProjects.tsx).
 *
 * This is now genuinely "decoupled from documents entirely" — nothing in
 * this file references projectFilesApi/ConstructionDocuments at all.
 *
 * Selecting anything here also clears the document-preview store — moving
 * within the real project/building/floor structure is exactly the
 * "clicking elsewhere" the brief describes as reverting the center panel
 * back to the map.
 */
export default function ConstructionProjectObjects() {
  const { selected, setSelected } = useSelection();
  const { hoveredId } = useSiteState();
  const activeId = selected?.feature === "construction" ? selected.objectId : undefined;

  const sel = selected?.feature === "construction" ? selected : undefined;
  const isProject = sel !== undefined && isConstructionProjectId(sel.objectId);
  const isFactory = sel?.objectId === FACTORY_NODE.id;

  return (
    <PanelCard title="Project Objects" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      <BrowseList
        items={toBrowseItems(constructionProjects)}
        activeId={activeId}
        hoveredId={hoveredId ?? undefined}
        onHover={(id) => setHoveredSite(id && isConstructionProjectId(id) ? id : null)}
        onSelect={(id) => {
          const node = findConstructionNode(id);
          if (!node) return;
          clearDocumentPreview();
          if (node.inspectable) {
            setSelected({
              feature: "construction",
              objectType: node.objectType,
              objectId: node.id,
              payload: { name: node.title, ...node.inspectable },
            });
            return;
          }
          if (node.objectType === "Project") {
            setSelected({
              feature: "construction",
              objectType: "Project",
              objectId: node.id,
              payload: { name: node.title, progress: "—", trade: "—", inspector: "—", punchListCount: "—" },
            });
          }
        }}
      />

      <div className="mt-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>{sel?.payload.name ?? "Nothing Selected"}</h2>
        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>{sel?.objectType ?? "Select an object"}</p>
      </div>

      <div className="mt-5 space-y-0.5">
        <DetailRow label="Progress" value={sel?.payload.progress ?? "--"} />
        <DetailRow label="Trade" value={sel?.payload.trade ?? "--"} />
        <DetailRow label="Inspector" value={sel?.payload.inspector ?? "--"} />
        <DetailRow label="Punch List" value={sel?.payload.punchListCount ?? "--"} />
      </div>

      {isProject && <SiteSection projectId={sel.objectId} />}

      {isFactory && (
        <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--ff-panel-border)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-secondary)" }}>
            Location
          </h3>
          <div className="mt-2 space-y-0.5">
            <DetailRow label="Address" value={FACTORY_NODE.address} />
            <DetailRow label="County" value={`${FACTORY_NODE.region} County`} />
          </div>
          <p className="mt-1 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
            Real, fixed location — the F»F hub every delivery corridor starts from.
          </p>
        </div>
      )}
    </PanelCard>
  );
}
