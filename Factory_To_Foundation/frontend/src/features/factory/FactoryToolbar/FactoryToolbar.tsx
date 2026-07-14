import { ToolbarButton, ToolbarInput, ToolbarSelect, ToolbarShell } from "@/framework/ui";

export default function FactoryToolbar() {
  return (
    <ToolbarShell>
      <ToolbarInput placeholder="Search by Machine, Line, or ID..." />
      <ToolbarSelect><option>All Production Lines</option></ToolbarSelect>
      <ToolbarSelect><option>All Statuses</option></ToolbarSelect>
      <ToolbarSelect><option>All Shifts</option></ToolbarSelect>
      <ToolbarButton>Filters</ToolbarButton>
      <ToolbarButton>Reset</ToolbarButton>
    </ToolbarShell>
  );
}
