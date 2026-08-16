import type { Schedule, ScheduleStage, ScheduleTask } from "@prisma/client";

import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/scheduleRepository";

export type ScheduleSummaryDto = {
  id: string;
  title: string;
  constructionProjectId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  stageCount: number;
  taskCount: number;
};

function toSummaryDto(row: Schedule & { _count: { stages: number; tasks: number } }): ScheduleSummaryDto {
  return {
    id: row.id,
    title: row.title,
    constructionProjectId: row.constructionProjectId,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    stageCount: row._count.stages,
    taskCount: row._count.tasks,
  };
}

export async function listSchedules(): Promise<ScheduleSummaryDto[]> {
  const rows = await repo.findAllSchedules();
  return rows.map(toSummaryDto);
}

export type TaskSummaryDto = {
  id: string;
  title: string;
  status: string;
  plannedStart: string;
  plannedEnd: string;
};

export type StageDto = {
  id: string;
  title: string;
  position: number;
  canonicalStageId: string | null;
  ownedByModuleId: string | null;
  tasks: TaskSummaryDto[];
};

export type ScheduleDetailDto = {
  id: string;
  title: string;
  constructionProjectId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  stages: StageDto[];
};

type StageRow = ScheduleStage & { tasks: Pick<ScheduleTask, "id" | "title" | "status" | "plannedStart" | "plannedEnd">[] };
type ScheduleWithStages = Schedule & { stages: StageRow[] };

function toDetailDto(row: ScheduleWithStages): ScheduleDetailDto {
  return {
    id: row.id,
    title: row.title,
    constructionProjectId: row.constructionProjectId,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    stages: row.stages.map((s) => ({
      id: s.id,
      title: s.title,
      position: s.position,
      canonicalStageId: s.canonicalStageId,
      ownedByModuleId: s.ownedByModuleId,
      tasks: s.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        plannedStart: t.plannedStart.toISOString(),
        plannedEnd: t.plannedEnd.toISOString(),
      })),
    })),
  };
}

export async function getSchedule(id: string): Promise<ScheduleDetailDto> {
  const row = await repo.findScheduleById(id);
  if (!row) throw new NotFoundError(`No real schedule with id "${id}".`);
  return toDetailDto(row);
}

export async function createSchedule(title: string, createdById: string, constructionProjectId: string | null): Promise<ScheduleSummaryDto> {
  if (!title.trim()) throw new ValidationError("Schedule title is required.");
  const row = await repo.createSchedule({ title: title.trim(), createdById, constructionProjectId });
  return toSummaryDto({ ...row, _count: { stages: 0, tasks: 0 } });
}

/** Real, always-append: a new real stage lands at the end of its schedule's real position order, never inserted mid-sequence (reordering is a separate, explicit real action). */
export async function addStage(scheduleId: string, title: string, canonicalStageId: string | null): Promise<ScheduleDetailDto> {
  const schedule = await repo.findScheduleById(scheduleId);
  if (!schedule) throw new NotFoundError(`No real schedule with id "${scheduleId}".`);
  if (!title.trim()) throw new ValidationError("Stage title is required.");

  const position = await repo.countStages(scheduleId);
  await repo.createStage({ scheduleId, title: title.trim(), position, canonicalStageId });

  return getSchedule(scheduleId);
}

/** Real bulk reorder -- the given id list must be exactly this schedule's real stage ids, no more, no fewer, never a partial/guessed order (same discipline as Analytics Phase 3's dashboard-widget reorder). */
export async function reorderStages(scheduleId: string, orderedStageIds: string[]): Promise<ScheduleDetailDto> {
  const schedule = await repo.findScheduleById(scheduleId);
  if (!schedule) throw new NotFoundError(`No real schedule with id "${scheduleId}".`);

  const realIds = new Set(schedule.stages.map((s) => s.id));
  if (orderedStageIds.length !== realIds.size || !orderedStageIds.every((id) => realIds.has(id))) {
    throw new ValidationError("stageIds must be exactly this schedule's real stage ids, each exactly once.");
  }

  await repo.reorderStages(scheduleId, orderedStageIds);
  return getSchedule(scheduleId);
}
