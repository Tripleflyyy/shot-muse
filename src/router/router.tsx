import { createHashRouter, Navigate } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
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
        element: <Navigate to="/inspiration" replace />,
      },
      {
        path: "inspiration",
        element: <InspirationLibraryPage />,
      },
      {
        path: "projects",
        element: <ProjectsPage />,
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
        element: <Navigate to="/inspiration" replace />,
      },
    ],
  },
]);
