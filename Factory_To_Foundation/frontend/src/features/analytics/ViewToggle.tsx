export type WidgetView = "text" | "chart";

type ViewToggleProps = {
  view: WidgetView;
  onChange: (view: WidgetView) => void;
};

/**
 * Shared Text/Chart toggle -- every Analytics widget (the 12 pre-existing
 * ones, Events, and MetricGraphWidget) gets the same two-view affordance,
 * per Joshua's explicit call (2026-08-16): default view is Chart (that's
 * what he's actually looking for on this page), with Text still one
 * click away for the exact real label/value rows Phase 1 always showed.
 * New widget types should reuse this, not invent their own toggle UI.
 */
export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex overflow-hidden rounded" style={{ border: "1px solid var(--ff-content-bg)" }}>
      <button
        type="button"
        onClick={() => onChange("text")}
        className="px-2 py-0.5 text-xs"
        style={{ background: view === "text" ? "var(--ff-accent)" : "transparent", color: view === "text" ? "#fff" : "var(--ff-text-muted)" }}
      >
        Text
      </button>
      <button
        type="button"
        onClick={() => onChange("chart")}
        className="px-2 py-0.5 text-xs"
        style={{ background: view === "chart" ? "var(--ff-accent)" : "transparent", color: view === "chart" ? "#fff" : "var(--ff-text-muted)" }}
      >
        Chart
      </button>
    </div>
  );
}
