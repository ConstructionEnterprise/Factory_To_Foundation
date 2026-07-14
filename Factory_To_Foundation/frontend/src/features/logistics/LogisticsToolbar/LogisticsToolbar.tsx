import { ToolbarButton, ToolbarInput, ToolbarSelect, ToolbarShell } from "@/framework/ui";

export default function LogisticsToolbar() {
  return (
    <ToolbarShell>
      <ToolbarInput placeholder="Search by Asset, Module, or ID..." />
      <ToolbarSelect><option>All Zones</option></ToolbarSelect>
      <ToolbarSelect><option>All Statuses</option></ToolbarSelect>
      <ToolbarButton>Filters</ToolbarButton>
      <ToolbarButton>Reset</ToolbarButton>
    </ToolbarShell>
  );
}
