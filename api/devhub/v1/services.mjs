import { createRequestId, sendPrivateSuccess, sendError, methodNotAllowed } from "../../../lib/devhub/http.mjs";
import { requireDevHubOwner } from "../../../lib/devhub/auth.mjs";
import { getDevHubConfig } from "../../../lib/devhub/config.mjs";
import { ServiceMonitor } from "../../../lib/devhub/service-monitor.mjs";
import { logRequest } from "../../../lib/devhub/logger.mjs";

export default async function handler(req, res) {
  const started = Date.now();
  const requestId = createRequestId();
  if (req.method !== "GET") return methodNotAllowed(res, requestId);
  try {
    await requireDevHubOwner(req);
    const config = getDevHubConfig();
    const monitor = new ServiceMonitor({ baseUrl: config.rgaBaseUrl });
    const data = await monitor.getServices();
    logRequest({ requestId, endpoint: "/api/devhub/v1/services", method: "GET", status: 200, durationMs: Date.now() - started, dependency: "rga", dependencyStatus: data.state });
    return sendPrivateSuccess(res, data, requestId);
  } catch (error) {
    const status = error?.status || 500;
    const code = error?.code || "INTERNAL_ERROR";
    const message = status === 500 ? "Não foi possível concluir a operação." : error.publicMessage;
    logRequest({ requestId, endpoint: "/api/devhub/v1/services", method: "GET", status, durationMs: Date.now() - started, dependency: "rga", dependencyStatus: "error", error: true });
    return sendError(res, status, code, message, requestId);
  }
}
