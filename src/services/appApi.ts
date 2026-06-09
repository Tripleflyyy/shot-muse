import { invoke } from "@tauri-apps/api/core";

export type AppInfo = {
  name: string;
  version: string;
};

export type AppStatus = {
  database_initialized: boolean;
  database_path: string;
  foreign_keys_enabled: boolean;
  migration_version: number;
  preset_tag_count: number;
};

export function getLocalAppInfo(): AppInfo {
  return {
    name: "Shot Muse",
    version: "0.1.0",
  };
}

export async function getAppStatus(): Promise<AppStatus> {
  return invoke<AppStatus>("get_app_status");
}

export async function healthCheck(): Promise<AppStatus> {
  return invoke<AppStatus>("health_check");
}
