import { prisma } from "../lib/prisma";

const stagesOrdered = {
  stages: {
    orderBy: { position: "asc" as const },
    include: {
      tasks: { select: { id: true, title: true, status: true, plannedStart: true, plannedEnd: true } },
    },
  },
};

export function findAllSchedules() {
  return prisma.schedule.findMany({
    include: { _count: { select: { stages: true, tasks: true } } },
    orderBy: { title: "asc" },
  });
}

export function findScheduleById(id: string) {
  return prisma.schedule.findUnique({ where: { id }, include: stagesOrdered });
}

export type CreateScheduleInput = {
  title: string;
  createdById: string;
  constructionProjectId: string | null;
};

export function createSchedule(input: CreateScheduleInput) {
  return prisma.schedule.create({ data: input });
}

export function countStages(scheduleId: string): Promise<number> {
  return prisma.scheduleStage.count({ where: { scheduleId } });
}

export type CreateStageInput = {
  scheduleId: string;
  title: string;
  position: number;
  canonicalStageId: string | null;
};

export function createStage(input: CreateStageInput) {
  return prisma.scheduleStage.create({ data: input });
}

export function findStagesByScheduleId(scheduleId: string) {
  return prisma.scheduleStage.findMany({ where: { scheduleId }, select: { id: true } });
}

/** Real bulk reorder -- sets position = index for each real stage id, one transaction, same pattern as Analytics Phase 3's dashboard-widget reorder. */
export function reorderStages(scheduleId: string, orderedStageIds: string[]) {
  return prisma.$transaction(
    orderedStageIds.map((id, position) => prisma.scheduleStage.update({ where: { id, scheduleId }, data: { position } }))
  );
}
