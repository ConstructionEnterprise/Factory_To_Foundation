import type { MileageRateConfig } from "@prisma/client";

import { ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/mileageRateRepository";

/**
 * Real, configurable IRS standard mileage rate — see schema.prisma's own
 * doc comment on MileageRateConfig for the full real reasoning (effective-
 * dated, never a single hardcoded scalar, never seeded with a guessed
 * real-world number). This service is the one place a real rate is read
 * back for a real trip date — Phase 2's CSV export is the first real
 * consumer of getRateForDate().
 */
export type MileageRateDto = {
  id: string;
  centsPerMile: number;
  effectiveDate: string;
  createdAt: string;
  createdById: string | null;
};

function toDto(row: MileageRateConfig): MileageRateDto {
  return {
    id: row.id,
    centsPerMile: row.centsPerMile,
    effectiveDate: row.effectiveDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
    createdById: row.createdById,
  };
}

export async function listRates(): Promise<MileageRateDto[]> {
  const rows = await repo.findAllRates();
  return rows.map(toDto);
}

export type CreateRateInput = {
  centsPerMile: number;
  effectiveDate: string;
  createdById: string;
};

export async function createRate(input: CreateRateInput): Promise<MileageRateDto> {
  if (input.centsPerMile <= 0) {
    throw new ValidationError("centsPerMile must be a real positive rate.");
  }
  const effectiveDate = new Date(input.effectiveDate);
  if (Number.isNaN(effectiveDate.getTime())) {
    throw new ValidationError("effectiveDate must be a real, valid date.");
  }

  const row = await repo.createRate({
    centsPerMile: input.centsPerMile,
    effectiveDate,
    createdById: input.createdById,
  });
  return toDto(row);
}

/** The real rate in effect for a given real trip date, or null if no real rate has been configured yet for that date — honest absence, never a fabricated fallback (e.g. never silently substitutes $0.00 or "the current rate" for a trip that predates every configured rate). */
export async function getRateForDate(date: Date): Promise<MileageRateDto | null> {
  const row = await repo.findLatestRateForDate(date);
  return row ? toDto(row) : null;
}
