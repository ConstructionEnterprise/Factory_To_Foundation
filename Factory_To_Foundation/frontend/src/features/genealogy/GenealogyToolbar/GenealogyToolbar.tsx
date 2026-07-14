import { ToolbarButton, ToolbarInput, ToolbarSelect, ToolbarShell } from "@/framework/ui";

export default function GenealogyToolbar() {
  return (
    <ToolbarShell>
      <ToolbarInput placeholder="Search by QR, Name, or ID..." />
      <ToolbarSelect><option>All Object Types</option></ToolbarSelect>
      <ToolbarSelect><option>All Projects</option></ToolbarSelect>
      <ToolbarSelect><option>All Locations</option></ToolbarSelect>
      <ToolbarSelect><option>All Statuses</option></ToolbarSelect>
      <ToolbarButton>Filters</ToolbarButton>
      <ToolbarButton>Reset</ToolbarButton>
    </ToolbarShell>
  );
}
