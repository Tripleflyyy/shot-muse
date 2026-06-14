import { InspirationCard } from "./inspirationApi";
import { invoke } from "@tauri-apps/api/core";

export type PlanInspirationFilters = {
  keyword?: string | null;
  source_platform?: string | null;
};

export async function attachInspirationToShootingPlan(
  shootingPlanId: string,
  inspirationCardId: string,
): Promise<boolean> {
  return invoke<boolean>("attach_inspiration_to_shooting_plan", {
    shootingPlanId,
    inspirationCardId,
  });
}

export async function detachInspirationFromShootingPlan(
  shootingPlanId: string,
  inspirationCardId: string,
): Promise<boolean> {
  return invoke<boolean>("detach_inspiration_from_shooting_plan", {
    shootingPlanId,
    inspirationCardId,
  });
}

export async function listShootingPlanInspirations(
  shootingPlanId: string,
): Promise<InspirationCard[]> {
  return invoke<InspirationCard[]>("list_shooting_plan_inspirations", {
    shootingPlanId,
  });
}

export async function listAvailableInspirationsForShootingPlan(
  shootingPlanId: string,
  filters: PlanInspirationFilters = {},
): Promise<InspirationCard[]> {
  return invoke<InspirationCard[]>(
    "list_available_inspirations_for_shooting_plan",
    {
      shootingPlanId,
      keyword: filters.keyword ?? null,
      sourcePlatform: filters.source_platform ?? null,
    },
  );
}
