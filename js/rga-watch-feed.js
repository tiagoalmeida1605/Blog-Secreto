/**
 * RGA Dark · feed de acompanhamento editorial.
 * Somente leitura: consulta o Firebase Realtime Database via REST.
 * Atualiza automaticamente a cada 30 s; não grava, edita ou remove dados.
 */
(() => {
  const DB_URL = "https://radiogeracaoativa-playlist-default-rtdb.firebaseio.com";
  const INTERVAL_MS = 30_000;
  const $ = (id) => document.getElementById(id);
  const feed = $("radio-activity-feed");
  if (!feed) return;

  const ui = {
    search: $("rga-watch-search"),
    refresh: $("rga-watch-refresh"),
    status: $("rga-watch-feed-status"),
    dot: $("rga-watch-connection-dot"),
    lastSync: $("rga-watch-last-sync"),
    newsSource: $("rga-watch-news-source"),
    videoSource: $("rga-watch-video-source"),
    newsMetric: document.querySelector(".rgaWatchMetricNews .rgaWatchMetricState"),
    videoMetric: document.querySelector(".rgaWatchMetricVideo .rgaWatchMetricState"),
    syncMetric: document.querySelector(".rgaWatchMetricSync .rgaWatchMetricState"),
    syncDescription: document.querySelector(".rgaWatchMetricSync p"),
    syncCode: document.querySelector(".rgaWatchMetricSync .rgaWatchMetricCode"),
    panelBadge: document.querySelector(".rgaWatchPanelBadge"),
  };

  let allItems = [];
  let activeFilter = "all";
  let lastSyncAt = null;
  let inFlight = false;
  let timer = null;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  function asRecords(data) {
    if (Array.isArray(data)) return data.map((item, i) => ({ id: String(i), item }));
    if (!data || typeof data !== "object") return [];
    return Object.entries(data).map(([id, item]) => ({ id, item }));
  }

  function parseDate(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (!value) return 0;
    const raw = String(value).trim();
    let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    m = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
    const n = Date.parse(raw);
    return Number.isNaN(n) ? 0 : n;
  }

  function formatDate(value) {
    const timestamp = parseDate(value);
    if (!timestamp) return "Data não informada";
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(timestamp));
  }

  function safeImage(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      const url = new URL(value, window.location.origin);
      if (url.protocol === "https:" || (url.protocol === "http:" && url.origin === window.location.origin)) return url.href;
    } catch { /* URL inválida */ }
    return "";
  }

  function normaliseNews(data) {
    return asRecords(data)
      .filter(({ item }) => item && typeof item === "object" && !Array.isArray(item))
      .map(({ id, item }) => ({
        id,
        kind: "noticia",
        title: String(item.titulo ?? "Sem título"),
        summary: String(item.resumo ?? item.conteudo ?? item.texto ?? ""),
        body: String(item.conteudo ?? item.texto ?? ""),
        image: safeImage(item.imagem),
        date: item.data ?? item.createdAt ?? item.timestamp ?? null,
        tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
        url: "https://radio-geracao-ativa.vercel.app/pages/publi.html",
        order: parseDate(item.data ?? item.createdAt ?? item.timestamp),
      }));
  }

  function normaliseVideos(data) {
    return asRecords(data)
      .filter(({ item }) => item && typeof item === "object" && !Array.isArray(item))
      .map(({ id, item }) => {
        const kind = item.tipo === "video" ? "video" : "playlist";
        const videoId = String(item.videoId ?? "").trim();
        const playlistId = String(item.playlistId ?? "").trim();
        const validVideo = /^[A-Za-z0-9_-]{11}$/.test(videoId);
        const validPlaylist = /^[A-Za-z0-9_-]+$/.test(playlistId);
        const valid = kind === "video" ? validVideo : validPlaylist;
        const youtubeId = kind === "video" ? videoId : playlistId;
        const url = !valid ? "" : kind === "video"
          ? `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`
          : `https://www.youtube.com/playlist?list=${encodeURIComponent(youtubeId)}`;
        return {
          id,
          kind,
          title: String(item.titulo ?? (kind === "video" ? "Vídeo sem título" : "Playlist sem título")),
          summary: String(item.descricao ?? ""),
          image: kind === "video" && validVideo ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "",
          date: item.data ?? item.createdAt ?? item.timestamp ?? null,
          tags: [],
          url,
          order: parseDate(item.data ?? item.createdAt ?? item.timestamp),
        };
      })
      .filter((item) => item.url);
  }

  function setSourceState(node, text, good) {
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("is-connected", Boolean(good));
    node.classList.toggle("is-error", !good && text === "ERRO");
  }

  function setStatus(state, message) {
    if (ui.status) ui.status.textContent = message;
    if (ui.dot) {
      ui.dot.classList.toggle("is-loading", state === "loading");
      ui.dot.classList.toggle("is-error", state === "error");
      ui.dot.classList.toggle("is-connected", state === "connected");
    }
    if (ui.panelBadge) ui.panelBadge.textContent = state === "connected" ? "LIVE FEED · ONLINE" : state === "error" ? "LIVE FEED · ERRO" : "LIVE FEED · SYNC";
    if (ui.refresh) {
      ui.refresh.disabled = state === "loading";
      ui.refresh.classList.toggle("is-loading", state === "loading");
    }
  }

  function renderEmpty(title, message, error = false) {
    feed.replaceChildren();
    const box = element("div", `rgaWatchEmpty${error ? " is-error" : ""}`);
    box.append(element("span", "rgaWatchEmptyGlyph", error ? "!" : "⌕"));
    box.append(element("h3", "", title));
    box.append(element("p", "", message));
    feed.append(box);
    feed.setAttribute("aria-busy", "false");
  }

  function makeCard(item) {
    const card = element("article", "rgaWatchFeedCard");
    card.dataset.kind = item.kind === "noticia" ? "noticia" : "video";
    const media = element("div", "rgaWatchFeedMedia");
    if (item.image) {
      const img = document.createElement("img");
      img.src = item.image;
      img.alt = `Miniatura: ${item.title}`;
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", () => {
        img.remove();
        media.classList.add("is-placeholder");
        media.append(element("span", "", item.kind === "noticia" ? "RGA / NOTÍCIA" : "RGA / VÍDEO"));
      }, { once: true });
      media.append(img);
    } else {
      media.classList.add("is-placeholder");
      media.append(element("span", "", item.kind === "noticia" ? "RGA / NOTÍCIA" : "RGA / PLAYLIST"));
    }
    const body = element("div", "rgaWatchFeedCardBody");
    const meta = element("div", "rgaWatchFeedMeta");
    const label = item.kind === "noticia" ? "NOTÍCIA" : item.kind === "video" ? "VÍDEO" : "PLAYLIST";
    meta.append(element("span", `rgaWatchKind rgaWatchKind-${item.kind}`, label));
    meta.append(element("time", "rgaWatchFeedDate", formatDate(item.date)));
    body.append(meta);
    body.append(element("h3", "rgaWatchFeedTitle", item.title));
    if (item.summary) body.append(element("p", "rgaWatchFeedSummary", item.summary.length > 230 ? `${item.summary.slice(0, 227).trimEnd()}…` : item.summary));
    if (item.tags.length) {
      const tags = element("div", "rgaWatchFeedTags");
      item.tags.slice(0, 5).forEach((tag) => tags.append(element("span", "", tag)));
      body.append(tags);
    }
    const actions = element("div", "rgaWatchFeedActions");
    const open = element("a", "rgaWatchOpenLink", item.kind === "noticia" ? "Abrir notícias no site ↗" : "Abrir no YouTube ↗");
    open.href = item.url;
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    actions.append(open);
    const id = element("span", "rgaWatchRecordId", `ID ${item.id.slice(0, 10)}`);
    id.title = `Identificador do registro: ${item.id}`;
    actions.append(id);
    body.append(actions);
    card.append(media, body);
    return card;
  }

  function renderFeed() {
    const query = (ui.search?.value || "").trim().toLocaleLowerCase("pt-BR");
    const filtered = allItems.filter((item) => {
      const isNews = item.kind === "noticia";
      if (activeFilter === "noticia" && !isNews) return false;
      if (activeFilter === "video" && isNews) return false;
      const haystack = `${item.title} ${item.summary} ${item.tags.join(" ")}`.toLocaleLowerCase("pt-BR");
      return !query || haystack.includes(query);
    });
    if (!filtered.length) {
      renderEmpty(allItems.length ? "Nenhum resultado encontrado" : "Nenhuma publicação encontrada", allItems.length ? "Tenta outro termo ou muda o filtro." : "As fontes responderam, mas ainda não há registros válidos para exibir.");
      return;
    }
    feed.replaceChildren();
    filtered.forEach((item) => feed.append(makeCard(item)));
    feed.setAttribute("aria-busy", "false");
  }

  async function readPath(path) {
    const response = await fetch(`${DB_URL}/${path}.json`, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }

  async function syncFeed({ manual = false } = {}) {
    if (inFlight) return;
    inFlight = true;
    setStatus("loading", manual ? "Atualização manual em andamento…" : "Sincronizando com o Firebase…");
    feed.setAttribute("aria-busy", "true");
    try {
      const [newsResult, videoResult] = await Promise.allSettled([readPath("noticias"), readPath("playlists")]);
      const newsOk = newsResult.status === "fulfilled";
      const videosOk = videoResult.status === "fulfilled";
      setSourceState(ui.newsSource, newsOk ? "CONECTADO" : "ERRO", newsOk);
      setSourceState(ui.videoSource, videosOk ? "CONECTADO" : "ERRO", videosOk);
      if (!newsOk && !videosOk) {
        const detail = [newsResult, videoResult].filter((r) => r.status === "rejected").map((r) => r.reason?.message || "Falha de rede").join(" · ");
        throw new Error(detail);
      }
      const news = newsOk ? normaliseNews(newsResult.value) : [];
      const videos = videosOk ? normaliseVideos(videoResult.value) : [];
      allItems = [...news, ...videos].sort((a, b) => b.order - a.order || (a.kind === "noticia" ? -1 : 1));
      lastSyncAt = new Date();
      const partial = !newsOk || !videosOk;
      setStatus(partial ? "error" : "connected", partial ? "Conectado parcialmente: uma fonte falhou." : `Conectado · ${allItems.length} registros recebidos`);
      if (ui.lastSync) ui.lastSync.textContent = `Última sincronização: ${lastSyncAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
      if (ui.newsMetric) ui.newsMetric.textContent = newsOk ? `${news.length} REGISTROS` : "ERRO DE LEITURA";
      if (ui.videoMetric) ui.videoMetric.textContent = videosOk ? `${videos.length} REGISTROS` : "ERRO DE LEITURA";
      if (ui.syncMetric) ui.syncMetric.textContent = partial ? "PARCIAL" : "ONLINE";
      if (ui.syncDescription) ui.syncDescription.textContent = `Última leitura concluída às ${lastSyncAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}.`;
      if (ui.syncCode) ui.syncCode.textContent = "SYNC / 30S";
      renderFeed();
    } catch (error) {
      console.error("[RGA Dark] Falha ao sincronizar o feed:", error);
      setStatus("error", "Falha ao conectar. Verifica a rede ou as regras de leitura do Firebase.");
      setSourceState(ui.newsSource, "ERRO", false);
      setSourceState(ui.videoSource, "ERRO", false);
      if (ui.newsMetric) ui.newsMetric.textContent = "ERRO DE LEITURA";
      if (ui.videoMetric) ui.videoMetric.textContent = "ERRO DE LEITURA";
      if (ui.syncMetric) ui.syncMetric.textContent = "OFFLINE";
      if (ui.lastSync) ui.lastSync.textContent = lastSyncAt ? `Última leitura válida: ${lastSyncAt.toLocaleTimeString("pt-BR")}` : "Nenhuma leitura válida ainda";
      renderEmpty("Não foi possível carregar o feed", "O painel não altera o Firebase. Confere se o banco permite leitura pública desses caminhos e tenta novamente.", true);
    } finally {
      inFlight = false;
      if (feed) feed.setAttribute("aria-busy", "false");
    }
  }

  ui.search?.addEventListener("input", renderFeed);
  ui.refresh?.addEventListener("click", () => syncFeed({ manual: true }));
  document.querySelectorAll("[data-rga-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.rgaFilter || "all";
      document.querySelectorAll("[data-rga-filter]").forEach((other) => {
        const active = other === button;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      renderFeed();
    });
  });

  syncFeed();
  timer = window.setInterval(() => syncFeed(), INTERVAL_MS);
  window.addEventListener("beforeunload", () => { if (timer) window.clearInterval(timer); }, { once: true });
})();
