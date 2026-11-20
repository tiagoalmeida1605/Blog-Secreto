import { lazy } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";

const LoginPage = lazy(() => import("../features/auth/LoginPage").then(({ LoginPage }) => ({ default: LoginPage })));
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage").then(({ DashboardPage }) => ({ default: DashboardPage })));
const ProjectsPage = lazy(() => import("../features/projects/ProjectsPage").then(({ ProjectsPage }) => ({ default: ProjectsPage })));
const AnalyticsPage = lazy(() => import("../features/analytics/AnalyticsPage").then(({ AnalyticsPage }) => ({ default: AnalyticsPage })));
const IntegrationsPage = lazy(() => import("../features/integrations/IntegrationsPage").then(({ IntegrationsPage }) => ({ default: IntegrationsPage })));
const GithubPage = lazy(() => import("../features/github/GithubPage").then(({ GithubPage }) => ({ default: GithubPage })));
const VercelPage = lazy(() => import("../features/vercel/VercelPage").then(({ VercelPage }) => ({ default: VercelPage })));
const RgaPage = lazy(() => import("../features/rga/RgaPage").then(({ RgaPage }) => ({ default: RgaPage })));
const AdminPage = lazy(() => import("../features/admin/AdminPage").then(({ AdminPage }) => ({ default: AdminPage })));
const SystemPage = lazy(() => import("../features/system/SystemPage").then(({ SystemPage }) => ({ default: SystemPage })));

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "projects", element: <ProjectsPage /> },
          { path: "analytics", element: <AnalyticsPage /> },
          { path: "integrations", element: <IntegrationsPage /> },
          { path: "github", element: <GithubPage /> },
          { path: "vercel", element: <VercelPage /> },
          { path: "rga", element: <RgaPage /> },
          { path: "admin", element: <AdminPage /> },
          { path: "system", element: <SystemPage /> },
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
