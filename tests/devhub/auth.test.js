import test from "node:test";
import assert from "node:assert/strict";
import { requireDevHubOwner, verifyDevHubOwnerToken } from "../../lib/devhub/auth.mjs";

const config = {
  ownerUid: "owner-uid",
  firebaseProjectId: "blog-secretov2",
  serviceAccountJson: "{}",
  checkRevocation: true
};

test("devhub auth requires a bearer token", async () => {
  await assert.rejects(() => requireDevHubOwner({ headers: {} }, {}), (error) => error.status === 401);
});

test("devhub auth rejects invalid and expired tokens", async () => {
  await assert.rejects(
    () => verifyDevHubOwnerToken("bad", config, async () => { throw { code: "auth/invalid-id-token" }; }),
    (error) => error.status === 401 && error.code === "INVALID_TOKEN"
  );
  await assert.rejects(
    () => verifyDevHubOwnerToken("expired", config, async () => { throw { code: "auth/id-token-expired" }; }),
    (error) => error.status === 401 && error.code === "TOKEN_EXPIRED"
  );
});

test("devhub auth rejects a different uid and accepts the owner", async () => {
  await assert.rejects(
    () => verifyDevHubOwnerToken("other", config, async () => ({ uid: "other-uid" })),
    (error) => error.status === 403
  );
  const result = await verifyDevHubOwnerToken("owner", config, async () => ({ uid: "owner-uid" }));
  assert.deepEqual(result, { uid: "owner-uid" });
});

test("devhub auth fails closed when Firebase Admin is unconfigured", async () => {
  await assert.rejects(
    () => verifyDevHubOwnerToken("token", { ownerUid: null, firebaseProjectId: null, serviceAccountJson: null }),
    (error) => error.status === 503 && error.code === "AUTH_NOT_CONFIGURED"
  );
});
