export type NavItem = {
  label: string;
  path: string;
  description: string;
};

export const navItems: NavItem[] = [
  {
    label: "Dashboard",
    path: "/",
    description: "最近项目、灵感和拍摄计划",
  },
  {
    label: "Projects",
    path: "/projects",
    description: "整理摄影项目和主题",
  },
  {
    label: "Card Library",
    path: "/inspiration",
    description: "管理灵感卡和技巧卡",
  },
  {
    label: "Tags",
    path: "/tags",
    description: "管理题材、光线、构图等标签",
  },
  {
    label: "Shooting Plans",
    path: "/shooting-plans",
    description: "沉淀可执行的拍摄计划",
  },
  {
    label: "Settings",
    path: "/settings",
    description: "查看本地应用配置",
  },
];
