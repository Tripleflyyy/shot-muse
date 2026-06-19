import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import { CardType, InspirationCard, SourcePlatform } from "../services/inspirationApi";
import {
  getMediaAsset,
  getMediaAssetDisplayUrl,
  importShootingPlanImage,
  listMediaAssetsByTarget,
  MediaAsset,
} from "../services/mediaApi";
import {
  createProject,
  deleteProject,
  listProjects,
  Project,
  ProjectPayload,
  reorderProjects,
  updateProject,
} from "../services/projectApi";
import {
  attachInspirationToShootingPlan,
  detachInspirationFromShootingPlan,
  listAvailableInspirationsForShootingPlan,
  listShootingPlanInspirations,
} from "../services/planInspirationApi";
import {
  createShootingPlan,
  deleteShootingPlan,
  listShootingPlans,
  reorderShootingPlans,
  ShootingPlan,
  ShootingPlanPayload,
  ShootingPlanStatus,
  updateShootingPlan,
  updateShootingPlanCover,
} from "../services/shootingPlanApi";

type ProjectFormState = {
  name: string;
  theme: string;
  description: string;
  location: string;
  planned_shooting_time: string;
  notes: string;
};

type PlanFormState = {
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

type PlanInspirationFilterState = {
  keyword: string;
  source_platform: "" | SourcePlatform;
  card_type: "all" | CardType;
};

type PlanReferencePreview = {
  cards: InspirationCard[];
  total: number;
};

const emptyProjectForm: ProjectFormState = {
  name: "",
  theme: "",
  description: "",
  location: "",
  planned_shooting_time: "",
  notes: "",
};

const emptyPlanForm: PlanFormState = {
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

const emptyInspirationFilters: PlanInspirationFilterState = {
  keyword: "",
  source_platform: "",
  card_type: "all",
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

const referenceCardTypeFilters: Array<{
  value: PlanInspirationFilterState["card_type"];
  label: string;
}> = [
  { value: "all", label: "全部" },
  { value: "inspiration", label: "灵感" },
  { value: "technique", label: "技巧" },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [plans, setPlans] = useState<ShootingPlan[]>([]);
  const [referenceCounts, setReferenceCounts] = useState<Record<string, number>>({});
  const [planReferencePreviewMap, setPlanReferencePreviewMap] = useState<Record<string, PlanReferencePreview>>({});
  const [planCoverMap, setPlanCoverMap] = useState<Record<string, MediaAsset | null>>({});
  const [planPreviewCoverMap, setPlanPreviewCoverMap] = useState<Record<string, MediaAsset | null>>({});
  const [inspirationCoverMap, setInspirationCoverMap] = useState<Record<string, MediaAsset | null>>({});
  const [brokenCoverIds, setBrokenCoverIds] = useState<Set<string>>(new Set());
  const [brokenPlanCoverIds, setBrokenPlanCoverIds] = useState<Set<string>>(new Set());
  const [keyword, setKeyword] = useState("");
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());
  const [projectForm, setProjectForm] = useState<ProjectFormState>(emptyProjectForm);
  const [planForm, setPlanForm] = useState<PlanFormState>(emptyPlanForm);
  const [activeReferencePlanId, setActiveReferencePlanId] = useState<string | null>(null);
  const [linkedInspirations, setLinkedInspirations] = useState<InspirationCard[]>([]);
  const [availableInspirations, setAvailableInspirations] = useState<InspirationCard[]>([]);
  const [inspirationFilters, setInspirationFilters] = useState<PlanInspirationFilterState>(emptyInspirationFilters);
  const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
  const [isReferenceLoading, setIsReferenceLoading] = useState(false);
  const [detailInspiration, setDetailInspiration] = useState<InspirationCard | null>(null);
  const [inspirationMediaMap, setInspirationMediaMap] = useState<Record<string, MediaAsset[]>>({});
  const [brokenDetailImageIds, setBrokenDetailImageIds] = useState<Set<string>>(new Set());
  const [selectedPlanImagePath, setSelectedPlanImagePath] = useState("");
  const [selectedPlanImageName, setSelectedPlanImageName] = useState("");
  const [existingPlanImage, setExistingPlanImage] = useState<MediaAsset | null>(null);
  const [setSelectedPlanImageAsCover, setSetSelectedPlanImageAsCover] = useState(true);
  const [planImageStatus, setPlanImageStatus] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ShootingPlan | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<Project | null>(null);
  const [pendingDeletePlan, setPendingDeletePlan] = useState<ShootingPlan | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  const activeReferencePlan = useMemo(
    () => plans.find((plan) => plan.id === activeReferencePlanId) ?? null,
    [activeReferencePlanId, plans],
  );
  const visibleLinkedReferences = useMemo(
    () => filterCardsByType(linkedInspirations, inspirationFilters.card_type),
    [linkedInspirations, inspirationFilters.card_type],
  );
  const visibleAvailableReferences = useMemo(
    () => filterCardsByType(availableInspirations, inspirationFilters.card_type),
    [availableInspirations, inspirationFilters.card_type],
  );

  const plansByProject = useMemo(() => {
    const grouped: Record<string, ShootingPlan[]> = {};
    for (const project of projects) {
      grouped[project.id] = [];
    }
    for (const plan of plans) {
      if (!grouped[plan.project_id]) {
        grouped[plan.project_id] = [];
      }
      grouped[plan.project_id].push(plan);
    }
    return grouped;
  }, [plans, projects]);

  useEffect(() => {
    void loadWorkspace("");
    // Load once on page mount; search is explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadWorkspace(searchKeyword = keyword) {
    setIsLoading(true);
    try {
      const [projectData, planData] = await Promise.all([
        listProjects(searchKeyword.trim() || undefined),
        listShootingPlans(),
      ]);
      setProjects(projectData);
      setPlans(planData);
      await loadPlanPreviews(planData);
      setSelectedPlan((current) =>
        current ? planData.find((plan) => plan.id === current.id) ?? null : null,
      );
      setExpandedProjectIds((current) => {
        if (current.size > 0) {
          const validIds = new Set(projectData.map((project) => project.id));
          return new Set([...current].filter((id) => validIds.has(id)));
        }
        return new Set(projectData[0] ? [projectData[0].id] : []);
      });
    } catch (error) {
      alert(toErrorMessage(error, "加载项目失败"));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPlanPreviews(planData: ShootingPlan[]) {
    if (planData.length === 0) {
      setReferenceCounts({});
      setPlanReferencePreviewMap({});
      setPlanCoverMap({});
      setPlanPreviewCoverMap({});
      return;
    }

    const previewEntries = await Promise.all(
      planData.map(async (plan) => {
        try {
          const references = await listShootingPlanInspirations(plan.id);
          const coverEntries = await loadCoverEntries(references);
          const previewCover = coverEntries.find(([, asset]) => asset !== null)?.[1] ?? null;

          return {
            planId: plan.id,
            preview: {
              cards: references,
              total: references.length,
            },
            covers: coverEntries,
            previewCover,
          };
        } catch (error) {
          console.error("加载拍摄计划参考卡片预览失败", { planId: plan.id, error });
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
      Object.fromEntries(previewEntries.map((entry) => [entry.planId, entry.preview])),
    );
    setReferenceCounts(
      Object.fromEntries(previewEntries.map((entry) => [entry.planId, entry.preview.total])),
    );
    setPlanPreviewCoverMap(
      Object.fromEntries(previewEntries.map((entry) => [entry.planId, entry.previewCover])),
    );
    setPlanCoverMap(Object.fromEntries(explicitCoverEntries));
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadWorkspace(keyword);
  }

  async function clearSearch() {
    setKeyword("");
    await loadWorkspace("");
  }

  function toggleProject(projectId: string) {
    setExpandedProjectIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }

  function openNewProjectModal() {
    setEditingProjectId(null);
    setProjectForm(emptyProjectForm);
    setPendingDeleteProject(null);
    setIsProjectModalOpen(true);
  }

  function openEditProject(project: Project) {
    setEditingProjectId(project.id);
    setProjectForm(toProjectForm(project));
    setPendingDeleteProject(null);
    setIsProjectModalOpen(true);
  }

  function closeProjectModal() {
    setIsProjectModalOpen(false);
    setEditingProjectId(null);
    setProjectForm(emptyProjectForm);
  }

  async function handleProjectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectForm.name.trim()) {
      alert("项目名称不能为空");
      return;
    }

    setIsSavingProject(true);
    try {
      const savedProject = editingProjectId
        ? await updateProject(editingProjectId, toProjectPayload(projectForm))
        : await createProject(toProjectPayload(projectForm));
      closeProjectModal();
      setExpandedProjectIds((current) => new Set(current).add(savedProject.id));
      await loadWorkspace();
    } catch (error) {
      alert(toErrorMessage(error, editingProjectId ? "编辑项目失败" : "创建项目失败"));
    } finally {
      setIsSavingProject(false);
    }
  }

  function openNewPlanModal(project: Project) {
    setEditingPlanId(null);
    setPlanForm({ ...emptyPlanForm, project_id: project.id });
    setSelectedPlan(null);
    clearSelectedPlanImage();
    setIsPlanModalOpen(true);
    setExpandedProjectIds((current) => new Set(current).add(project.id));
  }

  function openEditPlan(plan: ShootingPlan) {
    setEditingPlanId(plan.id);
    setPlanForm(toPlanForm(plan));
    clearSelectedPlanImage();
    void loadExistingPlanImage(plan);
    setIsPlanModalOpen(true);
  }

  function closePlanModal() {
    setIsPlanModalOpen(false);
    setEditingPlanId(null);
    setPlanForm(emptyPlanForm);
    clearSelectedPlanImage();
  }

  async function handlePlanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!planForm.project_id.trim()) {
      alert("请先选择项目");
      return;
    }
    if (!planForm.title.trim()) {
      alert("拍摄计划标题不能为空");
      return;
    }

    setIsSavingPlan(true);
    try {
      const payload: ShootingPlanPayload = {
        ...toPlanPayload(planForm),
      };
      let savedPlan = editingPlanId
        ? await updateShootingPlan(editingPlanId, payload)
        : await createShootingPlan(payload);
      savedPlan = await importSelectedPlanImageForPlan(savedPlan);
      closePlanModal();
      setSelectedPlan(savedPlan);
      setExpandedProjectIds((current) => new Set(current).add(savedPlan.project_id));
      await loadWorkspace();
    } catch (error) {
      alert(toErrorMessage(error, editingPlanId ? "编辑拍摄计划失败" : "创建拍摄计划失败"));
    } finally {
      setIsSavingPlan(false);
    }
  }

  async function importSelectedPlanImageForPlan(plan: ShootingPlan): Promise<ShootingPlan> {
    if (!selectedPlanImagePath) {
      return plan;
    }

    try {
      setPlanImageStatus("正在导入 Plan 参考图...");
      const imported = await importShootingPlanImage(
        selectedPlanImagePath,
        plan.id,
        setSelectedPlanImageAsCover,
      );

      if (!setSelectedPlanImageAsCover) {
        setPlanImageStatus("Plan 参考图已导入");
        return plan;
      }

      const updatedPlan = await updateShootingPlanCover(plan.id, imported.id);
      setPlanCoverMap((current) => ({
        ...current,
        [plan.id]: imported,
      }));
      setBrokenPlanCoverIds((current) => {
        const next = new Set(current);
        next.delete(plan.id);
        return next;
      });
      setPlanImageStatus("Plan 参考图已导入并设为封面");
      return updatedPlan;
    } catch (imageError) {
      console.error("导入 Plan 参考图失败", imageError);
      const message = toErrorMessage(imageError, "导入 Plan 参考图失败");
      setPlanImageStatus(message);
      alert(message);
      return plan;
    }
  }

  async function loadExistingPlanImage(plan: ShootingPlan) {
    setExistingPlanImage(null);

    try {
      if (plan.cover_media_asset_id) {
        const cover = await getMediaAsset(plan.cover_media_asset_id);
        setExistingPlanImage(cover);
        setSetSelectedPlanImageAsCover(true);
        return;
      }

      const planMedia = await listMediaAssetsByTarget("shooting_plan", plan.id);
      const existing = planMedia[0] ?? null;
      setExistingPlanImage(existing);
      setSetSelectedPlanImageAsCover(false);
    } catch (error) {
      console.error("加载 Plan 参考图失败", { planId: plan.id, error });
      setExistingPlanImage(null);
    }
  }

  async function choosePlanImage() {
    setPlanImageStatus("正在打开文件选择器...");
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Images",
            extensions: ["jpg", "jpeg", "png", "webp"],
          },
        ],
      });

      if (!selected) {
        setPlanImageStatus("已取消选择图片");
        return;
      }

      const sourcePath = Array.isArray(selected) ? selected[0] : selected;
      if (!sourcePath) {
        setPlanImageStatus("未选择图片");
        return;
      }

      setSelectedPlanImagePath(sourcePath);
      setSelectedPlanImageName(fileNameFromPath(sourcePath));
      setPlanImageStatus("已选择 Plan 参考图");
    } catch (error) {
      console.error("选择 Plan 参考图失败", error);
      const message = toErrorMessage(error, "选择 Plan 参考图失败");
      setPlanImageStatus(message);
      alert(message);
    }
  }

  function clearSelectedPlanImage() {
    setSelectedPlanImagePath("");
    setSelectedPlanImageName("");
    setExistingPlanImage(null);
    setSetSelectedPlanImageAsCover(true);
    setPlanImageStatus("");
  }

  function clearPlanImageSelection() {
    setSelectedPlanImagePath("");
    setSelectedPlanImageName("");
    setExistingPlanImage(null);
    setPlanImageStatus("");
  }

  async function openInspirationDetail(card: InspirationCard) {
    setDetailInspiration(card);
    setBrokenDetailImageIds(new Set());

    if (inspirationMediaMap[card.id]) {
      return;
    }

    try {
      const media = await listMediaAssetsByTarget("inspiration", card.id);
      setInspirationMediaMap((current) => ({
        ...current,
        [card.id]: media,
      }));
    } catch (error) {
      console.error("加载卡片详情图片失败", { cardId: card.id, error });
      setInspirationMediaMap((current) => ({
        ...current,
        [card.id]: [],
      }));
    }
  }

  function closeInspirationDetail() {
    setDetailInspiration(null);
  }

  function managePlanInspirations(plan: ShootingPlan) {
    const initialFilters = emptyInspirationFilters;
    setActiveReferencePlanId(plan.id);
    setIsReferenceModalOpen(true);
    setDetailInspiration(null);
    setInspirationFilters(initialFilters);
    void loadPlanReferences(plan.id, initialFilters);
  }

  function closeReferenceModal() {
    setIsReferenceModalOpen(false);
    setDetailInspiration(null);
  }

  async function loadPlanReferences(planId: string, nextFilters = inspirationFilters) {
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
      alert(toErrorMessage(error, "加载计划参考卡片失败"));
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
      setDetailInspiration(null);
      await attachInspirationToShootingPlan(activeReferencePlanId, card.id);
      await loadPlanReferences(activeReferencePlanId);
      await loadPlanPreviews(plans);
    } catch (error) {
      alert(toErrorMessage(error, "加入计划参考卡片失败"));
    }
  }

  async function detachInspirationFromPlan(card: InspirationCard) {
    if (!activeReferencePlanId) {
      return;
    }

    try {
      setDetailInspiration(null);
      await detachInspirationFromShootingPlan(activeReferencePlanId, card.id);
      await loadPlanReferences(activeReferencePlanId);
      await loadPlanPreviews(plans);
    } catch (error) {
      console.error("移除计划参考卡片失败", error);
      alert(toErrorMessage(error, "移除计划参考卡片失败"));
    }
  }

  async function setPlanCoverFromCard(card: InspirationCard) {
    if (!activeReferencePlanId) {
      alert("请先选择拍摄计划");
      return;
    }

    const cover = inspirationCoverMap[card.id];
    if (!cover) {
      alert("这张卡片还没有可用图片，无法设为封面");
      return;
    }

    try {
      const updated = await updateShootingPlanCover(activeReferencePlanId, cover.id);
      setPlans((current) =>
        current.map((plan) => (plan.id === updated.id ? updated : plan)),
      );
      setSelectedPlan((current) => (current?.id === updated.id ? updated : current));
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
          console.error("加载参考卡片封面失败", { cardId: card.id, error });
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
          console.error("加载参考卡片封面失败", { cardId: card.id, error });
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

  async function persistProjectOrder(nextOrder: string[]) {
    setProjects((current) =>
      nextOrder
        .map((id) => current.find((project) => project.id === id))
        .filter((project): project is Project => Boolean(project)),
    );

    try {
      await reorderProjects(nextOrder);
      await loadWorkspace();
    } catch (error) {
      console.error("调整 Project 顺序失败", error);
      alert(toErrorMessage(error, "调整 Project 顺序失败"));
      await loadWorkspace();
    }
  }

  async function moveProject(projectId: string, direction: -1 | 1) {
    const ids = projects.map((project) => project.id);
    const currentIndex = ids.indexOf(projectId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ids.length) {
      return;
    }

    const nextOrder = [...ids];
    const [moved] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(targetIndex, 0, moved);
    await persistProjectOrder(nextOrder);
  }

  async function persistPlanOrder(targetProjectId: string, nextOrder: string[]) {
    setPlans((current) => {
      const movedPlans = nextOrder
        .map((id) => current.find((plan) => plan.id === id))
        .filter((plan): plan is ShootingPlan => Boolean(plan));
      const otherPlans = current.filter((plan) => plan.project_id !== targetProjectId);
      return [...otherPlans, ...movedPlans];
    });

    try {
      await reorderShootingPlans(targetProjectId, nextOrder);
      await loadWorkspace();
    } catch (error) {
      console.error("调整 Plan 顺序失败", error);
      alert(toErrorMessage(error, "调整 Plan 顺序失败"));
      await loadWorkspace();
    }
  }

  async function movePlan(projectId: string, planId: string, direction: -1 | 1) {
    const projectPlanIds = (plansByProject[projectId] ?? []).map((plan) => plan.id);
    const currentIndex = projectPlanIds.indexOf(planId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= projectPlanIds.length) {
      return;
    }

    const nextOrder = [...projectPlanIds];
    const [moved] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(targetIndex, 0, moved);
    await persistPlanOrder(projectId, nextOrder);
  }

  async function updatePlanStatus(plan: ShootingPlan, status: ShootingPlanStatus) {
    if (plan.status === status) {
      return;
    }

    setPlans((current) =>
      current.map((item) => (item.id === plan.id ? { ...item, status } : item)),
    );
    setSelectedPlan((current) => (current?.id === plan.id ? { ...current, status } : current));

    try {
      await updateShootingPlan(plan.id, {
        project_id: plan.project_id,
        title: plan.title,
        shooting_theme: plan.shooting_theme,
        gear_list: plan.gear_list,
        scene_list: plan.scene_list,
        action_list: plan.action_list,
        composition_reference: plan.composition_reference,
        lighting_reference: plan.lighting_reference,
        post_style: plan.post_style,
        technique_notes: plan.technique_notes,
        notes: plan.notes,
        sort_order: plan.sort_order,
        status,
      });
      await loadWorkspace();
    } catch (error) {
      console.error("更新 Plan 状态失败", error);
      alert(toErrorMessage(error, "更新 Plan 状态失败"));
      await loadWorkspace();
    }
  }

  function requestDeleteProject(project: Project) {
    setPendingDeleteProject(project);
  }

  async function confirmDeleteProject() {
    if (!pendingDeleteProject) {
      return;
    }

    try {
      await deleteProject(pendingDeleteProject.id);
      setPendingDeleteProject(null);
      await loadWorkspace();
    } catch (error) {
      console.error("删除项目失败", error);
      alert(toErrorMessage(error, "删除项目失败"));
    }
  }

  async function confirmDeletePlan() {
    if (!pendingDeletePlan) {
      return;
    }

    try {
      await deleteShootingPlan(pendingDeletePlan.id);
      setPendingDeletePlan(null);
      if (selectedPlan?.id === pendingDeletePlan.id) {
        setSelectedPlan(null);
      }
      if (activeReferencePlanId === pendingDeletePlan.id) {
        setIsReferenceModalOpen(false);
        setActiveReferencePlanId(null);
        setLinkedInspirations([]);
        setAvailableInspirations([]);
      }
      await loadWorkspace();
    } catch (error) {
      alert(toErrorMessage(error, "删除拍摄计划失败"));
    }
  }

  function renderPlanImagePicker() {
    const hasSelectedImage = Boolean(selectedPlanImagePath);
    const previewAsset = hasSelectedImage ? null : existingPlanImage;
    const hasAnyImage = hasSelectedImage || Boolean(previewAsset);
    const previewName = hasSelectedImage
      ? selectedPlanImageName
      : previewAsset?.original_filename ?? "当前封面图";

    return (
      <section className="plan-image-picker">
        <div className="plan-image-picker-header">
          <strong>Plan 参考图</strong>
          <button type="button" onClick={() => void choosePlanImage()}>
            {hasAnyImage ? "更换图片" : "选择图片"}
          </button>
        </div>

        {hasAnyImage && (
          <div className="plan-image-preview">
            {hasSelectedImage ? (
              <img
                src={convertFileSrc(selectedPlanImagePath)}
                alt={selectedPlanImageName || "Plan 参考图"}
                onError={(event) => {
                  console.error("plan selected image preview failed", {
                    sourcePath: selectedPlanImagePath,
                    displayUrl: event.currentTarget.src,
                  });
                }}
              />
            ) : previewAsset ? (
              <img
                src={getMediaAssetDisplayUrl(previewAsset)}
                alt={previewAsset.original_filename ?? "当前封面图"}
                onError={(event) => {
                  console.error("existing plan image preview failed", {
                    asset: previewAsset,
                    displayUrl: event.currentTarget.src,
                  });
                }}
              />
            ) : null}
            <div>
              <strong>{previewName || "已选择图片"}</strong>
              <label className="check-row">
                <input
                  checked={setSelectedPlanImageAsCover}
                  type="checkbox"
                  onChange={(event) => setSetSelectedPlanImageAsCover(event.target.checked)}
                />
                <span>设为 Plan 封面</span>
              </label>
              <button type="button" onClick={clearPlanImageSelection}>
                取消选择
              </button>
            </div>
          </div>
        )}
        {planImageStatus && <p className="muted-text">{planImageStatus}</p>}
      </section>
    );
  }

  return (
    <section className="page-frame">
      <header className="page-header plans-page-header">
        <div className="plans-page-header-main">
          <p className="page-kicker">Projects</p>
          <h1 className="page-title">Photography Projects</h1>
          <p className="page-copy">
            Project 像一个拍摄目录：先建立旅行、商拍或创作周期，再在里面拆解具体 Plans。
          </p>
        </div>
        <div className="plans-page-actions">
          <button className="primary-button new-plan-button" type="button" onClick={openNewProjectModal}>
            + New Project
          </button>
        </div>
      </header>

      <section className="plans-workspace">
        <form className="search-filter-panel projects-filter-panel" onSubmit={handleSearch}>
          <div className="filter-panel-title">
            <strong>搜索项目目录</strong>
            <span>{projects.length} 个 Project</span>
          </div>
          <div className="search-filter-bar projects-filter-bar">
            <input
              className="search-filter-input"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索项目名称 / 主题 / 描述 / 地点..."
            />
            <div className="search-filter-actions">
              <button className="search-filter-button" type="submit">筛选</button>
              <button className="search-filter-reset" type="button" onClick={() => void clearSearch()}>
                清空
              </button>
            </div>
          </div>
        </form>

        {isLoading ? (
          <p className="muted-text">正在加载项目...</p>
        ) : projects.length === 0 ? (
          <p className="empty-message">暂无 Project。先创建一个拍摄目录吧。</p>
        ) : (
          <div className="project-directory-list">
            {projects.map((project, projectIndex) => {
              const projectPlans = plansByProject[project.id] ?? [];
              const isExpanded = expandedProjectIds.has(project.id);

              return (
                <section
                  className="project-directory-section"
                  key={project.id}
                >
                  <header className="project-directory-header">
                    <button
                      className="project-toggle-button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleProject(project.id);
                      }}
                      aria-expanded={isExpanded}
                      title={isExpanded ? "收起 Project" : "展开 Project"}
                    >
                      <span aria-hidden="true">{isExpanded ? "⌄" : "›"}</span>
                      <span className="sr-only">{isExpanded ? "收起" : "展开"}</span>
                    </button>
                    <div className="project-directory-title">
                      <h2>{project.name}</h2>
                      <p>
                        {project.theme || project.description || "未填写主题"}
                        {project.location ? ` · ${project.location}` : ""}
                        {project.planned_shooting_time
                          ? ` · ${formatDateTime(project.planned_shooting_time)}`
                          : ""}
                      </p>
                    </div>
                    <span className="project-plan-count">{projectPlans.length} Plans</span>
                    <div className="project-directory-actions">
                      <button
                        className="icon-button sort-fallback-button"
                        type="button"
                        title="Project 上移"
                        disabled={projectIndex === 0}
                        onClick={(event) => {
                          event.stopPropagation();
                          void moveProject(project.id, -1);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        className="icon-button sort-fallback-button"
                        type="button"
                        title="Project 下移"
                        disabled={projectIndex === projects.length - 1}
                        onClick={(event) => {
                          event.stopPropagation();
                          void moveProject(project.id, 1);
                        }}
                      >
                        ↓
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        title="编辑 Project"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditProject(project);
                        }}
                      >
                        ✎
                      </button>
                      <button
                        className="icon-button icon-button--danger"
                        type="button"
                        title="删除 Project"
                        onClick={(event) => {
                          event.stopPropagation();
                          requestDeleteProject(project);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </header>

                  {pendingDeleteProject?.id === project.id && (
                    <div className="inline-confirm">
                      <p>
                        确定删除 Project「{project.name}」吗？
                        {projectPlans.length > 0 ? ` 该 Project 下的 ${projectPlans.length} 个 Plan 也会被删除。` : ""}
                      </p>
                      <div className="row-actions">
                        <button className="danger-button" type="button" onClick={() => void confirmDeleteProject()}>
                          确认删除
                        </button>
                        <button type="button" onClick={() => setPendingDeleteProject(null)}>取消</button>
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="project-directory-body">
                      <div className="project-plan-card-grid">
                        {projectPlans.map((plan, planIndex) => {
                          const preview = planReferencePreviewMap[plan.id] ?? {
                            cards: [],
                            total: 0,
                          };
                          const coverAsset = planCoverMap[plan.id] ?? planPreviewCoverMap[plan.id] ?? null;
                          const hasCover = coverAsset && !brokenPlanCoverIds.has(plan.id);

                          return (
                            <PlanCard
                              key={plan.id}
                              plan={plan}
                              brokenCoverIds={brokenCoverIds}
                              coverAsset={coverAsset}
                              hasCover={Boolean(hasCover)}
                              inspirationCoverMap={inspirationCoverMap}
                              preview={preview}
                              isReferenceActive={isReferenceModalOpen && activeReferencePlanId === plan.id}
                              canMoveUp={planIndex > 0}
                              canMoveDown={planIndex < projectPlans.length - 1}
                              onBrokenReferenceCover={markCoverBroken}
                              onCoverBroken={() => markPlanCoverBroken(plan.id)}
                              onOpen={() => setSelectedPlan(plan)}
                              onMoveUp={() => void movePlan(project.id, plan.id, -1)}
                              onMoveDown={() => void movePlan(project.id, plan.id, 1)}
                              onStatusChange={(status) => void updatePlanStatus(plan, status)}
                            />
                          );
                        })}
                        <button
                          className="project-plan-add-card"
                          type="button"
                          onClick={() => openNewPlanModal(project)}
                        >
                          <span>＋</span>
                          <strong>New Plan</strong>
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>

      {isProjectModalOpen && (
        <ProjectFormModal
          form={projectForm}
          isSaving={isSavingProject}
          isEditing={editingProjectId !== null}
          onClose={closeProjectModal}
          onSubmit={handleProjectSubmit}
          onChange={setProjectForm}
        />
      )}

      {selectedPlan && (
        <PlanDetailModal
          plan={selectedPlan}
          referenceCount={referenceCounts[selectedPlan.id] ?? 0}
          brokenCoverIds={brokenCoverIds}
          inspirationCoverMap={inspirationCoverMap}
          pendingDeletePlan={pendingDeletePlan}
          preview={
            planReferencePreviewMap[selectedPlan.id] ?? {
              cards: [],
              total: 0,
            }
          }
          onClose={() => {
            setSelectedPlan(null);
            setPendingDeletePlan(null);
            clearSelectedPlanImage();
          }}
          onEdit={() => openEditPlan(selectedPlan)}
          onManageReferences={() => managePlanInspirations(selectedPlan)}
          onOpenReferenceDetail={openInspirationDetail}
          onReferenceBroken={markCoverBroken}
          onDelete={() => setPendingDeletePlan(selectedPlan)}
          onCancelDelete={() => setPendingDeletePlan(null)}
          onConfirmDelete={() => void confirmDeletePlan()}
        />
      )}

      {isPlanModalOpen && (
        <PlanFormModal
          form={planForm}
          isSaving={isSavingPlan}
          isEditing={editingPlanId !== null}
          projectName={projects.find((project) => project.id === planForm.project_id)?.name ?? ""}
          projects={projects}
          imagePicker={renderPlanImagePicker()}
          onClose={closePlanModal}
          onSubmit={handlePlanSubmit}
          onChange={setPlanForm}
        />
      )}

      {isReferenceModalOpen && activeReferencePlan && (
        <ReferenceManagementModal
          activePlan={activeReferencePlan}
          availableInspirations={visibleAvailableReferences}
          brokenCoverIds={brokenCoverIds}
          filters={inspirationFilters}
          inspirationCoverMap={inspirationCoverMap}
          isLoading={isReferenceLoading}
          linkedInspirations={visibleLinkedReferences}
          totalAvailableCount={availableInspirations.length}
          totalLinkedCount={linkedInspirations.length}
          onAdd={addInspirationToPlan}
          onBrokenCover={markCoverBroken}
          onChangeFilters={setInspirationFilters}
          onClearFilters={clearInspirationFilters}
          onClose={closeReferenceModal}
          onDetach={detachInspirationFromPlan}
          onFilter={handleInspirationFilter}
          onOpenDetail={openInspirationDetail}
          onSetCover={setPlanCoverFromCard}
        />
      )}

      {detailInspiration && (
        <InspirationDetailModal
          brokenImageIds={brokenDetailImageIds}
          card={detailInspiration}
          mediaAssets={inspirationMediaMap[detailInspiration.id] ?? []}
          onClose={closeInspirationDetail}
          onImageBroken={(assetId) =>
            setBrokenDetailImageIds((current) => {
              const next = new Set(current);
              next.add(assetId);
              return next;
            })
          }
        />
      )}
    </section>
  );
}

function PlanCard({
  plan,
  preview,
  coverAsset,
  hasCover,
  inspirationCoverMap,
  brokenCoverIds,
  isReferenceActive,
  canMoveUp,
  canMoveDown,
  onBrokenReferenceCover,
  onCoverBroken,
  onOpen,
  onMoveUp,
  onMoveDown,
  onStatusChange,
}: {
  plan: ShootingPlan;
  preview: PlanReferencePreview;
  coverAsset: MediaAsset | null;
  hasCover: boolean;
  inspirationCoverMap: Record<string, MediaAsset | null>;
  brokenCoverIds: Set<string>;
  isReferenceActive: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onBrokenReferenceCover: (cardId: string) => void;
  onCoverBroken: () => void;
  onOpen: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onStatusChange: (status: ShootingPlanStatus) => void;
}) {
  return (
    <article
      className={`entity-card shooting-plan-card shooting-plan-card--compact project-plan-workspace-card ${
        hasCover ? "shooting-plan-card--with-cover" : ""
      } ${isReferenceActive ? "shooting-plan-card--active-reference" : ""}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      {canMoveUp && (
        <button
          aria-label="Plan 前移"
          className="plan-side-order plan-side-order-left"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onMoveUp();
          }}
        >
          ‹
        </button>
      )}
      {canMoveDown && (
        <button
          aria-label="Plan 后移"
          className="plan-side-order plan-side-order-right"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onMoveDown();
          }}
        >
          ›
        </button>
      )}
      {hasCover && coverAsset && (
        <img
          alt=""
          className="plan-card-cover-bg"
          src={getMediaAssetDisplayUrl(coverAsset)}
          onError={onCoverBroken}
        />
      )}
      <div className="plan-card-content">
        <div className="entity-card-header">
          <div>
            <h2>{plan.title}</h2>
            <p className="plan-project-name">Project · {plan.project_name ?? "未知项目"}</p>
          </div>
          <PlanStatusSelectBadge status={plan.status} onChange={onStatusChange} />
        </div>
        {isReferenceActive && <p className="active-reference-label">正在管理参考卡片</p>}

        <div className="plan-compact-lines">
          <p><span>风格主题</span>{plan.shooting_theme || "-"}</p>
          <p><span>器材</span>{plan.gear_list || "-"}</p>
          <p><span>策划概述</span>{plan.notes || "-"}</p>
        </div>

        <PlanReferencePreviewList
          brokenCoverIds={brokenCoverIds}
          inspirationCoverMap={inspirationCoverMap}
          onBroken={onBrokenReferenceCover}
          preview={preview}
        />
      </div>
    </article>
  );
}

function PlanStatusSelectBadge({
  status,
  onChange,
}: {
  status: ShootingPlanStatus;
  onChange: (status: ShootingPlanStatus) => void;
}) {
  return (
    <select
      aria-label="设置 Plan 状态"
      className={`plan-status-select-badge status-pill--${status}`}
      value={status}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        event.stopPropagation();
        onChange(event.target.value as ShootingPlanStatus);
      }}
    >
      {statuses.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

function ProjectFormModal({
  form,
  isEditing,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: ProjectFormState;
  isEditing: boolean;
  isSaving: boolean;
  onChange: (form: ProjectFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="reference-modal-overlay" role="presentation">
      <section aria-modal="true" className="plan-modal project-form-modal" role="dialog">
        <header className="reference-modal-header">
          <div>
            <p className="page-kicker">{isEditing ? "Edit Project" : "New Project"}</p>
            <h2>{isEditing ? "编辑 Project" : "新建 Project"}</h2>
            <p className="muted-text">Project 是一次完整拍摄任务、旅行或创作周期。</p>
          </div>
          <button className="reference-modal-close" type="button" onClick={onClose}>关闭</button>
        </header>
        <form className="plan-modal-body project-form-grid" onSubmit={onSubmit}>
          <label className="field">
            <span>项目名称 *</span>
            <input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} />
          </label>
          <label className="field">
            <span>主题</span>
            <input value={form.theme} onChange={(event) => onChange({ ...form, theme: event.target.value })} />
          </label>
          <label className="field">
            <span>拍摄地点</span>
            <input value={form.location} onChange={(event) => onChange({ ...form, location: event.target.value })} />
          </label>
          <label className="field">
            <span>预计拍摄时间</span>
            <input
              type="datetime-local"
              value={form.planned_shooting_time}
              onChange={(event) => onChange({ ...form, planned_shooting_time: event.target.value })}
            />
          </label>
          <label className="field field--wide">
            <span>项目描述</span>
            <textarea value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} rows={3} />
          </label>
          <label className="field field--wide">
            <span>备注</span>
            <textarea value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} rows={3} />
          </label>
          <button className="primary-button field--wide" disabled={isSaving} type="submit">
            {isSaving ? "保存中..." : isEditing ? "保存 Project" : "创建 Project"}
          </button>
        </form>
      </section>
    </div>
  );
}

function PlanFormModal({
  form,
  imagePicker,
  projectName,
  projects,
  isEditing,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: PlanFormState;
  imagePicker: ReactNode;
  projectName: string;
  projects: Project[];
  isEditing: boolean;
  isSaving: boolean;
  onChange: (form: PlanFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="reference-modal-overlay" role="presentation">
      <section aria-modal="true" className="plan-modal project-plan-form-modal" role="dialog">
        <header className="reference-modal-header">
          <div>
            <p className="page-kicker">{isEditing ? "Edit Plan" : "New Plan"}</p>
            <h2>{isEditing ? "编辑 Plan" : "新建 Plan"}</h2>
            <p className="muted-text">所属 Project：{projectName || "-"}</p>
          </div>
          <div className="modal-header-actions">
            <select
              className={`status-select status-select--${form.status}`}
              value={form.status}
              onChange={(event) => onChange({ ...form, status: event.target.value as ShootingPlanStatus })}
            >
              {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
            <button className="reference-modal-close" type="button" onClick={onClose}>关闭</button>
          </div>
        </header>
        <form className="plan-modal-body project-plan-form-grid" onSubmit={onSubmit}>
          <label className="field">
            <span>所属项目 *</span>
            <select
              value={form.project_id}
              onChange={(event) => onChange({ ...form, project_id: event.target.value })}
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
            <span>Plan 标题 *</span>
            <input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} />
          </label>
          <TextAreaField label="风格主题" value={form.shooting_theme} onChange={(value) => onChange({ ...form, shooting_theme: value })} />
          <TextAreaField label="器材清单" value={form.gear_list} onChange={(value) => onChange({ ...form, gear_list: value })} />
          <TextAreaField label="场景清单" value={form.scene_list} onChange={(value) => onChange({ ...form, scene_list: value })} />
          <TextAreaField label="动作 / 姿态清单" value={form.action_list} onChange={(value) => onChange({ ...form, action_list: value })} />
          <TextAreaField label="构图参考" value={form.composition_reference} onChange={(value) => onChange({ ...form, composition_reference: value })} />
          <TextAreaField label="光线参考" value={form.lighting_reference} onChange={(value) => onChange({ ...form, lighting_reference: value })} />
          <TextAreaField label="后期风格" value={form.post_style} onChange={(value) => onChange({ ...form, post_style: value })} />
          <TextAreaField label="技术备注" value={form.technique_notes} onChange={(value) => onChange({ ...form, technique_notes: value })} />
          <label className="field field--wide">
            <span>策划概述</span>
            <textarea value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} rows={3} />
          </label>
          <div className="field--wide">{imagePicker}</div>
          <button className="primary-button field--wide" disabled={isSaving} type="submit">
            {isSaving ? "保存中..." : isEditing ? "保存修改" : "创建 Plan"}
          </button>
        </form>
      </section>
    </div>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={2} />
    </label>
  );
}

function PlanDetailModal({
  plan,
  referenceCount,
  preview,
  inspirationCoverMap,
  brokenCoverIds,
  pendingDeletePlan,
  onClose,
  onEdit,
  onManageReferences,
  onOpenReferenceDetail,
  onReferenceBroken,
  onDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  plan: ShootingPlan;
  referenceCount: number;
  preview: PlanReferencePreview;
  inspirationCoverMap: Record<string, MediaAsset | null>;
  brokenCoverIds: Set<string>;
  pendingDeletePlan: ShootingPlan | null;
  onClose: () => void;
  onEdit: () => void;
  onManageReferences: () => void;
  onOpenReferenceDetail: (card: InspirationCard) => void;
  onReferenceBroken: (cardId: string) => void;
  onDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  return (
    <div className="reference-modal-overlay" role="presentation">
      <section aria-modal="true" className="plan-modal project-plan-detail-modal" role="dialog">
        <header className="reference-modal-header">
          <div>
            <p className="page-kicker">Plan Detail</p>
            <h2>{plan.title}</h2>
            <p className="muted-text">{plan.project_name ?? "未知 Project"} · {referenceCount} 张参考卡片</p>
          </div>
          <div className="modal-header-actions">
            <span className={`status-pill status-pill--${plan.status}`}>{statusLabel(plan.status)}</span>
            <button className="reference-modal-close" type="button" onClick={onClose}>关闭</button>
          </div>
        </header>
        <div className="plan-modal-body">
          <dl className="project-plan-detail-grid">
            <DetailItem label="风格主题" value={plan.shooting_theme} />
            <DetailItem label="器材" value={plan.gear_list} />
            <DetailItem label="场景" value={plan.scene_list} />
            <DetailItem label="动作 / 姿态" value={plan.action_list} />
            <DetailItem label="构图参考" value={plan.composition_reference} />
            <DetailItem label="光线参考" value={plan.lighting_reference} />
            <DetailItem label="后期风格" value={plan.post_style} />
            <DetailItem label="技术备注" value={plan.technique_notes} />
            <DetailItem label="策划概述" value={plan.notes} />
          </dl>

          <section className="plan-detail-references">
            <div className="reference-section-title">
              <div>
                <h3>参考卡片</h3>
                <p className="muted-text">当前 Plan 已选择的参考内容。</p>
              </div>
              <span>{referenceCount} 张参考卡片</span>
            </div>
            <PlanDetailReferenceWall
              brokenCoverIds={brokenCoverIds}
              inspirationCoverMap={inspirationCoverMap}
              onBroken={onReferenceBroken}
              onOpenDetail={onOpenReferenceDetail}
              preview={preview}
            />
          </section>

          <div className="plan-detail-actions">
            <button type="button" onClick={onEdit}>编辑 Plan</button>
            <button className="primary-button" type="button" onClick={onManageReferences}>
              添加 / 管理参考卡片
            </button>
            <button className="danger-button" type="button" onClick={onDelete}>删除 Plan</button>
          </div>
          {pendingDeletePlan?.id === plan.id && (
            <div className="inline-confirm">
              <p>确定删除拍摄计划「{plan.title}」吗？</p>
              <div className="row-actions">
                <button className="danger-button" type="button" onClick={onConfirmDelete}>确认删除</button>
                <button type="button" onClick={onCancelDelete}>取消</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "-"}</dd>
    </div>
  );
}

function ReferenceManagementModal({
  activePlan,
  linkedInspirations,
  availableInspirations,
  totalLinkedCount,
  totalAvailableCount,
  filters,
  inspirationCoverMap,
  brokenCoverIds,
  isLoading,
  onAdd,
  onDetach,
  onSetCover,
  onOpenDetail,
  onBrokenCover,
  onChangeFilters,
  onFilter,
  onClearFilters,
  onClose,
}: {
  activePlan: ShootingPlan;
  linkedInspirations: InspirationCard[];
  availableInspirations: InspirationCard[];
  totalLinkedCount: number;
  totalAvailableCount: number;
  filters: PlanInspirationFilterState;
  inspirationCoverMap: Record<string, MediaAsset | null>;
  brokenCoverIds: Set<string>;
  isLoading: boolean;
  onAdd: (card: InspirationCard) => void;
  onDetach: (card: InspirationCard) => void;
  onSetCover: (card: InspirationCard) => void;
  onOpenDetail: (card: InspirationCard) => void;
  onBrokenCover: (cardId: string) => void;
  onChangeFilters: (filters: PlanInspirationFilterState) => void;
  onFilter: (event: FormEvent<HTMLFormElement>) => void;
  onClearFilters: () => void;
  onClose: () => void;
}) {
  return (
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
            <h2 id="reference-modal-title">管理参考卡片</h2>
            <p className="muted-text">
              当前计划：{activePlan.title}
              {activePlan.project_name ? ` · 所属项目：${activePlan.project_name}` : ""}
            </p>
          </div>
          <button aria-label="关闭参考卡片管理" className="reference-modal-close" type="button" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="reference-modal-body">
          {isLoading ? (
            <p className="muted-text">正在加载参考卡片...</p>
          ) : (
            <>
              <section className="reference-modal-section">
                <div className="reference-section-title">
                  <div>
                    <h3>已选参考卡片</h3>
                    <p className="muted-text">这些卡片会作为当前拍摄计划的模仿、技巧和执行参考。</p>
                  </div>
                  <span>{linkedInspirations.length} / {totalLinkedCount} 个已选</span>
                </div>

                {linkedInspirations.length === 0 ? (
                  <p className="empty-message">还没有匹配的已选参考卡片。</p>
                ) : (
                  <div className="selected-reference-strip">
                    {linkedInspirations.map((card) => (
                      <ReferenceCard
                        key={card.id}
                        card={card}
                        cover={inspirationCoverMap[card.id] ?? null}
                        isBroken={brokenCoverIds.has(card.id)}
                        isSelected
                        onBroken={() => onBrokenCover(card.id)}
                        onClick={() => void onDetach(card)}
                        onOpenDetail={() => void onOpenDetail(card)}
                        onSetCover={inspirationCoverMap[card.id] ? () => void onSetCover(card) : undefined}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="reference-modal-section">
                <form className="search-filter-panel reference-search-panel" onSubmit={onFilter}>
                  <div className="filter-panel-title">
                    <strong>从卡片库添加</strong>
                    <span>{availableInspirations.length} / {totalAvailableCount} 个可加入卡片</span>
                  </div>
                  <div className="reference-type-tabs" aria-label="参考卡片类型筛选">
                    {referenceCardTypeFilters.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={`reference-type-tab ${filters.card_type === item.value ? "selected" : ""}`}
                        onClick={() => onChangeFilters({ ...filters, card_type: item.value })}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div className="search-filter-bar reference-modal-filter-bar">
                    <input
                      className="search-filter-input"
                      value={filters.keyword}
                      onChange={(event) => onChangeFilters({ ...filters, keyword: event.target.value })}
                      placeholder="搜索标题 / 作者 / 备注 / 链接 / 标签..."
                    />
                    <select
                      className="search-filter-select"
                      value={filters.source_platform}
                      onChange={(event) =>
                        onChangeFilters({
                          ...filters,
                          source_platform: event.target.value as "" | SourcePlatform,
                        })
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
                      <button className="search-filter-button" type="submit">筛选</button>
                      <button className="search-filter-reset" type="button" onClick={() => void onClearFilters()}>
                        清空
                      </button>
                    </div>
                  </div>
                </form>

                {availableInspirations.length === 0 ? (
                  <p className="empty-message">没有匹配的可加入参考卡片。</p>
                ) : (
                  <div className="reference-card-wall">
                    {availableInspirations.map((card) => (
                      <ReferenceCard
                        key={card.id}
                        card={card}
                        cover={inspirationCoverMap[card.id] ?? null}
                        isBroken={brokenCoverIds.has(card.id)}
                        onBroken={() => onBrokenCover(card.id)}
                        onClick={() => void onAdd(card)}
                        onOpenDetail={() => void onOpenDetail(card)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function ReferenceCard({
  card,
  cover,
  isBroken,
  isSelected = false,
  onBroken,
  onClick,
  onOpenDetail,
  onSetCover,
}: {
  card: InspirationCard;
  cover: MediaAsset | null;
  isBroken: boolean;
  isSelected?: boolean;
  onBroken: () => void;
  onClick: () => void;
  onOpenDetail: () => void;
  onSetCover?: () => void;
}) {
  return (
    <article
      className={`reference-card ${isSelected ? "reference-card--selected" : "reference-card--wall"} reference-card--clickable`}
      onClick={onClick}
      title={isSelected ? "取消选择" : "加入计划"}
    >
      <div className="reference-card-tools">
        <span className={`card-type-badge card-type-badge--${card.card_type}`}>
          {cardTypeLabel(card.card_type)}
        </span>
        <button
          aria-label={`展开 ${card.title} 详情`}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenDetail();
          }}
        >
          详情
        </button>
        {onSetCover && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSetCover();
            }}
          >
            设为封面
          </button>
        )}
      </div>
      <InspirationCover asset={cover} isBroken={isBroken} onBroken={onBroken} />
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
        <strong>概述</strong>
        <p>{card.notes || "暂无备注"}</p>
        <span>{card.author_name ? `作者：${card.author_name}` : "作者未记录"}</span>
      </div>
    </article>
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
        alt={asset.original_filename ?? "参考卡片图片"}
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
    return <p className="plan-reference-empty">暂无参考卡片</p>;
  }

  return (
    <div className="plan-reference-preview-list">
      {preview.cards.map((card) => {
        const cover = inspirationCoverMap[card.id] ?? null;
        const isBroken = brokenCoverIds.has(card.id);

        return (
          <div className="plan-reference-preview" key={card.id}>
            <span className={`card-type-badge card-type-badge--${card.card_type}`}>
              {cardTypeLabel(card.card_type)}
            </span>
            {cover && !isBroken ? (
              <img
                src={getMediaAssetDisplayUrl(cover)}
                alt={cover.original_filename ?? card.title}
                onError={() => onBroken(card.id)}
              />
            ) : (
              <span className="plan-reference-preview-placeholder">暂无图片</span>
            )}
            <strong>{card.title}</strong>
          </div>
        );
      })}
    </div>
  );
}

function PlanDetailReferenceWall({
  preview,
  inspirationCoverMap,
  brokenCoverIds,
  onOpenDetail,
  onBroken,
}: {
  preview: PlanReferencePreview;
  inspirationCoverMap: Record<string, MediaAsset | null>;
  brokenCoverIds: Set<string>;
  onOpenDetail: (card: InspirationCard) => void;
  onBroken: (cardId: string) => void;
}) {
  if (preview.cards.length === 0) {
    return <p className="empty-message">当前 Plan 还没有参考卡片。</p>;
  }

  return (
    <div className="plan-detail-reference-wall">
      {preview.cards.map((card) => (
        <article
          className="reference-card reference-card--wall reference-card--clickable"
          key={card.id}
          onClick={() => void onOpenDetail(card)}
          title="查看详情"
        >
          <InspirationCover
            asset={inspirationCoverMap[card.id] ?? null}
            isBroken={brokenCoverIds.has(card.id)}
            onBroken={() => onBroken(card.id)}
          />
          <div className="reference-card-body">
            <span className={`card-type-badge card-type-badge--${card.card_type}`}>
              {cardTypeLabel(card.card_type)}
            </span>
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
        </article>
      ))}
    </div>
  );
}

function InspirationDetailModal({
  card,
  mediaAssets,
  brokenImageIds,
  onImageBroken,
  onClose,
}: {
  card: InspirationCard;
  mediaAssets: MediaAsset[];
  brokenImageIds: Set<string>;
  onImageBroken: (assetId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="reference-modal-overlay" role="presentation">
      <section
        aria-labelledby="inspiration-detail-modal-title"
        aria-modal="true"
        className="inspiration-detail-modal"
        role="dialog"
      >
        <header className="reference-modal-header">
          <div>
            <p className="page-kicker">Card Detail</p>
            <h2 id="inspiration-detail-modal-title">{card.title}</h2>
            <p className="muted-text">
              <span className={`card-type-badge card-type-badge--${card.card_type}`}>
                {cardTypeLabel(card.card_type)}
              </span>
              {platformLabel(card.source_platform)}
              {card.author_name ? ` · ${card.author_name}` : ""}
            </p>
          </div>
          <button className="reference-modal-close" type="button" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="inspiration-detail-body">
          <section className="inspiration-detail-images">
            {mediaAssets.length === 0 ? (
              <div className="inspiration-detail-image-placeholder">暂无图片</div>
            ) : (
              mediaAssets.map((asset) => (
                <div className="inspiration-detail-image" key={asset.id}>
                  {brokenImageIds.has(asset.id) ? (
                    <div className="inspiration-detail-image-placeholder">图片加载失败</div>
                  ) : (
                    <img
                      src={getMediaAssetDisplayUrl(asset)}
                      alt={asset.original_filename ?? card.title}
                      onError={() => onImageBroken(asset.id)}
                    />
                  )}
                </div>
              ))
            )}
          </section>

          <dl className="reference-detail-meta inspiration-detail-meta">
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
            <div>
              <dt>收藏时间</dt>
              <dd>{card.collected_at || "-"}</dd>
            </div>
          </dl>

          <div className="mini-tag-list">
            {card.tags.map((tag) => (
              <span className="mini-tag" key={tag.id}>
                #{tag.name}
              </span>
            ))}
          </div>

          <div className="reference-detail-notes inspiration-detail-notes">
            <h4>完整备注</h4>
            <p>{card.notes || "暂无备注"}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function toProjectForm(project: Project): ProjectFormState {
  return {
    name: project.name,
    theme: project.theme ?? "",
    description: project.description ?? "",
    location: project.location ?? "",
    planned_shooting_time: toDateTimeLocalValue(project.planned_shooting_time),
    notes: project.notes ?? "",
  };
}

function toProjectPayload(form: ProjectFormState): ProjectPayload {
  return {
    name: form.name,
    theme: optionalText(form.theme),
    description: optionalText(form.description),
    location: optionalText(form.location),
    planned_shooting_time: optionalText(fromDateTimeLocalValue(form.planned_shooting_time)),
    notes: optionalText(form.notes),
  };
}

function toPlanForm(plan: ShootingPlan): PlanFormState {
  return {
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
  };
}

function toPlanPayload(form: PlanFormState): ShootingPlanPayload {
  return {
    project_id: form.project_id,
    title: form.title.trim(),
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
  return sourcePlatforms.find((item) => item.value === platform)?.label ?? "其他";
}

function cardTypeLabel(cardType: string): string {
  return cardType === "technique" ? "技巧" : "灵感";
}

function filterCardsByType(
  cards: InspirationCard[],
  cardType: PlanInspirationFilterState["card_type"],
): InspirationCard[] {
  if (cardType === "all") {
    return cards;
  }

  return cards.filter((card) => card.card_type === cardType);
}

function toDateTimeLocalValue(value?: string | null): string {
  if (!value) return "";
  return value.replace(" ", "T").slice(0, 16);
}

function fromDateTimeLocalValue(value: string): string {
  if (!value) return "";
  return value.replace("T", " ");
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  return value.replace("T", " ").slice(0, 16);
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? "已选择图片";
}

function toErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return message && message !== "undefined" ? message : fallback;
}
