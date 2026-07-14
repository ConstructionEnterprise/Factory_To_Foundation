type PreviewBoxProps = {
  label?: string;
};

/** Shared empty preview placeholder used across every inspector panel. */
export default function PreviewBox({ label = "Preview Image" }: PreviewBoxProps) {
  return (
    <div
      className="flex h-32 items-center justify-center text-xs"
      style={{
        background: "var(--ff-content-bg)",
        border: "1px solid var(--ff-panel-border)",
        borderRadius: "var(--ff-radius)",
        color: "var(--ff-text-muted)",
      }}
    >
      {label}
    </div>
  );
}
