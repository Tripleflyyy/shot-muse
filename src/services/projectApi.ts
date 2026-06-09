import { invoke } from "@tauri-apps/api/core";

export type Project = {
  id: string;
  name: string;
  theme: string | null;
  description: string | null;
  location: string | null;
  planned_shooting_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectPayload = {
  name: string;
  theme?: string | null;
  description?: string | null;
  location?: string | null;
  planned_shooting_time?: string | null;
  notes?: string | null;
};

export async function createProject(payload: ProjectPayload): Promise<Project> {
  return invoke<Project>("create_project", { payload });
}

export async function updateProject(
  id: string,
  payload: ProjectPayload,
): Promise<Project> {
  return invoke<Project>("update_project", { id, payload });
}

export async function deleteProject(id: string): Promise<boolean> {
  return invoke<boolean>("delete_project", { id });
}

export async function getProject(id: string): Promise<Project> {
  return invoke<Project>("get_project", { id });
}

export async function listProjects(keyword?: string): Promise<Project[]> {
  return invoke<Project[]>("list_projects", { keyword });
}
