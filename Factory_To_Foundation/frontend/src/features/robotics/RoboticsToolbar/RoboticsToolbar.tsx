import { ToolbarButton, ToolbarInput, ToolbarSelect, ToolbarShell } from "@/framework/ui";

export default function RoboticsToolbar() {
  return (
    <ToolbarShell>
      <ToolbarInput placeholder="Search by Cell, Tool, or ID..." />
      <ToolbarSelect><option>All Subsystems</option></ToolbarSelect>
      <ToolbarSelect><option>All Statuses</option></ToolbarSelect>
      <ToolbarButton>Filters</ToolbarButton>
      <ToolbarButton>Reset</ToolbarButton>
    </ToolbarShell>
  );
}
