import { Outlet } from "react-router-dom";
import { navItems } from "../../app/navigation";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar items={navItems} />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
