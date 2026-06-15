import { FormEvent, useEffect, useMemo, useState } from "react";

import { InspirationCard, SourcePlatform } from "../services/inspirationApi";
import {
  getMediaAssetDisplayUrl,
  listMediaAssetsByTarget,
  MediaAsset,
} from "../services/mediaApi";
import {
  attachInspirationToShootingPlan,
  detachInspirationFromShootingPlan,
  listAvailableInspirationsForShootingPlan,
  listShootingPlanInspirations,
} from "../services/planInspirationApi";
import { listProjects, Project } from "../services/projectApi";
import {
  createShootingPlan,
  deleteShootingPlan,
  listShootingPlans,
  ShootingPlan,
  ShootingPlanPayload,
  ShootingPlanStatus,
  updateShootingPlan,
} from "../services/shootingPlanApi";

type ShootingPlanFormState = {
  project_id: string;
  title: string;
  shooting_theme: string;
  gear_list: string;
  scene_list: string;
  action_list: string;
  composition_reference: string;
  lighting_reference: string;
  post_style: string;
  technique_notes: string;
  notes: string;
  status: ShootingPlanStatus;
};

type ShootingPlanFilterState = {
  keyword: string;
  project_id: string;
  status: "" | ShootingPlanStatus;
};

type PlanInspirationFilterState = {
  keyword: string;
  source_platform: "" | SourcePlatform;
};

const emptyForm: ShootingPlanFormState = {
  project_id: "",
  title: "",
  shooting_theme: "",
  gear_list: "",
  scene_list: "",
  action_list: "",
  composition_reference: "",
  lighting_reference: "",
  post_style: "",
  technique_notes: "",
  notes: "",
  status: "draft",
};

const emptyFilters: ShootingPlanFilterState = {
  keyword: "",
  project_id: "",
  status: "",
};

const emptyInspirationFilters: PlanInspirationFilterState = {
  keyword: "",
  source_platform: "",
};

const statuses: Array<{ value: ShootingPlanStatus; label: string }> = [
  { value: "draft", label: "草稿" },
  { value: "ready", label: "准备完成" },
  { value: "completed", label: "已完成" },
  { value: "archived", label: "已归档" },
];

const sourcePlatforms: Array<{ value: SourcePlatform; label: string }> = [
  { value: "douyin", label: "抖音" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "bilibili", label: "B站" },
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram" },
  { value: "other", label: "其他" },
];

