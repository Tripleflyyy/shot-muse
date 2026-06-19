import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  CardType,
  InspirationCard,
  listInspirationCards,
} from "../services/inspirationApi";
import {
  getMediaAssetDisplayUrl,
  listMediaAssetsByTarget,
  MediaAsset,
} from "../services/mediaApi";
import { listShootingPlanInspirations } from "../services/planInspirationApi";
import { listProjects, Project } from "../services/projectApi";
import {
  listShootingPlans,
  ShootingPlan,
  ShootingPlanStatus,
} from "../services/shootingPlanApi";

type DashboardIssue = "缺标签" | "缺备注" | "缺图片" | "未关联 Plan";

type ContinueItem = {
  id: string;
  type: "Project" | "Plan" | "Card";
  title: string;
  description: string;
  updatedAt: string;
  to: string;
};

const statusLabels: Record<ShootingPlanStatus, string> = {
  draft: "草稿",
  ready: "准备完成",
  completed: "已完成",
  archived: "已归档",
};

const cardTypeLabels: Record<CardType, string> = {
  inspiration: "灵感",
  technique: "技巧",
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [plans, setPlans] = useState<ShootingPlan[]>([]);
  const [cards, setCards] = useState<InspirationCard[]>([]);
  const [cardMedia, setCardMedia] = useState<Record<string, MediaAsset[]>>({});
  const [planMedia, setPlanMedia] = useState<Record<string, MediaAsset[]>>({});
  const [planReferenceCounts, setPlanReferenceCounts] = useState<Record<string, number>>({});
  const [cardReferenceCounts, setCardReferenceCounts] = useState<Record<string, number>>({});
  const [brokenAssetIds, setBrokenAssetIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    setIsLoading(true);
    setLoadErrors([]);

    const errors: string[] = [];
    const [projectResult, planResult, cardResult] = await Promise.allSettled([
      listProjects(),
      listShootingPlans(),
      listInspirationCards({ card_type: "all" }),
    ]);

    const nextProjects =
      projectResult.status === "fulfilled" ? projectResult.value : [];
    const nextPlans = planResult.status === "fulfilled" ? planResult.value : [];
    const nextCards = cardResult.status === "fulfilled" ? cardResult.value : [];

    if (projectResult.status === "rejected") {
      errors.push(`Projects 加载失败：${toErrorMessage(projectResult.reason)}`);
    }
    if (planResult.status === "rejected") {
      errors.push(`Plans 加载失败：${toErrorMessage(planResult.reason)}`);
    }
    if (cardResult.status === "rejected") {
      errors.push(`Cards 加载失败：${toErrorMessage(cardResult.reason)}`);
    }

    setProjects(nextProjects);
    setPlans(nextPlans);
    setCards(nextCards);

    const [nextCardMedia, nextPlanMedia, nextPlanReferenceCounts, nextCardReferenceCounts] =
      await Promise.all([
        loadCardMedia(nextCards, errors),
        loadPlanMedia(nextPlans, errors),
        loadPlanReferences(nextPlans, errors),
        loadCardReferenceCounts(nextPlans, errors),
      ]);

    setCardMedia(nextCardMedia);
    setPlanMedia(nextPlanMedia);
    setPlanReferenceCounts(nextPlanReferenceCounts);
    setCardReferenceCounts(nextCardReferenceCounts);
    setLoadErrors(errors);
    setIsLoading(false);
  }

  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const plansByProject = useMemo(() => {
    const map = new Map<string, ShootingPlan[]>();
    plans.forEach((plan) => {
      const list = map.get(plan.project_id) ?? [];
      list.push(plan);
      map.set(plan.project_id, list);
    });
    return map;
  }, [plans]);

  const recentProjects = useMemo(
    () => sortByRecent(projects).slice(0, 3),
    [projects],
  );
  const recentPlans = useMemo(() => sortByRecent(plans).slice(0, 3), [plans]);
  const recentCards = useMemo(() => sortByRecent(cards).slice(0, 3), [cards]);

  const activeProjects = useMemo(() => {
    return [...projects]
      .sort((left, right) => {
        const leftOpen = countOpenPlans(plansByProject.get(left.id) ?? []);
        const rightOpen = countOpenPlans(plansByProject.get(right.id) ?? []);
        if (rightOpen !== leftOpen) {
          return rightOpen - leftOpen;
        }
        return timestamp(right.updated_at || right.created_at) - timestamp(left.updated_at || left.created_at);
      })
      .slice(0, 4);
  }, [plansByProject, projects]);

  const focusPlans = useMemo(() => {
    const draftAndReady = plans.filter(
      (plan) => plan.status === "draft" || plan.status === "ready",
    );
    const pool = draftAndReady.length > 0 ? draftAndReady : plans;
    return sortByRecent(pool).slice(0, 6);
  }, [plans]);

  const unprocessedCards = useMemo(() => {
    return sortByRecent(cards)
      .map((card) => ({
        card,
        issues: cardIssues(card, cardMedia[card.id] ?? [], cardReferenceCounts[card.id] ?? 0),
      }))
      .filter((item) => item.issues.length > 0)
      .slice(0, 6);
  }, [cardMedia, cardReferenceCounts, cards]);

  const stats = useMemo(
    () => [
      { label: "Projects", value: projects.length },
      { label: "Plans", value: plans.length },
      { label: "Cards", value: cards.length },
      {
        label: "Ready Plans",
        value: plans.filter((plan) => plan.status === "ready").length,
      },
    ],
    [cards.length, plans, projects.length],
  );

  return (
    <section className="page-frame dashboard-page">
      <header className="dashboard-hero">
        <div>
          <p className="page-kicker">Dashboard</p>
          <h1 className="page-title">继续你的拍摄创作</h1>
          <p className="page-copy">
            快速回到最近的项目、计划和待整理卡片，让灵感继续往下走。
          </p>
        </div>
        <div className="dashboard-quick-actions" aria-label="快速操作">
          <Link className="primary-button" to="/inspiration">
            + New Card
          </Link>
          <Link className="primary-button" to="/projects">
            + New Project
          </Link>
          <Link className="primary-button" to="/shooting-plans">
            + New Plan
          </Link>
        </div>
      </header>

      <div className="dashboard-stats" aria-label="工作台摘要">
        {stats.map((stat) => (
          <div className="dashboard-stat-card" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>

      {loadErrors.length > 0 && (
        <div className="dashboard-alert" role="status">
          <strong>部分数据暂时不可用</strong>
          {loadErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="empty-message">正在整理你的创作工作台...</p>
      ) : (
        <>
          <section className="dashboard-section">
            <div className="dashboard-section-header">
              <div>
                <p className="page-kicker">Continue Working</p>
                <h2>最近继续</h2>
              </div>
              <p>最近更新的 Project、Plan 和卡片。</p>
            </div>
            <div className="dashboard-continue-grid">
              <ContinueColumn
                emptyText="还没有 Project。"
                items={recentProjects.map(projectToContinueItem)}
                title="最近 Projects"
              />
              <ContinueColumn
                emptyText="还没有 Plan。"
                items={recentPlans.map((plan) => planToContinueItem(plan, projectsById))}
                title="最近 Plans"
              />
              <ContinueColumn
                emptyText="还没有卡片。"
                items={recentCards.map(cardToContinueItem)}
                title="最近 Cards"
              />
            </div>
          </section>

          <section className="dashboard-section">
            <div className="dashboard-section-header">
              <div>
                <p className="page-kicker">Active Projects</p>
                <h2>活跃项目</h2>
              </div>
              <Link className="text-button" to="/projects">
                查看 Projects
              </Link>
            </div>
            {activeProjects.length === 0 ? (
              <EmptyWorkbenchCard
                actionLabel="+ New Project"
                text="还没有项目。先建立一个创作目录。"
                to="/projects"
              />
            ) : (
              <div className="dashboard-active-projects">
                {activeProjects.map((project) => {
                  const projectPlans = plansByProject.get(project.id) ?? [];
                  const openPlans = countOpenPlans(projectPlans);
                  return (
                    <Link className="dashboard-workbench-card" key={project.id} to="/projects">
                      <div className="dashboard-card-heading">
                        <h3>{project.name}</h3>
                        <span className="dashboard-type-badge">Project</span>
                      </div>
                      <p>{project.theme || project.description || "未填写主题"}</p>
                      <div className="dashboard-card-metrics">
                        <span>{projectPlans.length} Plans</span>
                        <span>{openPlans} 未完成</span>
                        <span>{formatDate(project.updated_at || project.created_at)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section className="dashboard-section">
            <div className="dashboard-section-header">
              <div>
                <p className="page-kicker">Ready / Draft Plans</p>
                <h2>待继续计划</h2>
              </div>
              <Link className="text-button" to="/shooting-plans">
                查看 Shooting Plans
              </Link>
            </div>
            {focusPlans.length === 0 ? (
              <EmptyWorkbenchCard
                actionLabel="+ New Plan"
                text="还没有拍摄计划。"
                to="/shooting-plans"
              />
            ) : (
              <div className="dashboard-plan-list">
                {focusPlans.map((plan) => (
                  <DashboardPlanCard
                    cover={resolveCover(planMedia[plan.id] ?? [], plan.cover_media_asset_id)}
                    isBroken={brokenAssetIds.has(resolveCover(planMedia[plan.id] ?? [], plan.cover_media_asset_id)?.id ?? "")}
                    key={plan.id}
                    onImageError={markAssetBroken}
                    plan={plan}
                    project={projectsById.get(plan.project_id)}
                    referenceCount={planReferenceCounts[plan.id] ?? 0}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-section">
            <div className="dashboard-section-header">
              <div>
                <p className="page-kicker">Unprocessed Cards</p>
                <h2>待整理卡片</h2>
              </div>
              <Link className="text-button" to="/inspiration">
                打开 Card Library
              </Link>
            </div>
            {unprocessedCards.length === 0 ? (
              <div className="dashboard-empty-state">卡片库很整洁。</div>
            ) : (
              <div className="dashboard-card-list">
                {unprocessedCards.map(({ card, issues }) => (
                  <DashboardUnprocessedCard
                    card={card}
                    cover={resolveCover(cardMedia[card.id] ?? [], card.cover_media_asset_id)}
                    isBroken={brokenAssetIds.has(resolveCover(cardMedia[card.id] ?? [], card.cover_media_asset_id)?.id ?? "")}
                    issues={issues}
                    key={card.id}
                    onImageError={markAssetBroken}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );

  function markAssetBroken(assetId: string) {
    setBrokenAssetIds((current) => {
      const next = new Set(current);
      next.add(assetId);
      return next;
    });
  }
}

function ContinueColumn({
  emptyText,
  items,
  title,
}: {
  emptyText: string;
  items: ContinueItem[];
  title: string;
}) {
  return (
    <div className="dashboard-mini-card">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted-text">{emptyText}</p>
      ) : (
        <div className="dashboard-mini-list">
          {items.map((item) => (
            <Link className="dashboard-mini-row" key={item.id} to={item.to}>
              <span className="dashboard-type-badge">{item.type}</span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
              <time>{formatDate(item.updatedAt)}</time>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardPlanCard({
  cover,
  isBroken,
  onImageError,
  plan,
  project,
  referenceCount,
}: {
  cover: MediaAsset | null;
  isBroken: boolean;
  onImageError: (assetId: string) => void;
  plan: ShootingPlan;
  project?: Project;
  referenceCount: number;
}) {
  return (
    <Link className="dashboard-plan-card" to="/shooting-plans">
      <DashboardCover
        asset={cover}
        fallback="暂无封面"
        isBroken={isBroken}
        onImageError={onImageError}
      />
      <div className="dashboard-plan-body">
        <div className="dashboard-card-heading">
          <h3>{plan.title}</h3>
          <span className={`status-pill status-pill--${plan.status}`}>
            {statusLabels[plan.status]}
          </span>
        </div>
        <p className="dashboard-plan-project">{project?.name ?? plan.project_name ?? "未知项目"}</p>
        <p>{plan.shooting_theme || "未填写风格主题"}</p>
        <div className="dashboard-card-metrics">
          <span>{plan.gear_list || "未填写器材"}</span>
          <span>{referenceCount} 参考卡片</span>
        </div>
      </div>
    </Link>
  );
}

function DashboardUnprocessedCard({
  card,
  cover,
  isBroken,
  issues,
  onImageError,
}: {
  card: InspirationCard;
  cover: MediaAsset | null;
  isBroken: boolean;
  issues: DashboardIssue[];
  onImageError: (assetId: string) => void;
}) {
  return (
    <Link className="dashboard-card-item" to="/inspiration">
      <DashboardCover
        asset={cover}
        fallback="暂无图片"
        isBroken={isBroken}
        onImageError={onImageError}
      />
      <div>
        <div className="dashboard-card-heading">
          <h3>{card.title}</h3>
          <span className={`card-type-badge card-type-badge--${card.card_type}`}>
            {cardTypeLabels[card.card_type]}
          </span>
        </div>
        <p>{card.notes || "暂无备注"}</p>
        <div className="dashboard-issue-list">
          {issues.map((issue) => (
            <span key={issue}>{issue}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function DashboardCover({
  asset,
  fallback,
  isBroken,
  onImageError,
}: {
  asset: MediaAsset | null;
  fallback: string;
  isBroken: boolean;
  onImageError: (assetId: string) => void;
}) {
  if (!asset || isBroken) {
    return <div className="dashboard-cover-placeholder">{fallback}</div>;
  }

  return (
    <img
      alt=""
      className="dashboard-cover-image"
      src={getMediaAssetDisplayUrl(asset)}
      onError={() => onImageError(asset.id)}
    />
  );
}

function EmptyWorkbenchCard({
  actionLabel,
  text,
  to,
}: {
  actionLabel: string;
  text: string;
  to: string;
}) {
  return (
    <div className="dashboard-empty-state">
      <p>{text}</p>
      <Link className="text-button" to={to}>
        {actionLabel}
      </Link>
    </div>
  );
}

async function loadCardMedia(cards: InspirationCard[], errors: string[]) {
  const results = await Promise.allSettled(
    cards.map(async (card) => [
      card.id,
      await listMediaAssetsByTarget("inspiration", card.id),
    ] as const),
  );
  return objectFromSettledMedia(results, errors, "卡片图片");
}

async function loadPlanMedia(plans: ShootingPlan[], errors: string[]) {
  const results = await Promise.allSettled(
    plans.map(async (plan) => [
      plan.id,
      await listMediaAssetsByTarget("shooting_plan", plan.id),
    ] as const),
  );
  return objectFromSettledMedia(results, errors, "Plan 图片");
}

async function loadPlanReferences(plans: ShootingPlan[], errors: string[]) {
  const results = await Promise.allSettled(
    plans.map(async (plan) => [
      plan.id,
      await listShootingPlanInspirations(plan.id),
    ] as const),
  );
  const counts: Record<string, number> = {};
  results.forEach((result) => {
    if (result.status === "fulfilled") {
      counts[result.value[0]] = result.value[1].length;
    }
  });
  if (results.some((result) => result.status === "rejected")) {
    errors.push("部分 Plan 参考卡片统计加载失败。");
  }
  return counts;
}

async function loadCardReferenceCounts(plans: ShootingPlan[], errors: string[]) {
  const results = await Promise.allSettled(
    plans.map((plan) => listShootingPlanInspirations(plan.id)),
  );
  const counts: Record<string, number> = {};
  results.forEach((result) => {
    if (result.status === "fulfilled") {
      result.value.forEach((card) => {
        counts[card.id] = (counts[card.id] ?? 0) + 1;
      });
    }
  });
  if (results.some((result) => result.status === "rejected")) {
    errors.push("部分卡片关联 Plan 状态加载失败。");
  }
  return counts;
}

function objectFromSettledMedia(
  results: PromiseSettledResult<readonly [string, MediaAsset[]]>[],
  errors: string[],
  label: string,
) {
  const entries: Array<[string, MediaAsset[]]> = [];
  results.forEach((result) => {
    if (result.status === "fulfilled") {
      entries.push([result.value[0], sortMedia(result.value[1])]);
    }
  });
  if (results.some((result) => result.status === "rejected")) {
    errors.push(`部分${label}加载失败。`);
  }
  return Object.fromEntries(entries);
}

function projectToContinueItem(project: Project): ContinueItem {
  return {
    id: project.id,
    type: "Project",
    title: project.name,
    description: project.theme || project.description || "未填写主题",
    updatedAt: project.updated_at || project.created_at,
    to: "/projects",
  };
}

function planToContinueItem(
  plan: ShootingPlan,
  projectsById: Map<string, Project>,
): ContinueItem {
  return {
    id: plan.id,
    type: "Plan",
    title: plan.title,
    description: projectsById.get(plan.project_id)?.name ?? plan.project_name ?? "未知项目",
    updatedAt: plan.updated_at || plan.created_at,
    to: "/shooting-plans",
  };
}

function cardToContinueItem(card: InspirationCard): ContinueItem {
  return {
    id: card.id,
    type: "Card",
    title: card.title,
    description: `${cardTypeLabels[card.card_type]} · ${card.author_name || "未填写作者"}`,
    updatedAt: card.updated_at || card.created_at,
    to: "/inspiration",
  };
}

function cardIssues(
  card: InspirationCard,
  media: MediaAsset[],
  referenceCount: number,
): DashboardIssue[] {
  const issues: DashboardIssue[] = [];
  if (card.tags.length === 0) {
    issues.push("缺标签");
  }
  if (!card.notes?.trim()) {
    issues.push("缺备注");
  }
  if (media.length === 0) {
    issues.push("缺图片");
  }
  if (referenceCount === 0) {
    issues.push("未关联 Plan");
  }
  return issues;
}

function resolveCover(media: MediaAsset[], coverMediaAssetId?: string | null) {
  const sorted = sortMedia(media);
  return (
    sorted.find((asset) => asset.id === coverMediaAssetId) ??
    sorted[0] ??
    null
  );
}

function sortMedia(media: MediaAsset[]) {
  return [...media].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }
    return timestamp(left.created_at) - timestamp(right.created_at);
  });
}

function sortByRecent<T extends { created_at: string; updated_at: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      timestamp(right.updated_at || right.created_at) -
      timestamp(left.updated_at || left.created_at),
  );
}

function countOpenPlans(projectPlans: ShootingPlan[]) {
  return projectPlans.filter(
    (plan) => plan.status !== "completed" && plan.status !== "archived",
  ).length;
}

function timestamp(value?: string | null) {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "未知时间";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "未知错误";
}
