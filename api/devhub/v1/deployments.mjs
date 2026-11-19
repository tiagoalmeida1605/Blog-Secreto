import { createRequestId, sendPrivateSuccess, sendError, methodNotAllowed } from "../../../lib/devhub/http.mjs";
import { requireDevHubOwner } from "../../../lib/devhub/auth.mjs";
import { getDevHubConfig } from "../../../lib/devhub/config.mjs";
import { VercelClient } from "../../../lib/devhub/vercel-client.mjs";
import { logRequest } from "../../../lib/devhub/logger.mjs";

export default async function handler(req, res) {
  const started = Date.now();
  const requestId = createRequestId();
  if (req.method !== "GET") return methodNotAllowed(res, requestId);
  try {
    await requireDevHubOwner(req);
    const config = getDevHubConfig();
    const client = new VercelClient({ token: config.vercelToken, teamId: config.vercelTeamId, projects: config.vercelProjects });
    const data = await client.getDeploymentsForAll();
    logRequest({ requestId, endpoint: "/api/devhub/v1/deployments", method: "GET", status: 200, durationMs: Date.now() - started, dependency: "vercel", dependencyStatus: data.length ? "operational" : "unavailable" });
    return sendPrivateSuccess(res, { projects: data }, requestId);
  } catch (error) {
    const status = error?.status || 500;
    const code = error?.code || "INTERNAL_ERROR";
    const message = status === 500 ? "Não foi possível concluir a operação." : error.publicMessage;
    logRequest({ requestId, endpoint: "/api/devhub/v1/deployments", method: "GET", status, durationMs: Date.now() - started, dependency: "vercel", dependencyStatus: "error", error: true });
    return sendError(res, status, code, message, requestId);
  }
}
