import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, BarChart3, Database, RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "../../components/layout/PageHeader";
import { QueryState } from "../../components/feedback/QueryState";
import { StateBadge } from "../../components/feedback/StateBadge";
import { api } from "../../services/api";

export function AnalyticsPage() {
  const [period, setPeriod] = useState("30d");
  const queryClient = useQueryClient();
  const history = useQuery({ queryKey: ["analytics", period], queryFn: () => api.getAnalytics(period) });
  const collect = useMutation({
    mutationFn: api.collectAnalytics,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["analytics"] }),
  });
  const snapshots = history.data?.snapshots || [];
  const lineData = snapshots.map((snapshot) => ({
    ...snapshot.metrics,
    time: new Date(snapshot.collectedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
  }));
  const latest = history.data?.latestSnapshot;

  return (
    <>
      <PageHeader
        eyebrow="OBSERVABILITY / HISTORICAL DATA"
        title="Analytics"
        description="Séries construídas somente por snapshots coletados no backend. Os valores atuais não são tratados como histórico."
        action={<button className="button button-primary" type="button" onClick={() => collect.mutate()} disabled={collect.isPending}><RefreshCw size={15} className={collect.isPending ? "spin" : ""} />{collect.isPending ? "Coletando..." : "Coletar snapshot"}</button>}
      />
      {collect.error && <p className="inline-error" role="alert">{collect.error.message}</p>}
      {collect.data && <p className="inline-success" role="status">{collect.data.created ? "Snapshot registrado." : "Já existe um snapshot nesta janela; nenhuma duplicação foi criada."}</p>}
      <div className="toolbar analytics-toolbar">
        <div className="segmented-control" aria-label="Período analítico">
          {[["7d", "7 dias"], ["30d", "30 dias"], ["90d", "90 dias"], ["all", "Histórico"]].map(([value, label]) => <button key={value} type="button" className={period === value ? "selected" : ""} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>)}
        </div>
        <span className="mono small-text">{snapshots.length} SNAPSHOTS / RANGE</span>
      </div>
      <QueryState loading={history.isLoading} error={history.error as Error | null} onRetry={() => void history.refetch()}>
        {!snapshots.length ? (
          <div className="empty-state analytics-empty"><Database size={24} /><h2>Histórico em inicialização</h2><p>{history.data?.message || "Ainda não existem snapshots no período selecionado. Faça uma coleta manual para começar."}</p><p className="muted small-text">A coleta automática não está habilitada nesta versão.</p></div>
        ) : (
          <>
            <section className="metric-grid analytics-metrics">
              <SnapshotMetric label="Projects" value={latest?.metrics.projects} />
              <SnapshotMetric label="Commits consultados" value={latest?.metrics.githubCommits} />
              <SnapshotMetric label="Deployments observados" value={latest?.metrics.vercelDeployments} />
              <SnapshotMetric label="Publicações RGA" value={latest && latest.metrics.rgaNews !== null && latest.metrics.rgaVideos !== null ? latest.metrics.rgaNews + latest.metrics.rgaVideos : null} />
            </section>
            <section className="chart-grid">
              <article className="panel chart-panel">
                <header className="panel-heading"><div><p className="eyebrow">COLLECTED SERIES / 01</p><h2>Atividade capturada</h2></div><Activity size={17} /></header>
                <p className="chart-caption">Contagens nos snapshots armazenados; cada ponto representa uma coleta real.</p>
                <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={lineData} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}><CartesianGrid stroke="var(--nx-border)" strokeDasharray="3 5" /><XAxis dataKey="time" tick={{ fill: "var(--nx-text-muted)", fontSize: 10 }} minTickGap={30} /><YAxis allowDecimals={false} tick={{ fill: "var(--nx-text-muted)", fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="githubCommits" name="Commits consultados" stroke="var(--nx-blue-light)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} /><Line type="monotone" dataKey="vercelDeployments" name="Deployments" stroke="var(--nx-cyan)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} /></LineChart></ResponsiveContainer></div>
              </article>
              <article className="panel chart-panel">
                <header className="panel-heading"><div><p className="eyebrow">SOURCE COUNTS / 02</p><h2>Projetos e conteúdo</h2></div><BarChart3 size={17} /></header>
                <p className="chart-caption">Métricas atuais observadas em cada coleta, sem interpolação de períodos sem dados.</p>
                <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={lineData} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}><CartesianGrid stroke="var(--nx-border)" strokeDasharray="3 5" /><XAxis dataKey="time" tick={{ fill: "var(--nx-text-muted)", fontSize: 10 }} minTickGap={30} /><YAxis allowDecimals={false} tick={{ fill: "var(--nx-text-muted)", fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="projects" name="Projects" fill="var(--nx-blue)" radius={[3, 3, 0, 0]} /><Bar dataKey="rgaNews" name="Notícias RGA" fill="var(--nx-cyan)" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
              </article>
            </section>
            <section className="panel snapshot-table">
              <header className="panel-heading"><div><p className="eyebrow">SOURCE HEALTH / 03</p><h2>Snapshots recentes</h2></div><span className="mono small-text">LAST: {latest ? new Date(latest.collectedAt).toLocaleString("pt-BR") : "—"}</span></header>
              <div className="table-scroll"><table><thead><tr><th>Coletado em</th><th>Projects</th><th>GitHub</th><th>Vercel</th><th>RGA</th><th>Firebase</th></tr></thead><tbody>{[...snapshots].reverse().slice(0, 20).map((snapshot) => <tr key={snapshot.id}><td>{new Date(snapshot.collectedAt).toLocaleString("pt-BR")}</td><td>{snapshot.metrics.projects}</td>{(["github", "vercel", "rga", "firebase"] as const).map((source) => <td key={source}><StateBadge state={snapshot.sources[source] || "unavailable"} /></td>)}</tr>)}</tbody></table></div>
              <p className="panel-footnote">Snapshots criados manualmente; retenção e periodicidade não estão agendadas nesta instalação.</p>
            </section>
          </>
        )}
      </QueryState>
    </>
  );
}

const tooltipStyle = { background: "var(--nx-surface-raised)", border: "1px solid var(--nx-border-strong)", borderRadius: 6, color: "var(--nx-text)", fontSize: 12 };

function SnapshotMetric({ label, value }: { label: string; value?: number | null }) {
  return <article className="metric-card"><span className="metric-label">{label}</span><strong>{value ?? "—"}</strong><small>Valor do snapshot mais recente</small></article>;
}
