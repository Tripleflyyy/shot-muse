import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

import {
  createInspirationCard,
  deleteInspirationCard,
  InspirationCard,
  InspirationCardPayload,
  listInspirationCards,
  SourcePlatform,
  updateInspirationCard,
} from "../services/inspirationApi";
import {
  deleteMediaAsset,
  getMediaAssetDisplayUrl,
  importLocalImage,
  listMediaAssetsByTarget,
  MediaAsset,
} from "../services/mediaApi";
import { listTags, Tag, TagCategory } from "../services/tagApi";

type InspirationFormState = {
  title: string;
  source_platform: SourcePlatform;
  source_url: string;
  author_name: string;
  notes: string;
  tag_ids: string[];
};

type InspirationFiltersState = {
  source_platform: "" | SourcePlatform;
  keyword: string;
};

const sourcePlatforms: Array<{ value: SourcePlatform; label: string }> = [
  { value: "douyin", label: "抖音" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "bilibili", label: "B站" },
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram" },
  { value: "other", label: "其他" },
];

const emptyForm: InspirationFormState = {
  title: "",
  source_platform: "xiaohongshu",
  source_url: "",
  author_name: "",
  notes: "",
  tag_ids: [],
};

const emptyFilters: InspirationFiltersState = {
  source_platform: "",
  keyword: "",
};

const tagCategories: Array<{ value: TagCategory; label: string }> = [
  { value: "subject", label: "主体" },
  { value: "lighting", label: "光线" },
  { value: "composition", label: "构图" },
  { value: "color", label: "色彩" },
  { value: "mood", label: "情绪" },
  { value: "technique", label: "技术" },
  { value: "custom", label: "自定义" },
];

