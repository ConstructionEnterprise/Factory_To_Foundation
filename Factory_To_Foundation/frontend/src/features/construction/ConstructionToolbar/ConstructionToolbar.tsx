import { ToolbarButton, ToolbarInput, ToolbarSelect, ToolbarShell } from "@/framework/ui";

export default function ConstructionToolbar() {
  return (
    <ToolbarShell>
      <ToolbarInput placeholder="Search by Building, Module, or ID..." />
      <ToolbarSelect><option>All Buildings</option></ToolbarSelect>
      <ToolbarSelect><option>All Trades</option></ToolbarSelect>
      <ToolbarButton>Filters</ToolbarButton>
      <ToolbarButton>Reset</ToolbarButton>
    </ToolbarShell>
  );
}
