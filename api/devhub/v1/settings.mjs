import { createRequestId, methodNotAllowed, sendError, sendPrivateSuccess } from "../../../lib/devhub/http.mjs";
import { requireDevHubOwner } from "../../../lib/devhub/auth.mjs";
import { getDevHubStore } from "../../../lib/devhub/firestore-store.mjs";

export default async function handler(req, res) {
  const requestId = createRequestId();
  if (!["GET", "PUT"].includes(req.method)) return methodNotAllowed(res, requestId, "GET, PUT");
  try {
    await requireDevHubOwner(req);
    const store = getDevHubStore();
    const settings = req.method === "GET" ? await store.getSettings() : await store.updateSettings(req.body);
    return sendPrivateSuccess(res, settings, requestId);
  } catch (error) {
    const status = error?.message === "INVALID_SETTINGS" ? 400 : error?.status || 500;
    const code = status === 400 ? "INVALID_SETTINGS" : error?.code || "INTERNAL_ERROR";
    const message = status === 400 ? "As preferências informadas são inválidas." : status === 500 ? "Não foi possível concluir a operação." : error.publicMessage;
    return sendError(res, status, code, message, requestId);
  }
}
