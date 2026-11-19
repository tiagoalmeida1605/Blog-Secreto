import { createRequestId, sendSuccess, sendError, methodNotAllowed } from "../../../lib/devhub/http.mjs";

export default function handler(req, res) {
  const requestId = createRequestId();
  if (req.method !== "GET") return methodNotAllowed(res, requestId);
  res.setHeader("Cache-Control", "no-store");
  return sendSuccess(res, { status: "ok" }, requestId);
}
