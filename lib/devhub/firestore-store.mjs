import { getFirestore } from "firebase-admin/firestore";
import { getDevHubAdminApp } from "./auth.mjs";
import { DEFAULT_DEVHUB_SETTINGS, validateDevHubSettings, validateProjectInput } from "./validators.mjs";

const PROJECTS_COLLECTION = "devhub_projects";
const SETTINGS_COLLECTION = "devhub_settings";
const ANALYTICS_COLLECTION = "devhub_analytics_snapshots";
const SNAPSHOT_INTERVAL_MS = 60_000;

export function getDevHubStore() {
  return createDevHubStore(getFirestore(getDevHubAdminApp()));
}

export function createDevHubStore(db, { now = () => new Date() } = {}) {
  return {
    async listProjects() {
      const snapshot = await db.collection(PROJECTS_COLLECTION).get();
      return snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    },

    async createProject(input) {
      const project = validateProjectInput(input);
      if (!project) throw new TypeError("INVALID_PROJECT");
      const reference = db.collection(PROJECTS_COLLECTION).doc();
      const timestamp = now().toISOString();
      const result = { ...project, createdAt: timestamp, updatedAt: timestamp };
      await reference.set(result);
      return { id: reference.id, ...result };
    },

    async updateProject(id, input) {
      if (!isDocumentId(id)) throw new TypeError("INVALID_PROJECT_ID");
      const changes = validateProjectInput(input, { partial: true });
      if (!changes || !Object.keys(changes).length) throw new TypeError("INVALID_PROJECT");
      const reference = db.collection(PROJECTS_COLLECTION).doc(id);
      const existing = await reference.get();
      if (!existing.exists) return null;
      const updatedAt = now().toISOString();
      await reference.update({ ...changes, updatedAt });
      return { id: reference.id, ...existing.data(), ...changes, updatedAt };
    },

    async getSettings() {
      const snapshot = await db.collection(SETTINGS_COLLECTION).doc("owner").get();
      if (!snapshot.exists) return { ...DEFAULT_DEVHUB_SETTINGS };
      const data = snapshot.data();
      return validateDevHubSettings({
        dashboardWidgets: data.dashboardWidgets,
        visibleIntegrations: data.visibleIntegrations,
      }) || { ...DEFAULT_DEVHUB_SETTINGS };
    },

    async updateSettings(input) {
      const settings = validateDevHubSettings(input);
      if (!settings) throw new TypeError("INVALID_SETTINGS");
      await db.collection(SETTINGS_COLLECTION).doc("owner").set({
        ...settings,
        updatedAt: now().toISOString(),
      });
      return settings;
    },

    async listAnalytics({ period = "30d", limit = 1000 } = {}) {
      let query = db.collection(ANALYTICS_COLLECTION);
      if (period !== "all") {
        const days = Number.parseInt(period, 10);
        const start = new Date(now().getTime() - days * 24 * 60 * 60 * 1000).toISOString();
        query = query.where("collectedAt", ">=", start);
      }
      const result = await query.orderBy("collectedAt", "desc").limit(limit).get();
      return result.docs.map((document) => ({ id: document.id, ...document.data() })).reverse();
    },

    async saveAnalyticsSnapshot(snapshot) {
      const collectedAt = new Date(snapshot.collectedAt);
      const bucketAt = new Date(Math.floor(collectedAt.getTime() / SNAPSHOT_INTERVAL_MS) * SNAPSHOT_INTERVAL_MS);
      const bucketIso = bucketAt.toISOString();
      const id = `snapshot_${bucketIso.replace(/[-:.]/g, "")}`;
      const reference = db.collection(ANALYTICS_COLLECTION).doc(id);
      return db.runTransaction(async (transaction) => {
        const existing = await transaction.get(reference);
        if (existing.exists) {
          return { snapshot: { id: reference.id, ...existing.data() }, created: false };
        }
        const value = { ...snapshot, collectedAt: bucketIso };
        transaction.create(reference, value);
        return { snapshot: { id: reference.id, ...value }, created: true };
      });
    },
  };
}

function isDocumentId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
