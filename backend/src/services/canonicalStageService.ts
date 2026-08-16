import * as repo from "../repositories/canonicalStageRepository";

export type CanonicalStageDto = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  order: number;
};

export async function listCanonicalStages(): Promise<CanonicalStageDto[]> {
  const rows = await repo.findAllCanonicalStages();
  return rows.map((r) => ({ id: r.id, title: r.title, subtitle: r.subtitle, description: r.description, order: r.order }));
}
