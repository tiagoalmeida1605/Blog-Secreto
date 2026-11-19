import { DevHubError } from "./errors.mjs";
import { isValidProjectId } from "./validators.mjs";

export class VercelClient {
  constructor({ token = null, teamId = null, projects = [], fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
    this.token = token;
    this.teamId = teamId;
    this.projects = projects.filter((project) => project?.id && isValidProjectId(project.id));
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async getDeployments(project) {
    if (!this.token) throw new DevHubError(503, "VERCEL_NOT_CONFIGURED", "Integração Vercel não configurada.");
    const params = new URLSearchParams({ projectId: project.id, limit: "5" });
    if (this.teamId) params.set("teamId", this.teamId);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`https://api.vercel.com/v6/deployments?${params}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json"
        },
        signal: controller.signal
      });
      if (response.status === 429) throw new DevHubError(429, "DEPENDENCY_RATE_LIMITED", "O Vercel atingiu o limite de requisições.");
      if (!response.ok) throw new DevHubError(502, "VERCEL_HTTP_ERROR", "O Vercel respondeu com um erro.");
      const text = await response.text();
      if (!text) throw new DevHubError(502, "VERCEL_INVALID_RESPONSE", "O Vercel retornou uma resposta vazia.");
      let body;
      try { body = JSON.parse(text); } catch { throw new DevHubError(502, "VERCEL_INVALID_RESPONSE", "O Vercel retornou dados inválidos."); }
      if (!Array.isArray(body.deployments)) throw new DevHubError(502, "VERCEL_INVALID_RESPONSE", "O Vercel retornou dados inválidos.");
      return body.deployments.slice(0, 5).map((deployment) => ({
        id: deployment.uid || deployment.id || null,
        name: typeof deployment.name === "string" ? deployment.name : project.name,
        environment: deployment.target || deployment.meta?.target || "preview",
        state: deployment.readyState || deployment.state || "unknown",
        url: deployment.url ? `https://${deployment.url}` : null,
        createdAt: this.toIso(deployment.createdAt),
        readyAt: this.toIso(deployment.ready)
      }));
    } catch (error) {
      if (error?.name === "AbortError") throw new DevHubError(504, "DEPENDENCY_TIMEOUT", "O Vercel não respondeu a tempo.");
      throw error instanceof DevHubError ? error : new DevHubError(502, "VERCEL_UNAVAILABLE", "Não foi possível consultar o Vercel.");
    } finally {
      clearTimeout(timer);
    }
  }

  toIso(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  async getOverview() {
    if (!this.token) return { state: "partially_configured", status: "partially_configured", projects: [], message: "Token do Vercel não configurado." };
    if (!this.projects.length) return { state: "partially_configured", status: "partially_configured", projects: [], message: "Nenhum projeto Vercel configurado." };
    const results = await Promise.allSettled(this.projects.map(async (project) => ({
      project: project.name,
      deployments: await this.getDeployments(project)
    })));
    const projects = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
    const failures = results.filter((result) => result.status === "rejected");
    const state = projects.length === 0 ? "unavailable" : failures.length ? "degraded" : "operational";
    return {
      state,
      status: state,
      projects,
      failures: failures.map((failure) => ({ code: failure.reason?.code || "VERCEL_UNAVAILABLE", message: "Uma fonte do Vercel ficou indisponível." }))
    };
  }

  async getDeploymentsForAll() {
    if (!this.token) throw new DevHubError(503, "VERCEL_NOT_CONFIGURED", "Integração Vercel não configurada.");
    if (!this.projects.length) throw new DevHubError(503, "VERCEL_PROJECT_NOT_CONFIGURED", "Nenhum projeto Vercel configurado.");
    const results = await Promise.allSettled(this.projects.map(async (project) => ({
      project: project.name,
      deployments: await this.getDeployments(project)
    })));
    return results.map((result, index) => result.status === "fulfilled"
      ? result.value
      : { project: this.projects[index].name, state: "unavailable", deployments: [], error: { code: result.reason?.code || "VERCEL_UNAVAILABLE", message: "Projeto indisponível." } });
  }
}
