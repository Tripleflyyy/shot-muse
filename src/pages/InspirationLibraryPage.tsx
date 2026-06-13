import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  createInspirationCard,
  deleteInspirationCard,
  InspirationCard,
  InspirationCardPayload,
  listInspirationCards,
  SourcePlatform,
  updateInspirationCard,
} from "../services/inspirationApi";
import { listProjects, Project } from "../services/projectApi";
import { listTags, Tag } from "../services/tagApi";

type InspirationFormState = {
  title: string;
  source_platform: SourcePlatform;
  source_url: string;
  author_name: string;
  notes: string;
  project_id: string;
  tag_ids: string[];
};

type InspirationFiltersState = {
  project_id: string;
  source_platform: "" | SourcePlatform;
  keyword: string;
  tag_id: string;
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
  project_id: "",
  tag_ids: [],
};

const emptyFilters: InspirationFiltersState = {
  project_id: "",
  source_platform: "",
  keyword: "",
  tag_id: "",
};

export default function InspirationLibraryPage() {
  const [cards, setCards] = useState<InspirationCard[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [form, setForm] = useState<InspirationFormState>(emptyForm);
  const [filters, setFilters] = useState<InspirationFiltersState>(emptyFilters);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [pendingDeleteCard, setPendingDeleteCard] =
    useState<InspirationCard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = editingCardId !== null;

  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  async function loadReferenceData() {
    try {
      const [projectData, tagData] = await Promise.all([
        listProjects(),
        listTags(),
      ]);
      setProjects(projectData);
      setTags(tagData);
    } catch (error) {
      alert(toErrorMessage(error, "加载项目或标签失败"));
    }
  }

  async function loadCards(nextFilters = filters) {
    setIsLoading(true);
    try {
      const data = await listInspirationCards({
        project_id: optionalText(nextFilters.project_id),
        source_platform: nextFilters.source_platform || null,
        keyword: optionalText(nextFilters.keyword),
        tag_ids: nextFilters.tag_id ? [nextFilters.tag_id] : [],
      });
      setCards(data);
    } catch (error) {
      alert(toErrorMessage(error, "加载灵感卡片失败"));
    } finally {
      setIsLoading(false);
    }
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
      project_id: card.project_id ?? "",
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
            <span>所属项目</span>
            <select
              value={form.project_id}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  project_id: event.target.value,
                }))
              }
            >
              <option value="">不关联项目</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
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
            <div className="checkbox-grid">
              {tags.length === 0 ? (
                <p className="empty-message">暂无标签</p>
              ) : (
                tags.map((tag) => (
                  <label className="check-row" key={tag.id}>
                    <input
                      checked={form.tag_ids.includes(tag.id)}
                      type="checkbox"
                      onChange={() => toggleFormTag(tag.id)}
                    />
                    <span>{tag.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <button className="primary-button" disabled={isSaving} type="submit">
            {isSaving ? "保存中..." : isEditing ? "保存修改" : "创建灵感"}
          </button>
        </form>

        <section className="list-panel">
          <form className="filter-panel" onSubmit={handleFilterSubmit}>
            <div className="filter-search-row">
              <input
                className="filter-search"
                value={filters.keyword}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    keyword: event.target.value,
                  }))
                }
                placeholder="搜索灵感标题 / 作者 / 备注 / 链接"
              />
            </div>

            <div className="filter-controls-grid">
              <label className="filter-field">
                <span>项目</span>
                <select
                  value={filters.project_id}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      project_id: event.target.value,
                    }))
                  }
                >
                  <option value="">全部项目</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-field">
                <span>平台</span>
                <select
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
              </label>

              <label className="filter-field">
                <span>标签</span>
                <select
                  value={filters.tag_id}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      tag_id: event.target.value,
                    }))
                  }
                >
                  <option value="">全部标签</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="filter-actions">
                <button type="submit">筛选</button>
                <button type="button" onClick={clearFilters}>
                  清空
                </button>
              </div>
            </div>
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
                      <dt>所属项目</dt>
                      <dd>
                        {card.project_name ||
                          (card.project_id
                            ? projectNameById.get(card.project_id) || card.project_id
                            : "-")}
                      </dd>
                    </div>
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

                  <div className="tag-chip-list">
                    {card.tags.length === 0 ? (
                      <span className="muted-text">未添加标签</span>
                    ) : (
                      card.tags.map((tag) => (
                        <span className="tag-chip" key={tag.id}>
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
    project_id: optionalText(form.project_id),
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
