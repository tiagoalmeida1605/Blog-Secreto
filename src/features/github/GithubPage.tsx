import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, GitBranch, GitCommitHorizontal, Workflow } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { QueryState } from "../../components/feedback/QueryState";
import { StateBadge } from "../../components/feedback/StateBadge";
import { api } from "../../services/api";

export function GithubPage() {
  const github = useQuery({ queryKey: ["github"], queryFn: api.getGithub });
  const repositories = github.data?.repositories || [];
  const commitCount = repositories.reduce((count, repository) => count + repository.commits.length, 0);
  const workflowCount = repositories.reduce((count, repository) => count + repository.actions.length, 0);

  return (
    <>
      <PageHeader eyebrow="SOURCE CONTROL / GITHUB" title="GitHub Activity" description="Repositórios, commits recentes e GitHub Actions consultados pelo backend privado." action={github.data && <StateBadge state={github.data.state} />} />
      <QueryState loading={github.isLoading} error={github.error as Error | null} onRetry={() => void github.refetch()}>
        <section className="metric-grid">
          <Metric label="Repositórios" value={repositories.length} icon={GitBranch} />
          <Metric label="Commits retornados" value={commitCount} icon={GitCommitHorizontal} />
          <Metric label="Execuções recentes" value={workflowCount} icon={Workflow} />
        </section>
        {github.data?.failures?.map((failure) => <p className="inline-error" key={failure.code} role="status">{failure.message}</p>)}
        <section className="github-repository-grid">
          {repositories.map((repository) => (
            <article className="panel github-repo-card" key={repository.repository}>
              <header className="panel-heading"><div><p className="eyebrow">REPOSITORY / {repository.visibility.toUpperCase()}</p><h2>{repository.name}</h2></div><a className="icon-link" href={repository.htmlUrl || `https://github.com/${repository.repository}`} target="_blank" rel="noreferrer" aria-label={`Abrir ${repository.repository}`}><ArrowUpRight size={17} /></a></header>
              <p className="repo-full-name">{repository.repository} {repository.defaultBranch && <span>· {repository.defaultBranch}</span>}</p>
              <div className="repo-section"><h3><GitCommitHorizontal size={15} /> Commits recentes</h3>{repository.commits.map((commit) => <a className="repo-event-row" key={commit.sha || commit.authoredAt} href={commit.url || "#"} target="_blank" rel="noreferrer"><span><strong>{commit.message || "Sem mensagem"}</strong><small>{commit.sha?.slice(0, 8)} · {formatDate(commit.authoredAt)}</small></span><ArrowUpRight size={13} /></a>)}{!repository.commits.length && <p className="muted small-text">Nenhum commit retornado na consulta.</p>}</div>
              <div className="repo-section"><h3><Workflow size={15} /> GitHub Actions</h3>{repository.actions.map((run) => <a className="repo-event-row" key={run.id || run.createdAt} href={run.url || "#"} target="_blank" rel="noreferrer"><span><strong>{run.name || "Workflow"}</strong><small>{run.status || "estado não informado"}{run.conclusion ? ` · ${run.conclusion}` : ""} · {formatDate(run.createdAt)}</small></span><ArrowUpRight size={13} /></a>)}{!repository.actions.length && <p className="muted small-text">Nenhuma execução retornada na consulta.</p>}</div>
            </article>
          ))}
          {!repositories.length && <div className="empty-state"><GitBranch size={22} /><h2>Sem repositórios disponíveis</h2><p>Verifique GITHUB_REPOSITORIES e o estado mostrado pela API.</p></div>}
        </section>
      </QueryState>
    </>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof GitBranch }) {
  return <article className="metric-card"><span className="metric-icon"><Icon size={18} /></span><span className="metric-label">{label}</span><strong>{value}</strong><small>Resposta atual da API</small></article>;
}

function formatDate(value: string | null) {
  if (!value) return "data indisponível";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "data indisponível" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
