import { FormEvent, useEffect, useMemo, useState } from "react";

import { InspirationCard, SourcePlatform } from "../services/inspirationApi";
import {
  getMediaAssetDisplayUrl,
  getMediaAsset,
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
  updateShootingPlanCover,
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

type PlanReferencePreview = {
  cards: InspirationCard[];
  total: number;
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
  const [planReferencePreviewMap, setPlanReferencePreviewMap] = useState<
    Record<string, PlanReferencePreview>
  >({});
  const [planCoverMap, setPlanCoverMap] = useState<Record<string, MediaAsset | null>>({});
  const [planPreviewCoverMap, setPlanPreviewCoverMap] = useState<
    Record<string, MediaAsset | null>
  >({});
  const [inspirationCoverMap, setInspirationCoverMap] = useState<
    Record<string, MediaAsset | null>
  >({});
  const [brokenCoverIds, setBrokenCoverIds] = useState<Set<string>>(new Set());
  const [brokenPlanCoverIds, setBrokenPlanCoverIds] = useState<Set<string>>(new Set());
  const [inspirationFilters, setInspirationFilters] =
    useState<PlanInspirationFilterState>(emptyInspirationFilters);
  const [isPlanFormModalOpen, setIsPlanFormModalOpen] = useState(false);
  const [selectedPlanForDetail, setSelectedPlanForDetail] =
    useState<ShootingPlan | null>(null);
  const [isPlanDetailEditing, setIsPlanDetailEditing] = useState(false);
  const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
  const [expandedInspirationId, setExpandedInspirationId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [pendingDeletePlan, setPendingDeletePlan] =
    useState<ShootingPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReferenceLoading, setIsReferenceLoading] = useState(false);

  const isEditing = editingPlanId !== null;
  const activeReferencePlan = useMemo(
    () => plans.find((plan) => plan.id === activeReferencePlanId) ?? null,
    [activeReferencePlanId, plans],
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
      await loadPlanPreviews(planData);
    } catch (error) {
      alert(toErrorMessage(error, "加载拍摄计划失败"));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPlans(nextFilters = filters) {
    setIsLoading(true);
    try {
      const planData = await listShootingPlans({
        keyword: optionalText(nextFilters.keyword),
        project_id: optionalText(nextFilters.project_id),
        status: nextFilters.status || null,
      });
      setPlans(planData);
      await loadPlanPreviews(planData);
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
      let savedPlan: ShootingPlan;
      if (editingPlanId) {
        savedPlan = await updateShootingPlan(editingPlanId, payload);
        setSelectedPlanForDetail(savedPlan);
        setIsPlanDetailEditing(false);
      } else {
        savedPlan = await createShootingPlan(payload);
        setIsPlanFormModalOpen(false);
        setSelectedPlanForDetail(savedPlan);
        setIsPlanDetailEditing(false);
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
    setIsPlanDetailEditing(true);
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

  function openNewPlanModal() {
    resetForm();
    setSelectedPlanForDetail(null);
    setIsPlanDetailEditing(false);
    setIsPlanFormModalOpen(true);
  }

  function closeNewPlanModal() {
    setIsPlanFormModalOpen(false);
    resetForm();
  }

  function openPlanDetail(plan: ShootingPlan) {
    setSelectedPlanForDetail(plan);
    setIsPlanDetailEditing(false);
    setPendingDeletePlan(null);
  }

  function closePlanDetail() {
    setSelectedPlanForDetail(null);
    setIsPlanDetailEditing(false);
    setPendingDeletePlan(null);
    if (editingPlanId) {
      resetForm();
    }
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
      if (selectedPlanForDetail?.id === pendingDeletePlan.id) {
        setSelectedPlanForDetail(null);
        setIsPlanDetailEditing(false);
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
    setExpandedInspirationId(null);
  }

  function managePlanInspirations(plan: ShootingPlan) {
    setActiveReferencePlanId(plan.id);
    setIsReferenceModalOpen(true);
    setExpandedInspirationId(null);
    void loadPlanReferences(plan.id, inspirationFilters);
  }

  function closeReferenceModal() {
    setIsReferenceModalOpen(false);
    setExpandedInspirationId(null);
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
      setExpandedInspirationId(null);
      await attachInspirationToShootingPlan(activeReferencePlanId, card.id);
      await loadPlanReferences(activeReferencePlanId);
      await loadPlanPreviews(plans);
    } catch (error) {
      alert(toErrorMessage(error, "加入计划参考灵感失败"));
    }
  }

  async function detachInspirationFromPlan(card: InspirationCard) {
    if (!activeReferencePlanId) {
      return;
    }

    try {
      setExpandedInspirationId(null);
      await detachInspirationFromShootingPlan(
        activeReferencePlanId,
        card.id,
      );
      await loadPlanReferences(activeReferencePlanId);
      await loadPlanPreviews(plans);
    } catch (error) {
      console.error("移除计划参考灵感失败", error);
      alert(toErrorMessage(error, "移除计划参考灵感失败"));
    }
  }

  async function setPlanCoverFromCard(card: InspirationCard) {
    if (!activeReferencePlanId) {
      alert("请先选择拍摄计划");
      return;
    }

    const cover = inspirationCoverMap[card.id];
    if (!cover) {
      alert("这张灵感还没有可用图片，无法设为封面");
      return;
    }

    try {
      const updated = await updateShootingPlanCover(activeReferencePlanId, cover.id);
      setPlans((current) =>
        current.map((plan) => (plan.id === updated.id ? updated : plan)),
      );
      setPlanCoverMap((current) => ({
        ...current,
        [activeReferencePlanId]: cover,
      }));
      setBrokenPlanCoverIds((current) => {
        const next = new Set(current);
        next.delete(activeReferencePlanId);
        return next;
      });
    } catch (error) {
      console.error("设置拍摄计划封面失败", error);
      alert(toErrorMessage(error, "设置拍摄计划封面失败"));
    }
  }

  async function loadPlanPreviews(planData: ShootingPlan[]) {
    if (planData.length === 0) {
      setPlanReferencePreviewMap({});
      setPlanCoverMap({});
      setPlanPreviewCoverMap({});
      return;
    }

    const previewEntries = await Promise.all(
      planData.map(async (plan) => {
        try {
          const references = await listShootingPlanInspirations(plan.id);
          const previewCards = references;
          const coverEntries = await loadCoverEntries(previewCards);
          const previewCover =
            coverEntries.find(([, asset]) => asset !== null)?.[1] ?? null;

          return {
            planId: plan.id,
            preview: {
              cards: previewCards,
              total: references.length,
            },
            covers: coverEntries,
            previewCover,
          };
        } catch (error) {
          console.error("加载拍摄计划参考灵感预览失败", {
            planId: plan.id,
            error,
          });
          return {
            planId: plan.id,
            preview: {
              cards: [],
              total: 0,
            },
            covers: [],
            previewCover: null,
          };
        }
      }),
    );

    const explicitCoverEntries = await Promise.all(
      planData.map(async (plan) => {
        if (!plan.cover_media_asset_id) {
          return [plan.id, null] as const;
        }

        try {
          return [plan.id, await getMediaAsset(plan.cover_media_asset_id)] as const;
        } catch (error) {
          console.error("加载拍摄计划封面失败", {
            planId: plan.id,
            mediaAssetId: plan.cover_media_asset_id,
            error,
          });
          return [plan.id, null] as const;
        }
      }),
    );

    const allCardCoverEntries = previewEntries.flatMap((entry) => entry.covers);
    setInspirationCoverMap((current) => ({
      ...current,
      ...Object.fromEntries(allCardCoverEntries),
    }));
    setPlanReferencePreviewMap(
      Object.fromEntries(
        previewEntries.map((entry) => [entry.planId, entry.preview]),
      ),
    );
    setPlanPreviewCoverMap(
      Object.fromEntries(
        previewEntries.map((entry) => [entry.planId, entry.previewCover]),
      ),
    );
    setPlanCoverMap(Object.fromEntries(explicitCoverEntries));
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

  async function loadCoverEntries(cards: InspirationCard[]) {
    const uniqueCards = cards.filter(
      (card, index, allCards) =>
        allCards.findIndex((candidate) => candidate.id === card.id) === index,
    );

    return Promise.all(
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
  }

  function markCoverBroken(cardId: string) {
    setBrokenCoverIds((current) => {
      const next = new Set(current);
      next.add(cardId);
      return next;
    });
  }

  function markPlanCoverBroken(planId: string) {
    setBrokenPlanCoverIds((current) => {
      const next = new Set(current);
      next.add(planId);
      return next;
    });
  }

  function renderPlanFormFields() {
    return (
      <>
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
          <span>风格主题</span>
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
          <span>器材</span>
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
          <span>策划概述</span>
          <textarea
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({ ...current, notes: event.target.value }))
            }
            rows={5}
            placeholder="姿势、构图、光线、后期等都可以写在这里"
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
      </>
    );
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

      <section className="plans-workspace">
        <div className="plans-toolbar">
          <button className="primary-button new-plan-button" type="button" onClick={openNewPlanModal}>
            + New Plan
          </button>
          <form className="search-filter-panel plans-filter-panel" onSubmit={handleFilter}>
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
                placeholder="搜索标题 / 主题 / 器材 / 策划概述..."
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
        </div>

        {isLoading ? (
          <p className="muted-text">正在加载拍摄计划...</p>
        ) : plans.length === 0 ? (
          <p className="empty-message">
            暂无拍摄计划。点击 New Plan 创建第一个计划。
          </p>
        ) : (
          <div className="plan-card-wall">
            {plans.map((plan) => {
                const preview = planReferencePreviewMap[plan.id] ?? {
                  cards: [],
                  total: 0,
                };
                const coverAsset = planCoverMap[plan.id] ?? planPreviewCoverMap[plan.id] ?? null;
                const hasCover = coverAsset && !brokenPlanCoverIds.has(plan.id);

                return (
                  <article
                    className={`entity-card shooting-plan-card shooting-plan-card--compact ${
                      hasCover ? "shooting-plan-card--with-cover" : ""
                    } ${
                      isReferenceModalOpen && activeReferencePlanId === plan.id
                        ? "shooting-plan-card--active-reference"
                        : ""
                    }`}
                    key={plan.id}
                    onClick={() => openPlanDetail(plan)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openPlanDetail(plan);
                      }
                    }}
                  >
                    {hasCover && (
                      <img
                        alt=""
                        className="plan-card-cover-bg"
                        src={getMediaAssetDisplayUrl(coverAsset)}
                        onError={() => markPlanCoverBroken(plan.id)}
                      />
                    )}
                    <div className="plan-card-content">
                      <div className="entity-card-header">
                        <div>
                          <h2>{plan.title}</h2>
                          <p>{plan.project_name ?? "未知项目"}</p>
                        </div>
                        <span className={`status-pill status-pill--${plan.status}`}>
                          {statusLabel(plan.status)}
                        </span>
                      </div>
                      {isReferenceModalOpen && activeReferencePlanId === plan.id && (
                        <p className="active-reference-label">正在管理参考灵感</p>
                      )}

                      <div className="plan-compact-lines">
                        <p>
                          <span>风格主题</span>
                          {plan.shooting_theme || "-"}
                        </p>
                        <p>
                          <span>器材</span>
                          {plan.gear_list || "-"}
                        </p>
                        <p>
                          <span>策划概述</span>
                          {plan.notes || "-"}
                        </p>
                      </div>

                      <PlanReferencePreviewList
                        brokenCoverIds={brokenCoverIds}
                        inspirationCoverMap={inspirationCoverMap}
                        onBroken={markCoverBroken}
                        preview={preview}
                      />
                    </div>
                  </article>
                );
              })}
          </div>
        )}
      </section>

      {isPlanFormModalOpen && (
        <div className="reference-modal-overlay" role="presentation">
          <section
            aria-labelledby="plan-form-modal-title"
            aria-modal="true"
            className="plan-modal"
            role="dialog"
          >
            <header className="reference-modal-header">
              <div>
                <p className="page-kicker">New Plan</p>
                <h2 id="plan-form-modal-title">新建 Plan</h2>
                <p className="muted-text">先保存 Plan，再在详情窗口中添加参考灵感。</p>
              </div>
              <button
                className="reference-modal-close"
                type="button"
                onClick={closeNewPlanModal}
              >
                关闭
              </button>
            </header>
            <form className="plan-modal-body" onSubmit={handleSubmit}>
              {renderPlanFormFields()}
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving ? "保存中..." : "创建 Plan"}
              </button>
            </form>
          </section>
        </div>
      )}

      {selectedPlanForDetail && (
        <div className="reference-modal-overlay" role="presentation">
          <section
            aria-labelledby="plan-detail-modal-title"
            aria-modal="true"
            className="plan-modal plan-detail-modal"
            role="dialog"
          >
            <header className="reference-modal-header">
              <div>
                <p className="page-kicker">Plan Detail</p>
                <h2 id="plan-detail-modal-title">{selectedPlanForDetail.title}</h2>
                <p className="muted-text">
                  {selectedPlanForDetail.project_name ?? "未知项目"} ·{" "}
                  {statusLabel(selectedPlanForDetail.status)}
                </p>
              </div>
              <button
                className="reference-modal-close"
                type="button"
                onClick={closePlanDetail}
              >
                关闭
              </button>
            </header>

            <div className="plan-modal-body">
              {isPlanDetailEditing ? (
                <form className="plan-detail-edit-form" onSubmit={handleSubmit}>
                  {renderPlanFormFields()}
                  <div className="row-actions">
                    <button className="primary-button" disabled={isSaving} type="submit">
                      {isSaving ? "保存中..." : "保存修改"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlanDetailEditing(false);
                        resetForm();
                      }}
                    >
                      取消编辑
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="plan-detail-summary">
                    <div>
                      <span>风格主题</span>
                      <p>{selectedPlanForDetail.shooting_theme || "-"}</p>
                    </div>
                    <div>
                      <span>器材</span>
                      <p>{selectedPlanForDetail.gear_list || "-"}</p>
                    </div>
                    <div>
                      <span>策划概述</span>
                      <p>{selectedPlanForDetail.notes || "-"}</p>
                    </div>
                  </div>

                  <section className="plan-detail-references">
                    <div className="reference-section-title">
                      <div>
                        <h3>参考灵感</h3>
                        <p className="muted-text">当前 Plan 已选择的参考内容。</p>
                      </div>
                    </div>
                    <PlanReferencePreviewList
                      brokenCoverIds={brokenCoverIds}
                      inspirationCoverMap={inspirationCoverMap}
                      onBroken={markCoverBroken}
                      preview={
                        planReferencePreviewMap[selectedPlanForDetail.id] ?? {
                          cards: [],
                          total: 0,
                        }
                      }
                    />
                  </section>

                  <div className="plan-detail-actions">
                    <button type="button" onClick={() => handleEdit(selectedPlanForDetail)}>
                      编辑
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => managePlanInspirations(selectedPlanForDetail)}
                    >
                      添加 / 管理参考灵感
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => requestDeletePlan(selectedPlanForDetail)}
                    >
                      删除 Plan
                    </button>
                  </div>

                  {pendingDeletePlan?.id === selectedPlanForDetail.id && (
                    <div className="inline-confirm">
                      <p>确定删除拍摄计划「{selectedPlanForDetail.title}」吗？</p>
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
                </>
              )}
            </div>
          </section>
        </div>
      )}

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
                          <article
                            className="reference-card reference-card--selected reference-card--clickable"
                            key={card.id}
                            onClick={() => void detachInspirationFromPlan(card)}
                            title="点击取消选择"
                          >
                            <div className="reference-card-tools">
                              <button
                                aria-label={`展开 ${card.title} 详情`}
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setExpandedInspirationId((current) =>
                                    current === card.id ? null : card.id,
                                  );
                                }}
                              >
                                详情
                              </button>
                              {inspirationCoverMap[card.id] && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void setPlanCoverFromCard(card);
                                  }}
                                >
                                  设为封面
                                </button>
                              )}
                            </div>
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
                            <div className="reference-hover-preview">
                              <strong>点击取消选择</strong>
                              <p>{card.notes || "暂无备注"}</p>
                              <span>
                                {card.author_name ? `作者：${card.author_name}` : "作者未记录"}
                              </span>
                            </div>
                            {expandedInspirationId === card.id && (
                              <InspirationDetailPopover
                                card={card}
                                cover={inspirationCoverMap[card.id] ?? null}
                                isBroken={brokenCoverIds.has(card.id)}
                                onBroken={() => markCoverBroken(card.id)}
                                onClose={() => setExpandedInspirationId(null)}
                              />
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
                          <article
                            className="reference-card reference-card--wall reference-card--clickable"
                            key={card.id}
                            onClick={() => void addInspirationToPlan(card)}
                            title="点击加入计划"
                          >
                            <div className="reference-card-tools">
                              <button
                                aria-label={`展开 ${card.title} 详情`}
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setExpandedInspirationId((current) =>
                                    current === card.id ? null : card.id,
                                  );
                                }}
                              >
                                详情
                              </button>
                            </div>
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
                            <div className="reference-hover-preview">
                              <strong>点击加入计划</strong>
                              <p>{card.notes || "暂无备注"}</p>
                              <span>
                                {card.author_name ? `作者：${card.author_name}` : "作者未记录"}
                              </span>
                            </div>
                            {expandedInspirationId === card.id && (
                              <InspirationDetailPopover
                                card={card}
                                cover={inspirationCoverMap[card.id] ?? null}
                                isBroken={brokenCoverIds.has(card.id)}
                                onBroken={() => markCoverBroken(card.id)}
                                onClose={() => setExpandedInspirationId(null)}
                              />
                            )}
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

