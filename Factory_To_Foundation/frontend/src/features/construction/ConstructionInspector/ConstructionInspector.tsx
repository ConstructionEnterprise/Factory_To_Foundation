import { useEffect, useState } from "react";

import { useSelection } from "@/context/SelectionContext";
import { DetailRow, PanelCard } from "@/framework/ui";

import { FACTORY_NODE, isConstructionProjectId, resolveSite, type SitePrecision } from "../constructionLocations";
import {
  cancelPlacement,
  clearSite,
  setSiteAddress,
  startPlacement,
  useSiteState,
} from "../constructionSiteStore";

const PRECISION_LABEL: Record<SitePrecision, string> = {
  unlocated: "Unlocated — no real location data",
  region: "County-level (approximate)",
  address: "Sited — address assigned",
  sited: "Sited — placed on map",
};

/**
 * "Site this project" — assign/edit an address string and place the
 * project on the Construction Enterprises Map. The address is metadata
 * only (no geocoding service, deliberately); placement is a user-picked
 * map click. Assignments persist to real Postgres via the ff-backend API;
 * clearing falls back to the honest fixture state (county-level for Garden
 * Lofts, unlocated for the rest).
 */
function SiteSection({ projectId }: { projectId: string }) {
  const { overrides, placementFor, loading, error } = useSiteState();
  const site = resolveSite(projectId, overrides);
  const hasOverride = projectId in overrides;
  const placing = placementFor === projectId;

  const [draft, setDraft] = useState(site.address ?? "");
  useEffect(() => {
    setDraft(site.address ?? "");
    // Re-sync the input when the selected project (or its stored address) changes —
    // also fires once the initial GET /construction-sites resolves.
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
              placeholder="e.g. 1200 Main St, Lewisville, TX"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              style={{ borderColor: "var(--ff-panel-border)", color: "var(--ff-text-primary)" }}
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => (placing ? cancelPlacement() : startPlacement(projectId))}
              className="rounded-[0.2rem] px-3 py-1.5 text-xs font-medium text-white"
              style={{ background: placing ? "var(--ff-status-critical)" : "var(--ff-accent)" }}
            >
              {placing ? "Cancel placement" : "Place on map"}
            </button>
            {hasOverride && (
              <button
                type="button"
                onClick={() => clearSite(projectId)}
                className="rounded-[0.2rem] border px-3 py-1.5 text-xs font-medium"
                style={{ borderColor: "var(--ff-panel-border)", color: "var(--ff-text-secondary)" }}
                title="Remove the in-app assignment and fall back to the honest fixture state"
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

export default function ConstructionInspector() {
  const { selected } = useSelection();
  const sel = selected?.feature === "construction" ? selected : undefined;
  const isProject = sel !== undefined && isConstructionProjectId(sel.objectId);
  const isFactory = sel?.objectId === FACTORY_NODE.id;

  return (
    <PanelCard title="Selected Object" className="h-[560px]" bodyClassName="flex-1 overflow-auto p-5">
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
