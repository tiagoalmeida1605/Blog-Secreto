import { useQuery } from "@tanstack/react-query";
import { Cloud, Database, GitBranch, Radio, RefreshCw, ShieldCheck } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { QueryState } from "../../components/feedback/QueryState";
import { StateBadge } from "../../components/feedback/StateBadge";
import { api } from "../../services/api";
import type { IntegrationState } from "../../types/devhub";
import { INTEGRATION_MODULES } from "../../types/devhub";

export function IntegrationsPage() {
  const overview = useQuery({ queryKey: ["overview"], queryFn: api.getOverview });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const cards = overview.data ? [
    { key: "firebase", title: "Firebase", icon: Database, state: "operational" as IntegrationState, origin: "Firebase Authentication; validação administrativa na API Dev Hub.", dependency: "Firebase Client SDK + Firebase Admin" },
    { key: "github", title: "GitHub", icon: GitBranch, state: overview.data.integrations.github.state, origin: `${overview.data.integrations.github.repositories.length} repositórios configurados no backend.`, dependency: "GitHub REST API" },
    { key: "vercel", title: "Vercel", icon: Cloud, state: overview.data.integrations.vercel.state, origin: `${overview.data.integrations.vercel.projects.length} projetos consultados pelo backend.`, dependency: "Vercel Deployments API" },
    { key: "rga", title: "Rádio Geração Ativa", icon: Radio, state: overview.data.integrations.services.state, origin: "Health check e feed público consultados pelo backend.", dependency: "RGA Health API + Home Feed" },
  ].filter((card) => (settings.data?.visibleIntegrations || [...INTEGRATION_MODULES]).includes(card.key as typeof INTEGRATION_MODULES[number])) : [];

  return (
    <>
      <PageHeader eyebrow="CONNECTIVITY / SERVICES" title="Integrations" description="Estado e origem das integrações configuradas. Segredos permanecem no ambiente server-side." action={<button className="button button-quiet" onClick={() => void overview.refetch()} type="button"><RefreshCw size={15} /> Verificar agora</button>} />
      <QueryState loading={overview.isLoading} error={overview.error as Error | null} onRetry={() => void overview.refetch()}>
        <section className="integration-grid" aria-label="Integrações">
          {cards.map(({ key, title, icon: Icon, state, origin, dependency }) => (
            <article className="panel integration-card" key={key}>
              <header className="integration-card-heading"><span className="integration-icon large"><Icon size={20} /></span><StateBadge state={state} /></header>
              <p className="eyebrow">INTEGRATION / {key.toUpperCase()}</p><h2>{title}</h2><p className="integration-origin">{origin}</p>
              <div className="integration-details"><span><strong>Última verificação</strong><small>{new Date().toLocaleString("pt-BR")}</small></span><span><strong>Dependência</strong><small>{dependency}</small></span></div>
              {state !== "operational" && <p className="integration-warning"><ShieldCheck size={14} />{key === "github" ? overview.data?.integrations.github.failures?.[0]?.message : key === "vercel" ? overview.data?.integrations.vercel.failures?.[0]?.message : overview.data?.integrations.services.message || "Uma ou mais fontes precisam de atenção."}</p>}
            </article>
          ))}
        </section>
      </QueryState>
    </>
  );
}
