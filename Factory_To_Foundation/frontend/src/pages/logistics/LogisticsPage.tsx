import { useState } from "react";

import { FeaturePage, KpiList, type KpiDefinition } from "@/framework/ui";

import {
  LogisticsBrowse,
  LogisticsDispatchForm,
  LogisticsDispatchTracker,
  LogisticsInspector,
  LogisticsMap,
  LogisticsToolbar,
} from "@/features/logistics";

const logisticsKpis: KpiDefinition[] = [
  { title: "Modules Staged", value: "14" },
  { title: "In Transit", value: "2" },
  { title: "Dock Utilization", value: "68%" },
  { title: "Deliveries (MTD)", value: "37" },
];

export default function LogisticsPage() {
  // Real, provisional Dispatch-creation entry point — see
  // LogisticsDispatchForm's own doc comment for why it lives here (a
  // modal triggered from the toolbar) rather than in a real Browse
  // Logistics panel, which Phase 8 hasn't built yet.
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  // Real, provisional chain-of-custody tracker — same reasoning, see
  // LogisticsDispatchTracker's own doc comment (Phase 7).
  const [showDispatchTracker, setShowDispatchTracker] = useState(false);

  return (
    <>
      <FeaturePage
        pageLabel="Logistics"
        pageSubtitle="Material & Module Flow"
        kpis={<KpiList kpis={logisticsKpis} />}
        toolbar={
          <LogisticsToolbar
            onNewDispatch={() => setShowDispatchForm(true)}
            onTrackDispatches={() => setShowDispatchTracker(true)}
          />
        }
        left={<LogisticsBrowse />}
        center={<LogisticsMap />}
        right={<LogisticsInspector />}
      />
      {showDispatchForm && (
        <LogisticsDispatchForm
          onClose={() => setShowDispatchForm(false)}
          onCreated={() => {
            // No real dispatch list is rendered anywhere yet (Phase 8) —
            // nothing to refresh this pass. Kept as an explicit no-op
            // callback (not omitted) so a future real list only has to
            // fill this in, not restructure the call site.
          }}
        />
      )}
      {showDispatchTracker && <LogisticsDispatchTracker onClose={() => setShowDispatchTracker(false)} />}
    </>
  );
}
