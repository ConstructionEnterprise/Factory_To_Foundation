import type { ReactNode } from "react";

type WorkspaceStackProps = {
  /** Rendered top-to-bottom, each getting the same real definite height. */
  sections: ReactNode[];
};

/**
 * The real phone-portrait ("Inspection Mode") stacking mechanism, shared
 * by the base `Workspace` and every bespoke multi-panel workspace
 * (`FactoryWorkspace`, `ScheduleWorkspace`) once a real third consumer
 * needed the identical shape - see `Workspace.tsx`'s own doc comment for
 * why each section gets a real height (`workspace-stacked-section`,
 * defined in `Workspace.css`) rather than an unconstrained one.
 */
export default function WorkspaceStack({ sections }: WorkspaceStackProps) {
  return (
    <div className="workspace-stacked">
      {sections.map((section, index) => (
        <div key={index} className="workspace-stacked-section">
          {section}
        </div>
      ))}
    </div>
  );
}
