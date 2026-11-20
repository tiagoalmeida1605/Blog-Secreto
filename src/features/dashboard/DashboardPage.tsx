import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Boxes,
  GitCommitHorizontal,
  Globe2,
  Radio,
  RefreshCw,
  Rocket,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/layout/PageHeader";
import { QueryState } from "../../components/feedback/QueryState";
import { StateBadge } from "../../components/feedback/StateBadge";
import { api } from "../../services/api";
import { DASHBOARD_WIDGETS } from "../../types/devhub";

function formatTime(value?: string | null) {
  if (!value) return "Sem atualização";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function DashboardPage() {
  const overview = useQuery({ queryKey: ["overview"], queryFn: api.getOverview });
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.getProjects });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });

  const metrics = useMemo(() => {
    const repositories = overview.data?.integrations.github.repositories || [];
    const deployments = overview.data?.integrations.vercel.projects.flatMap((project) => project.deployments) || [];
    const services = overview.data?.integrations.services;
    return {
      projects: projects.data?.projects.filter((project) => project.status !== "archived").length,
      repositories: repositories.length,
      commits: repositories.reduce((total, repo) => total + repo.commits.length, 0),
      deployments: deployments.length,
      rgaFeedCount: typeof services?.feed?.newsCount === "number" ? services.feed.newsCount : null,
    };
  }, [overview.data, projects.data]);

  const widgets = settings.data?.dashboardWidgets || [...DASHBOARD_WIDGETS];
  const integrationCards = overview.data ? [
    { key: "github", title: "GitHub", state: overview.data.integrations.github.state, detail: `${overview.data.integrations.github.repositories.length} repositórios monitorados`, icon: GitCommitHorizontal, to: "/github" },
    { key: "vercel", title: "Vercel", state: overview.data.integrations.vercel.state, detail: `${overview.data.integrations.vercel.projects.length} projetos consultados`, icon: Rocket, to: "/vercel" },
    { key: "rga", title: "Rádio Geração Ativa", state: overview.data.integrations.services.state, detail: overview.data.integrations.services.feed?.checkedAt ? `Feed verificado ${formatTime(String(overview.data.integrations.services.feed.checkedAt))}` : "Monitoramento do serviço", icon: Radio, to: "/rga" },
  ] : [];

  return (
    <>
      <PageHeader
        eyebrow="NEXUS / OPERATIONS"
        title="Dashboard"
        description="Estado atual do seu ecossistema digital, consolidado pelas integrações configuradas."
        action={<button className="button button-quiet" onClick={() => { void overview.refetch(); void projects.refetch(); }} type="button"><RefreshCw size={15} /> Atualizar</button>}
      />
      <QueryState loading={overview.isLoading || projects.isLoading} error={(overview.error || projects.error) as Error | null} onRetry={() => { void overview.refetch(); void projects.refetch(); }}>
        <section className="metric-grid" aria-label="Indicadores atuais">
          <Metric label="Projects ativos" value={metrics.projects} icon={Boxes} note="Dados cadastrados no workspace" />
          <Metric label="Repositórios GitHub" value={metrics.repositories} icon={GitCommitHorizontal} note="Fontes monitoradas" />
          <Metric label="Commits consultados" value={metrics.commits} icon={Zap} note="Atividade retornada pela API" />
          <Metric label="Deployments recentes" value={metrics.deployments} icon={Rocket} note="Amostra atual da Vercel" />
        </section>

        <div className="dashboard-grid">
          {widgets.includes("integrations") && (
            <section className="panel dashboard-integrations">
              <PanelHeading eyebrow="CONNECTIONS / 01" title="Estado das integrações" to="/integrations" />
              <div className="integration-list">
                {integrationCards.map(({ key, title, state, detail, icon: Icon, to }) => (
                  <Link className="integration-row" to={to} key={key}>
                    <span className="integration-icon"><Icon size={17} /></span>
                    <span className="integration-copy"><strong>{title}</strong><small>{detail}</small></span>
                    <StateBadge state={state} />
                  </Link>
                ))}
                <div className="integration-row">
                  <span className="integration-icon"><Globe2 size={17} /></span>
                  <span className="integration-copy"><strong>Firebase</strong><small>Authentication ativo; acesso aos dados via API proprietária</small></span>
                  <StateBadge state="operational" />
                </div>
              </div>
              <p className="panel-footnote">Estado recebido da API Dev Hub; não representa uptime histórico.</p>
            </section>
          )}

          {widgets.includes("projects") && (
            <section className="panel dashboard-projects">
              <PanelHeading eyebrow="PORTFOLIO / 02" title="Projects" to="/projects" />
              <div className="project-preview-list">
                {(projects.data?.projects || []).filter((project) => project.status !== "archived").slice(0, 4).map((project) => (
                  <div className="project-preview" key={project.id}>
                    <span className={`project-mark status-dot-${project.status}`} />
                    <span><strong>{project.name}</strong><small>{project.category} · Atualizado {formatTime(project.updatedAt)}</small></span>
                    <span className="project-status-text">{project.status}</span>
                  </div>
                ))}
                {!projects.data?.projects.filter((project) => project.status !== "archived").length && <EmptyPanel text="Nenhum projeto cadastrado ainda." action={<Link to="/projects">Cadastrar o primeiro projeto <ArrowUpRight size={14} /></Link>} />}
              </div>
            </section>
          )}

          {widgets.includes("github") && (
            <section className="panel dashboard-activity">
              <PanelHeading eyebrow="SOURCE CONTROL / 03" title="Atividade GitHub" to="/github" />
              <div className="compact-activity-list">
                {(overview.data?.integrations.github.repositories || []).flatMap((repository) =>
                  repository.commits.slice(0, 2).map((commit) => ({ repository, commit })),
                ).slice(0, 5).map(({ repository, commit }) => (
                  <a className="compact-activity" href={commit.url || repository.htmlUrl || "#"} target="_blank" rel="noreferrer" key={`${repository.repository}-${commit.sha}`}>
                    <GitCommitHorizontal size={15} />
                    <span><strong>{commit.message || "Commit sem mensagem"}</strong><small>{repository.repository} · {formatTime(commit.authoredAt)}</small></span>
                    <ArrowUpRight size={14} />
                  </a>
                ))}
                {!metrics.commits && <EmptyPanel text="A API não retornou commits na consulta atual." />}
              </div>
            </section>
          )}

          {widgets.includes("deployments") && (
            <section className="panel dashboard-deployments">
              <PanelHeading eyebrow="DELIVERY / 04" title="Deployments recentes" to="/vercel" />
              <div className="deployment-list">
                {(overview.data?.integrations.vercel.projects || []).flatMap((project) =>
                  project.deployments.slice(0, 2).map((deployment) => ({ project, deployment })),
                ).slice(0, 4).map(({ project, deployment }) => (
                  <div className="deployment-row" key={deployment.id || `${project.project}-${deployment.createdAt}`}>
                    <Rocket size={15} />
                    <span><strong>{project.project}</strong><small>{deployment.environment} · {formatTime(deployment.createdAt)}</small></span>
                    <span className="deployment-state">{deployment.state}</span>
                  </div>
                ))}
                {!metrics.deployments && <EmptyPanel text="Nenhum deployment foi retornado pela configuração atual da Vercel." />}
              </div>
            </section>
          )}

          {widgets.includes("rga") && (
            <section className="panel dashboard-rga">
              <PanelHeading eyebrow="CONTENT OPS / 05" title="Rádio Geração Ativa" to="/rga" />
              <div className="rga-summary">
                <div className="rga-summary-icon"><Radio size={20} /></div>
                <div><StateBadge state={overview.data?.integrations.services.state || "unavailable"} /><p>{overview.data?.integrations.services.feed?.message as string || "Estado consultado pela API Dev Hub."}</p></div>
              </div>
              <div className="rga-metrics"><span><strong>{metrics.rgaFeedCount ?? "—"}</strong><small>notícias no feed atual</small></span><Link to="/rga">Abrir monitor <ArrowUpRight size={14} /></Link></div>
            </section>
          )}
        </div>
        <p className="data-disclaimer">Indicadores refletem as respostas atuais das fontes; não representam histórico analítico. <Link to="/analytics">Ver snapshots coletados</Link></p>
      </QueryState>
    </>
  );
}

function Metric({ label, value, icon: Icon, note }: { label: string; value?: number; icon: typeof Boxes; note: string }) {
  return <article className="metric-card"><span className="metric-icon"><Icon size={18} /></span><span className="metric-label">{label}</span><strong>{value ?? "—"}</strong><small>{note}</small></article>;
}

function PanelHeading({ eyebrow, title, to }: { eyebrow: string; title: string; to: string }) {
  return <header className="panel-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><Link className="icon-link" to={to} aria-label={`Abrir ${title}`}><ArrowUpRight size={17} /></Link></header>;
}

function EmptyPanel({ text, action }: { text: string; action?: React.ReactNode }) {
  return <div className="empty-panel"><p>{text}</p>{action && <span>{action}</span>}</div>;
}
