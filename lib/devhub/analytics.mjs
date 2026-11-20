import { getDevHubConfig } from "./config.mjs";
import { getDevHubStore } from "./firestore-store.mjs";
import { GitHubClient } from "./github-client.mjs";
import { buildOverview } from "./overview-service.mjs";
import { ServiceMonitor } from "./service-monitor.mjs";
import { VercelClient } from "./vercel-client.mjs";
import { RgaFeedClient } from "./rga-feed-client.mjs";

export async function collectAnalyticsSnapshot({
  config = getDevHubConfig(),
  store = getDevHubStore(),
  now = () => new Date(),
  getOverview = null,
  getRgaFeed = null,
} = {}) {
  const overviewRequest = getOverview ? getOverview() : buildOverview({
      monitor: new ServiceMonitor({ baseUrl: config.rgaBaseUrl }),
      githubClient: new GitHubClient({
        token: config.githubToken,
        repositories: config.githubRepositories,
        username: config.githubUsername,
      }),
      vercelClient: new VercelClient({
        token: config.vercelToken,
        teamId: config.vercelTeamId,
        projects: config.vercelProjects,
      }),
    });
  const feedRequest = getRgaFeed ? getRgaFeed() : new RgaFeedClient({ baseUrl: config.rgaBaseUrl }).getFeed();
  const [overview, feedResult, projects] = await Promise.all([
    overviewRequest,
    Promise.resolve(feedRequest).then(
      (value) => ({ status: "fulfilled", value }),
      (reason) => ({ status: "rejected", reason }),
    ),
    store.listProjects(),
  ]);
  const feed = feedResult.status === "fulfilled" ? feedResult.value : null;
  const { github, vercel, services } = overview.integrations;
  const sources = {
    firebase: "operational",
    github: github.state,
    vercel: vercel.state,
    rga: feed?.state || "unavailable",
  };
  const snapshot = {
    collectedAt: now().toISOString(),
    sources,
    metrics: {
      projects: projects.length,
      githubRepositories: github.repositories.length,
      githubCommits: github.repositories.reduce((total, repo) => total + repo.commits.length, 0),
      githubActions: github.repositories.reduce((total, repo) => total + repo.actions.length, 0),
      vercelDeployments: vercel.projects.reduce((total, project) => total + project.deployments.length, 0),
      rgaNews: feed?.counts.news ?? services.feed?.newsCount ?? null,
      rgaVideos: feed?.counts.videos ?? null,
      rgaPlaylists: feed?.counts.playlists ?? null,
    },
  };
  return store.saveAnalyticsSnapshot(snapshot);
}
