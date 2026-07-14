export type StatusTone = "positive" | "warning" | "critical" | "neutral";

type StatusBadgeProps = {
  label: string;
  tone: StatusTone;
};

const TONE_COLOR: Record<StatusTone, string> = {
  positive: "var(--ff-status-positive)",
  warning: "var(--ff-status-warning)",
  critical: "var(--ff-status-critical)",
  neutral: "var(--ff-status-neutral)",
};

const TONE_BG: Record<StatusTone, string> = {
  positive: "#e6efe7",
  warning: "#f5ead9",
  critical: "#f3e0dd",
  neutral: "#eceef1",
};

/**
 * Shared status pill — one consistent visual language for "what state is
 * this thing in" across every inspector (Factory, Robotics, Logistics,
 * Construction, Assets), instead of each panel defining its own
 * status→Tailwind-color map.
 */
export default function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: TONE_BG[tone], color: TONE_COLOR[tone] }}
    >
      {label}
    </span>
  );
}
