export type AppInfo = {
  name: string;
  version: string;
};

export function getLocalAppInfo(): AppInfo {
  return {
    name: "Shot Muse",
    version: "0.1.0",
  };
}
