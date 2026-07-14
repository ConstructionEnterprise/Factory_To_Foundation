import type { ReactNode } from "react";
import "./ToolbarShell.css";

type ToolbarShellProps = {
  children: ReactNode;
};

/**
 * Shared flat toolbar wrapper — the flush-panel treatment (thin border,
 * no shadow, minimal radius) every feature's toolbar renders through,
 * instead of each toolbar redefining the same card wrapper. Replaces
 * the "mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
 * markup that was previously duplicated across all 8 toolbars.
 */
export function ToolbarShell({ children }: ToolbarShellProps) {
  return (
    <div className="ff-toolbar-shell mt-4">
      <div className="flex items-center gap-2.5 flex-wrap">
        {children}
      </div>
    </div>
  );
}

export function ToolbarInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="ff-toolbar-input" />;
}

export function ToolbarSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="ff-toolbar-select" />;
}

export function ToolbarButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className="ff-toolbar-button" />;
}
