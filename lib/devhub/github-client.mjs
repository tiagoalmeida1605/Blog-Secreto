import { DevHubError } from "./errors.mjs";
import { validateRepositories } from "./validators.mjs";

export class GitHubClient {
  constructor({ token = null, repositories = [], username = "tiagoalmeida1605", fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
    this.token = token;
    this.repositories = validateRepositories(repositories);
    this.username = username;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      const response = await this.fetchImpl(`https://api.github.com${path}`, { headers, signal: controller.signal });
      if (response.status === 429) {
        throw new DevHubError(429, "DEPENDENCY_RATE_LIMITED", "O GitHub atingiu o limite de requisições.");
      }
      if (response.status === 404) {
        throw new DevHubError(502, "GITHUB_REPOSITORY_NOT_FOUND", "Repositório não encontrado.");
      }
      if (!response.ok) {
        throw new DevHubError(response.status >= 500 ? 502 : 502, "GITHUB_HTTP_ERROR", "O GitHub respondeu com um erro.");
      }
      const text = await response.text();
      if (!text) throw new DevHubError(502, "GITHUB_INVALID_RESPONSE", "O GitHub retornou uma resposta vazia.");
      try {
        return JSON.parse(text);
      } catch {
        throw new DevHubError(502, "GITHUB_INVALID_RESPONSE", "O GitHub retornou dados inválidos.");
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new DevHubError(504, "DEPENDENCY_TIMEOUT", "O GitHub não respondeu a tempo.");
      }
      throw error instanceof DevHubError ? error : new DevHubError(502, "GITHUB_UNAVAILABLE", "Não foi possível consultar o GitHub.");
    } finally {
      clearTimeout(timer);
    }
  }

  async getRepository(fullName) {
    const encoded = fullName.split("/").map(encodeURIComponent).join("/");
    const [metadata, commits, actions] = await Promise.all([
      this.request(`/repos/${encoded}`),
      this.request(`/repos/${encoded}/commits?per_page=5`),
      this.request(`/repos/${encoded}/actions/runs?per_page=5`)
    ]);
    return {
      repository: fullName,
      name: typeof metadata.name === "string" ? metadata.name : fullName,
      visibility: typeof metadata.visibility === "string" ? metadata.visibility : "unknown",
      defaultBranch: typeof metadata.default_branch === "string" ? metadata.default_branch : null,
      updatedAt: metadata.updated_at || null,
      htmlUrl: typeof metadata.html_url === "string" ? metadata.html_url : null,
      commits: Array.isArray(commits) ? commits.slice(0, 5).map((commit) => ({
        sha: commit.sha || null,
        message: commit.commit?.message?.split("\n")[0] || null,
        authoredAt: commit.commit?.author?.date || null,
        url: commit.html_url || null
      })) : [],
      actions: Array.isArray(actions.workflow_runs) ? actions.workflow_runs.slice(0, 5).map((run) => ({
        id: run.id || null,
        name: run.name || null,
        status: run.status || null,
        conclusion: run.conclusion || null,
        createdAt: run.created_at || null,
        updatedAt: run.updated_at || null,
        url: run.html_url || null
      })) : []
    };
  }

  async getOverview() {
    if (!this.repositories.length) {
      return { state: "partially_configured", status: "partially_configured", repositories: [], message: "Nenhum repositório válido configurado." };
    }
    const results = await Promise.allSettled(this.repositories.map((repository) => this.getRepository(repository)));
    const repositories = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
    const failures = results.filter((result) => result.status === "rejected");
    let state = "operational";
    if (repositories.length === 0) state = "unavailable";
    else if (failures.length) state = "degraded";
    return {
      state,
      status: state,
      configuredRepositories: this.repositories.length,
      repositories,
      failures: failures.map((failure) => ({
        code: failure.reason?.code || "GITHUB_UNAVAILABLE",
        message: "Uma fonte do GitHub ficou indisponível."
      }))
    };
  }
}
