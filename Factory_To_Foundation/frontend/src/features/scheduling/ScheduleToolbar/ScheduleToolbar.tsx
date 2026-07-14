import { ToolbarButton, ToolbarInput, ToolbarSelect, ToolbarShell } from "@/framework/ui";

export default function ScheduleToolbar() {
  return (
    <ToolbarShell>
      <ToolbarInput placeholder="Search schedules..." />
      <ToolbarSelect><option>All Owners</option></ToolbarSelect>
      <ToolbarButton>Filters</ToolbarButton>
      <ToolbarButton>Reset</ToolbarButton>
    </ToolbarShell>
  );
}
