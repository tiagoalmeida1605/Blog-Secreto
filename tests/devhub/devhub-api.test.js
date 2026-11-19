import test from "node:test";
import assert from "node:assert/strict";
import { createDevHubApiClient } from "../../js/devhub-api.js";

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

function authenticatedAuth(userOverrides = {}) {
  const user = {
    getIdToken: async () => "firebase-id-token",
    ...userOverrides
  };
  return { auth: { currentUser: user }, user };
}

test("DevHub client gets the current user's Firebase ID token", async () => {
  let tokenRequests = 0;
  const { auth } = authenticatedAuth({
    getIdToken: async () => {
      tokenRequests += 1;
      return "fresh-token";
    }
  });
  const client = createDevHubApiClient({ auth, fetchImpl: async () => response({ ok: true, data: {} }) });

  await client.getOverview();

  assert.equal(tokenRequests, 1);
});

test("DevHub client sends a bearer token in a no-store GET request to the relative API path", async () => {
  const { auth } = authenticatedAuth();
  let requestUrl;
  let requestOptions;
  const client = createDevHubApiClient({
    auth,
    fetchImpl: async (url, options) => {
      requestUrl = url;
      requestOptions = options;
      return response({ ok: true, data: { overallState: "operational" } });
    }
  });

  const data = await client.getOverview();

  assert.equal(requestUrl, "/api/devhub/v1/overview");
  assert.equal(requestOptions.method, "GET");
  assert.equal(requestOptions.cache, "no-store");
  assert.equal(requestOptions.headers.Authorization, "Bearer firebase-id-token");
  assert.deepEqual(data, { overallState: "operational" });
});

test("DevHub client rejects unauthenticated users without making a request", async () => {
  let fetchCalls = 0;
  const client = createDevHubApiClient({
    auth: { currentUser: null },
    fetchImpl: async () => { fetchCalls += 1; }
  });

  await assert.rejects(client.getServices(), (error) => error.kind === "NOT_AUTHENTICATED");
  assert.equal(fetchCalls, 0);
});

test("DevHub client reports a missing ID token", async () => {
  const { auth } = authenticatedAuth({ getIdToken: async () => "" });
  const client = createDevHubApiClient({ auth, fetchImpl: async () => response({ ok: true, data: {} }) });

  await assert.rejects(client.getOverview(), (error) => error.kind === "TOKEN_UNAVAILABLE"
    && error.code === "TOKEN_MISSING");
});

test("DevHub client reports communication failures without retrying", async () => {
  const { auth } = authenticatedAuth();
  let fetchCalls = 0;
  const client = createDevHubApiClient({
    auth,
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new TypeError("Network unavailable");
    }
  });

  await assert.rejects(client.getOverview(), (error) => error.kind === "NETWORK_ERROR"
    && error.code === "NETWORK_ERROR");
  assert.equal(fetchCalls, 1);
});

test("DevHub client preserves HTTP 401 and the API error code", async () => {
  const { auth } = authenticatedAuth();
  const client = createDevHubApiClient({
    auth,
    fetchImpl: async () => response({ ok: false, error: { code: "TOKEN_EXPIRED", message: "Token expirado." } }, 401)
  });

  await assert.rejects(client.getOverview(), (error) => error.kind === "UNAUTHORIZED"
    && error.status === 401 && error.code === "TOKEN_EXPIRED");
});

test("DevHub client preserves HTTP 403 and the API error code", async () => {
  const { auth } = authenticatedAuth();
  const client = createDevHubApiClient({
    auth,
    fetchImpl: async () => response({ ok: false, error: { code: "FORBIDDEN", message: "Acesso negado." } }, 403)
  });

  await assert.rejects(client.getGithub(), (error) => error.kind === "FORBIDDEN"
    && error.status === 403 && error.code === "FORBIDDEN");
});

test("DevHub client distinguishes Firebase Admin configuration from unavailable integrations", async () => {
  const { auth } = authenticatedAuth();
  const firebaseNotConfigured = createDevHubApiClient({
    auth,
    fetchImpl: async () => response({ ok: false, error: { code: "AUTH_NOT_CONFIGURED", message: "Indisponível." } }, 503)
  });
  const integrationUnavailable = createDevHubApiClient({
    auth,
    fetchImpl: async () => response({ ok: false, error: { code: "VERCEL_NOT_CONFIGURED", message: "Indisponível." } }, 503)
  });

  await assert.rejects(firebaseNotConfigured.getOverview(), (error) => error.kind === "FIREBASE_ADMIN_NOT_CONFIGURED"
    && error.status === 503 && error.code === "AUTH_NOT_CONFIGURED");
  await assert.rejects(integrationUnavailable.getDeployments(), (error) => error.kind === "INTEGRATION_UNAVAILABLE"
    && error.status === 503 && error.code === "VERCEL_NOT_CONFIGURED");
  const badGateway = createDevHubApiClient({
    auth,
    fetchImpl: async () => response({ ok: false, error: { code: "GITHUB_UNAVAILABLE", message: "Indisponível." } }, 502)
  });
  await assert.rejects(badGateway.getGithub(), (error) => error.kind === "INTEGRATION_UNAVAILABLE"
    && error.status === 502 && error.code === "GITHUB_UNAVAILABLE");
});

test("DevHub client reports invalid JSON responses", async () => {
  const { auth } = authenticatedAuth();
  const client = createDevHubApiClient({ auth, fetchImpl: async () => ({
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError("invalid json"); }
  }) });

  await assert.rejects(client.getServices(), (error) => error.kind === "INVALID_JSON"
    && error.code === "INVALID_JSON" && error.status === 200);
});

test("DevHub client returns the data from a valid success envelope", async () => {
  const { auth } = authenticatedAuth();
  const expectedData = { projects: [{ project: "Blog-Secreto", deployments: [] }] };
  const client = createDevHubApiClient({ auth, fetchImpl: async () => response({ ok: true, data: expectedData }) });

  assert.deepEqual(await client.getDeployments(), expectedData);
});

test("DevHub client exposes all endpoint methods through the shared request flow", async () => {
  const { auth } = authenticatedAuth();
  const paths = [];
  const client = createDevHubApiClient({
    auth,
    fetchImpl: async (url) => {
      paths.push(url);
      return response({ ok: true, data: {} });
    }
  });

  await client.getOverview();
  await client.getServices();
  await client.getGithub();
  await client.getDeployments();

  assert.deepEqual(paths, [
    "/api/devhub/v1/overview",
    "/api/devhub/v1/services",
    "/api/devhub/v1/github",
    "/api/devhub/v1/deployments"
  ]);
});
