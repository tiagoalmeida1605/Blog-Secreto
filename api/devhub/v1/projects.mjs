import { createRequestId, methodNotAllowed, sendError, sendPrivateSuccess } from "../../../lib/devhub/http.mjs";
import { requireDevHubOwner } from "../../../lib/devhub/auth.mjs";
import { getDevHubStore } from "../../../lib/devhub/firestore-store.mjs";

export default async function handler(req, res) {
  const requestId = createRequestId();
  if (!["GET", "POST"].includes(req.method)) return methodNotAllowed(res, requestId, "GET, POST");
  try {
    await requireDevHubOwner(req);
    const store = getDevHubStore();
    if (req.method === "GET") {
      const projects = await store.listProjects();
      return sendPrivateSuccess(res, { projects }, requestId);
    }
    const project = await store.createProject(req.body);
    return sendPrivateSuccess(res, project, requestId);
  } catch (error) {
    const status = error?.message === "INVALID_PROJECT" ? 400 : error?.status || 500;
    const code = status === 400 ? "INVALID_PROJECT" : error?.code || "INTERNAL_ERROR";
    const message = status === 400 ? "Os dados do projeto são inválidos." : status === 500 ? "Não foi possível concluir a operação." : error.publicMessage;
    return sendError(res, status, code, message, requestId);
  }
}
