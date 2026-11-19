import { randomUUID } from "node:crypto";

export function createRequestId() {
  return randomUUID();
}

export function setJsonHeaders(res, privateResponse = false) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (privateResponse) {
    res.setHeader("Cache-Control", "private, no-store");
  }
}

export function sendSuccess(res, data, requestId, extraMeta = {}) {
  setJsonHeaders(res, false);
  return res.status(200).json({
    ok: true,
    data,
    meta: {
      apiVersion: "v1",
      requestId,
      generatedAt: new Date().toISOString(),
      ...extraMeta
    }
  });
}

export function sendPrivateSuccess(res, data, requestId, extraMeta = {}) {
  setJsonHeaders(res, true);
  return res.status(200).json({
    ok: true,
    data,
    meta: {
      apiVersion: "v1",
      requestId,
      generatedAt: new Date().toISOString(),
      ...extraMeta
    }
  });
}

export function sendError(res, status, code, message, requestId) {
  setJsonHeaders(res, true);
  return res.status(status).json({
    ok: false,
    error: { code, message, requestId }
  });
}

export function methodNotAllowed(res, requestId, allowed = "GET") {
  res.setHeader("Allow", allowed);
  return sendError(res, 405, "METHOD_NOT_ALLOWED", "Método HTTP não permitido.", requestId);
}
