import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Radio, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { QueryState } from "../../components/feedback/QueryState";
import { StateBadge } from "../../components/feedback/StateBadge";
import { api } from "../../services/api";

export function RgaPage() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const feed = useQuery({ queryKey: ["rga-feed"], queryFn: api.getRgaFeed, refetchInterval: 30_000 });
  const items = useMemo(() => (feed.data?.items || []).filter((item) => {
    const matchesType = kind === "all" || item.kind === kind;
    const text = `${item.title} ${item.summary} ${item.tags.join(" ")}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    const matchesSearch = !query.trim() || text.includes(query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR"));
    return matchesType && matchesSearch;
  }), [feed.data, kind, query]);
  const counts = feed.data?.counts;

  return (
    <>
      <PageHeader eyebrow="CONTENT OPS / RADIO GERAÇÃO ATIVA" title="RGA Monitor" description="Acompanhamento somente leitura das notícias, vídeos e playlists fornecidos pelo feed oficial." action={<button className="button button-quiet" onClick={() => void feed.refetch()} type="button" disabled={feed.isFetching}><RefreshCw size={15} className={feed.isFetching ? "spin" : ""} /> Atualizar</button>} />
      {feed.data && <div className="rga-status-line"><StateBadge state={feed.data.state} /><span className="mono small-text">VERIFICADO {formatDate(feed.data.checkedAt)}</span></div>}
      <QueryState loading={feed.isLoading} error={feed.error as Error | null} onRetry={() => void feed.refetch()}>
        <section className="metric-grid">
          <Metric label="Notícias" value={counts?.news ?? null} />
          <Metric label="Vídeos" value={counts?.videos ?? null} />
          <Metric label="Playlists" value={counts?.playlists ?? null} />
        </section>
        {feed.data?.message && <p className="inline-warning" role="status">{feed.data.message}</p>}
        <div className="toolbar">
          <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar publicações..." /><span className="sr-only">Buscar publicações da RGA</span></label>
          <select aria-label="Filtrar publicações" value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">Todos os tipos</option><option value="noticia">Notícias</option><option value="video">Vídeos</option><option value="playlist">Playlists</option></select>
        </div>
        {items.length ? (
          <section className="rga-feed-grid" aria-label="Publicações da RGA">
            {items.map((item) => <article className="rga-feed-card" key={`${item.kind}-${item.id}`}>
              <div className={`rga-feed-media${item.image ? "" : " media-placeholder"}`}>{item.image ? <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span>RGA / {item.kind.toUpperCase()}</span>}</div>
              <div className="rga-feed-body"><div className="rga-feed-meta"><span className={`rga-kind kind-${item.kind}`}>{item.kind}</span><time>{formatDate(item.date)}</time></div><h2>{item.title}</h2><p>{item.summary || "Sem descrição informada."}</p>{item.tags.length > 0 && <div className="technology-list">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}<a className="text-link" href={item.url} target="_blank" rel="noreferrer">Abrir publicação <ExternalLink size={14} /></a></div>
            </article>)}
          </section>
        ) : <div className="empty-state"><Radio size={22} /><h2>{feed.data?.items.length ? "Nenhum resultado" : "Feed sem publicações"}</h2><p>{feed.data?.items.length ? "Altere a pesquisa ou o tipo para ver outros itens." : "O endpoint respondeu sem publicações válidas neste momento."}</p></div>}
      </QueryState>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number | null | undefined }) {
  return <article className="metric-card"><span className="metric-label">{label}</span><strong>{value ?? "—"}</strong><small>Itens retornados pela fonte</small></article>;
}

function formatDate(value: string | null) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data não informada" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