export default function InspirationLibraryPage() {
  const [cards, setCards] = useState<InspirationCard[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [form, setForm] = useState<InspirationFormState>(emptyForm);
  const [filters, setFilters] = useState<InspirationFiltersState>(emptyFilters);
  const [tagSearchKeyword, setTagSearchKeyword] = useState("");
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [pendingDeleteCard, setPendingDeleteCard] =
    useState<InspirationCard | null>(null);
  const [cardMedia, setCardMedia] = useState<Record<string, MediaAsset[]>>({});
  const [pendingRemoveMedia, setPendingRemoveMedia] = useState<{
    cardId: string;
    asset: MediaAsset;
  } | null>(null);
  const [imageActionStatus, setImageActionStatus] = useState<{
    cardId: string;
    message: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [importingCardId, setImportingCardId] = useState<string | null>(null);

  const isEditing = editingCardId !== null;
  const selectableTags = useMemo(() => {
    const keyword = tagSearchKeyword.trim().toLowerCase();
    if (!keyword) {
      return tags;
    }

    return tags.filter((tag) =>
      [tag.name, tag.category, categoryLabel(tag.category)]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [tagSearchKeyword, tags]);

  async function loadReferenceData() {
    try {
      setTags(await listTags());
    } catch (error) {
      alert(toErrorMessage(error, "加载标签失败"));
    }
  }

  async function loadCards(nextFilters = filters) {
    setIsLoading(true);
    try {
      const data = await listInspirationCards({
        source_platform: nextFilters.source_platform || null,
        keyword: optionalText(nextFilters.keyword),
        tag_ids: [],
      });
      setCards(data);
      await loadMediaForCards(data);
    } catch (error) {
      alert(toErrorMessage(error, "加载灵感卡片失败"));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMediaForCards(nextCards: InspirationCard[]) {
    if (nextCards.length === 0) {
      setCardMedia({});
      return;
    }

    try {
      const entries = await Promise.all(
        nextCards.map(async (card) => [
          card.id,
          await listMediaAssetsByTarget("inspiration", card.id),
        ] as const),
      );
      setCardMedia(Object.fromEntries(entries));
    } catch (error) {
      console.error("加载灵感图片失败", error);
      alert(toErrorMessage(error, "加载灵感图片失败"));
    }
  }

  async function refreshCardMedia(cardId: string) {
    const media = await listMediaAssetsByTarget("inspiration", cardId);
    setCardMedia((current) => ({ ...current, [cardId]: media }));
  }

  useEffect(() => {
    void loadReferenceData();
    void loadCards(emptyFilters);
    // Run once on page mount; filters are triggered explicitly by the toolbar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim()) {
      alert("灵感标题不能为空");
      return;
    }

    if (!form.source_platform) {
      alert("来源平台不能为空");
      return;
    }

    setIsSaving(true);
    try {
      const payload = toPayload(form);
      if (editingCardId) {
        await updateInspirationCard(editingCardId, payload);
      } else {
        await createInspirationCard(payload);
      }

      resetForm();
      await loadCards();
    } catch (error) {
      alert(
        toErrorMessage(
          error,
          isEditing ? "编辑灵感卡片失败" : "创建灵感卡片失败",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(card: InspirationCard) {
    setEditingCardId(card.id);
    setPendingDeleteCard(null);
    setForm({
      title: card.title,
      source_platform: card.source_platform,
      source_url: card.source_url ?? "",
      author_name: card.author_name ?? "",
      notes: card.notes ?? "",
      tag_ids: card.tags.map((tag) => tag.id),
    });
  }

  function requestDeleteCard(card: InspirationCard) {
    if (!card.id) {
      alert("删除灵感卡片失败：灵感卡片 ID 为空");
      return;
    }

    setPendingDeleteCard(card);
  }

  async function handleAddImage(card: InspirationCard) {
    console.log("add image clicked", card.id);
    setImageActionStatus({
      cardId: card.id,
      message: "正在打开文件选择器...",
    });

    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "图片",
            extensions: ["jpg", "jpeg", "png", "webp"],
          },
        ],
      });

      if (!selected) {
        setImageActionStatus({
          cardId: card.id,
          message: "已取消选择图片",
        });
        return;
      }

      const sourcePath = Array.isArray(selected) ? selected[0] : selected;
      if (!sourcePath) {
        setImageActionStatus({
          cardId: card.id,
          message: "未选择图片",
        });
        return;
      }

      setImportingCardId(card.id);
      await importLocalImage(sourcePath, "inspiration", card.id);
      await refreshCardMedia(card.id);
      setImageActionStatus({
        cardId: card.id,
        message: "图片导入成功",
      });
    } catch (error) {
      console.error("导入图片失败", error);
      const message = toErrorMessage(error, "导入图片失败");
      setImageActionStatus({
        cardId: card.id,
        message,
      });
      alert(message);
    } finally {
      setImportingCardId(null);
    }
  }

  function requestRemoveMedia(cardId: string, asset: MediaAsset) {
    setPendingRemoveMedia({ cardId, asset });
  }

  async function confirmRemoveMedia() {
    if (!pendingRemoveMedia) {
      return;
    }

    const { cardId, asset } = pendingRemoveMedia;

    try {
      await deleteMediaAsset(asset.id);
      setPendingRemoveMedia(null);
      await refreshCardMedia(cardId);
      setImageActionStatus({
        cardId,
        message: "图片已从灵感卡片移除",
      });
    } catch (error) {
      console.error("移除图片失败", error);
      const message = toErrorMessage(error, "移除图片失败");
      setImageActionStatus({
        cardId,
        message,
      });
      alert(message);
    }
  }

  async function confirmDeleteCard() {
    if (!pendingDeleteCard?.id) {
      alert("删除灵感卡片失败：灵感卡片 ID 为空");
      return;
    }

    const card = pendingDeleteCard;

    try {
      await deleteInspirationCard(card.id);
      if (editingCardId === card.id) {
        resetForm();
      }
      setPendingDeleteCard(null);
      setPendingRemoveMedia((current) =>
        current?.cardId === card.id ? null : current,
      );
      await loadCards();
    } catch (error) {
      console.error("删除灵感卡片失败", error);
      alert(toErrorMessage(error, "删除灵感卡片失败"));
    }
  }

  async function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadCards(filters);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    void loadCards(emptyFilters);
  }

  function resetForm() {
    setEditingCardId(null);
    setForm(emptyForm);
  }

  function toggleFormTag(tagId: string) {
    setForm((current) => ({
      ...current,
      tag_ids: current.tag_ids.includes(tagId)
        ? current.tag_ids.filter((id) => id !== tagId)
        : [...current.tag_ids, tagId],
    }));
  }

  return (
    <section className="page-frame">
      <header className="page-header">
        <p className="page-kicker">Library</p>
        <h1 className="page-title">Inspiration Library</h1>
        <p className="page-copy">
          保存摄影灵感来源、作者、备注、项目归属和标签。本阶段暂不处理图片导入。
        </p>
      </header>

      <div className="crud-layout inspiration-layout">
        <form className="form-panel sticky-form-panel" onSubmit={handleSubmit}>
          <div className="section-heading">
            <h2>{isEditing ? "编辑灵感卡片" : "新建灵感卡片"}</h2>
            {isEditing && (
              <button className="text-button" type="button" onClick={resetForm}>
                取消编辑
              </button>
            )}
          </div>

          <label className="field">
            <span>标题 *</span>
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="例如：咖啡馆窗边人像参考"
            />
          </label>

          <label className="field">
            <span>来源平台 *</span>
            <select
              value={form.source_platform}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  source_platform: event.target.value as SourcePlatform,
                }))
              }
            >
              {sourcePlatforms.map((platform) => (
                <option key={platform.value} value={platform.value}>
                  {platform.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>原作品链接</span>
            <input
              value={form.source_url}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  source_url: event.target.value,
                }))
              }
              placeholder="https://..."
            />
          </label>

          <label className="field">
            <span>作者</span>
            <input
              value={form.author_name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  author_name: event.target.value,
                }))
              }
            />
          </label>

          <label className="field">
            <span>备注</span>
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              rows={4}
            />
          </label>

          <div className="field">
            <span>标签</span>
            <div className="tag-picker-panel">
              <input
                value={tagSearchKeyword}
                onChange={(event) => setTagSearchKeyword(event.target.value)}
                placeholder="搜索标签名或分类"
              />
              <div className="tag-chip-cloud">
                {selectableTags.length === 0 ? (
                <p className="empty-message">暂无标签</p>
              ) : (
                selectableTags.map((tag) => (
                  <button
                    className={
                      form.tag_ids.includes(tag.id)
                        ? "tag-manage-chip tag-manage-chip--selected"
                        : "tag-manage-chip"
                    }
                    key={tag.id}
                    style={tagChipStyle(tag)}
                    type="button"
                    onClick={() => toggleFormTag(tag.id)}
                  >
                    <span
                      className="tag-chip-color"
                      style={{ backgroundColor: tag.color ?? "#d6d0c7" }}
                    />
                    <span>#{tag.name}</span>
                  </button>
                ))
              )}
              </div>
            </div>
          </div>

          <button className="primary-button" disabled={isSaving} type="submit">
            {isSaving ? "保存中..." : isEditing ? "保存修改" : "创建灵感"}
          </button>
        </form>

        <section className="list-panel">
          <form
            className="filter-panel search-filter-panel"
            onSubmit={handleFilterSubmit}
          >
            <div className="search-filter-bar">
              <input
                className="search-filter-input"
                value={filters.keyword}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    keyword: event.target.value,
                  }))
                }
                placeholder="搜索标题 / 作者 / 备注 / 链接 / 标签..."
              />
              <select
                className="search-filter-select"
                value={filters.source_platform}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    source_platform: event.target.value as "" | SourcePlatform,
                  }))
                }
              >
                <option value="">全部平台</option>
                {sourcePlatforms.map((platform) => (
                  <option key={platform.value} value={platform.value}>
                    {platform.label}
                  </option>
                ))}
              </select>
              <div className="search-filter-actions">
                <button className="search-filter-button" type="submit">
                  筛选
                </button>
                <button
                  className="search-filter-reset"
                  type="button"
                  onClick={clearFilters}
                >
                  清空
                </button>
              </div>
            </div>
            <p className="filter-result-text">{cards.length} 条灵感结果</p>
          </form>

          {isLoading ? (
            <p className="muted-text">正在加载灵感卡片...</p>
          ) : cards.length === 0 ? (
            <p className="empty-message">暂无灵感卡片。先保存一个灵感来源吧。</p>
          ) : (
            <div className="entity-list inspiration-list">
              {cards.map((card) => (
                <article className="entity-card inspiration-card" key={card.id}>
                  <div className="card-title-row">
                    <div>
                      <h2>{card.title}</h2>
                      <p>
                        {platformLabel(card.source_platform)}
                        {card.author_name ? ` · ${card.author_name}` : ""}
                      </p>
                    </div>
                    <span className="platform-pill">
                      {platformLabel(card.source_platform)}
                    </span>
                  </div>

                  <dl className="compact-meta">
                    <div>
                      <dt>收藏时间</dt>
                      <dd>{formatDateTime(card.collected_at)}</dd>
                    </div>
                    <div>
                      <dt>链接</dt>
                      <dd>
                        {card.source_url ? (
                          <a href={card.source_url}>{card.source_url}</a>
                        ) : (
                          "-"
                        )}
                      </dd>
                    </div>
                  </dl>

                  {card.notes && <p className="note-text">{card.notes}</p>}

                  <div className="media-section">
                    <div className="media-section-header">
                      <strong>图片</strong>
                      <button
                        type="button"
                        onClick={() => void handleAddImage(card)}
                        disabled={importingCardId === card.id}
                      >
                        {importingCardId === card.id ? "导入中..." : "添加图片"}
                      </button>
                    </div>

                    {imageActionStatus?.cardId === card.id && (
                      <p className="media-action-status">
                        {imageActionStatus.message}
                      </p>
                    )}

                    {(cardMedia[card.id] ?? []).length === 0 ? (
                      <p className="media-empty">暂无图片</p>
                    ) : (
                      <div className="media-thumb-grid">
                        {(cardMedia[card.id] ?? []).map((asset) => {
                          const displayUrl = getMediaAssetDisplayUrl(asset);
                          console.log("media asset path", asset.file_path);
                          console.log("media asset display url", displayUrl);

                          return (
                            <div className="media-thumb-item" key={asset.id}>
                              <div className="media-thumb-image-wrap">
                                <img
                                  alt={asset.original_filename ?? "灵感图片"}
                                  src={displayUrl}
                                  onError={(event) => {
                                    console.error("image load failed", {
                                      filePath: asset.file_path,
                                      displayUrl,
                                      asset,
                                    });
                                    event.currentTarget.classList.add("is-broken");
                                    event.currentTarget
                                      .closest(".media-thumb-image-wrap")
                                      ?.classList.add("is-broken");
                                  }}
                                />
                                <span className="media-load-fallback">
                                  图片加载失败
                                </span>
                              </div>
                              <div className="media-thumb-meta">
                                <span>{asset.original_filename ?? "本地图片"}</span>
                                <button
                                  className="text-button"
                                  type="button"
                                  onClick={() => requestRemoveMedia(card.id, asset)}
                                >
                                  移除
                                </button>
                              </div>

                              {pendingRemoveMedia?.asset.id === asset.id && (
                                <div className="inline-confirm">
                                  <p>
                                    确定从灵感卡片中移除图片「
                                    {asset.original_filename ?? "本地图片"}」吗？
                                  </p>
                                  <div className="row-actions">
                                    <button
                                      className="danger-button"
                                      type="button"
                                      onClick={() => void confirmRemoveMedia()}
                                    >
                                      确认移除
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPendingRemoveMedia(null)}
                                    >
                                      取消
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="tag-chip-list">
                    {card.tags.length === 0 ? (
                      <span className="muted-text">未添加标签</span>
                    ) : (
                      card.tags.map((tag) => (
                        <span
                          className="tag-chip"
                          key={tag.id}
                          style={tagChipStyle(tag)}
                        >
                          <span
                            className="tag-dot"
                            style={{ backgroundColor: tag.color ?? "#d6d0c7" }}
                          />
                          {tag.name}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="row-actions">
                    <button type="button" onClick={() => handleEdit(card)}>
                      编辑
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => requestDeleteCard(card)}
                    >
                      删除
                    </button>
                  </div>

                  {pendingDeleteCard?.id === card.id && (
                    <div className="inline-confirm">
                      <p>确定删除灵感卡片「{card.title}」吗？</p>
                      <div className="row-actions">
                        <button
                          className="danger-button"
                          type="button"
                          onClick={() => void confirmDeleteCard()}
                        >
                          确认删除
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingDeleteCard(null);
                          }}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function toPayload(form: InspirationFormState): InspirationCardPayload {
  return {
    title: form.title,
    source_platform: form.source_platform,
    source_url: optionalText(form.source_url),
    author_name: optionalText(form.author_name),
    notes: optionalText(form.notes),
    project_id: null,
    tag_ids: form.tag_ids,
  };
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function platformLabel(platform: SourcePlatform): string {
  return (
    sourcePlatforms.find((item) => item.value === platform)?.label ?? "其他"
  );
}

function categoryLabel(category: TagCategory): string {
  return (
    tagCategories.find((item) => item.value === category)?.label ?? category
  );
}

function tagChipStyle(tag: Tag): CSSProperties {
  const color = isValidHexColor(tag.color) ? tag.color : "#8a6f3d";
  return {
    "--tag-color": color,
    "--tag-bg": softTagBackground(color),
  } as CSSProperties;
}

function isValidHexColor(color: string | null | undefined): color is string {
  return Boolean(color && /^#[0-9A-Fa-f]{6}$/.test(color));
}

function softTagBackground(color: string): string {
  const red = parseInt(color.slice(1, 3), 16);
  const green = parseInt(color.slice(3, 5), 16);
  const blue = parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, 0.12)`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function toErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return message ? `${fallback}：${message}` : fallback;
}
