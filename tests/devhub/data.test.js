import test from "node:test";
import assert from "node:assert/strict";
import { collectAnalyticsSnapshot } from "../../lib/devhub/analytics.mjs";
import { createDevHubStore } from "../../lib/devhub/firestore-store.mjs";
import { RgaFeedClient } from "../../lib/devhub/rga-feed-client.mjs";
import { DEFAULT_DEVHUB_SETTINGS, validateDevHubSettings, validateProjectInput } from "../../lib/devhub/validators.mjs";

class FakeDocument {
  constructor(collection, id) {
    this.collection = collection;
    this.id = id;
  }

  async get() {
    const value = this.collection.documents.get(this.id);
    return { exists: value !== undefined, data: () => value && structuredClone(value) };
  }

  async set(value) {
    this.collection.documents.set(this.id, structuredClone(value));
  }

  async update(value) {
    const previous = this.collection.documents.get(this.id);
    if (!previous) throw new Error("Missing document");
    this.collection.documents.set(this.id, { ...previous, ...structuredClone(value) });
  }
}

class FakeCollection {
  constructor() {
    this.documents = new Map();
    this.nextId = 0;
  }

  doc(id = `generated-${++this.nextId}`) {
    return new FakeDocument(this, id);
  }

  async get() {
    return { docs: [...this.documents].map(([id, value]) => ({ id, data: () => structuredClone(value) })) };
  }

  where() { return this; }
  orderBy() { return this; }
  limit() { return this; }
}

class FakeFirestore {
  constructor() {
    this.collections = new Map();
  }

  collection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new FakeCollection());
    return this.collections.get(name);
  }

  async runTransaction(callback) {
    return callback({
      get: (reference) => reference.get(),
      create: (reference, value) => reference.set(value),
    });
  }
}

test("project validation normalizes supported values and rejects unsafe or unknown fields", () => {
  assert.deepEqual(validateProjectInput({
    name: "  NEXUS  ",
    description: "Core tools",
    category: "Platform",
    repository: "tiagoalmeida1605/NEXUS-WEB",
    productionUrl: "https://nexus.example/",
    technologies: ["React", "React"],
  }), {
    name: "NEXUS",
    description: "Core tools",
    category: "Platform",
    status: "active",
    repository: "tiagoalmeida1605/NEXUS-WEB",
    productionUrl: "https://nexus.example/",
    technologies: ["React"],
  });
  assert.equal(validateProjectInput({ name: "NEXUS", productionUrl: "javascript:alert(1)" }), null);
  assert.equal(validateProjectInput({ name: "NEXUS", repository: "not a repository" }), null);
  assert.equal(validateProjectInput({ name: "NEXUS", ownerUid: "injected" }), null);
  assert.equal(validateProjectInput({ status: "archived" }, { partial: true }).status, "archived");
  assert.equal(validateProjectInput({ name: "" }, { partial: true }), null);
});

test("settings validation only accepts known dashboard widgets and integrations", () => {
  assert.deepEqual(validateDevHubSettings(DEFAULT_DEVHUB_SETTINGS), DEFAULT_DEVHUB_SETTINGS);
  assert.equal(validateDevHubSettings({ ...DEFAULT_DEVHUB_SETTINGS, visibleIntegrations: ["unknown"] }), null);
  assert.equal(validateDevHubSettings({ ...DEFAULT_DEVHUB_SETTINGS, dashboardWidgets: ["projects", "projects"] }), null);
  assert.equal(validateDevHubSettings({ ...DEFAULT_DEVHUB_SETTINGS, token: "secret" }), null);
});

test("Firestore project store creates, edits and archives documents without deleting them", async () => {
  const db = new FakeFirestore();
  const store = createDevHubStore(db, { now: () => new Date("2026-11-20T12:00:00.000Z") });
  const created = await store.createProject({ name: "NEXUS", status: "active" });
  assert.equal(created.name, "NEXUS");
  assert.equal(created.category, "other");

  const archived = await store.updateProject(created.id, { status: "archived" });
  assert.equal(archived.status, "archived");
  assert.equal(archived.createdAt, created.createdAt);
  assert.equal((await store.listProjects()).length, 1);
  assert.equal(await store.updateProject("missing", { status: "active" }), null);
});

test("analytics snapshots are idempotent within a time bucket", async () => {
  const db = new FakeFirestore();
  const store = createDevHubStore(db);
  const input = {
    collectedAt: "2026-11-20T12:00:32.000Z",
    sources: { github: "operational" },
    metrics: { githubCommits: 4 },
  };
  const first = await store.saveAnalyticsSnapshot(input);
  const duplicate = await store.saveAnalyticsSnapshot({ ...input, metrics: { githubCommits: 99 } });
  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.snapshot.metrics.githubCommits, 4);
  assert.equal((await store.listAnalytics({ period: "all" })).length, 1);
});

test("analytics collection uses live source responses and records unavailable sources honestly", async () => {
  const db = new FakeFirestore();
  const store = createDevHubStore(db);
  await store.createProject({ name: "Tracked project" });
  const result = await collectAnalyticsSnapshot({
    store,
    now: () => new Date("2026-11-20T12:01:00.000Z"),
    getOverview: async () => ({
      integrations: {
        github: { state: "operational", repositories: [{ commits: [{}, {}], actions: [{}] }] },
        vercel: { state: "degraded", projects: [{ deployments: [{}, {}] }] },
        services: { state: "degraded", feed: { newsCount: 3 } },
      },
    }),
    getRgaFeed: async () => { throw new Error("source offline"); },
  });
  assert.deepEqual(result.snapshot.metrics, {
    projects: 1,
    githubRepositories: 1,
    githubCommits: 2,
    githubActions: 1,
    vercelDeployments: 2,
    rgaNews: 3,
    rgaVideos: null,
    rgaPlaylists: null,
  });
  assert.equal(result.snapshot.sources.rga, "unavailable");
});

test("RGA feed client normalizes actual content and rejects untrusted links and image protocols", async () => {
  const client = new RgaFeedClient({
    baseUrl: "https://rga.example",
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          noticias: { news1: { titulo: "Atualização", imagem: "javascript:alert(1)", data: "2026-11-20" } },
          playlists: {
            video1: { tipo: "video", titulo: "Vídeo", videoId: "abcdefghijk" },
            invalid: { tipo: "video", videoId: "bad" },
            playlist1: { tipo: "playlist", playlistId: "PL_123" },
          },
        };
      },
    }),
  });
  const result = await client.getFeed();
  assert.equal(result.state, "operational");
  assert.deepEqual(result.counts, { news: 1, videos: 1, playlists: 1 });
  assert.equal(result.items.find((item) => item.kind === "noticia").image, "");
  assert.equal(result.items.find((item) => item.kind === "video").url, "https://www.youtube.com/watch?v=abcdefghijk");
  assert.equal(result.items.some((item) => item.id === "invalid"), false);
});
