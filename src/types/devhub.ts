export type IntegrationState =
  | "operational"
  | "degraded"
  | "unavailable"
  | "partially_configured";

export interface IntegrationSummary {
  state: IntegrationState;
  message?: string;
  failures?: Array<{ code: string; message: string }>;
  [key: string]: unknown;
}

export interface Overview {
  overallState: IntegrationState;
  integrations: {
    services: IntegrationSummary & {
      name: string;
      health?: Record<string, unknown>;
      feed?: Record<string, unknown>;
    };
    github: IntegrationSummary & {
      repositories: GitHubRepository[];
    };
    vercel: IntegrationSummary & {
      projects: VercelProject[];
    };
  };
}

export interface GitHubCommit {
  sha: string | null;
  message: string | null;
  authoredAt: string | null;
  url: string | null;
}

export interface GitHubWorkflow {
  id: number | null;
  name: string | null;
  status: string | null;
  conclusion: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  url: string | null;
}

export interface GitHubRepository {
  repository: string;
  name: string;
  visibility: string;
  defaultBranch: string | null;
  updatedAt: string | null;
  htmlUrl: string | null;
  commits: GitHubCommit[];
  actions: GitHubWorkflow[];
}

export interface VercelDeployment {
  id: string | null;
  name: string;
  environment: string;
  state: string;
  url: string | null;
  createdAt: string | null;
  readyAt: string | null;
}

export interface VercelProject {
  project: string;
  deployments: VercelDeployment[];
  state?: IntegrationState;
  error?: { code: string; message: string };
}

export type ProjectStatus = "active" | "planned" | "paused" | "archived";

export interface DevHubProject {
  id: string;
  name: string;
  description: string;
  category: string;
  status: ProjectStatus;
  repository: string;
  productionUrl: string;
  technologies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput extends Omit<DevHubProject, "id" | "createdAt" | "updatedAt"> {}

export const DASHBOARD_WIDGETS = [
  "integrations",
  "projects",
  "github",
  "deployments",
  "rga",
] as const;

export type DashboardWidget = (typeof DASHBOARD_WIDGETS)[number];
export const INTEGRATION_MODULES = ["github", "vercel", "rga", "firebase"] as const;
export type IntegrationModule = (typeof INTEGRATION_MODULES)[number];

export interface DevHubSettings {
  dashboardWidgets: DashboardWidget[];
  visibleIntegrations: IntegrationModule[];
}

export interface AnalyticsSnapshot {
  id: string;
  collectedAt: string;
  sources: Record<string, IntegrationState>;
  metrics: {
    projects: number;
    githubRepositories: number;
    githubCommits: number;
    githubActions: number;
    vercelDeployments: number;
    rgaNews: number | null;
    rgaVideos: number | null;
    rgaPlaylists: number | null;
  };
}

export interface AnalyticsHistory {
  snapshots: AnalyticsSnapshot[];
  latestSnapshot: AnalyticsSnapshot | null;
  message: string | null;
}

export interface RgaFeedItem {
  id: string;
  kind: "noticia" | "video" | "playlist";
  title: string;
  summary: string;
  image: string;
  date: string | null;
  tags: string[];
  url: string;
}

export interface RgaFeed {
  state: IntegrationState;
  items: RgaFeedItem[];
  counts: Record<string, number | null>;
  checkedAt: string;
  message: string | null;
}
