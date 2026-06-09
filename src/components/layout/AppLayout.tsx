import { Outlet, useLocation } from "react-router-dom";
import { navItems } from "../../app/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout() {
  const location = useLocation();
  const currentItem =
    navItems.find((item) => item.path === location.pathname) ?? navItems[0];

  return (
    <div className="app-shell">
      <Sidebar items={navItems} />
      <main className="app-main">
        <Topbar title={currentItem.label} description={currentItem.description} />
        <Outlet />
      </main>
    </div>
  );
}
