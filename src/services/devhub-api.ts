import type {
  AnalyticsHistory,
  AnalyticsSnapshot,
  DevHubProject,
  DevHubSettings,
  GitHubRepository,
  Overview,
  ProjectInput,
  RgaFeed,
  VercelProject,
} from "../types/devhub";
import type { Auth } from "firebase/auth";
import { signOut } from "firebase/auth";

export class DevHubApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "DevHubApiError";
    this.code = code;
    this.status = status;
  }
}

interface ApiEnvelope<T> {
  ok: true;
  data: T;
}

export function createDevHubApi(auth: Auth, fetchImpl: typeof fetch = fetch) {
  async function request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    await authPersistenceReady();
    const user = auth.currentUser;
    if (!user) throw new DevHubApiError("USER_NOT_AUTHENTICATED", "Entre para continuar.", 401);

    let token: string;
    try {
      token = await user.getIdToken();
    } catch {
      throw new DevHubApiError("TOKEN_UNAVAILABLE", "Não foi possível validar a sessão.", 401);
    }

    let response: Response;
    try {
      response = await fetchImpl(`/api/devhub/v1/${path}`, {
        method: options.method || "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        cache: "no-store",
      });
    } catch {
      throw new DevHubApiError("NETWORK_ERROR", "Não foi possível se comunicar com a API Dev Hub.", 0);
    }

    let payload: ApiEnvelope<T> | { ok: false; error?: { code?: string; message?: string } };
    try {
      payload = await response.json() as typeof payload;
    } catch {
      throw new DevHubApiError("INVALID_RESPONSE", "A API Dev Hub retornou uma resposta inválida.", response.status);
    }

    if (!response.ok || payload?.ok !== true) {
      const error = payload && typeof payload === "object" && "error" in payload ? payload.error : undefined;
      if (response.status === 401) void signOut(auth);
      throw new DevHubApiError(
        error?.code || `HTTP_${response.status}`,
        error?.message || "A API Dev Hub não conseguiu concluir a solicitação.",
        response.status,
      );
    }
    return payload.data;
  }

  return {
    getHealth: () => request<{ status: string }>("health"),
    getOverview: () => request<Overview>("overview"),
    getServices: () => request<Overview["integrations"]["services"]>("services"),
    getGithub: () => request<{ state: string; repositories: GitHubRepository[]; failures?: Overview["integrations"]["github"]["failures"] }>("github"),
    getDeployments: () => request<{ projects: VercelProject[] }>("deployments"),
    getProjects: () => request<{ projects: DevHubProject[] }>("projects"),
    createProject: (input: ProjectInput) => request<DevHubProject>("projects", { method: "POST", body: input }),
    updateProject: (id: string, input: Partial<ProjectInput>) =>
      request<DevHubProject>(`projects/${encodeURIComponent(id)}`, { method: "PATCH", body: input }),
    getSettings: () => request<DevHubSettings>("settings"),
    updateSettings: (settings: DevHubSettings) =>
      request<DevHubSettings>("settings", { method: "PUT", body: settings }),
    getAnalytics: (period: string) =>
      request<AnalyticsHistory>(`analytics?period=${encodeURIComponent(period)}`),
    collectAnalytics: () =>
      request<{ snapshot: AnalyticsSnapshot; created: boolean }>("analytics", { method: "POST" }),
    getRgaFeed: () => request<RgaFeed>("rga-feed"),
  };
}

let persistenceReady: Promise<void> = Promise.resolve();

export function setAuthPersistenceReady(promise: Promise<void>) {
  persistenceReady = promise;
}

async function authPersistenceReady() {
  await persistenceReady;
}
