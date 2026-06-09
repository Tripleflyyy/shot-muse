import PlaceholderCard from "../components/common/PlaceholderCard";

export default function ShootingPlanPage() {
  return (
    <section className="page-frame">
      <header className="page-header">
        <p className="page-kicker">Plans</p>
        <h1 className="page-title">Shooting Plans</h1>
        <p className="page-copy">
          后续会在这里创建拍摄计划，并关联项目、灵感卡片和拍摄准备信息。
        </p>
      </header>

      <div className="placeholder-grid">
        <PlaceholderCard title="Plan List">
          预留拍摄计划列表区域。
        </PlaceholderCard>
        <PlaceholderCard title="References">
          预留关联灵感卡片区域。
        </PlaceholderCard>
        <PlaceholderCard title="Export">
          预留 Markdown 导出入口。
        </PlaceholderCard>
      </div>
    </section>
  );
}
