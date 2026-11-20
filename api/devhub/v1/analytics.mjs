import { collectAnalyticsSnapshot } from "../../../lib/devhub/analytics.mjs";
import { createRequestId, methodNotAllowed, sendError, sendPrivateSuccess } from "../../../lib/devhub/http.mjs";
import { requireDevHubOwner } from "../../../lib/devhub/auth.mjs";
import { getDevHubStore } from "../../../lib/devhub/firestore-store.mjs";

const PERIODS = new Set(["7d", "30d", "90d", "all"]);

export default async function handler(req, res) {
  const requestId = createRequestId();
  if (!["GET", "POST"].includes(req.method)) return methodNotAllowed(res, requestId, "GET, POST");
  if (req.method === "POST" && !isEmptyBody(req.body)) {
    return sendError(res, 400, "INVALID_ANALYTICS_REQUEST", "A coleta não aceita dados enviados pelo navegador.", requestId);
  }
  try {
    await requireDevHubOwner(req);
    const store = getDevHubStore();
    if (req.method === "POST") {
      const result = await collectAnalyticsSnapshot({ store });
      return sendPrivateSuccess(res, result, requestId);
    }

    function isEmptyBody(body) {
      return body === undefined || body === null
        || (typeof body === "object" && !Array.isArray(body) && Object.keys(body).length === 0);
    }

    const period = Array.isArray(req.query?.period) ? req.query.period[0] : req.query?.period || "30d";
    if (!PERIODS.has(period)) return sendError(res, 400, "INVALID_ANALYTICS_PERIOD", "O período informado é inválido.", requestId);
    const snapshots = await store.listAnalytics({ period });
    return sendPrivateSuccess(res, {
      snapshots,
      latestSnapshot: snapshots.at(-1) || null,
      message: snapshots.length ? null : "A coleta histórica está começando. Gere o primeiro snapshot para iniciar as séries.",
    }, requestId);
  } catch (error) {
    const status = error?.status || 500;
    const code = error?.code || "INTERNAL_ERROR";
    const message = status === 500 ? "Não foi possível concluir a operação." : error.publicMessage;
    return sendError(res, status, code, message, requestId);
  }
}