export default function ShootingPlanPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [plans, setPlans] = useState<ShootingPlan[]>([]);
  const [form, setForm] = useState<ShootingPlanFormState>(emptyForm);
  const [filters, setFilters] = useState<ShootingPlanFilterState>(emptyFilters);
  const [activeReferencePlanId, setActiveReferencePlanId] = useState<string | null>(null);
  const [linkedInspirations, setLinkedInspirations] = useState<InspirationCard[]>([]);
  const [availableInspirations, setAvailableInspirations] = useState<InspirationCard[]>([]);
  const [inspirationCoverMap, setInspirationCoverMap] = useState<
    Record<string, MediaAsset | null>
  >({});
  const [brokenCoverIds, setBrokenCoverIds] = useState<Set<string>>(new Set());
  const [inspirationFilters, setInspirationFilters] =
    useState<PlanInspirationFilterState>(emptyInspirationFilters);
  const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [pendingDeletePlan, setPendingDeletePlan] =
    useState<ShootingPlan | null>(null);
  const [pendingDetachInspiration, setPendingDetachInspiration] =
    useState<InspirationCard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReferenceLoading, setIsReferenceLoading] = useState(false);

  const isEditing = editingPlanId !== null;
  const activeReferencePlan = useMemo(
    () => plans.find((plan) => plan.id === activeReferencePlanId) ?? null,
    [activeReferencePlanId, plans],
  );
  const submitLabel = useMemo(
    () => (isEditing ? "保存修改" : "创建拍摄计划"),
    [isEditing],
  );

  useEffect(() => {
    void loadInitialData();
    // Load once on page mount; filters are applied explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInitialData() {
    setIsLoading(true);
    try {
      const [projectData, planData] = await Promise.all([
        listProjects(),
        listShootingPlans(),
      ]);
      setProjects(projectData);
      setPlans(planData);
    } catch (error) {
      alert(toErrorMessage(error, "加载拍摄计划失败"));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPlans(nextFilters = filters) {
    setIsLoading(true);
    try {
      setPlans(
        await listShootingPlans({
          keyword: optionalText(nextFilters.keyword),
          project_id: optionalText(nextFilters.project_id),
          status: nextFilters.status || null,
        }),
      );
    } catch (error) {
      alert(toErrorMessage(error, "加载拍摄计划失败"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.project_id.trim()) {
      alert("关联项目不能为空");
      return;
    }

    if (!form.title.trim()) {
      alert("拍摄计划标题不能为空");
      return;
    }

    setIsSaving(true);
    try {
      const payload = toPayload(form);
      if (editingPlanId) {
        await updateShootingPlan(editingPlanId, payload);
      } else {
        await createShootingPlan(payload);
      }

      resetForm();
      await loadPlans();
    } catch (error) {
      alert(toErrorMessage(error, isEditing ? "编辑拍摄计划失败" : "创建拍摄计划失败"));
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(plan: ShootingPlan) {
    setEditingPlanId(plan.id);
    setPendingDeletePlan(null);
    setForm({
      project_id: plan.project_id,
      title: plan.title,
      shooting_theme: plan.shooting_theme ?? "",
      gear_list: plan.gear_list ?? "",
      scene_list: plan.scene_list ?? "",
      action_list: plan.action_list ?? "",
      composition_reference: plan.composition_reference ?? "",
      lighting_reference: plan.lighting_reference ?? "",
      post_style: plan.post_style ?? "",
      technique_notes: plan.technique_notes ?? "",
      notes: plan.notes ?? "",
      status: plan.status,
    });
  }

  function requestDeletePlan(plan: ShootingPlan) {
    setPendingDeletePlan(plan);
  }

  async function confirmDeletePlan() {
    if (!pendingDeletePlan) {
      return;
    }

    try {
      await deleteShootingPlan(pendingDeletePlan.id);
      if (editingPlanId === pendingDeletePlan.id) {
        resetForm();
      }
      if (activeReferencePlanId === pendingDeletePlan.id) {
        clearReferenceState();
      }
      setPendingDeletePlan(null);
      await loadPlans();
    } catch (error) {
      console.error("删除拍摄计划失败", error);
      alert(toErrorMessage(error, "删除拍摄计划失败"));
    }
  }

  async function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadPlans(filters);
  }

  async function clearFilters() {
    setFilters(emptyFilters);
    await loadPlans(emptyFilters);
  }

  function resetForm() {
    setEditingPlanId(null);
    setPendingDeletePlan(null);
    setForm(emptyForm);
  }

  function clearReferenceState() {
    setIsReferenceModalOpen(false);
    setActiveReferencePlanId(null);
    setLinkedInspirations([]);
    setAvailableInspirations([]);
    setInspirationCoverMap({});
    setBrokenCoverIds(new Set());
    setInspirationFilters(emptyInspirationFilters);
    setPendingDetachInspiration(null);
  }

  function managePlanInspirations(plan: ShootingPlan) {
    setActiveReferencePlanId(plan.id);
    setIsReferenceModalOpen(true);
    setPendingDetachInspiration(null);
    void loadPlanReferences(plan.id, inspirationFilters);
  }

  function closeReferenceModal() {
    setIsReferenceModalOpen(false);
    setPendingDetachInspiration(null);
  }

  async function loadPlanReferences(
    planId: string,
    nextFilters = inspirationFilters,
  ) {
    setIsReferenceLoading(true);
    try {
      const [linked, available] = await Promise.all([
        listShootingPlanInspirations(planId),
        listAvailableInspirationsForShootingPlan(planId, {
          keyword: optionalText(nextFilters.keyword),
          source_platform: nextFilters.source_platform || null,
        }),
      ]);
      setLinkedInspirations(linked);
      setAvailableInspirations(available);
      await loadInspirationCovers([...linked, ...available]);
    } catch (error) {
      alert(toErrorMessage(error, "加载计划参考灵感失败"));
    } finally {
      setIsReferenceLoading(false);
    }
  }

  async function handleInspirationFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeReferencePlanId) {
      return;
    }
    await loadPlanReferences(activeReferencePlanId, inspirationFilters);
  }

  async function clearInspirationFilters() {
    setInspirationFilters(emptyInspirationFilters);
    if (activeReferencePlanId) {
      await loadPlanReferences(activeReferencePlanId, emptyInspirationFilters);
    }
  }

  async function addInspirationToPlan(card: InspirationCard) {
    if (!activeReferencePlanId) {
      alert("请先选择拍摄计划");
      return;
    }

    try {
      await attachInspirationToShootingPlan(activeReferencePlanId, card.id);
      await loadPlanReferences(activeReferencePlanId);
    } catch (error) {
      alert(toErrorMessage(error, "加入计划参考灵感失败"));
    }
  }

  function requestDetachInspiration(card: InspirationCard) {
    setPendingDetachInspiration(card);
  }

  async function confirmDetachInspiration() {
    if (!activeReferencePlanId || !pendingDetachInspiration) {
      return;
    }

    try {
      await detachInspirationFromShootingPlan(
        activeReferencePlanId,
        pendingDetachInspiration.id,
      );
      setPendingDetachInspiration(null);
      await loadPlanReferences(activeReferencePlanId);
    } catch (error) {
      console.error("移除计划参考灵感失败", error);
      alert(toErrorMessage(error, "移除计划参考灵感失败"));
    }
  }

  async function loadInspirationCovers(cards: InspirationCard[]) {
    const uniqueCards = cards.filter(
      (card, index, allCards) =>
        allCards.findIndex((candidate) => candidate.id === card.id) === index,
    );

    const entries = await Promise.all(
      uniqueCards.map(async (card) => {
        try {
          const media = await listMediaAssetsByTarget("inspiration", card.id);
          return [card.id, media[0] ?? null] as const;
        } catch (error) {
          console.error("加载参考灵感封面失败", { cardId: card.id, error });
          return [card.id, null] as const;
        }
      }),
    );

    setInspirationCoverMap((current) => ({
      ...current,
      ...Object.fromEntries(entries),
    }));
    setBrokenCoverIds(new Set());
  }

  function markCoverBroken(cardId: string) {
    setBrokenCoverIds((current) => {
      const next = new Set(current);
      next.add(cardId);
      return next;
    });
  }

  return (
    <section className="page-frame">
      <header className="page-header">
        <p className="page-kicker">Plans</p>
        <h1 className="page-title">Shooting Plans</h1>
        <p className="page-copy">
          为已有摄影项目创建可执行拍摄计划，整理器材、场景、动作、构图、光线和后期方向。
        </p>
      </header>

      <div className="crud-layout">
        <form className="form-panel sticky-form-panel" onSubmit={handleSubmit}>
          <div className="section-heading">
            <h2>{isEditing ? "编辑拍摄计划" : "新建拍摄计划"}</h2>
            {isEditing && (
              <button className="text-button" type="button" onClick={resetForm}>
                取消编辑
              </button>
            )}
          </div>

          <label className="field">
            <span>所属项目 *</span>
            <select
              value={form.project_id}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  project_id: event.target.value,
                }))
              }
            >
              <option value="">选择项目</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>标题 *</span>
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="例如：咖啡馆人像拍摄计划"
            />
          </label>

          <label className="field">
            <span>拍摄主题</span>
            <textarea
              value={form.shooting_theme}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  shooting_theme: event.target.value,
                }))
              }
              rows={2}
            />
          </label>

          <label className="field">
            <span>器材清单</span>
            <textarea
              value={form.gear_list}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  gear_list: event.target.value,
                }))
              }
              rows={3}
            />
          </label>

          <label className="field">
            <span>场景清单</span>
            <textarea
              value={form.scene_list}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  scene_list: event.target.value,
                }))
              }
              rows={3}
            />
          </label>

          <label className="field">
            <span>动作 / 姿态清单</span>
            <textarea
              value={form.action_list}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  action_list: event.target.value,
                }))
              }
              rows={3}
            />
          </label>

          <label className="field">
            <span>构图参考</span>
            <textarea
              value={form.composition_reference}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  composition_reference: event.target.value,
                }))
              }
              rows={2}
            />
          </label>

          <label className="field">
            <span>光线参考</span>
            <textarea
              value={form.lighting_reference}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  lighting_reference: event.target.value,
                }))
              }
              rows={2}
            />
          </label>

          <label className="field">
            <span>后期风格</span>
            <textarea
              value={form.post_style}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  post_style: event.target.value,
                }))
              }
              rows={2}
            />
          </label>

          <label className="field">
            <span>技术备注</span>
            <textarea
              value={form.technique_notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  technique_notes: event.target.value,
                }))
              }
              rows={2}
            />
          </label>

          <label className="field">
            <span>其他备注</span>
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              rows={3}
            />
          </label>

          <label className="field">
            <span>状态</span>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as ShootingPlanStatus,
                }))
              }
            >
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>

          <button className="primary-button" disabled={isSaving} type="submit">
            {isSaving ? "保存中..." : submitLabel}
          </button>
        </form>

        <section className="list-panel">
          <form className="search-filter-panel" onSubmit={handleFilter}>
            <div className="filter-panel-title">
              <strong>筛选拍摄计划</strong>
              <span>{plans.length} 个匹配计划</span>
            </div>
            <div className="search-filter-bar shooting-plan-filter-bar">
              <input
                className="search-filter-input"
                value={filters.keyword}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    keyword: event.target.value,
                  }))
                }
                placeholder="搜索标题 / 主题 / 器材 / 场景 / 动作 / 备注..."
              />
              <select
                className="search-filter-select"
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
              <select
                className="search-filter-select"
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value as "" | ShootingPlanStatus,
                  }))
                }
              >
                <option value="">全部状态</option>
                {statuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
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
                  onClick={() => void clearFilters()}
                >
                  清空
                </button>
              </div>
            </div>
          </form>

          {isLoading ? (
            <p className="muted-text">正在加载拍摄计划...</p>
          ) : plans.length === 0 ? (
            <p className="empty-message">
              暂无拍摄计划。先选择项目并创建一个计划吧。
            </p>
          ) : (
            <div className="entity-list">
              {plans.map((plan) => (
                <article
                  className={`entity-card shooting-plan-card ${
                    isReferenceModalOpen && activeReferencePlanId === plan.id
                      ? "shooting-plan-card--active-reference"
                      : ""
                  }`}
                  key={plan.id}
                >
                  <div className="entity-card-header">
                    <div>
                      <h2>{plan.title}</h2>
                      <p>
                        {plan.project_name ?? "未知项目"} · {statusLabel(plan.status)}
                      </p>
                    </div>
                    <span className={`status-pill status-pill--${plan.status}`}>
                      {statusLabel(plan.status)}
                    </span>
                  </div>
                  {isReferenceModalOpen && activeReferencePlanId === plan.id && (
                    <p className="active-reference-label">正在管理参考灵感</p>
                  )}

                  <dl className="compact-meta">
                    <div>
                      <dt>主题</dt>
                      <dd>{plan.shooting_theme || "-"}</dd>
                    </div>
                    <div>
                      <dt>器材</dt>
                      <dd>{plan.gear_list || "-"}</dd>
                    </div>
                    <div>
                      <dt>场景</dt>
                      <dd>{plan.scene_list || "-"}</dd>
                    </div>
                    <div>
                      <dt>动作</dt>
                      <dd>{plan.action_list || "-"}</dd>
                    </div>
                    <div>
                      <dt>构图</dt>
                      <dd>{plan.composition_reference || "-"}</dd>
                    </div>
                    <div>
                      <dt>光线</dt>
                      <dd>{plan.lighting_reference || "-"}</dd>
                    </div>
                    <div>
                      <dt>后期</dt>
                      <dd>{plan.post_style || "-"}</dd>
                    </div>
                    <div>
                      <dt>技术</dt>
                      <dd>{plan.technique_notes || "-"}</dd>
                    </div>
                  </dl>

                  {plan.notes && <p className="note-text">{plan.notes}</p>}

                  <div className="row-actions">
                    <button type="button" onClick={() => handleEdit(plan)}>
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => managePlanInspirations(plan)}
                    >
                      管理参考灵感
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => requestDeletePlan(plan)}
                    >
                      删除
                    </button>
                  </div>

                  {pendingDeletePlan?.id === plan.id && (
                    <div className="inline-confirm">
                      <p>确定删除拍摄计划「{plan.title}」吗？</p>
                      <div className="row-actions">
                        <button
                          className="danger-button"
                          type="button"
                          onClick={() => void confirmDeletePlan()}
                        >
                          确认删除
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeletePlan(null)}
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

      {isReferenceModalOpen && activeReferencePlan && (
        <div className="reference-modal-overlay" role="presentation">
          <section
            aria-labelledby="reference-modal-title"
            aria-modal="true"
            className="reference-modal"
            role="dialog"
          >
            <header className="reference-modal-header">
              <div>
                <p className="page-kicker">Plan References</p>
                <h2 id="reference-modal-title">管理参考灵感</h2>
                <p className="muted-text">
                  当前计划：{activeReferencePlan.title}
                  {activeReferencePlan.project_name
                    ? ` · 所属项目：${activeReferencePlan.project_name}`
                    : ""}
                </p>
              </div>
              <button
                aria-label="关闭参考灵感管理"
                className="reference-modal-close"
                type="button"
                onClick={closeReferenceModal}
              >
                关闭
              </button>
            </header>

            <div className="reference-modal-body">
              {isReferenceLoading ? (
                <p className="muted-text">正在加载参考灵感...</p>
              ) : (
                <>
                  <section className="reference-modal-section">
                    <div className="reference-section-title">
                      <div>
                        <h3>已选参考灵感</h3>
                        <p className="muted-text">
                          这些灵感会作为当前拍摄计划的模仿和执行参考。
                        </p>
                      </div>
                      <span>{linkedInspirations.length} 个已选</span>
                    </div>

                    {linkedInspirations.length === 0 ? (
                      <p className="empty-message">还没有为该计划选择参考灵感。</p>
                    ) : (
                      <div className="selected-reference-strip">
                        {linkedInspirations.map((card) => (
                          <article className="reference-card reference-card--selected" key={card.id}>
                            <InspirationCover
                              asset={inspirationCoverMap[card.id] ?? null}
                              isBroken={brokenCoverIds.has(card.id)}
                              onBroken={() => markCoverBroken(card.id)}
                            />
                            <div className="reference-card-body">
                              <strong>{card.title}</strong>
                              <p>
                                {platformLabel(card.source_platform)}
                                {card.author_name ? ` · ${card.author_name}` : ""}
                              </p>
                              <div className="mini-tag-list">
                                {card.tags.map((tag) => (
                                  <span className="mini-tag" key={tag.id}>
                                    #{tag.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button
                              className="danger-button"
                              type="button"
                              onClick={() => requestDetachInspiration(card)}
                            >
                              从计划移除
                            </button>
                            {pendingDetachInspiration?.id === card.id && (
                              <div className="inline-confirm">
                                <p>确定从计划中移除「{card.title}」吗？</p>
                                <div className="row-actions">
                                  <button
                                    className="danger-button"
                                    type="button"
                                    onClick={() => void confirmDetachInspiration()}
                                  >
                                    确认移除
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPendingDetachInspiration(null)}
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

                  <section className="reference-modal-section">
                    <form
                      className="search-filter-panel reference-search-panel"
                      onSubmit={handleInspirationFilter}
                    >
                      <div className="filter-panel-title">
                        <strong>从灵感库添加</strong>
                        <span>{availableInspirations.length} 个可加入灵感</span>
                      </div>
                      <div className="search-filter-bar reference-modal-filter-bar">
                        <input
                          className="search-filter-input"
                          value={inspirationFilters.keyword}
                          onChange={(event) =>
                            setInspirationFilters((current) => ({
                              ...current,
                              keyword: event.target.value,
                            }))
                          }
                          placeholder="搜索标题 / 作者 / 备注 / 链接 / 标签..."
                        />
                        <select
                          className="search-filter-select"
                          value={inspirationFilters.source_platform}
                          onChange={(event) =>
                            setInspirationFilters((current) => ({
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
                            onClick={() => void clearInspirationFilters()}
                          >
                            清空
                          </button>
                        </div>
                      </div>
                    </form>

                    {availableInspirations.length === 0 ? (
                      <p className="empty-message">没有匹配的可加入灵感。</p>
                    ) : (
                      <div className="reference-card-wall">
                        {availableInspirations.map((card) => (
                          <article className="reference-card reference-card--wall" key={card.id}>
                            <InspirationCover
                              asset={inspirationCoverMap[card.id] ?? null}
                              isBroken={brokenCoverIds.has(card.id)}
                              onBroken={() => markCoverBroken(card.id)}
                            />
                            <div className="reference-card-body">
                              <strong>{card.title}</strong>
                              <p>
                                {platformLabel(card.source_platform)}
                                {card.author_name ? ` · ${card.author_name}` : ""}
                              </p>
                              {card.notes && <p className="note-text">{card.notes}</p>}
                              <div className="mini-tag-list">
                                {card.tags.map((tag) => (
                                  <span className="mini-tag" key={tag.id}>
                                    #{tag.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button
                              className="primary-button"
                              type="button"
                              onClick={() => void addInspirationToPlan(card)}
                            >
                              加入计划
                            </button>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function toPayload(form: ShootingPlanFormState): ShootingPlanPayload {
  return {
    project_id: form.project_id,
    title: form.title,
    shooting_theme: optionalText(form.shooting_theme),
    gear_list: optionalText(form.gear_list),
    scene_list: optionalText(form.scene_list),
    action_list: optionalText(form.action_list),
    composition_reference: optionalText(form.composition_reference),
    lighting_reference: optionalText(form.lighting_reference),
    post_style: optionalText(form.post_style),
    technique_notes: optionalText(form.technique_notes),
    notes: optionalText(form.notes),
    status: form.status,
  };
}

function statusLabel(status: ShootingPlanStatus): string {
  return statuses.find((item) => item.value === status)?.label ?? "草稿";
}

function platformLabel(platform: string): string {
  return (
    sourcePlatforms.find((item) => item.value === platform)?.label ?? "其他"
  );
}

function InspirationCover({
  asset,
  isBroken,
  onBroken,
}: {
  asset: MediaAsset | null;
  isBroken: boolean;
  onBroken: () => void;
}) {
  if (!asset || isBroken) {
    return <div className="reference-cover-placeholder">暂无图片</div>;
  }

  return (
    <div className="reference-cover">
      <img
        src={getMediaAssetDisplayUrl(asset)}
        alt={asset.original_filename ?? "参考灵感图片"}
        onError={(event) => {
          console.error("plan reference image load failed", {
            asset,
            displayUrl: event.currentTarget.src,
          });
          onBroken();
        }}
      />
    </div>
  );
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return message ? `${fallback}：${message}` : fallback;
}
