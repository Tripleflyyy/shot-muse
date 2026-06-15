import { invoke } from "@tauri-apps/api/core";

export type ShootingPlanStatus = "draft" | "ready" | "completed" | "archived";

export type ShootingPlan = {
  id: string;
  project_id: string;
  project_name: string | null;
  title: string;
  shooting_theme: string | null;
  gear_list: string | null;
  scene_list: string | null;
  action_list: string | null;
  composition_reference: string | null;
  lighting_reference: string | null;
  post_style: string | null;
  technique_notes: string | null;
  notes: string | null;
  cover_media_asset_id: string | null;
  status: ShootingPlanStatus;
  created_at: string;
  updated_at: string;
};

export type ShootingPlanPayload = {
  project_id: string;
  title: string;
  shooting_theme?: string | null;
  gear_list?: string | null;
  scene_list?: string | null;
  action_list?: string | null;
  composition_reference?: string | null;
  lighting_reference?: string | null;
  post_style?: string | null;
  technique_notes?: string | null;
  notes?: string | null;
  status?: ShootingPlanStatus | null;
};

export type ShootingPlanFilters = {
  project_id?: string | null;
  status?: ShootingPlanStatus | null;
  keyword?: string | null;
};

export async function createShootingPlan(
  payload: ShootingPlanPayload,
): Promise<ShootingPlan> {
  return invoke<ShootingPlan>("create_shooting_plan", { payload });
}

export async function updateShootingPlan(
  id: string,
  payload: ShootingPlanPayload,
): Promise<ShootingPlan> {
  return invoke<ShootingPlan>("update_shooting_plan", { id, payload });
}

export async function deleteShootingPlan(id: string): Promise<boolean> {
  if (!id?.trim()) {
    throw new Error("拍摄计划 ID 不能为空，无法删除");
  }

  const deleted = await invoke<boolean>("delete_shooting_plan", { id });
  if (!deleted) {
    throw new Error("未找到要删除的拍摄计划");
  }
  return deleted;
}

export async function updateShootingPlanCover(
  id: string,
  coverMediaAssetId: string | null,
): Promise<ShootingPlan> {
  return invoke<ShootingPlan>("update_shooting_plan_cover", {
    id,
    coverMediaAssetId,
  });
}

export async function getShootingPlan(id: string): Promise<ShootingPlan> {
  return invoke<ShootingPlan>("get_shooting_plan", { id });
}

export async function listShootingPlans(
  filters: ShootingPlanFilters = {},
): Promise<ShootingPlan[]> {
  return invoke<ShootingPlan[]>("list_shooting_plans", { filters });
}

export async function listShootingPlansByProject(
  projectId: string,
): Promise<ShootingPlan[]> {
  return invoke<ShootingPlan[]>("list_shooting_plans_by_project", {
    projectId,
  });
}
