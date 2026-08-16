-- CreateEnum
CREATE TYPE "AlarmComparator" AS ENUM ('greater_than', 'less_than');

-- CreateEnum
CREATE TYPE "AnalyticsWidgetType" AS ENUM ('metric_graph', 'events_feed', 'existing_summary');

-- CreateTable
CREATE TABLE "analytics_threshold" (
    "id" TEXT NOT NULL,
    "metric_key" TEXT NOT NULL,
    "comparator" "AlarmComparator" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "window_minutes" INTEGER NOT NULL DEFAULT 60,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_threshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_dashboard" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_dashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_dashboard_widget" (
    "id" TEXT NOT NULL,
    "dashboard_id" TEXT NOT NULL,
    "widget_type" "AnalyticsWidgetType" NOT NULL,
    "metric_key" TEXT,
    "summary_widget_key" TEXT,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_dashboard_widget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_threshold_metric_key_key" ON "analytics_threshold"("metric_key");

-- AddForeignKey
ALTER TABLE "analytics_threshold" ADD CONSTRAINT "analytics_threshold_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_dashboard" ADD CONSTRAINT "analytics_dashboard_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_dashboard_widget" ADD CONSTRAINT "analytics_dashboard_widget_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "analytics_dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
