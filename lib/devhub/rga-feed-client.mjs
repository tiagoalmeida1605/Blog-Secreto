import { DevHubError } from "./errors.mjs";
import { validateRgaBaseUrl } from "./validators.mjs";

const NEWS_URL = "https://radio-geracao-ativa.vercel.app/pages/publi.html";
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_PLAYLIST_ID = /^[A-Za-z0-9_-]+$/;

export class RgaFeedClient {
  constructor({ baseUrl, fetchImpl = globalThis.fetch, timeoutMs = 10_000 } = {}) {
    this.baseUrl = validateRgaBaseUrl(baseUrl);
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async getFeed() {
    if (!this.baseUrl) {
      return { state: "partially_configured", checkedAt: new Date().toISOString(), items: [], counts: emptyCounts(), message: "RGA_BASE_URL não configurada." };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/home-feed`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new DevHubError(502, "RGA_FEED_HTTP_ERROR", "O feed da RGA respondeu com erro.");
      const payload = await response.json();
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new DevHubError(502, "RGA_FEED_INVALID_RESPONSE", "O feed da RGA retornou dados inválidos.");
      }

      const hasNews = Array.isArray(payload.noticias) || isRecord(payload.noticias);
      const videoSource = payload.playlists ?? payload.videos;
      const hasVideos = Array.isArray(videoSource) || isRecord(videoSource);
      const news = hasNews ? records(payload.noticias).map(({ id, value }) => normalizeNews(id, value)).filter(Boolean) : [];
      const videos = hasVideos ? records(videoSource).map(({ id, value }) => normalizeVideo(id, value)).filter(Boolean) : [];
      return {
        state: hasNews && hasVideos ? "operational" : hasNews || hasVideos ? "degraded" : "unavailable",
        checkedAt: new Date().toISOString(),
        items: [...news, ...videos].sort((a, b) => dateValue(b.date) - dateValue(a.date)),
        counts: {
          news: hasNews ? news.length : null,
          videos: hasVideos ? videos.filter((item) => item.kind === "video").length : null,
          playlists: hasVideos ? videos.filter((item) => item.kind === "playlist").length : null,
        },
        message: hasNews && hasVideos ? null : "Uma ou mais fontes de conteúdo não foram retornadas.",
      };
    } catch (error) {
      if (error?.name === "AbortError") throw new DevHubError(504, "RGA_FEED_TIMEOUT", "O feed da RGA não respondeu a tempo.");
      throw error instanceof DevHubError ? error : new DevHubError(502, "RGA_FEED_UNAVAILABLE", "Não foi possível consultar o feed da RGA.");
    } finally {
      clearTimeout(timer);
    }
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function records(value) {
  if (Array.isArray(value)) return value.map((item, index) => ({ id: String(index), value: item }));
  if (isRecord(value)) return Object.entries(value).map(([id, item]) => ({ id, value: item }));
  return [];
}

function normalizeNews(id, value) {
  if (!isRecord(value)) return null;
  return {
    id,
    kind: "noticia",
    title: text(value.titulo, "Sem título"),
    summary: text(value.resumo ?? value.conteudo ?? value.texto),
    image: safeImage(value.imagem),
    date: value.data ?? value.createdAt ?? value.timestamp ?? null,
    tags: Array.isArray(value.tags) ? value.tags.filter((tag) => typeof tag === "string").slice(0, 10) : [],
    url: NEWS_URL,
  };
}

function normalizeVideo(id, value) {
  if (!isRecord(value)) return null;
  const kind = value.tipo === "video" ? "video" : "playlist";
  const videoId = typeof value.videoId === "string" ? value.videoId.trim() : "";
  const playlistId = typeof value.playlistId === "string" ? value.playlistId.trim() : "";
  const mediaId = kind === "video" ? videoId : playlistId;
  if (kind === "video" ? !YOUTUBE_VIDEO_ID.test(mediaId) : !YOUTUBE_PLAYLIST_ID.test(mediaId)) return null;
  return {
    id,
    kind,
    title: text(value.titulo, kind === "video" ? "Vídeo sem título" : "Playlist sem título"),
    summary: text(value.descricao),
    image: kind === "video" ? `https://i.ytimg.com/vi/${mediaId}/hqdefault.jpg` : "",
    date: value.data ?? value.createdAt ?? value.timestamp ?? null,
    tags: [],
    url: kind === "video"
      ? `https://www.youtube.com/watch?v=${encodeURIComponent(mediaId)}`
      : `https://www.youtube.com/playlist?list=${encodeURIComponent(mediaId)}`,
  };
}

function safeImage(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function text(value, fallback = "") {
  return typeof value === "string" ? value.slice(0, 2000) : fallback;
}

function dateValue(value) {
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function emptyCounts() {
  return { news: null, videos: null, playlists: null };
}
