const API_BASE_PATH = "/api/devhub/v1";

export class DevHubApiError extends Error {
  constructor({ kind, code, status = null, message, cause }) {
    super(message, { cause });
    this.name = "DevHubApiError";
    this.kind = kind;
    this.code = code;
    this.status = status;
  }
}

function createApiError(response, payload) {
  const apiError = payload?.error;
  const code = typeof apiError?.code === "string" ? apiError.code : null;
  const message = typeof apiError?.message === "string" ? apiError.message : "A API não conseguiu concluir a solicitação.";
  let kind = "HTTP_ERROR";
  if (response.status === 401) kind = "UNAUTHORIZED";
  else if (response.status === 403) kind = "FORBIDDEN";
  else if (response.status === 503 && code === "AUTH_NOT_CONFIGURED") {
    kind = "FIREBASE_ADMIN_NOT_CONFIGURED";
  } else if ([502, 503, 504].includes(response.status)) {
    kind = "INTEGRATION_UNAVAILABLE";
  }
  return new DevHubApiError({
    kind,
    code: code || `HTTP_${response.status}`,
    status: response.status,
    message
  });
}

export function createDevHubApiClient({ auth, fetchImpl = globalThis.fetch } = {}) {
  async function request(endpoint) {
    const user = auth?.currentUser;
    if (!user) {
      throw new DevHubApiError({
        kind: "NOT_AUTHENTICATED",
        code: "USER_NOT_AUTHENTICATED",
        message: "Entre na sua conta para acessar o DevHub."
      });
    }

    let token;
    try {
      token = await user.getIdToken();
    } catch (cause) {
      throw new DevHubApiError({
        kind: "TOKEN_UNAVAILABLE",
        code: "TOKEN_UNAVAILABLE",
        message: "Não foi possível obter o token de autenticação.",
        cause
      });
    }
    if (typeof token !== "string" || token.length === 0) {
      throw new DevHubApiError({
        kind: "TOKEN_UNAVAILABLE",
        code: "TOKEN_MISSING",
        message: "Não foi possível obter o token de autenticação."
      });
    }

    let response;
    try {
      response = await fetchImpl(`${API_BASE_PATH}/${endpoint}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        },
        cache: "no-store"
      });
    } catch (cause) {
      throw new DevHubApiError({
        kind: "NETWORK_ERROR",
        code: "NETWORK_ERROR",
        message: "Não foi possível se comunicar com a API DevHub.",
        cause
      });
    }

    let payload;
    try {
      payload = await response.json();
    } catch (cause) {
      throw new DevHubApiError({
        kind: "INVALID_JSON",
        code: "INVALID_JSON",
        status: response.status,
        message: "A API DevHub retornou uma resposta JSON inválida.",
        cause
      });
    }

    if (!response.ok) {
      throw createApiError(response, payload);
    }
    if (payload?.ok === false) throw createApiError(response, payload);
    if (payload?.ok !== true || typeof payload !== "object" || payload === null) {
      throw new DevHubApiError({
        kind: "INVALID_RESPONSE",
        code: "INVALID_RESPONSE",
        status: response.status,
        message: "A API DevHub retornou uma resposta inesperada."
      });
    }
    if (!Object.hasOwn(payload, "data")) {
      throw new DevHubApiError({
        kind: "INVALID_RESPONSE",
        code: "INVALID_RESPONSE",
        status: response.status,
        message: "A API DevHub retornou uma resposta inesperada."
      });
    }
    return payload.data;
  }

  return Object.freeze({
    getOverview: () => request("overview"),
    getServices: () => request("services"),
    getGithub: () => request("github"),
    getDeployments: () => request("deployments")
  });
}

let defaultClientPromise;

function getDefaultClient() {
  if (!defaultClientPromise) {
    defaultClientPromise = import("./firebase.js").then(({ auth }) => createDevHubApiClient({ auth }));
  }
  return defaultClientPromise;
}

export async function getOverview() {
  return (await getDefaultClient()).getOverview();
}

export async function getServices() {
  return (await getDefaultClient()).getServices();
}

export async function getGithub() {
  return (await getDefaultClient()).getGithub();
}

export async function getDeployments() {
  return (await getDefaultClient()).getDeployments();
}
