import test from "node:test";
import assert from "node:assert/strict";
import { GitHubClient } from "../../lib/devhub/github-client.mjs";

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

test("GitHub client normalizes repository metadata, commits and actions", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/commits?per_page=5")) return jsonResponse([{ sha: "abc", commit: { message: "Ajuste\ndetalhe", author: { date: "2026-01-01T00:00:00Z" } }, html_url: "https://github.com/a/b/commit/abc" }]);
    if (url.includes("/actions/runs")) return jsonResponse({ workflow_runs: [{ id: 1, name: "CI", status: "completed", conclusion: "success", created_at: "2026-01-01T00:00:00Z", html_url: "https://github.com/a/b/actions/runs/1" }] });
    return jsonResponse({ name: "Blog-Secreto", visibility: "public", default_branch: "main", updated_at: "2026-01-02T00:00:00Z", html_url: "https://github.com/a/b" });
  };
  const client = new GitHubClient({ repositories: ["a/b"], fetchImpl });
  const data = await client.getRepository("a/b");
  assert.equal(data.defaultBranch, "main");
  assert.equal(data.commits[0].message, "Ajuste");
  assert.equal(data.actions[0].conclusion, "success");
});

test("GitHub client validates repositories and reports missing token as public mode", () => {
  const client = new GitHubClient({ repositories: ["bad url", "owner/repo"], token: null });
  assert.deepEqual(client.repositories, ["owner/repo"]);
});

test("GitHub client handles rate limit and invalid responses", async () => {
  const limited = new GitHubClient({ repositories: ["a/b"], fetchImpl: async () => jsonResponse({}, 429) });
  await assert.rejects(() => limited.request("/repos/a/b"), (error) => error.status === 429);
  const invalid = new GitHubClient({ repositories: ["a/b"], fetchImpl: async () => ({ ok: true, status: 200, text: async () => "{" }) });
  await assert.rejects(() => invalid.request("/repos/a/b"), (error) => error.code === "GITHUB_INVALID_RESPONSE");
});

test("GitHub client handles timeout", async () => {
  const client = new GitHubClient({ repositories: ["a/b"], timeoutMs: 5, fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => { const error = new Error("aborted"); error.name = "AbortError"; reject(error); });
  }) });
  await assert.rejects(() => client.request("/repos/a/b"), (error) => error.status === 504);
});
