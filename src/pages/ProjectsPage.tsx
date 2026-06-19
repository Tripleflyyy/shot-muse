import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";

import {
  createProject,
  deleteProject,
  listProjects,
  Project,
  ProjectPayload,
  reorderProjects,
  updateProject,
} from "../services/projectApi";
import { listShootingPlanInspirations } from "../services/planInspirationApi";
import {
  createShootingPlan,
  deleteShootingPlan,
  listShootingPlans,
  reorderShootingPlans,
  ShootingPlan,
  ShootingPlanPayload,
  ShootingPlanStatus,
  updateShootingPlan,
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

const emptyProjectForm: ProjectFormState = {
  name: "",
  theme: "",
  description: "",
  location: "",
  planned_shooting_time: "",
  notes: "",
};

const emptyPlanForm: PlanFormState = {
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

const statuses: Array<{ value: ShootingPlanStatus; label: string }> = [
  { value: "draft", label: "草稿" },
  { value: "ready", label: "准备完成" },
  { value: "completed", label: "已完成" },
  { value: "archived", label: "已归档" },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [plans, setPlans] = useState<ShootingPlan[]>([]);
  const [referenceCounts, setReferenceCounts] = useState<Record<string, number>>({});
  const [keyword, setKeyword] = useState("");
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [draggingPlan, setDraggingPlan] = useState<{ projectId: string; planId: string } | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(emptyProjectForm);
  const [planForm, setPlanForm] = useState<PlanFormState>(emptyPlanForm);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [activePlanProjectId, setActivePlanProjectId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ShootingPlan | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<Project | null>(null);
  const [pendingDeletePlan, setPendingDeletePlan] = useState<ShootingPlan | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

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
      setReferenceCounts(await loadReferenceCounts(planData));
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

  async function loadReferenceCounts(planData: ShootingPlan[]) {
    const entries = await Promise.all(
      planData.map(async (plan) => {
        try {
          const references = await listShootingPlanInspirations(plan.id);
          return [plan.id, references.length] as const;
        } catch (error) {
          console.error("加载 Plan 参考卡片数量失败", { planId: plan.id, error });
          return [plan.id, 0] as const;
        }
      }),
    );
    return Object.fromEntries(entries);
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
    setActivePlanProjectId(project.id);
    setEditingPlanId(null);
    setPlanForm(emptyPlanForm);
    setIsPlanModalOpen(true);
    setExpandedProjectIds((current) => new Set(current).add(project.id));
  }

  function openEditPlan(plan: ShootingPlan) {
    setActivePlanProjectId(plan.project_id);
    setEditingPlanId(plan.id);
    setPlanForm(toPlanForm(plan));
    setIsPlanModalOpen(true);
  }

  function closePlanModal() {
    setIsPlanModalOpen(false);
    setEditingPlanId(null);
    setActivePlanProjectId(null);
    setPlanForm(emptyPlanForm);
  }

  async function handlePlanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activePlanProjectId) {
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
        project_id: activePlanProjectId,
      };
      const savedPlan = editingPlanId
        ? await updateShootingPlan(editingPlanId, payload)
        : await createShootingPlan(payload);
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

  async function updatePlanStatus(plan: ShootingPlan, status: ShootingPlanStatus) {
    try {
      await updateShootingPlan(plan.id, {
        ...toPlanPayload(toPlanForm(plan)),
        project_id: plan.project_id,
        sort_order: plan.sort_order,
        status,
      });
      await loadWorkspace();
    } catch (error) {
      alert(toErrorMessage(error, "更新拍摄计划状态失败"));
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

    try {
      await reorderShootingPlans(projectId, nextOrder);
      await loadWorkspace();
    } catch (error) {
      alert(toErrorMessage(error, "调整 Plan 顺序失败"));
    }
  }

  async function dropProject(targetProjectId: string) {
    if (!draggingProjectId || draggingProjectId === targetProjectId) {
      setDraggingProjectId(null);
      return;
    }

    const ids = projects.map((project) => project.id);
    const fromIndex = ids.indexOf(draggingProjectId);
    const toIndex = ids.indexOf(targetProjectId);
    if (fromIndex < 0 || toIndex < 0) {
      setDraggingProjectId(null);
      return;
    }

    const nextOrder = [...ids];
    const [moved] = nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, moved);
    setProjects((current) =>
      nextOrder
        .map((id) => current.find((project) => project.id === id))
        .filter((project): project is Project => Boolean(project)),
    );
    setDraggingProjectId(null);

    try {
      await reorderProjects(nextOrder);
      await loadWorkspace();
    } catch (error) {
      alert(toErrorMessage(error, "调整 Project 顺序失败"));
      await loadWorkspace();
    }
  }

  async function dropPlan(targetProjectId: string, targetPlanId: string) {
    if (!draggingPlan || draggingPlan.projectId !== targetProjectId || draggingPlan.planId === targetPlanId) {
      setDraggingPlan(null);
      return;
    }

    const projectPlans = (plansByProject[targetProjectId] ?? []).map((plan) => plan.id);
    const fromIndex = projectPlans.indexOf(draggingPlan.planId);
    const toIndex = projectPlans.indexOf(targetPlanId);
    if (fromIndex < 0 || toIndex < 0) {
      setDraggingPlan(null);
      return;
    }

    const nextOrder = [...projectPlans];
    const [moved] = nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, moved);
    setDraggingPlan(null);

    try {
      await reorderShootingPlans(targetProjectId, nextOrder);
      await loadWorkspace();
    } catch (error) {
      alert(toErrorMessage(error, "调整 Plan 顺序失败"));
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
      await loadWorkspace();
    } catch (error) {
      alert(toErrorMessage(error, "删除拍摄计划失败"));
    }
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
            {projects.map((project) => {
              const projectPlans = plansByProject[project.id] ?? [];
              const isExpanded = expandedProjectIds.has(project.id);

              return (
                <section
                  className={`project-directory-section ${
                    draggingProjectId === project.id ? "is-dragging" : ""
                  }`}
                  key={project.id}
                  draggable
                  onDragStart={(event) => {
                    setDraggingProjectId(project.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => void dropProject(project.id)}
                  onDragEnd={() => setDraggingProjectId(null)}
                >
                  <header className="project-directory-header">
                    <button
                      className="project-toggle-button"
                      type="button"
                      onClick={() => toggleProject(project.id)}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? "收起" : "展开"}
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
                      <p className="muted-text">
                        Plan 是 Project 下的具体拍摄主题、场景、地点或子任务。
                      </p>

                      <div className="project-plan-card-grid">
                        {projectPlans.map((plan, index) => (
                            <PlanCard
                              key={plan.id}
                              plan={plan}
                              referenceCount={referenceCounts[plan.id] ?? 0}
                              canMoveUp={index > 0}
                              canMoveDown={index < projectPlans.length - 1}
                              isDragging={draggingPlan?.planId === plan.id}
                              onOpen={() => setSelectedPlan(plan)}
                              onEdit={() => openEditPlan(plan)}
                              onStatusChange={(status) => void updatePlanStatus(plan, status)}
                              onMoveUp={() => void movePlan(project.id, plan.id, -1)}
                              onMoveDown={() => void movePlan(project.id, plan.id, 1)}
                              onDragStart={() => setDraggingPlan({ projectId: project.id, planId: plan.id })}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => void dropPlan(project.id, plan.id)}
                              onDragEnd={() => setDraggingPlan(null)}
                            />
                        ))}
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

      {isPlanModalOpen && (
        <PlanFormModal
          form={planForm}
          isSaving={isSavingPlan}
          isEditing={editingPlanId !== null}
          projectName={projects.find((project) => project.id === activePlanProjectId)?.name ?? ""}
          onClose={closePlanModal}
          onSubmit={handlePlanSubmit}
          onChange={setPlanForm}
        />
      )}

      {selectedPlan && (
        <PlanDetailModal
          plan={selectedPlan}
          referenceCount={referenceCounts[selectedPlan.id] ?? 0}
          pendingDeletePlan={pendingDeletePlan}
          onClose={() => {
            setSelectedPlan(null);
            setPendingDeletePlan(null);
          }}
          onEdit={() => openEditPlan(selectedPlan)}
          onDelete={() => setPendingDeletePlan(selectedPlan)}
          onCancelDelete={() => setPendingDeletePlan(null)}
          onConfirmDelete={() => void confirmDeletePlan()}
        />
      )}
    </section>
  );
}

function PlanCard({
  plan,
  referenceCount,
  canMoveUp,
  canMoveDown,
  isDragging,
  onOpen,
  onEdit,
  onStatusChange,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  plan: ShootingPlan;
  referenceCount: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isDragging: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onStatusChange: (status: ShootingPlanStatus) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  return (
    <article
      className={`entity-card shooting-plan-card shooting-plan-card--compact project-plan-workspace-card ${
        isDragging ? "is-dragging" : ""
      }`}
      draggable
      onClick={onOpen}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="plan-card-content">
      <div className="entity-card-header">
        <div>
          <h2>{plan.title}</h2>
          <p className="plan-project-name">Project · {plan.project_name ?? "未知项目"}</p>
        </div>
        <span className={`status-pill status-pill--${plan.status}`}>
          {statusLabel(plan.status)}
        </span>
      </div>
      <div className="plan-compact-lines">
        <p><span>风格主题</span>{plan.shooting_theme || "-"}</p>
        <p><span>器材</span>{plan.gear_list || "-"}</p>
        <p><span>策划概述</span>{plan.notes || "-"}</p>
      </div>
      <p className="plan-reference-empty">{referenceCount} 张参考卡片</p>
      <div className="project-plan-card-controls" onClick={(event) => event.stopPropagation()}>
        <select
          value={plan.status}
          onChange={(event) => onStatusChange(event.target.value as ShootingPlanStatus)}
          aria-label="设置 Plan 状态"
        >
          {statuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
        <button type="button" disabled={!canMoveUp} onClick={onMoveUp}>上移</button>
        <button type="button" disabled={!canMoveDown} onClick={onMoveDown}>下移</button>
      </div>
      <div className="row-actions" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={onEdit}>编辑</button>
      </div>
      </div>
    </article>
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
  projectName,
  isEditing,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: PlanFormState;
  projectName: string;
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
          <button className="reference-modal-close" type="button" onClick={onClose}>关闭</button>
        </header>
        <form className="plan-modal-body project-plan-form-grid" onSubmit={onSubmit}>
          <label className="field">
            <span>Plan 标题 *</span>
            <input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} />
          </label>
          <label className="field">
            <span>状态</span>
            <select value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as ShootingPlanStatus })}>
              {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
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
  pendingDeletePlan,
  onClose,
  onEdit,
  onDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  plan: ShootingPlan;
  referenceCount: number;
  pendingDeletePlan: ShootingPlan | null;
  onClose: () => void;
  onEdit: () => void;
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
          <div className="plan-detail-actions">
            <button type="button" onClick={onEdit}>编辑 Plan</button>
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

function toPlanPayload(form: PlanFormState): Omit<ShootingPlanPayload, "project_id"> {
  return {
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

function toErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return message && message !== "undefined" ? message : fallback;
}
