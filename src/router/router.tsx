import { createHashRouter, Navigate } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import DashboardPage from "../pages/DashboardPage";
import InspirationLibraryPage from "../pages/InspirationLibraryPage";
import ProjectsPage from "../pages/ProjectsPage";
import SettingsPage from "../pages/SettingsPage";
import ShootingPlanPage from "../pages/ShootingPlanPage";
import TagsPage from "../pages/TagsPage";

export const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "projects",
        element: <ProjectsPage />,
      },
      {
        path: "inspiration",
        element: <InspirationLibraryPage />,
      },
      {
        path: "tags",
        element: <TagsPage />,
      },
      {
        path: "shooting-plans",
        element: <ShootingPlanPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
