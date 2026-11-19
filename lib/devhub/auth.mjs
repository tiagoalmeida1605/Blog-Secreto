import * as admin from "firebase-admin";
import { DevHubError } from "./errors.mjs";
import { getDevHubConfig, parsePrivateKey } from "./config.mjs";

let adminApp = null;

function getAdminApp(config) {
  if (adminApp) return adminApp;
  if (!config.ownerUid || !config.firebaseProjectId || !config.serviceAccountJson) {
    throw new DevHubError(503, "AUTH_NOT_CONFIGURED", "Autenticação indisponível no momento.");
  }
  const serviceAccount = parsePrivateKey(config.serviceAccountJson);
  if (!serviceAccount || !serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new DevHubError(503, "AUTH_NOT_CONFIGURED", "Autenticação indisponível no momento.");
  }
  if (serviceAccount.project_id !== config.firebaseProjectId) {
    throw new DevHubError(503, "AUTH_NOT_CONFIGURED", "Autenticação indisponível no momento.");
  }
  adminApp = admin.apps.length
    ? admin.app()
    : admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: config.firebaseProjectId
      });
  return adminApp;
}

export async function requireDevHubOwner(req, env = process.env) {
  const config = getDevHubConfig(env);
  const authorization = req.headers?.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ") || authorization.length <= 7) {
    throw new DevHubError(401, "UNAUTHENTICATED", "Autenticação necessária.");
  }
  const token = authorization.slice(7).trim();
  if (!token) throw new DevHubError(401, "UNAUTHENTICATED", "Autenticação necessária.");
  return verifyDevHubOwnerToken(token, config);
}

export async function verifyDevHubOwnerToken(token, config, verifyIdTokenImpl = null) {
  if (!config.ownerUid || !config.firebaseProjectId || !config.serviceAccountJson) {
    throw new DevHubError(503, "AUTH_NOT_CONFIGURED", "Autenticação indisponível no momento.");
  }
  let decoded;
  try {
    if (verifyIdTokenImpl) {
      decoded = await verifyIdTokenImpl(token, config.checkRevocation);
    } else {
      const app = getAdminApp(config);
      decoded = await admin.auth(app).verifyIdToken(token, config.checkRevocation);
    }
  } catch (error) {
    const code = error?.code || "";
    if (code.includes("expired")) {
      throw new DevHubError(401, "TOKEN_EXPIRED", "O token expirou.");
    }
    throw new DevHubError(401, "INVALID_TOKEN", "Token inválido ou revogado.");
  }
  if (!decoded?.uid || decoded.uid !== config.ownerUid) {
    throw new DevHubError(403, "FORBIDDEN", "Acesso permitido somente ao proprietário.");
  }
  return { uid: decoded.uid };
}
