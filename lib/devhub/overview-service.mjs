export function getOverallState(integrationStates) {
  const states = integrationStates.filter(Boolean);
  if (!states.length) return "unavailable";
  if (states.every((state) => state === "operational")) return "operational";
  if (states.every((state) => state === "unavailable")) return "unavailable";
  if (states.includes("partially_configured")) return "partially_configured";
  if (states.every((state) => state === "partially_configured")) return "partially_configured";
  return "degraded";
}

export async function buildOverview({ monitor, githubClient, vercelClient }) {
  const [servicesResult, githubResult, vercelResult] = await Promise.allSettled([
    monitor.getServices(),
    githubClient.getOverview(),
    vercelClient.getOverview()
  ]);
  const services = servicesResult.status === "fulfilled" ? servicesResult.value : { name: "Rádio Geração Ativa", state: "unavailable" };
  const github = githubResult.status === "fulfilled" ? githubResult.value : { state: "unavailable", repositories: [], failures: [{ code: "GITHUB_UNAVAILABLE", message: "Integração indisponível." }] };
  const vercel = vercelResult.status === "fulfilled" ? vercelResult.value : { state: "unavailable", projects: [], failures: [{ code: "VERCEL_UNAVAILABLE", message: "Integração indisponível." }] };
  return {
    overallState: getOverallState([services.state, github.state, vercel.state]),
    integrations: { services, github, vercel }
  };
}
