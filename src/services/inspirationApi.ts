import { invoke } from "@tauri-apps/api/core";

import { Tag, normalizeTag, RawTag } from "./tagApi";

export type SourcePlatform =
  | "douyin"
  | "xiaohongshu"
  | "bilibili"
  | "youtube"
  | "instagram"
  | "other";

export type InspirationCard = {
  id: string;
  title: string;
  source_platform: SourcePlatform;
  source_url: string | null;
  author_name: string | null;
  notes: string | null;
  project_id: string | null;
  project_name: string | null;
  collected_at: string;
  created_at: string;
  updated_at: string;
  tags: Tag[];
};

export type InspirationCardPayload = {
  title: string;
  source_platform: SourcePlatform;
  source_url?: string | null;
  author_name?: string | null;
  notes?: string | null;
  project_id?: string | null;
  collected_at?: string | null;
  tag_ids?: string[];
};

export type InspirationCardFilters = {
  project_id?: string | null;
  source_platform?: SourcePlatform | null;
  keyword?: string | null;
  tag_ids?: string[];
};

type RawInspirationCard = Omit<InspirationCard, "tags"> & {
  tags?: RawTag[];
};

export async function createInspirationCard(
  payload: InspirationCardPayload,
): Promise<InspirationCard> {
  const card = await invoke<RawInspirationCard>("create_inspiration_card", {
    payload,
  });
  return normalizeInspirationCard(card);
}

export async function updateInspirationCard(
  id: string,
  payload: InspirationCardPayload,
): Promise<InspirationCard> {
  const card = await invoke<RawInspirationCard>("update_inspiration_card", {
    id,
    payload,
  });
  return normalizeInspirationCard(card);
}

export async function deleteInspirationCard(id: string): Promise<boolean> {
  if (!id?.trim()) {
    throw new Error("灵感卡片 ID 不能为空，无法删除");
  }

  const deleted = await invoke<boolean>("delete_inspiration_card", { id });
  if (!deleted) {
    throw new Error("未找到要删除的灵感卡片");
  }
  return deleted;
}

export async function getInspirationCard(
  id: string,
): Promise<InspirationCard> {
  const card = await invoke<RawInspirationCard>("get_inspiration_card", { id });
  return normalizeInspirationCard(card);
}

export async function listInspirationCards(
  filters: InspirationCardFilters = {},
): Promise<InspirationCard[]> {
  const cards = await invoke<RawInspirationCard[]>("list_inspiration_cards", {
    filters,
  });
  return cards.map(normalizeInspirationCard);
}

export async function attachTagToInspiration(
  inspirationCardId: string,
  tagId: string,
): Promise<boolean> {
  return invoke<boolean>("attach_tag_to_inspiration", {
    inspirationCardId,
    tagId,
  });
}

export async function detachTagFromInspiration(
  inspirationCardId: string,
  tagId: string,
): Promise<boolean> {
  return invoke<boolean>("detach_tag_from_inspiration", {
    inspirationCardId,
    tagId,
  });
}

export async function attachInspirationToProject(
  projectId: string,
  inspirationCardId: string,
): Promise<boolean> {
  return invoke<boolean>("attach_inspiration_to_project", {
    projectId,
    inspirationCardId,
  });
}

export async function detachInspirationFromProject(
  projectId: string,
  inspirationCardId: string,
): Promise<boolean> {
  return invoke<boolean>("detach_inspiration_from_project", {
    projectId,
    inspirationCardId,
  });
}

export async function listProjectInspirations(
  projectId: string,
): Promise<InspirationCard[]> {
  const cards = await invoke<RawInspirationCard[]>("list_project_inspirations", {
    projectId,
  });
  return cards.map(normalizeInspirationCard);
}

function normalizeInspirationCard(card: RawInspirationCard): InspirationCard {
  return {
    ...card,
    tags: (card.tags ?? []).map(normalizeTag),
  };
}
