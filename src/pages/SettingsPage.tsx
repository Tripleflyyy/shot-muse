import PlaceholderCard from "../components/common/PlaceholderCard";

export default function SettingsPage() {
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
          预留版本和运行环境信息。
        </PlaceholderCard>
        <PlaceholderCard title="Local Storage">
          预留数据库与媒体资源目录信息。
        </PlaceholderCard>
        <PlaceholderCard title="Backup">
          预留本地备份入口。
        </PlaceholderCard>
      </div>
    </section>
  );
}