function PlanReferencePreviewList({
  preview,
  inspirationCoverMap,
  brokenCoverIds,
  onBroken,
}: {
  preview: PlanReferencePreview;
  inspirationCoverMap: Record<string, MediaAsset | null>;
  brokenCoverIds: Set<string>;
  onBroken: (cardId: string) => void;
}) {
  if (preview.cards.length === 0) {
    return <p className="plan-reference-empty">暂无参考灵感</p>;
  }

  return (
    <div className="plan-reference-preview-list">
      {preview.cards.map((card) => {
        const cover = inspirationCoverMap[card.id] ?? null;
        const isBroken = brokenCoverIds.has(card.id);

        return (
          <div className="plan-reference-preview" key={card.id}>
            {cover && !isBroken ? (
              <img
                src={getMediaAssetDisplayUrl(cover)}
                alt={cover.original_filename ?? card.title}
                onError={() => onBroken(card.id)}
              />
            ) : (
              <span>暂无图片</span>
            )}
            <strong>{card.title}</strong>
          </div>
        );
      })}
    </div>
  );
}

function InspirationDetailPopover({
  card,
  cover,
  isBroken,
  onBroken,
  onClose,
}: {
  card: InspirationCard;
  cover: MediaAsset | null;
  isBroken: boolean;
  onBroken: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="reference-detail-popover"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="reference-detail-header">
        <strong>{card.title}</strong>
        <button type="button" onClick={onClose}>
          关闭
        </button>
      </div>
      <InspirationCover asset={cover} isBroken={isBroken} onBroken={onBroken} />
      <dl className="reference-detail-meta">
        <div>
          <dt>平台</dt>
          <dd>{platformLabel(card.source_platform)}</dd>
        </div>
        <div>
          <dt>作者</dt>
          <dd>{card.author_name || "-"}</dd>
        </div>
        <div>
          <dt>链接</dt>
          <dd>
            {card.source_url ? (
              <a href={card.source_url} rel="noreferrer" target="_blank">
                {card.source_url}
              </a>
            ) : (
              "-"
            )}
          </dd>
        </div>
      </dl>
      <div className="mini-tag-list">
        {card.tags.map((tag) => (
          <span className="mini-tag" key={tag.id}>
            #{tag.name}
          </span>
        ))}
      </div>
      <div className="reference-detail-notes">
        <h4>备注</h4>
        <p>{card.notes || "暂无备注"}</p>
      </div>
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
