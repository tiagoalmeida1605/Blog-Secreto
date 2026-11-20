import { useQuery } from "@tanstack/react-query";
import { Activity, CircleGauge, Database, GitBranch, Radio, RefreshCw, Server, Workflow } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { StateBadge } from "../../components/feedback/StateBadge";
import { DevHubApiError } from "../../services/devhub-api";
import { api } from "../../services/api";
import type { IntegrationState } from "../../types/devhub";

async function measured<T>(request: () => Promise<T>) {
  const started = performance.now();
  const data = await request();
  return { data, latencyMs: Math.round(performance.now() - started), checkedAt: new Date().toISOString() };
}

export function SystemPage() {
  const health = useQuery({ queryKey: ["system", "health"], queryFn: () => measured(api.getHealth), refetchInterval: 60_000 });
  const overview = useQuery({ queryKey: ["system", "overview"], queryFn: () => measured(api.getOverview), refetchInterval: 60_000 });
  const github = useQuery({ queryKey: ["system", "github"], queryFn: () => measured(api.getGithub), refetchInterval: 60_000 });
  const deployments = useQuery({ queryKey: ["system", "deployments"], queryFn: () => measured(api.getDeployments), refetchInterval: 60_000 });
  const services = useQuery({ queryKey: ["system", "services"], queryFn: () => measured(api.getServices), refetchInterval: 60_000 });
  const checks = [
    { key: "api", name: "DevHub API", icon: Server, query: health, state: health.data ? "operational" : queryState(health.error), detail: health.data?.data.status || health.error?.message },
    { key: "firebase", name: "Firebase / Auth", icon: Database, query: overview, state: overview.data ? "operational" : queryState(overview.error), detail: "Autenticação e validação de proprietário via Firebase Admin." },
    { key: "github", name: "GitHub", icon: GitBranch, query: github, state: github.data?.data.state || queryState(github.error), detail: github.data?.data.failures?.[0]?.message || `${github.data?.data.repositories.length ?? 0} repositórios na resposta atual.` },
    { key: "vercel", name: "Vercel", icon: Workflow, query: deployments, state: deployments.data ? deployments.data.data.projects.some((project) => project.error) ? "degraded" : deployments.data.data.projects.length ? "operational" : "partially_configured" : queryState(deployments.error), detail: deployments.data ? `${deployments.data.data.projects.length} projetos na resposta atual.` : deployments.error?.message },
    { key: "rga", name: "Rádio Geração Ativa", icon: Radio, query: services, state: services.data?.data.state || queryState(services.error), detail: services.data?.data.message || "Health check e endpoint de conteúdo." },
  ];
  const refresh = () => {
    void health.refetch(); void overview.refetch(); void github.refetch(); void deployments.refetch(); void services.refetch();
  };
  const isRefreshing = [health, overview, github, deployments, services].some((query) => query.isFetching);

  return (
    <>
      <PageHeader eyebrow="OBSERVABILITY / LIVE CHECKS" title="System Monitor" description="Verificações em tempo real e latência observada pelo navegador. Não são métricas de uptime ou recursos da infraestrutura." action={<button className="button button-quiet" type="button" onClick={refresh} disabled={isRefreshing}><RefreshCw size={15} className={isRefreshing ? "spin" : ""} /> Verificar serviços</button>} />
      <section className="system-grid" aria-label="Estado do sistema">
        {checks.map(({ key, name, icon: Icon, query, state, detail }) => (
          <article className="panel system-card" key={key}>
            <header className="system-card-head"><span className="integration-icon"><Icon size={18} /></span><StateBadge state={state} /></header>
            <p className="eyebrow">CHECK / {key.toUpperCase()}</p><h2>{name}</h2><p className="system-detail">{detail || (query.isLoading ? "Verificando..." : "Detalhe não disponível.")}</p>
            <footer className="system-meta"><span><CircleGauge size={13} />{query.data ? `${query.data.latencyMs} ms observados` : "Latência indisponível"}</span><time>{query.data ? new Date(query.data.checkedAt).toLocaleTimeString("pt-BR") : "—"}</time></footer>
          </article>
        ))}
      </section>
      <section className="panel system-note"><Activity size={17} /><div><strong>Métricas não coletadas não são simuladas</strong><p>CPU, memória, uptime histórico e traces de infraestrutura não estão expostos pelos endpoints atuais.</p></div></section>
    </>
  );
}

function queryState(error: Error | null): IntegrationState {
  if (!error) return "unavailable";
  if (error instanceof DevHubApiError && error.status === 503 && /NOT_CONFIGURED/.test(error.code)) return "partially_configured";
  return "unavailable";
}
