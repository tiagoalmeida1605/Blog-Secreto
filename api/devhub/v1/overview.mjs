import { createRequestId, sendPrivateSuccess, sendError, methodNotAllowed } from "../../../lib/devhub/http.mjs";
import { requireDevHubOwner } from "../../../lib/devhub/auth.mjs";
import { getDevHubConfig } from "../../../lib/devhub/config.mjs";
import { ServiceMonitor } from "../../../lib/devhub/service-monitor.mjs";
import { GitHubClient } from "../../../lib/devhub/github-client.mjs";
import { VercelClient } from "../../../lib/devhub/vercel-client.mjs";
import { buildOverview } from "../../../lib/devhub/overview-service.mjs";
import { logRequest } from "../../../lib/devhub/logger.mjs";

export default async function handler(req, res) {
  const started = Date.now();
  const requestId = createRequestId();
  if (req.method !== "GET") return methodNotAllowed(res, requestId);
  try {
    await requireDevHubOwner(req);
    const config = getDevHubConfig();
    const data = await buildOverview({
      monitor: new ServiceMonitor({ baseUrl: config.rgaBaseUrl }),
      githubClient: new GitHubClient({ token: config.githubToken, repositories: config.githubRepositories, username: config.githubUsername }),
      vercelClient: new VercelClient({ token: config.vercelToken, teamId: config.vercelTeamId, projects: config.vercelProjects })
    });
    logRequest({ requestId, endpoint: "/api/devhub/v1/overview", method: "GET", status: 200, durationMs: Date.now() - started, dependency: "overview", dependencyStatus: data.overallState });
    return sendPrivateSuccess(res, data, requestId);
  } catch (error) {
    const status = error?.status || 500;
    const code = error?.code || "INTERNAL_ERROR";
    const message = status === 500 ? "Não foi possível concluir a operação." : error.publicMessage;
    logRequest({ requestId, endpoint: "/api/devhub/v1/overview", method: "GET", status, durationMs: Date.now() - started, dependency: "overview", dependencyStatus: "error", error: true });
    return sendError(res, status, code, message, requestId);
  }
}
