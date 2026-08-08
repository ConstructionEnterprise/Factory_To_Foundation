import type { MileageRateConfig } from "@prisma/client";

import { prisma } from "../lib/prisma";

/** Every real configured rate, most recently effective first. */
export function findAllRates(): Promise<MileageRateConfig[]> {
  return prisma.mileageRateConfig.findMany({ orderBy: { effectiveDate: "desc" } });
}

/** The real rate that was actually in effect on a given real date — the most recent row whose effectiveDate <= date, or null if none exists yet (honest absence, not a fabricated default). */
export function findLatestRateForDate(date: Date): Promise<MileageRateConfig | null> {
  return prisma.mileageRateConfig.findFirst({
    where: { effectiveDate: { lte: date } },
    orderBy: { effectiveDate: "desc" },
  });
}

export type CreateRateInput = {
  centsPerMile: number;
  effectiveDate: Date;
  createdById: string;
};

export function createRate(data: CreateRateInput): Promise<MileageRateConfig> {
  return prisma.mileageRateConfig.create({
    data: {
      centsPerMile: data.centsPerMile,
      effectiveDate: data.effectiveDate,
      createdById: data.createdById,
    },
  });
}
