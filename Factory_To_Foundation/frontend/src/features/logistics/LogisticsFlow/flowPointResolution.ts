import { useEffect, useState } from "react";

import { constructionProjects } from "@/features/construction/constructionData";

import { listDispatches, listTrucks, type LogisticsDispatch, type LogisticsTruck } from "../logisticsOperationsApi";

/**
 * Resolves a FlowPoint's `assetRef` to a real, human-readable name for the
 * two types that carry a real cross-domain reference instead of free text
 * — see frontend/CLAUDE.md's "Logistics Flow" section for the full
 * architecture decision. `load_assignment` points hold a real
 * LogisticsTruck id; `transportation_handoff` points hold a real
 * LogisticsDispatch id (whose own truckId/destinationProjectId resolve
 * further, since Transportation — not Logistics Flow — owns that data).
 * Every other type keeps assetRef's original, unresolved meaning
 * (an id from the Engineering Asset Catalog or elsewhere).
 */
export type FlowAssetLookups = {
  trucks: LogisticsTruck[];
  dispatches: LogisticsDispatch[];
};

export function resolveFlowPointAsset(
  type: string,
  assetRef: string | null,
  { trucks, dispatches }: FlowAssetLookups
): string | null {
  if (!assetRef) return null;

  if (type === "load_assignment") {
    const truck = trucks.find((t) => t.id === assetRef);
    return truck ? truck.identifier : assetRef;
  }

  if (type === "transportation_handoff") {
    const dispatch = dispatches.find((d) => d.id === assetRef);
    if (!dispatch) return assetRef;
    const truck = trucks.find((t) => t.id === dispatch.truckId);
    const project = constructionProjects.find((p) => p.id === dispatch.destinationProjectId);
    const truckLabel = truck ? truck.identifier : dispatch.truckId;
    const destinationLabel = project ? project.title : dispatch.destinationProjectId;
    return `${truckLabel} → ${destinationLabel}`;
  }

  return assetRef;
}

/**
 * Shared fetch-once lookup for the Map/Inspector display consumers (the
 * creation form fetches its own copy inline, only when it actually needs a
 * picker — see AddFlowPointForm.tsx). Real trucks/dispatches, not derived
 * from FlowPoint/FlowConnection state, since this data is owned by
 * Transportation, not Logistics Flow.
 */
export function useFlowAssetLookups(): FlowAssetLookups & { error: string | null } {
  const [trucks, setTrucks] = useState<LogisticsTruck[]>([]);
  const [dispatches, setDispatches] = useState<LogisticsDispatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listTrucks(), listDispatches()])
      .then(([truckRows, dispatchRows]) => {
        setTrucks(truckRows);
        setDispatches(dispatchRows);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return { trucks, dispatches, error };
}
