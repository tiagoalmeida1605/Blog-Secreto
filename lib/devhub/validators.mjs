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
