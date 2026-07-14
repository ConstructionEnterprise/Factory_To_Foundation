import { ToolbarShell } from "@/framework/ui";

export default function ManufacturingToolbar() {
  return (
    <ToolbarShell>
      <button
        type="button"
        className="rounded-[0.2rem] px-3.5 py-2 text-sm font-medium text-white"
        style={{ background: "var(--ff-accent)" }}
      >
        Import .blend File
      </button>
      <span className="text-xs" style={{ color: "var(--ff-text-muted)" }}>No file imported</span>
    </ToolbarShell>
  );
}
