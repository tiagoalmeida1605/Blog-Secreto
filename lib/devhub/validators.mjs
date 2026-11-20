export function isValidRepository(value) {
  return typeof value === "string"
    && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38}[A-Za-z0-9])?\/[A-Za-z0-9_.-]{1,100}$/.test(value);
}

export function validateRepositories(repositories) {
  return repositories.filter(isValidRepository);
}

export function isValidProjectId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}

export function validateRgaBaseUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

const PROJECT_STATUSES = new Set(["active", "planned", "paused", "archived"]);
const SETTING_WIDGETS = new Set(["integrations", "projects", "github", "deployments", "rga"]);
const SETTING_INTEGRATIONS = new Set(["github", "vercel", "rga", "firebase"]);

export function validateProjectInput(input, { partial = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const allowed = new Set(["name", "description", "category", "status", "repository", "productionUrl", "technologies"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) return null;
  if (!partial && (typeof input.name !== "string" || !input.name.trim())) return null;

  const result = {};
  if ("name" in input) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 120) return null;
    result.name = input.name.trim();
  }
  if ("description" in input) {
    if (typeof input.description !== "string" || input.description.length > 2000) return null;
    result.description = input.description.trim();
  }
  if ("category" in input) {
    if (typeof input.category !== "string" || !input.category.trim() || input.category.trim().length > 60) return null;
    result.category = input.category.trim();
  } else if (!partial) {
    result.category = "other";
  }
  if ("status" in input) {
    if (!PROJECT_STATUSES.has(input.status)) return null;
    result.status = input.status;
  } else if (!partial) {
    result.status = "active";
  }
  if ("repository" in input) {
    if (typeof input.repository !== "string" || (input.repository && !isValidRepository(input.repository))) return null;
    result.repository = input.repository;
  } else if (!partial) {
    result.repository = "";
  }
  if ("productionUrl" in input) {
    if (typeof input.productionUrl !== "string") return null;
    if (input.productionUrl) {
      try {
        const url = new URL(input.productionUrl);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
        result.productionUrl = url.toString();
      } catch {
        return null;
      }
    } else result.productionUrl = "";
  } else if (!partial) {
    result.productionUrl = "";
  }
  if ("technologies" in input) {
    if (!Array.isArray(input.technologies) || input.technologies.length > 20
      || input.technologies.some((item) => typeof item !== "string" || !item.trim() || item.trim().length > 40)) return null;
    result.technologies = [...new Set(input.technologies.map((item) => item.trim()))];
  } else if (!partial) {
    result.technologies = [];
  }
  return result;
}

export const DEFAULT_DEVHUB_SETTINGS = Object.freeze({
  dashboardWidgets: ["integrations", "projects", "github", "deployments", "rga"],
  visibleIntegrations: ["github", "vercel", "rga", "firebase"],
});

export function validateDevHubSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some((key) => !["dashboardWidgets", "visibleIntegrations"].includes(key))) return null;
  if (!Array.isArray(input.dashboardWidgets)
    || input.dashboardWidgets.some((item) => !SETTING_WIDGETS.has(item))
    || new Set(input.dashboardWidgets).size !== input.dashboardWidgets.length) return null;
  if (!Array.isArray(input.visibleIntegrations)
    || input.visibleIntegrations.some((item) => !SETTING_INTEGRATIONS.has(item))
    || new Set(input.visibleIntegrations).size !== input.visibleIntegrations.length) return null;
  return {
    dashboardWidgets: [...input.dashboardWidgets],
    visibleIntegrations: [...input.visibleIntegrations],
  };
}
