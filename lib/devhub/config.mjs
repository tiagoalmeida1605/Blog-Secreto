const DEFAULT_REPOSITORIES = [
  "tiagoalmeida1605/Blog-Secreto",
  "tiagoalmeida1605/Radio-Geracao-Ativa"
];

export function parsePrivateKey(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch {
    return null;
  }
}

export function parseRepositoryList(value) {
  if (!value) return [...DEFAULT_REPOSITORIES];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function getDevHubConfig(env = process.env) {
  return {
    ownerUid: env.DEVHUB_OWNER_UID || null,
    firebaseProjectId: env.FIREBASE_PROJECT_ID || null,
    serviceAccountJson: env.FIREBASE_SERVICE_ACCOUNT_JSON || null,
    githubToken: env.GITHUB_TOKEN || null,
    githubUsername: env.GITHUB_USERNAME || "tiagoalmeida1605",
    githubRepositories: parseRepositoryList(env.GITHUB_REPOSITORIES),
    vercelToken: env.VERCEL_API_TOKEN || null,
    vercelTeamId: env.VERCEL_TEAM_ID || null,
    vercelProjects: [
      { name: "Blog-Secreto", id: env.VERCEL_PROJECT_ID_BLOG_SECRETO || null },
      { name: "Rádio Geração Ativa", id: env.VERCEL_PROJECT_ID_RGA || null }
    ].filter((project) => project.id),
    rgaBaseUrl: env.RGA_BASE_URL || null,
    checkRevocation: env.DEVHUB_CHECK_TOKEN_REVOCATION !== "false"
  };
}
