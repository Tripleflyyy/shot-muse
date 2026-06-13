import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  createProject,
  deleteProject,
  listProjects,
  Project,
  ProjectPayload,
  updateProject,
} from "../services/projectApi";

type ProjectFormState = {
  name: string;
  theme: string;
  description: string;
  location: string;
  planned_shooting_time: string;
  notes: string;
};

const emptyProjectForm: ProjectFormState = {
  name: "",
  theme: "",
  description: "",
  location: "",
  planned_shooting_time: "",
  notes: "",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [keyword, setKeyword] = useState("");
  const [form, setForm] = useState<ProjectFormState>(emptyProjectForm);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteProject, setPendingDeleteProject] =
    useState<Project | null>(null);

  const isEditing = editingProjectId !== null;

  async function loadProjects(searchKeyword = keyword) {
    setIsLoading(true);
    try {
      const data = await listProjects(searchKeyword.trim() || undefined);
      setProjects(data);
    } catch (error) {
      alert(toErrorMessage(error, "加载项目失败"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects("");
    // Run once on page mount; searches are triggered explicitly by the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitLabel = useMemo(
    () => (isEditing ? "保存修改" : "创建项目"),
    [isEditing],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      alert("项目名称不能为空");
      return;
    }

    setIsSaving(true);
    try {
      const payload = toProjectPayload(form);
      if (editingProjectId) {
        await updateProject(editingProjectId, payload);
      } else {
        await createProject(payload);
      }

      resetForm();
      await loadProjects();
    } catch (error) {
      alert(toErrorMessage(error, isEditing ? "编辑项目失败" : "创建项目失败"));
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(project: Project) {
    setEditingProjectId(project.id);
    setForm({
      name: project.name,
      theme: project.theme ?? "",
      description: project.description ?? "",
      location: project.location ?? "",
      planned_shooting_time: project.planned_shooting_time ?? "",
      notes: project.notes ?? "",
    });
  }

  function handleDeleteProject(project: Project) {
    setPendingDeleteProject(project);
  }

  async function confirmDeleteProject() {
    if (!pendingDeleteProject) {
      return;
    }

    const projectId = pendingDeleteProject.id;

    if (!projectId) {
      alert("删除项目失败：项目 ID 为空");
      return;
    }

    try {
      await deleteProject(projectId);
      if (editingProjectId === projectId) {
        resetForm();
      }
      setPendingDeleteProject(null);
      await loadProjects();
    } catch (error) {
      console.error("删除项目失败", error);
      alert(toErrorMessage(error, "删除项目失败"));
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadProjects(keyword);
  }

  function resetForm() {
    setEditingProjectId(null);
    setForm(emptyProjectForm);
  }

  return (
    <section className="page-frame">
      <header className="page-header">
        <p className="page-kicker">Projects</p>
        <h1 className="page-title">Photography Projects</h1>
        <p className="page-copy">
          创建和维护本地摄影项目。当前阶段只处理项目基本信息。
        </p>
      </header>

      <div className="crud-layout">
        <form className="form-panel" onSubmit={handleSubmit}>
          <div className="section-heading">
            <h2>{isEditing ? "编辑项目" : "新建项目"}</h2>
            {isEditing && (
              <button className="text-button" type="button" onClick={resetForm}>
                取消编辑
              </button>
            )}
          </div>

          <label className="field">
            <span>项目名称 *</span>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="例如：春日街拍"
            />
          </label>

          <label className="field">
            <span>主题</span>
            <input
              value={form.theme}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  theme: event.target.value,
                }))
              }
              placeholder="例如：城市日常、人像练习"
            />
          </label>

          <label className="field">
            <span>描述</span>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              rows={3}
            />
          </label>

          <label className="field">
            <span>拍摄地点</span>
            <input
              value={form.location}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  location: event.target.value,
                }))
              }
            />
          </label>

          <label className="field">
            <span>预计拍摄时间</span>
            <input
              value={form.planned_shooting_time}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  planned_shooting_time: event.target.value,
                }))
              }
              placeholder="例如：2026-06-20 16:00"
            />
          </label>

          <label className="field">
            <span>备注</span>
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              rows={3}
            />
          </label>

          <button className="primary-button" disabled={isSaving} type="submit">
            {isSaving ? "保存中..." : submitLabel}
          </button>
        </form>

        <section className="list-panel">
          <form className="toolbar" onSubmit={handleSearch}>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="按名称、主题或描述搜索"
            />
            <button type="submit">搜索</button>
            <button
              type="button"
              onClick={() => {
                setKeyword("");
                void loadProjects("");
              }}
            >
              清空
            </button>
          </form>

          {isLoading ? (
            <p className="muted-text">正在加载项目...</p>
          ) : projects.length === 0 ? (
            <p className="empty-message">暂无项目。先创建一个拍摄项目吧。</p>
          ) : (
            <div className="entity-list">
              {projects.map((project) => (
                <article className="entity-card" key={project.id}>
                  <div>
                    <h2>{project.name}</h2>
                    <p>{project.theme || "未填写主题"}</p>
                  </div>
                  <dl className="compact-meta">
                    <div>
                      <dt>地点</dt>
                      <dd>{project.location || "-"}</dd>
                    </div>
                    <div>
                      <dt>时间</dt>
                      <dd>{project.planned_shooting_time || "-"}</dd>
                    </div>
                    <div>
                      <dt>描述</dt>
                      <dd>{project.description || "-"}</dd>
                    </div>
                  </dl>
                  {project.notes && <p className="note-text">{project.notes}</p>}
                  <div className="row-actions">
                    <button type="button" onClick={() => handleEdit(project)}>
                      编辑
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => handleDeleteProject(project)}
                    >
                      删除
                    </button>
                  </div>
                  {pendingDeleteProject?.id === project.id && (
                    <div className="inline-confirm">
                      <p>确定删除项目「{project.name}」吗？</p>
                      <div className="row-actions">
                        <button
                          className="danger-button"
                          type="button"
                          onClick={() => void confirmDeleteProject()}
                        >
                          确认删除
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingDeleteProject(null);
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

function toProjectPayload(form: ProjectFormState): ProjectPayload {
  return {
    name: form.name,
    theme: optionalText(form.theme),
    description: optionalText(form.description),
    location: optionalText(form.location),
    planned_shooting_time: optionalText(form.planned_shooting_time),
    notes: optionalText(form.notes),
  };
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return message ? `${fallback}：${message}` : fallback;
}
