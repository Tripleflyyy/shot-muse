import PlaceholderCard from "../components/common/PlaceholderCard";

export default function ProjectsPage() {
  return (
    <section className="page-frame">
      <header className="page-header">
        <p className="page-kicker">Projects</p>
        <h1 className="page-title">Photography Projects</h1>
        <p className="page-copy">
          后续会在这里创建、搜索和管理摄影项目，并进入项目详情页。
        </p>
      </header>

      <div className="placeholder-grid">
        <PlaceholderCard title="Project List">
          预留项目列表区域。
        </PlaceholderCard>
        <PlaceholderCard title="Project Filters">
          预留关键词搜索与筛选区域。
        </PlaceholderCard>
        <PlaceholderCard title="Plan Entry">
          预留从项目生成拍摄计划的入口。
        </PlaceholderCard>
      </div>
    </section>
  );
}
