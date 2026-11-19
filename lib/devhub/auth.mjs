import * as admin from "firebase-admin";
import { DevHubError } from "./errors.mjs";
import { getDevHubConfig, parsePrivateKey } from "./config.mjs";

let adminApp = null;

function getServiceAccount(config) {
  if (!config.ownerUid || !config.firebaseProjectId || !config.serviceAccountJson) {
    throw new DevHubError(503, "AUTH_NOT_CONFIGURED", "Autenticação indisponível no momento.");
  }

  const serviceAccount = parsePrivateKey(config.serviceAccountJson);
  if (!serviceAccount) {
    throw new DevHubError(503, "INVALID_SERVICE_ACCOUNT_JSON", "Autenticação indisponível no momento.");
  }
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new DevHubError(503, "INVALID_SERVICE_ACCOUNT_CONFIG", "Autenticação indisponível no momento.");
  }
  if (serviceAccount.project_id !== config.firebaseProjectId) {
    throw new DevHubError(503, "FIREBASE_PROJECT_MISMATCH", "Autenticação indisponível no momento.");
  }
  return serviceAccount;
}

function isCredentialError(error) {
  return ["auth/invalid-credential", "auth/insufficient-permission"].includes(error?.code);
}

function isAdminCredentialError(error) {
  return isCredentialError(error) || error?.code === "app/invalid-credential";
}

function initializeAdminError(error) {
  if (error instanceof DevHubError) return error;
  if (isAdminCredentialError(error)) {
    return new DevHubError(503, "FIREBASE_ADMIN_CREDENTIAL_ERROR", "Autenticação indisponível no momento.");
  }
  return new DevHubError(503, "FIREBASE_ADMIN_INITIALIZATION_FAILED", "Autenticação indisponível no momento.");
}

function getAdminApp(config) {
  const serviceAccount = getServiceAccount(config);
  if (adminApp) return adminApp;

  try {
    adminApp = admin.apps.length
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: config.firebaseProjectId
        });
  } catch (error) {
    throw initializeAdminError(error);
  }
  return adminApp;
}

function tokenValidationError(error) {
  if (error instanceof DevHubError) return error;
  const code = error?.code;

  if (code === "auth/id-token-expired") {
    return new DevHubError(401, "TOKEN_EXPIRED", "O token expirou.");
  }
  if (code === "auth/id-token-revoked") {
    return new DevHubError(401, "TOKEN_REVOKED", "O token foi revogado.");
  }
  if (code === "auth/invalid-id-token" || code === "auth/argument-error") {
    return new DevHubError(401, "INVALID_TOKEN", "Token inválido.");
  }
  if (isAdminCredentialError(error)) {
    return new DevHubError(503, "FIREBASE_ADMIN_CREDENTIAL_ERROR", "Autenticação indisponível no momento.");
  }
  return new DevHubError(500, "FIREBASE_ADMIN_VERIFICATION_FAILED", "Não foi possível validar a autenticação.");
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

export async function verifyDevHubOwnerToken(token, config, verifyIdTokenImpl = null, getAdminAppImpl = getAdminApp) {
  getServiceAccount(config);

  let verifyToken;
  if (verifyIdTokenImpl) {
    verifyToken = verifyIdTokenImpl;
  } else {
    let app;
    try {
      app = getAdminAppImpl(config);
    } catch (error) {
      throw initializeAdminError(error);
    }
    verifyToken = (idToken, checkRevocation) => admin.auth(app).verifyIdToken(idToken, checkRevocation);
  }

  let decoded;
  try {
    decoded = await verifyToken(token, config.checkRevocation);
  } catch (error) {
    throw tokenValidationError(error);
  }
  if (!decoded?.uid || decoded.uid !== config.ownerUid) {
    throw new DevHubError(403, "FORBIDDEN", "Acesso permitido somente ao proprietário.");
  }
  return { uid: decoded.uid };
}
