import { ToolbarButton, ToolbarInput, ToolbarSelect, ToolbarShell } from "@/framework/ui";

export default function AssetsToolbar() {
  return (
    <ToolbarShell>
      <ToolbarInput placeholder="Search by Asset or ID..." />
      <ToolbarSelect><option>All Categories</option></ToolbarSelect>
      <ToolbarSelect><option>All Statuses</option></ToolbarSelect>
      <ToolbarButton>Filters</ToolbarButton>
      <ToolbarButton>Reset</ToolbarButton>
    </ToolbarShell>
  );
}
