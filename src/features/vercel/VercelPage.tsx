import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Cloud, Rocket } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { QueryState } from "../../components/feedback/QueryState";
import { StateBadge } from "../../components/feedback/StateBadge";
import { api } from "../../services/api";

export function VercelPage() {
  const deployments = useQuery({ queryKey: ["deployments"], queryFn: api.getDeployments });
  const projects = deployments.data?.projects || [];
  const count = projects.reduce((total, project) => total + project.deployments.length, 0);
  return (
    <>
      <PageHeader eyebrow="DELIVERY / VERCEL" title="Vercel Monitor" description="Deployments recentes consultados server-side. Nenhuma ação de publicação é executada pelo Dev Hub." action={<span className="mono small-text">{count} DEPLOYMENTS RETORNADOS</span>} />
      <QueryState loading={deployments.isLoading} error={deployments.error as Error | null} onRetry={() => void deployments.refetch()}>
        <section className="deployment-project-grid">
          {projects.map((project) => (
            <article className="panel deployment-project" key={project.project}>
              <header className="panel-heading"><div><p className="eyebrow">VERCEL PROJECT</p><h2>{project.project}</h2></div><Cloud size={18} /></header>
              {project.state && <StateBadge state={project.state} />}
              {project.error && <p className="inline-error">{project.error.message}</p>}
              <div className="deployment-list">
                {project.deployments.map((deployment) => (
                  <div className="deployment-detail" key={deployment.id || `${deployment.name}-${deployment.createdAt}`}>
                    <span className="deployment-icon"><Rocket size={16} /></span>
                    <span className="deployment-info"><strong>{deployment.name}</strong><small>{deployment.environment} · {formatDate(deployment.createdAt)}</small></span>
                    <span className={`deployment-state state-text-${deployment.state.toLowerCase()}`}>{deployment.state}</span>
                    {deployment.url && <a className="icon-link" href={deployment.url} target="_blank" rel="noreferrer" aria-label={`Abrir deployment ${deployment.name}`}><ArrowUpRight size={15} /></a>}
                  </div>
                ))}
                {!project.deployments.length && !project.error && <p className="empty-inline">Nenhum deployment retornado para este projeto.</p>}
              </div>
            </article>
          ))}
          {!projects.length && <div className="empty-state"><Cloud size={22} /><h2>Vercel não configurada</h2><p>A API não retornou projetos. Verifique a configuração server-side sem expor tokens.</p></div>}
        </section>
      </QueryState>
    </>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Data indisponível";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
