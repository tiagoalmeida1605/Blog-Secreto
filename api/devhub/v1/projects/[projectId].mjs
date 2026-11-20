import { createRequestId, methodNotAllowed, sendError, sendPrivateSuccess } from "../../../../lib/devhub/http.mjs";
import { requireDevHubOwner } from "../../../../lib/devhub/auth.mjs";
import { getDevHubStore } from "../../../../lib/devhub/firestore-store.mjs";

export default async function handler(req, res) {
  const requestId = createRequestId();
  if (req.method !== "PATCH") return methodNotAllowed(res, requestId, "PATCH");
  try {
    await requireDevHubOwner(req);
    const id = Array.isArray(req.query?.projectId) ? req.query.projectId[0] : req.query?.projectId;
    const project = await getDevHubStore().updateProject(id, req.body);
    if (!project) return sendError(res, 404, "PROJECT_NOT_FOUND", "Projeto não encontrado.", requestId);
    return sendPrivateSuccess(res, project, requestId);
  } catch (error) {
    const status = ["INVALID_PROJECT", "INVALID_PROJECT_ID"].includes(error?.message) ? 400 : error?.status || 500;
    const code = status === 400 ? error.message : error?.code || "INTERNAL_ERROR";
    const message = status === 400 ? "Os dados do projeto são inválidos." : status === 500 ? "Não foi possível concluir a operação." : error.publicMessage;
    return sendError(res, status, code, message, requestId);
  }
}
