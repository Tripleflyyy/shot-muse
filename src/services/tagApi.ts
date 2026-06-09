import { invoke } from "@tauri-apps/api/core";

export type TagCategory =
  | "subject"
  | "lighting"
  | "composition"
  | "color"
  | "mood"
  | "technique"
  | "custom";

export type Tag = {
  id: string;
  name: string;
  category: TagCategory;
  color: string | null;
  is_preset: boolean;
  created_at: string;
  updated_at: string;
};

export type TagUsage = {
  tag: Tag;
  usage_count: number;
};

export type CreateTagPayload = {
  name: string;
  category?: TagCategory | null;
  color?: string | null;
};

export type UpdateTagPayload = {
  name: string;
  category?: TagCategory | null;
};

export async function listTags(category?: TagCategory): Promise<Tag[]> {
  return invoke<Tag[]>("list_tags", { category });
}

export async function createCustomTag(
  payload: CreateTagPayload,
): Promise<Tag> {
  return invoke<Tag>("create_custom_tag", { payload });
}

export async function updateTag(
  id: string,
  payload: UpdateTagPayload,
): Promise<Tag> {
  return invoke<Tag>("update_tag", { id, payload });
}

export async function updateTagColor(
  id: string,
  color?: string | null,
): Promise<Tag> {
  return invoke<Tag>("update_tag_color", { id, color });
}

export async function deleteTag(id: string): Promise<boolean> {
  return invoke<boolean>("delete_tag", { id });
}

export async function listTagsByUsage(
  targetType: "inspiration" = "inspiration",
): Promise<TagUsage[]> {
  return invoke<TagUsage[]>("list_tags_by_usage", {
    targetType,
  });
}
