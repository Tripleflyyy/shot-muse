import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  createProject,
  deleteProject,
  listProjects,
  Project,
  ProjectPayload,
  updateProject,
} from "../services/projectApi";
import { listShootingPlanInspirations } from "../services/planInspirationApi";
import {
  createShootingPlan,
  listShootingPlans,
  ShootingPlan,
  ShootingPlanPayload,
  ShootingPlanStatus,
} from "../services/shootingPlanApi";

type ProjectFormState = {
  name: string;
  theme: string;
  description: string;
  location: string;
  planned_shooting_time: string;
  notes: string;
};

type QuickPlanFormState = {
  title: string;
  shooting_theme: string;
  notes: string;
  status: ShootingPlanStatus;
};

type ProjectStats = {
  plans: ShootingPlan[];
  plan_count: number;
  completed_plan_count: number;
  draft_plan_count: number;
  ready_plan_count: number;
  archived_plan_count: number;
  reference_card_count: number;
};

const emptyProjectForm: ProjectFormState = {
  name: "",
  theme: "",
  description: "",
  location: "",
  planned_shooting_time: "",
  notes: "",
};

const emptyQuickPlanForm: QuickPlanFormState = {
  title: "",
  shooting_theme: "",
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
  const [projectForm, setProjectForm] = useState<ProjectFormState>(emptyProjectForm);
  const [quickPlanForm, setQuickPlanForm] =
    useState<QuickPlanFormState>(emptyQuickPlanForm);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ShootingPlan | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isQuickPlanOpen, setIsQuickPlanOpen] = useState(false);
  const [pendingDeleteProject, setPendingDeleteProject] =
    useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  const projectStatsMap = useMemo(
    () => buildProjectStats(projects, plans, referenceCounts),
    [projects, plans, referenceCounts],
  );

  const selectedProjectStats = selectedProject
    ? projectStatsMap[selectedProject.id] ?? emptyProjectStats()
    : emptyProjectStats();

  useEffect(() => {
    void loadProjectWorkspace("");
    // Load once on page mount; searches are triggered explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProjectWorkspace(searchKeyword = keyword) {
    setIsLoading(true);
    try {
      const [projectData, planData] = await Promise.all([
        listProjects(searchKeyword.trim() || undefined),
        listShootingPlans(),
      ]);
      setProjects(projectData);
      setPlans(planData);
      setReferenceCounts(await loadPlanReferenceCounts(planData));
      setSelectedProject((current) =>
        current
          ? projectData.find((project) => project.id === current.id) ?? null
          : null,
      );
      setSelectedPlan((current) =>
        current ? planData.find((plan) => plan.id === current.id) ?? null : null,
      );
    } catch (error) {
      alert(toErrorMessage(error, "加载项目工作区失败"));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPlanReferenceCounts(planData: ShootingPlan[]) {
    const entries = await Promise.all(
      planData.map(async (plan) => {
        try {
          const references = await listShootingPlanInspirations(plan.id);
          return [plan.id, references.length] as const;
        } catch (error) {
          console.error("加载 Plan 参考卡片数量失败", {
            planId: plan.id,
            error,
          });
          return [plan.id, 0] as const;
        }
      }),
    );

    return Object.fromEntries(entries);
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadProjectWorkspace(keyword);
  }

  async function clearSearch() {
    setKeyword("");
    await loadProjectWorkspace("");
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

  function openProjectDetail(project: Project) {
    setSelectedProject(project);
    setSelectedPlan(null);
    setIsQuickPlanOpen(false);
    setQuickPlanForm(emptyQuickPlanForm);
    setPendingDeleteProject(null);
  }

  function closeProjectDetail() {
    setSelectedProject(null);
    setSelectedPlan(null);
    setIsQuickPlanOpen(false);
    setQuickPlanForm(emptyQuickPlanForm);
    setPendingDeleteProject(null);
  }

  async function handleProjectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!projectForm.name.trim()) {
      alert("项目名称不能为空");
      return;
    }

    setIsSavingProject(true);
    try {
      const payload = toProjectPayload(projectForm);
      const savedProject = editingProjectId
        ? await updateProject(editingProjectId, payload)
        : await createProject(payload);
      closeProjectModal();
      setSelectedProject(savedProject);
      await loadProjectWorkspace();
    } catch (error) {
      alert(
        toErrorMessage(
          error,
          editingProjectId ? "编辑项目失败" : "创建项目失败",
        ),
      );
    } finally {
      setIsSavingProject(false);
    }
  }

  async function handleQuickPlanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProject) {
      alert("请先选择项目");
      return;
    }

    if (!quickPlanForm.title.trim()) {
      alert("拍摄计划标题不能为空");
      return;
    }

    setIsSavingPlan(true);
    try {
      const payload: ShootingPlanPayload = {
        project_id: selectedProject.id,
        title: quickPlanForm.title.trim(),
        shooting_theme: optionalText(quickPlanForm.shooting_theme),
        notes: optionalText(quickPlanForm.notes),
        status: quickPlanForm.status,
      };
      const savedPlan = await createShootingPlan(payload);
      setQuickPlanForm(emptyQuickPlanForm);
      setIsQuickPlanOpen(false);
      setSelectedPlan(savedPlan);
      await loadProjectWorkspace();
    } catch (error) {
      alert(toErrorMessage(error, "创建拍摄计划失败"));
    } finally {
      setIsSavingPlan(false);
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
      if (selectedProject?.id === pendingDeleteProject.id) {
        closeProjectDetail();
      }
      await loadProjectWorkspace();
    } catch (error) {
      console.error("删除项目失败", error);
      alert(toErrorMessage(error, "删除项目失败"));
    }
  }

  return (
    <section className="page-frame">
      <header className="page-header plans-page-header">
        <div className="plans-page-header-main">
          <p className="page-kicker">Projects</p>
          <h1 className="page-title">Photography Projects</h1>
          <p className="page-copy">
            把一次旅行、商拍或创作周期组织成 Project，再在其中拆解可执行的 Shooting Plans。
          </p>
        </div>
        <div className="plans-page-actions">
          <button
            className="primary-button new-plan-button"
            type="button"
            onClick={openNewProjectModal}
          >
            + New Project
          </button>
        </div>
      </header>

      <section className="plans-workspace">
        <form className="search-filter-panel projects-filter-panel" onSubmit={handleSearch}>
          <div className="filter-panel-title">
            <strong>筛选项目</strong>
            <span>{projects.length} 个匹配项目</span>
          </div>
          <div className="search-filter-bar projects-filter-bar">
            <input
              className="search-filter-input"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索项目名称 / 主题 / 描述 / 地点..."
            />
            <div className="search-filter-actions">
              <button className="search-filter-button" type="submit">
                筛选
              </button>
              <button
                className="search-filter-reset"
                type="button"
                onClick={() => void clearSearch()}
              >
                清空
              </button>
            </div>
          </div>
        </form>

        {isLoading ? (
          <p className="muted-text">正在加载项目...</p>
        ) : projects.length === 0 ? (
          <p className="empty-message">暂无项目。点击 New Project 创建第一个拍摄任务。</p>
        ) : (
          <div className="project-card-wall">
            {projects.map((project) => {
              const stats = projectStatsMap[project.id] ?? emptyProjectStats();
              const latestPlans = stats.plans.slice(0, 3);

              return (
                <article
                  className="entity-card project-card project-card--clickable"
                  key={project.id}
                  onClick={() => openProjectDetail(project)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openProjectDetail(project);
                    }
                  }}
                >
                  <div className="entity-card-header project-card-header">
                    <div>
                      <p className="page-kicker">{projectStatusLabel(stats)}</p>
                      <h2>{project.name}</h2>
                      <p>{project.theme || project.description || "未填写主题"}</p>
                    </div>
                    <span className="status-pill status-pill--ready">
                      {stats.completed_plan_count}/{stats.plan_count}
                    </span>
                  </div>

                  <dl className="project-card-meta">
                    <div>
                      <dt>地点</dt>
                      <dd>{project.location || "-"}</dd>
                    </div>
                    <div>
                      <dt>预计时间</dt>
                      <dd>{formatDateTime(project.planned_shooting_time)}</dd>
                    </div>
                    <div>
                      <dt>最近更新</dt>
                      <dd>{formatDateTime(project.updated_at)}</dd>
                    </div>
                  </dl>

                  <div className="project-stat-grid">
                    <StatTile label="Plans" value={stats.plan_count} />
                    <StatTile label="已完成" value={stats.completed_plan_count} />
                    <StatTile label="参考卡片" value={stats.reference_card_count} />
                  </div>

                  <div className="project-plan-distribution">
                    <span>草稿 {stats.draft_plan_count}</span>
                    <span>准备 {stats.ready_plan_count}</span>
                    <span>归档 {stats.archived_plan_count}</span>
                  </div>

                  <div className="project-recent-plans">
                    <strong>最近 Plans</strong>
                    {latestPlans.length === 0 ? (
                      <p className="muted-text">还没有拆解拍摄计划。</p>
                    ) : (
                      latestPlans.map((plan) => (
                        <span key={plan.id}>
                          {plan.title}
                          <small>{statusLabel(plan.status)}</small>
                        </span>
                      ))
                    )}
                  </div>
                </article>
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

      {selectedProject && (
        <div className="reference-modal-overlay" role="presentation">
          <section
            aria-labelledby="project-detail-modal-title"
            aria-modal="true"
            className="plan-modal project-detail-modal"
            role="dialog"
          >
            <header className="reference-modal-header">
              <div>
                <p className="page-kicker">Project Detail</p>
                <h2 id="project-detail-modal-title">{selectedProject.name}</h2>
                <p className="muted-text">
                  {selectedProject.theme || "一次完整拍摄任务 / 旅行 / 创作周期"}
                </p>
              </div>
              <div className="modal-header-actions">
                <button type="button" onClick={() => openEditProject(selectedProject)}>
                  编辑 Project
                </button>
                <button
                  className="reference-modal-close"
                  type="button"
                  onClick={closeProjectDetail}
                >
                  关闭
                </button>
              </div>
            </header>

            <div className="plan-modal-body">
              <section className="project-detail-summary">
                <div>
                  <span>项目描述</span>
                  <p>{selectedProject.description || "-"}</p>
                </div>
                <div>
                  <span>地点</span>
                  <p>{selectedProject.location || "-"}</p>
                </div>
                <div>
                  <span>预计拍摄时间</span>
                  <p>{formatDateTime(selectedProject.planned_shooting_time)}</p>
                </div>
                <div>
                  <span>备注</span>
                  <p>{selectedProject.notes || "-"}</p>
                </div>
              </section>

              <section className="project-detail-stats">
                <StatTile label="总 Plans" value={selectedProjectStats.plan_count} />
                <StatTile
                  label="已完成"
                  value={selectedProjectStats.completed_plan_count}
                />
                <StatTile label="草稿" value={selectedProjectStats.draft_plan_count} />
                <StatTile label="准备" value={selectedProjectStats.ready_plan_count} />
                <StatTile label="归档" value={selectedProjectStats.archived_plan_count} />
                <StatTile
                  label="参考卡片"
                  value={selectedProjectStats.reference_card_count}
                />
              </section>

              <section className="project-detail-plans">
                <div className="reference-section-title">
                  <div>
                    <h3>Project Plans</h3>
                    <p className="muted-text">
                      Plan 是这个 Project 下的具体拍摄主题、场景或子任务。
                    </p>
                  </div>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      setIsQuickPlanOpen((current) => !current);
                      setSelectedPlan(null);
                    }}
                  >
                    + New Plan
                  </button>
                </div>

                {isQuickPlanOpen && (
                  <form className="quick-plan-form" onSubmit={handleQuickPlanSubmit}>
                    <label className="field">
                      <span>所属 Project</span>
                      <input value={selectedProject.name} disabled />
                    </label>
                    <label className="field">
                      <span>Plan 标题 *</span>
                      <input
                        value={quickPlanForm.title}
                        onChange={(event) =>
                          setQuickPlanForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        placeholder="例如：喀什民族风人像"
                      />
                    </label>
                    <label className="field">
                      <span>风格主题</span>
                      <textarea
                        value={quickPlanForm.shooting_theme}
                        onChange={(event) =>
                          setQuickPlanForm((current) => ({
                            ...current,
                            shooting_theme: event.target.value,
                          }))
                        }
                        rows={2}
                      />
                    </label>
                    <label className="field">
                      <span>状态</span>
                      <select
                        value={quickPlanForm.status}
                        onChange={(event) =>
                          setQuickPlanForm((current) => ({
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
                    <label className="field">
                      <span>策划概述</span>
                      <textarea
                        value={quickPlanForm.notes}
                        onChange={(event) =>
                          setQuickPlanForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        rows={2}
                      />
                    </label>
                    <div className="row-actions">
                      <button className="primary-button" disabled={isSavingPlan} type="submit">
                        {isSavingPlan ? "创建中..." : "创建 Plan"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickPlanForm(emptyQuickPlanForm);
                          setIsQuickPlanOpen(false);
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </form>
                )}

                {selectedProjectStats.plans.length === 0 ? (
                  <p className="empty-message">这个 Project 还没有 Plan。</p>
                ) : (
                  <div className="project-plan-list">
                    {selectedProjectStats.plans.map((plan) => (
                      <article
                        className={`project-plan-row ${
                          selectedPlan?.id === plan.id ? "selected" : ""
                        }`}
                        key={plan.id}
                      >
                        <div>
                          <strong>{plan.title}</strong>
                          <p>
                            {plan.shooting_theme || "未填写主题"}
                            {plan.updated_at ? ` · 更新 ${formatDateTime(plan.updated_at)}` : ""}
                          </p>
                        </div>
                        <span className={`status-pill status-pill--${plan.status}`}>
                          {statusLabel(plan.status)}
                        </span>
                        <span>{referenceCounts[plan.id] ?? 0} 张参考卡片</span>
                        <button type="button" onClick={() => setSelectedPlan(plan)}>
                          查看详情
                        </button>
                      </article>
                    ))}
                  </div>
                )}

                {selectedPlan && (
                  <div className="project-plan-detail-card">
                    <div className="reference-section-title">
                      <div>
                        <h3>{selectedPlan.title}</h3>
                        <p className="muted-text">
                          {statusLabel(selectedPlan.status)} ·{" "}
                          {referenceCounts[selectedPlan.id] ?? 0} 张参考卡片
                        </p>
                      </div>
                    </div>
                    <dl className="project-plan-detail-grid">
                      <div>
                        <dt>风格主题</dt>
                        <dd>{selectedPlan.shooting_theme || "-"}</dd>
                      </div>
                      <div>
                        <dt>器材</dt>
                        <dd>{selectedPlan.gear_list || "-"}</dd>
                      </div>
                      <div>
                        <dt>场景</dt>
                        <dd>{selectedPlan.scene_list || "-"}</dd>
                      </div>
                      <div>
                        <dt>策划概述</dt>
                        <dd>{selectedPlan.notes || "-"}</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </section>

              <div className="plan-detail-actions">
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => requestDeleteProject(selectedProject)}
                >
                  删除 Project
                </button>
              </div>

              {pendingDeleteProject?.id === selectedProject.id && (
                <div className="inline-confirm">
                  <p>
                    确定删除 Project「{selectedProject.name}」吗？
                    {selectedProjectStats.plan_count > 0
                      ? ` 该 Project 下的 ${selectedProjectStats.plan_count} 个 Plan 也会被删除。`
                      : ""}
                  </p>
                  <div className="row-actions">
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => void confirmDeleteProject()}
                    >
                      确认删除
                    </button>
                    <button type="button" onClick={() => setPendingDeleteProject(null)}>
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
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
      <section
        aria-labelledby="project-form-modal-title"
        aria-modal="true"
        className="plan-modal project-form-modal"
        role="dialog"
      >
        <header className="reference-modal-header">
          <div>
            <p className="page-kicker">{isEditing ? "Edit Project" : "New Project"}</p>
            <h2 id="project-form-modal-title">
              {isEditing ? "编辑 Project" : "新建 Project"}
            </h2>
            <p className="muted-text">Project 是一次完整拍摄任务、旅行或创作周期。</p>
          </div>
          <button className="reference-modal-close" type="button" onClick={onClose}>
            关闭
          </button>
        </header>

        <form className="plan-modal-body project-form-grid" onSubmit={onSubmit}>
          <label className="field">
            <span>项目名称 *</span>
            <input
              value={form.name}
              onChange={(event) =>
                onChange({
                  ...form,
                  name: event.target.value,
                })
              }
              placeholder="例如：新疆旅行拍摄"
            />
          </label>
          <label className="field">
            <span>主题</span>
            <input
              value={form.theme}
              onChange={(event) =>
                onChange({
                  ...form,
                  theme: event.target.value,
                })
              }
              placeholder="例如：旅行人文、风光、人像"
            />
          </label>
          <label className="field">
            <span>拍摄地点</span>
            <input
              value={form.location}
              onChange={(event) =>
                onChange({
                  ...form,
                  location: event.target.value,
                })
              }
            />
          </label>
          <label className="field">
            <span>预计拍摄时间</span>
            <input
              type="datetime-local"
              value={form.planned_shooting_time}
              onChange={(event) =>
                onChange({
                  ...form,
                  planned_shooting_time: event.target.value,
                })
              }
            />
          </label>
          <label className="field field--wide">
            <span>项目描述</span>
            <textarea
              value={form.description}
              onChange={(event) =>
                onChange({
                  ...form,
                  description: event.target.value,
                })
              }
              rows={3}
            />
          </label>
          <label className="field field--wide">
            <span>备注</span>
            <textarea
              value={form.notes}
              onChange={(event) =>
                onChange({
                  ...form,
                  notes: event.target.value,
                })
              }
              rows={3}
            />
          </label>

          <button className="primary-button field--wide" disabled={isSaving} type="submit">
            {isSaving ? "保存中..." : isEditing ? "保存 Project" : "创建 Project"}
          </button>
        </form>
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="project-stat-tile">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function buildProjectStats(
  projects: Project[],
  plans: ShootingPlan[],
  referenceCounts: Record<string, number>,
): Record<string, ProjectStats> {
  return Object.fromEntries(
    projects.map((project) => {
      const projectPlans = plans
        .filter((plan) => plan.project_id === project.id)
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at));

      return [
        project.id,
        {
          plans: projectPlans,
          plan_count: projectPlans.length,
          completed_plan_count: projectPlans.filter(
            (plan) => plan.status === "completed",
          ).length,
          draft_plan_count: projectPlans.filter((plan) => plan.status === "draft")
            .length,
          ready_plan_count: projectPlans.filter((plan) => plan.status === "ready")
            .length,
          archived_plan_count: projectPlans.filter(
            (plan) => plan.status === "archived",
          ).length,
          reference_card_count: projectPlans.reduce(
            (sum, plan) => sum + (referenceCounts[plan.id] ?? 0),
            0,
          ),
        },
      ] as const;
    }),
  );
}

function emptyProjectStats(): ProjectStats {
  return {
    plans: [],
    plan_count: 0,
    completed_plan_count: 0,
    draft_plan_count: 0,
    ready_plan_count: 0,
    archived_plan_count: 0,
    reference_card_count: 0,
  };
}

function projectStatusLabel(stats: ProjectStats): string {
  if (stats.plan_count === 0) {
    return "Planning";
  }

  if (stats.completed_plan_count === stats.plan_count) {
    return "Completed";
  }

  if (stats.ready_plan_count > 0) {
    return "Ready";
  }

  return "In Progress";
}

function statusLabel(status: ShootingPlanStatus): string {
  return statuses.find((item) => item.value === status)?.label ?? "草稿";
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
    planned_shooting_time: optionalText(
      fromDateTimeLocalValue(form.planned_shooting_time),
    ),
    notes: optionalText(form.notes),
  };
}

function toDateTimeLocalValue(value?: string | null): string {
  if (!value) {
    return "";
  }

  return value.replace(" ", "T").slice(0, 16);
}

function fromDateTimeLocalValue(value: string): string {
  if (!value) {
    return "";
  }

  return value.replace("T", " ");
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "-";
  }

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
