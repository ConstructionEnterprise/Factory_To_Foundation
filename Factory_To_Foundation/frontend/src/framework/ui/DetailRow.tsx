type DetailRowProps = {
  label: string;
  value: string;
};

/** A single labeled key/value line, used across inspector panels. */
export default function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div
      className="flex justify-between py-1.5 text-xs"
      style={{ borderBottom: "1px solid var(--ff-content-bg)" }}
    >
      <span style={{ color: "var(--ff-text-muted)" }}>{label}</span>
      <span className="font-medium" style={{ color: "var(--ff-text-primary)" }}>{value}</span>
    </div>
  );
}
