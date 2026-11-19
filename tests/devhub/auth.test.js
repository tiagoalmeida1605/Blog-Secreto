import test from "node:test";
import assert from "node:assert/strict";
import { requireDevHubOwner, verifyDevHubOwnerToken } from "../../lib/devhub/auth.mjs";
import { DevHubError } from "../../lib/devhub/errors.mjs";

const config = {
  ownerUid: "owner-uid",
  firebaseProjectId: "blog-secretov2",
  serviceAccountJson: JSON.stringify({
    project_id: "blog-secretov2",
    client_email: "service@example.invalid",
    private_key: "not-a-real-key"
  }),
  checkRevocation: true
};

test("devhub auth requires a bearer token", async () => {
  await assert.rejects(() => requireDevHubOwner({ headers: {} }, {}), (error) => error.status === 401);
});

test("devhub auth rejects missing and invalid Firebase configuration with generic 503 errors", async () => {
  await assert.rejects(
    () => verifyDevHubOwnerToken("token", { ...config, ownerUid: null }),
    (error) => error.status === 503 && error.code === "AUTH_NOT_CONFIGURED"
  );
  await assert.rejects(
    () => verifyDevHubOwnerToken("token", { ...config, serviceAccountJson: "{invalid-json" }),
    (error) => error.status === 503
      && error.code === "INVALID_SERVICE_ACCOUNT_JSON"
      && !error.message.includes("invalid-json")
  );
  await assert.rejects(
    () => verifyDevHubOwnerToken("token", { ...config, serviceAccountJson: "{}" }),
    (error) => error.status === 503 && error.code === "INVALID_SERVICE_ACCOUNT_CONFIG"
  );
});

test("devhub auth rejects a service account from a different Firebase project", async () => {
  const mismatchedConfig = {
    ...config,
    serviceAccountJson: JSON.stringify({
      project_id: "another-project",
      client_email: "service@example.invalid",
      private_key: "not-a-real-key"
    })
  };
  await assert.rejects(
    () => verifyDevHubOwnerToken("token", mismatchedConfig),
    (error) => error.status === 503 && error.code === "FIREBASE_PROJECT_MISMATCH"
  );
});

test("devhub auth reports Firebase Admin credential initialization errors as generic 503", async () => {
  const error = { code: "app/invalid-credential", message: "private key detail" };
  await assert.rejects(
    () => verifyDevHubOwnerToken("token", config, null, () => { throw error; }),
    (result) => result.status === 503
      && result.code === "FIREBASE_ADMIN_CREDENTIAL_ERROR"
      && !result.message.includes("private key")
  );
});

test("devhub auth reports unexpected Firebase Admin initialization errors as generic 503", async () => {
  await assert.rejects(
    () => verifyDevHubOwnerToken("token", config, null, () => { throw new Error("sensitive credential detail"); }),
    (error) => error.status === 503
      && error.code === "FIREBASE_ADMIN_INITIALIZATION_FAILED"
      && !error.message.includes("sensitive")
  );
});

test("devhub auth maps expired, revoked and invalid tokens to their specific 401 codes", async () => {
  const tokenErrors = [
    ["auth/id-token-expired", "TOKEN_EXPIRED"],
    ["auth/id-token-revoked", "TOKEN_REVOKED"],
    ["auth/invalid-id-token", "INVALID_TOKEN"],
    ["auth/argument-error", "INVALID_TOKEN"]
  ];

  for (const [firebaseCode, expectedCode] of tokenErrors) {
    await assert.rejects(
      () => verifyDevHubOwnerToken("token", config, async () => { throw { code: firebaseCode }; }),
      (error) => error.status === 401 && error.code === expectedCode
    );
  }
});

test("devhub auth maps insufficient Firebase Admin permissions to generic 503", async () => {
  await assert.rejects(
    () => verifyDevHubOwnerToken("token", config, async () => { throw { code: "auth/insufficient-permission" }; }),
    (error) => error.status === 503
      && error.code === "FIREBASE_ADMIN_CREDENTIAL_ERROR"
      && !error.message.includes("permission")
  );
});

test("devhub auth preserves DevHubError and hides unexpected verification details", async () => {
  const original = new DevHubError(418, "INTERNAL_TEST_ERROR", "Public message.");
  await assert.rejects(
    () => verifyDevHubOwnerToken("token", config, async () => { throw original; }),
    (error) => error === original
  );
  await assert.rejects(
    () => verifyDevHubOwnerToken("token", config, async () => { throw new Error("private key detail"); }),
    (error) => error.status === 500
      && error.code === "FIREBASE_ADMIN_VERIFICATION_FAILED"
      && !error.message.includes("private key")
  );
});

test("devhub auth keeps revocation checking enabled", async () => {
  let checkedRevocation;
  await verifyDevHubOwnerToken("token", config, async (_token, checkRevocation) => {
    checkedRevocation = checkRevocation;
    return { uid: "owner-uid" };
  });
  assert.equal(checkedRevocation, true);
});

test("devhub auth rejects a different uid and accepts the owner", async () => {
  await assert.rejects(
    () => verifyDevHubOwnerToken("other", config, async () => ({ uid: "other-uid" })),
    (error) => error.status === 403 && error.code === "FORBIDDEN"
  );
  const result = await verifyDevHubOwnerToken("owner", config, async () => ({ uid: "owner-uid" }));
  assert.deepEqual(result, { uid: "owner-uid" });
});
