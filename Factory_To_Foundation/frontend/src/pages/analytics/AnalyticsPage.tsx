import { SimplePage } from "@/framework/ui";

import AnalyticsDashboard from "@/features/analytics/AnalyticsDashboard";

export default function AnalyticsPage() {
  return (
    <SimplePage pageLabel="Analytics" pageSubtitle="Business Intelligence — Real Cross-Feature Data">
      <AnalyticsDashboard />
    </SimplePage>
  );
}
