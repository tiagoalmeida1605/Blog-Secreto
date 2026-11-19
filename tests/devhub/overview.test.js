import test from "node:test";
import assert from "node:assert/strict";
import { buildOverview, getOverallState } from "../../lib/devhub/overview-service.mjs";

const monitor = (state) => ({ getServices: async () => ({ state }) });
const github = (state) => ({ getOverview: async () => ({ state, repositories: state === "operational" ? [{}] : [] }) });
const vercel = (state) => ({ getOverview: async () => ({ state, projects: state === "operational" ? [{}] : [] }) });

test("overview reports all operational sources", async () => {
  const data = await buildOverview({ monitor: monitor("operational"), githubClient: github("operational"), vercelClient: vercel("operational") });
  assert.equal(data.overallState, "operational");
});

test("overview reports degraded and unavailable sources", async () => {
  const one = await buildOverview({ monitor: monitor("operational"), githubClient: github("degraded"), vercelClient: vercel("operational") });
  assert.equal(one.overallState, "degraded");
  const many = await buildOverview({ monitor: monitor("unavailable"), githubClient: github("degraded"), vercelClient: vercel("unavailable") });
  assert.equal(many.overallState, "degraded");
  assert.equal(getOverallState(["unavailable", "unavailable"]), "unavailable");
});

test("overview reports partial configuration", async () => {
  const data = await buildOverview({ monitor: monitor("partially_configured"), githubClient: github("operational"), vercelClient: vercel("partially_configured") });
  assert.equal(data.overallState, "partially_configured");
});
