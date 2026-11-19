import test from "node:test";
import assert from "node:assert/strict";
import { VercelClient } from "../../lib/devhub/vercel-client.mjs";

test("Vercel client normalizes deployments", async () => {
  const client = new VercelClient({
    token: "token",
    projects: [{ name: "Blog-Secreto", id: "prj_blog" }],
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ deployments: [{ uid: "dep1", name: "Blog", target: "production", readyState: "READY", url: "example.vercel.app", createdAt: "2026-01-01T00:00:00Z" }] }) })
  });
  const data = await client.getDeployments(client.projects[0]);
  assert.equal(data[0].id, "dep1");
  assert.equal(data[0].environment, "production");
  assert.equal(data[0].url, "https://example.vercel.app");
});

test("Vercel client reports missing token and project configuration", async () => {
  await assert.rejects(() => new VercelClient().getDeploymentsForAll(), (error) => error.code === "VERCEL_NOT_CONFIGURED");
  await assert.rejects(() => new VercelClient({ token: "token" }).getDeploymentsForAll(), (error) => error.code === "VERCEL_PROJECT_NOT_CONFIGURED");
});

test("Vercel client handles HTTP, timeout and invalid JSON", async () => {
  const http = new VercelClient({ token: "token", projects: [{ name: "A", id: "prj_a" }], fetchImpl: async () => ({ ok: false, status: 500, text: async () => "{}" }) });
  await assert.rejects(() => http.getDeployments(http.projects[0]), (error) => error.code === "VERCEL_HTTP_ERROR");
  const invalid = new VercelClient({ token: "token", projects: [{ name: "A", id: "prj_a" }], fetchImpl: async () => ({ ok: true, status: 200, text: async () => "{" }) });
  await assert.rejects(() => invalid.getDeployments(invalid.projects[0]), (error) => error.code === "VERCEL_INVALID_RESPONSE");
  const timeout = new VercelClient({ token: "token", projects: [{ name: "A", id: "prj_a" }], timeoutMs: 5, fetchImpl: async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => { const error = new Error("aborted"); error.name = "AbortError"; reject(error); })) });
  await assert.rejects(() => timeout.getDeployments(timeout.projects[0]), (error) => error.status === 504);
});
