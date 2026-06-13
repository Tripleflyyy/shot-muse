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
  const tags = await invoke<RawTag[]>("list_tags", { category });
  return tags.map(normalizeTag);
}

export async function createCustomTag(
  payload: CreateTagPayload,
): Promise<Tag> {
  const tag = await invoke<RawTag>("create_custom_tag", { payload });
  return normalizeTag(tag);
}

export async function updateTag(
  id: string,
  payload: UpdateTagPayload,
): Promise<Tag> {
  const tag = await invoke<RawTag>("update_tag", { id, payload });
  return normalizeTag(tag);
}

export async function updateTagColor(
  id: string,
  color?: string | null,
): Promise<Tag> {
  const tag = await invoke<RawTag>("update_tag_color", { id, color });
  return normalizeTag(tag);
}

export async function deleteTag(id: string): Promise<boolean> {
  if (!id?.trim()) {
    throw new Error("标签 ID 不能为空，无法删除");
  }

  const deleted = await invoke<boolean>("delete_tag", { id });
  if (!deleted) {
    throw new Error("未找到要删除的标签");
  }
  return deleted;
}

export async function listTagsByUsage(
  targetType: "inspiration" = "inspiration",
): Promise<TagUsage[]> {
  const usages = await invoke<Array<{ tag: RawTag; usage_count: number }>>(
    "list_tags_by_usage",
    {
      targetType,
    },
  );
  return usages.map((usage) => ({
    ...usage,
    tag: normalizeTag(usage.tag),
  }));
}

type RawTag = Omit<Tag, "is_preset"> & {
  is_preset?: boolean | number | string;
  isPreset?: boolean | number | string;
};

function normalizeTag(tag: RawTag): Tag {
  const isPresetValue = tag.is_preset ?? tag.isPreset ?? false;
  return {
    ...tag,
    is_preset:
      isPresetValue === true || isPresetValue === 1 || isPresetValue === "1",
  };
}
