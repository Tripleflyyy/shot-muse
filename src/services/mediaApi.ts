import { invoke } from "@tauri-apps/api/core";

export type MediaTargetType = "inspiration" | "technique" | "project" | "plan";
export type MediaSourceType = "file_picker" | "clipboard" | "drag_drop";

export type MediaAsset = {
  id: string;
  target_type: MediaTargetType;
  target_id: string | null;
  file_path: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  source_type: MediaSourceType;
  created_at: string;
  updated_at: string;
};

export type MediaAssetPayload = {
  target_type: MediaTargetType;
  target_id?: string | null;
  file_path: string;
  original_filename?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  source_type: MediaSourceType;
};

export type MediaAssetFilters = {
  target_type?: MediaTargetType | null;
  target_id?: string | null;
  source_type?: MediaSourceType | null;
};

export type UpdateMediaAssetTargetPayload = {
  target_type: MediaTargetType;
  target_id?: string | null;
};

export async function createMediaAsset(
  payload: MediaAssetPayload,
): Promise<MediaAsset> {
  return invoke<MediaAsset>("create_media_asset", { payload });
}

export async function getMediaAsset(id: string): Promise<MediaAsset> {
  return invoke<MediaAsset>("get_media_asset", { id });
}

export async function listMediaAssets(
  filters: MediaAssetFilters = {},
): Promise<MediaAsset[]> {
  return invoke<MediaAsset[]>("list_media_assets", { filters });
}

export async function listMediaAssetsByTarget(
  targetType: MediaTargetType,
  targetId: string,
): Promise<MediaAsset[]> {
  return invoke<MediaAsset[]>("list_media_assets_by_target", {
    targetType,
    targetId,
  });
}

export async function updateMediaAssetTarget(
  id: string,
  payload: UpdateMediaAssetTargetPayload,
): Promise<MediaAsset> {
  return invoke<MediaAsset>("update_media_asset_target", { id, payload });
}

export async function deleteMediaAsset(id: string): Promise<boolean> {
  if (!id?.trim()) {
    throw new Error("媒体资源 ID 不能为空，无法删除");
  }

  const deleted = await invoke<boolean>("delete_media_asset", { id });
  if (!deleted) {
    throw new Error("未找到要删除的媒体资源");
  }
  return deleted;
}
