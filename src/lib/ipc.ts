import { invoke } from "@tauri-apps/api/core";

export interface AppInfo {
  version: string;
  db_path: string;
}

export async function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info");
}
