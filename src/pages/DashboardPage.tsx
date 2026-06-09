import PlaceholderCard from "../components/common/PlaceholderCard";

export default function DashboardPage() {
  return (
    <section className="page-frame">
      <header className="page-header">
        <p className="page-kicker">Overview</p>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-copy">
          首页将展示最近更新的项目、最近收藏的灵感卡片和最近编辑的拍摄计划。
        </p>
      </header>

      <div className="placeholder-grid">
        <PlaceholderCard title="Recent Projects">
          项目列表接入后，这里显示最近更新的摄影项目。
        </PlaceholderCard>
        <PlaceholderCard title="Recent Inspiration">
          灵感卡片接入后，这里显示最近保存的参考作品。
        </PlaceholderCard>
        <PlaceholderCard title="Recent Plans">
          拍摄计划接入后，这里显示最近创建或编辑的计划。
        </PlaceholderCard>
      </div>
    </section>
  );
}
