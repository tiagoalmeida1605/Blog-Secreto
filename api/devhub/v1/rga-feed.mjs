import { RgaFeedClient } from "../../../lib/devhub/rga-feed-client.mjs";
import { getDevHubConfig } from "../../../lib/devhub/config.mjs";
import { requireDevHubOwner } from "../../../lib/devhub/auth.mjs";
import { createRequestId, methodNotAllowed, sendError, sendPrivateSuccess } from "../../../lib/devhub/http.mjs";

export default async function handler(req, res) {
  const requestId = createRequestId();
  if (req.method !== "GET") return methodNotAllowed(res, requestId);
  try {
    await requireDevHubOwner(req);
    const data = await new RgaFeedClient({ baseUrl: getDevHubConfig().rgaBaseUrl }).getFeed();
    return sendPrivateSuccess(res, data, requestId);
  } catch (error) {
    const status = error?.status || 500;
    return sendError(res, status, error?.code || "INTERNAL_ERROR", status === 500 ? "Não foi possível concluir a operação." : error.publicMessage, requestId);
  }
}
