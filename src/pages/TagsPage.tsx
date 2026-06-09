import PlaceholderCard from "../components/common/PlaceholderCard";

export default function TagsPage() {
  return (
    <section className="page-frame">
      <header className="page-header">
        <p className="page-kicker">Tags</p>
        <h1 className="page-title">Tags</h1>
        <p className="page-copy">
          后续会按题材、光线、构图、色彩、情绪、技术和自定义分类管理标签。
        </p>
      </header>

      <div className="placeholder-grid">
        <PlaceholderCard title="Default Tags">
          预留系统预设标签展示区域。
        </PlaceholderCard>
        <PlaceholderCard title="Custom Tags">
          预留用户自定义标签管理区域。
        </PlaceholderCard>
        <PlaceholderCard title="Usage">
          预留标签使用情况统计区域。
        </PlaceholderCard>
      </div>
    </section>
  );
}
