type KpiCardProps = {
  title: string;
  value: string;
};

export default function KpiCard({ title, value }: KpiCardProps) {
  return (
    <div
      className="h-24 flex flex-col justify-between p-3.5"
      style={{
        background: "var(--ff-panel-bg)",
        border: "1px solid var(--ff-panel-border)",
        borderRadius: "var(--ff-radius)",
      }}
    >
      <p className="text-xs font-medium" style={{ color: "var(--ff-text-muted)" }}>
        {title}
      </p>

      <h2 className="text-2xl font-bold" style={{ color: "var(--ff-text-primary)" }}>
        {value}
      </h2>
    </div>
  );
}
