import { SimplePage } from "@/framework/ui";

import ReportsLibrary from "@/features/reports/ReportsLibrary";

export default function ReportsPage() {
  return (
    <SimplePage pageLabel="Reports" pageSubtitle="Enterprise Reporting">
      <ReportsLibrary />
    </SimplePage>
  );
}
