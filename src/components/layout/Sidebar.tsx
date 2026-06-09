import { NavLink } from "react-router-dom";
import type { NavItem } from "../../app/navigation";

type SidebarProps = {
  items: NavItem[];
};

export default function Sidebar({ items }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <h1 className="sidebar__brand-name">Shot Muse</h1>
        <p className="sidebar__brand-note">Local photography planner</p>
      </div>

      <nav className="sidebar__nav" aria-label="Primary navigation">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar__link${isActive ? " sidebar__link--active" : ""}`
            }
            end={item.path === "/"}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
