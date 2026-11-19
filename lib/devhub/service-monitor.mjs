import { validateRgaBaseUrl } from "./validators.mjs";

export class ServiceMonitor {
  constructor({ baseUrl = null, fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
    this.baseUrl = validateRgaBaseUrl(baseUrl);
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async checkPath(path) {
    if (!this.baseUrl) {
      return { name: "Rádio Geração Ativa", state: "partially_configured", httpStatus: null, responseTimeMs: 0, checkedAt: new Date().toISOString(), message: "RGA_BASE_URL não configurada." };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const started = Date.now();
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      const elapsed = Date.now() - started;
      const text = await response.text();
      let body = null;
      if (text) {
        try { body = JSON.parse(text); } catch {
          return { name: "Rádio Geração Ativa", state: "degraded", httpStatus: response.status, responseTimeMs: elapsed, checkedAt: new Date().toISOString(), message: "Resposta JSON inválida." };
        }
      }
      if (!response.ok) {
        return { name: "Rádio Geração Ativa", state: "unavailable", httpStatus: response.status, responseTimeMs: elapsed, checkedAt: new Date().toISOString(), message: "Serviço respondeu com erro HTTP." };
      }
      const result = { name: "Rádio Geração Ativa", state: "operational", httpStatus: response.status, responseTimeMs: elapsed, checkedAt: new Date().toISOString(), message: "Serviço disponível." };
      if (path === "/api/home-feed" && body) {
        result.newsCount = Array.isArray(body.noticias) ? body.noticias.length : (Array.isArray(body.news) ? body.news.length : null);
        result.videoCount = Array.isArray(body.videos) ? body.videos.length : (Array.isArray(body.playlists) ? body.playlists.length : null);
      }
      return result;
    } catch (error) {
      const timedOut = error?.name === "AbortError";
      return { name: "Rádio Geração Ativa", state: "unavailable", httpStatus: null, responseTimeMs: Date.now() - started, checkedAt: new Date().toISOString(), message: timedOut ? "Tempo limite excedido." : "Não foi possível acessar o serviço." };
    } finally {
      clearTimeout(timer);
    }
  }

  async getServices() {
    const [health, feed] = await Promise.all([this.checkPath("/api/health"), this.checkPath("/api/home-feed")]);
    return {
      name: "Rádio Geração Ativa",
      state: health.state === "operational" && feed.state === "operational" ? "operational" : health.state === "partially_configured" || feed.state === "partially_configured" ? "partially_configured" : "degraded",
      health,
      feed
    };
  }
}
