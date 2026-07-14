type LegendProps = {
  /** A real CSS color (e.g. "var(--ff-tier-material)") — not a Tailwind class, so it can read the muted design tokens directly. */
  color: string;
  label: string;
};

/** A single legend swatch: colored dot + label. Used by any viewport that needs a status/tier key. */
export default function Legend({ color, label }: LegendProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: color }}
      ></div>
      <span className="text-xs" style={{ color: "var(--ff-text-secondary)" }}>{label}</span>
    </div>
  );
}
