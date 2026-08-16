import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

export type ScheduleSummary = {
  id: string;
  title: string;
  constructionProjectId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  stageCount: number;
  taskCount: number;
};

export type ScheduleTaskSummary = {
  id: string;
  title: string;
  status: string;
  plannedStart: string;
  plannedEnd: string;
};

export type ScheduleStageDetail = {
  id: string;
  title: string;
  position: number;
  canonicalStageId: string | null;
  ownedByModuleId: string | null;
  tasks: ScheduleTaskSummary[];
};

export type ScheduleDetail = {
  id: string;
  title: string;
  constructionProjectId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  stages: ScheduleStageDetail[];
};

export type CanonicalStage = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  order: number;
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${BACKEND_URL}${path}`, init);
  if (!res.ok) throw new Error(await describeResponseError(res));
  return res.json() as Promise<T>;
}

export function fetchSchedules(): Promise<ScheduleSummary[]> {
  return requestJson("/schedules");
}

export function fetchScheduleDetail(id: string): Promise<ScheduleDetail> {
  return requestJson(`/schedules/${id}`);
}

export function createSchedule(title: string, constructionProjectId?: string): Promise<ScheduleSummary> {
  return requestJson("/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, constructionProjectId }),
  });
}

export function createStage(scheduleId: string, title: string, canonicalStageId?: string): Promise<ScheduleDetail> {
  return requestJson(`/schedules/${scheduleId}/stages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, canonicalStageId }),
  });
}

export function reorderStages(scheduleId: string, stageIds: string[]): Promise<ScheduleDetail> {
  return requestJson(`/schedules/${scheduleId}/stages/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stageIds }),
  });
}

export function fetchCanonicalStages(): Promise<CanonicalStage[]> {
  return requestJson("/canonical-stages");
}
