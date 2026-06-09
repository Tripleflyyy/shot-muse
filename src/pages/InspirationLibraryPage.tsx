import PlaceholderCard from "../components/common/PlaceholderCard";

export default function InspirationLibraryPage() {
  return (
    <section className="page-frame">
      <header className="page-header">
        <p className="page-kicker">Library</p>
        <h1 className="page-title">Inspiration Library</h1>
        <p className="page-copy">
          后续会在这里保存作品链接、作者、备注、标签和本地截图。
        </p>
      </header>

      <div className="placeholder-grid">
        <PlaceholderCard title="Inspiration Grid">
          预留灵感卡片网格区域。
        </PlaceholderCard>
        <PlaceholderCard title="Source Metadata">
          预留平台、作者和原作品链接信息。
        </PlaceholderCard>
        <PlaceholderCard title="Local Notes">
          预留备注、项目归属和标签信息。
        </PlaceholderCard>
      </div>
    </section>
  );
}
