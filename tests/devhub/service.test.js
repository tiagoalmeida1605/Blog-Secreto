import test from "node:test";
import assert from "node:assert/strict";
import { ServiceMonitor } from "../../lib/devhub/service-monitor.mjs";

test("RGA service reports separate health and feed results", async () => {
  const monitor = new ServiceMonitor({ baseUrl: "https://rga.example", fetchImpl: async (url) => ({
    ok: true,
    status: 200,
    text: async () => url.endsWith("/api/home-feed")
      ? JSON.stringify({ noticias: [{}, {}], videos: [{}] })
      : JSON.stringify({ status: "ok" })
  }) });
  const data = await monitor.getServices();
  assert.equal(data.state, "operational");
  assert.equal(data.health.httpStatus, 200);
  assert.equal(data.feed.newsCount, 2);
  assert.equal(data.feed.videoCount, 1);
});

test("RGA reports health success and feed failure distinctly", async () => {
  const monitor = new ServiceMonitor({ baseUrl: "https://rga.example", fetchImpl: async (url) => url.endsWith("/api/health")
    ? { ok: true, status: 200, text: async () => "{}" }
    : { ok: false, status: 503, text: async () => "{}" } });
  const data = await monitor.getServices();
  assert.equal(data.health.state, "operational");
  assert.equal(data.feed.state, "unavailable");
  assert.equal(data.state, "degraded");
});

test("RGA reports invalid JSON and timeout", async () => {
  const invalid = new ServiceMonitor({ baseUrl: "https://rga.example", fetchImpl: async () => ({ ok: true, status: 200, text: async () => "{" }) });
  const invalidResult = await invalid.checkPath("/api/health");
  assert.equal(invalidResult.state, "degraded");
  const timeout = new ServiceMonitor({ baseUrl: "https://rga.example", timeoutMs: 5, fetchImpl: async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => { const error = new Error("aborted"); error.name = "AbortError"; reject(error); })) });
  const timeoutResult = await timeout.checkPath("/api/health");
  assert.equal(timeoutResult.state, "unavailable");
  assert.match(timeoutResult.message, /Tempo limite/);
});
