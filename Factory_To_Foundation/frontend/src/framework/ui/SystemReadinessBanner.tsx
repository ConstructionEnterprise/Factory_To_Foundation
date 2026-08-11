import { useSystemReadiness } from "./useSystemReadiness";
import StatusBadge from "./StatusBadge";

/**
 * The one authoritative "is FF ready" indicator, mounted once at the app
 * shell level (AppLayout) rather than left as N independent per-widget
 * badges guessing at the same question. Deliberately quiet when ready —
 * only takes up real space when there's something worth telling every
 * page about, since most pages (Manufacturing, Logistics, Construction,
 * Scheduling, Permissions, Networking, Assets, Reports) have nothing to
 * do with Twin at all and shouldn't be interrupted by its state.
 */
export default function SystemReadinessBanner() {
  const readiness = useSystemReadiness();

  if (readiness.ready) return null;

  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium"
      style={{ background: "var(--ff-status-critical)", color: "white" }}
    >
      <StatusBadge label="FF NOT READY" tone="neutral" />
      <span>
        {readiness.reasons.length > 0 ? readiness.reasons.join("; ") : "system readiness unknown"}
      </span>
    </div>
  );
}
