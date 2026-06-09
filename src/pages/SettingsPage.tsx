import { useEffect, useState } from "react";
import PlaceholderCard from "../components/common/PlaceholderCard";
import { getAppStatus, getLocalAppInfo, type AppStatus } from "../services/appApi";

export default function SettingsPage() {
  const appInfo = getLocalAppInfo();
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getAppStatus()
      .then((appStatus) => {
        if (!isMounted) {
          return;
        }

        setStatus(appStatus);
        setStatusError(null);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setStatus(null);
        setStatusError(
          error instanceof Error
            ? error.message
            : "当前不在 Tauri 环境中，无法读取本地数据库状态。",
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingStatus(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="page-frame">
      <header className="page-header">
        <p className="page-kicker">Settings</p>
        <h1 className="page-title">Settings</h1>
        <p className="page-copy">
          后续会展示应用版本、本地数据库路径、媒体资源目录和导出目录。
        </p>
      </header>

      <div className="placeholder-grid">
        <PlaceholderCard title="Application">
          <dl className="status-list">
            <div>
              <dt>应用名称</dt>
              <dd>{appInfo.name}</dd>
            </div>
            <div>
              <dt>版本</dt>
              <dd>{appInfo.version}</dd>
            </div>
          </dl>
        </PlaceholderCard>
        <PlaceholderCard title="Local Storage">
          {isLoadingStatus ? (
            <p>正在读取本地状态...</p>
          ) : status ? (
            <dl className="status-list">
              <div>
                <dt>数据库初始化</dt>
                <dd>{status.database_initialized ? "已完成" : "未完成"}</dd>
              </div>
              <div>
                <dt>数据库路径</dt>
                <dd className="status-list__path">{status.database_path}</dd>
              </div>
              <div>
                <dt>Migration Version</dt>
                <dd>{status.migration_version}</dd>
              </div>
              <div>
                <dt>预设标签数量</dt>
                <dd>{status.preset_tag_count}</dd>
              </div>
              <div>
                <dt>外键约束</dt>
                <dd>{status.foreign_keys_enabled ? "已开启" : "未开启"}</dd>
              </div>
            </dl>
          ) : (
            <p>
              当前不在 Tauri 环境中，或本地状态读取失败。
              {statusError ? ` ${statusError}` : ""}
            </p>
          )}
        </PlaceholderCard>
        <PlaceholderCard title="Backup">
          预留本地备份入口。
        </PlaceholderCard>
      </div>
    </section>
  );
}
