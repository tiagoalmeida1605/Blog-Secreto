const USERNAME = "tiagoalmeida1605";
const API_BASE = "https://api.github.com";
const CACHE_KEY = "bs-github-activity-v1";
const CACHE_TTL = 10 * 60 * 1000;
const $ = (id) => globalThis.document?.getElementById(id);

export function normalizeGitHubEvent(event) {
  if (!event || typeof event !== "object" || typeof event.type !== "string") return null;
  const repoName = typeof event.repo?.name === "string" ? event.repo.name : "";
  const repoUrl = repoName ? `https://github.com/${repoName}` : "";
  const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
  let description = "";
  let url = repoUrl;
  switch (event.type) {
    case "PushEvent": {
      const commits = Array.isArray(payload.commits) ? payload.commits.filter((commit) => typeof commit?.message === "string") : [];
      const messages = commits.slice(0, 3).map((commit) => commit.message.split("\n")[0]).filter(Boolean);
      description = commits.length
        ? `Enviou ${commits.length} ${commits.length === 1 ? "commit" : "commits"}${messages.length ? `: ${messages.join(" · ")}` : ""}`
        : "Enviou alterações";
      if (payload.ref) description += ` (${String(payload.ref).replace(/^refs\/heads\//, "")})`;
      break;
    }
    case "CreateEvent":
      description = `Criou ${String(payload.ref_type || "referência")}${payload.ref ? ` ${payload.ref}` : ""}`;
      break;
    case "PullRequestEvent": {
      const action = String(payload.action || "atualizou");
      const pull = payload.pull_request || {};
      description = `${action === "opened" ? "Abriu" : action === "closed" ? "Concluiu/fechou" : "Atualizou"} pull request${pull.title ? `: ${pull.title}` : ""}`;
      if (typeof pull.html_url === "string" && pull.html_url.startsWith("https://github.com/")) url = pull.html_url;
      break;
    }
    case "IssuesEvent": {
      const action = String(payload.action || "atualizou");
      const issue = payload.issue || {};
      description = `${action === "opened" ? "Abriu" : action === "closed" ? "Fechou" : "Atualizou"} issue${issue.title ? `: ${issue.title}` : ""}`;
      if (typeof issue.html_url === "string" && issue.html_url.startsWith("https://github.com/")) url = issue.html_url;
      break;
    }
    case "WatchEvent":
      description = payload.action === "started" ? "Adicionou uma estrela ao repositório" : "Atualizou o acompanhamento do repositório";
      break;
    case "ForkEvent":
      description = payload.forkee?.full_name ? `Criou o fork ${payload.forkee.full_name}` : "Criou um fork do repositório";
      if (typeof payload.forkee?.html_url === "string" && payload.forkee.html_url.startsWith("https://github.com/")) url = payload.forkee.html_url;
      break;
    default:
      description = `Atividade pública: ${event.type.replace(/Event$/, "")}`;
  }
  return {
    id: String(event.id || `${event.type}-${event.created_at || ""}-${repoName}`),
    type: event.type,
    repoName,
    repoUrl,
    url,
    createdAt: typeof event.created_at === "string" ? event.created_at : "",
    description
  };
}

export function sortGitHubRepositories(repositories) {
  const priority = new Map([["blog-secreto", 0], ["radio-geracao-ativa", 1]]);
  return [...repositories].sort((a, b) => {
    const priorityDiff = (priority.get(String(a.name).toLowerCase()) ?? 2) - (priority.get(String(b.name).toLowerCase()) ?? 2);
    if (priorityDiff) return priorityDiff;
    return Date.parse(b.updated_at || "") - Date.parse(a.updated_at || "");
  });
}

const ui = {
  refresh: $("github-refresh"),
  status: $("github-status"),
  avatar: $("github-avatar"),
  name: $("github-name"),
  bio: $("github-bio"),
  count: $("github-repo-count"),
  repositories: $("github-repositories"),
  events: $("github-events"),
  updated: $("github-updated")
};

if (typeof document !== "undefined" && Object.values(ui).some((element) => !element)) {
  console.warn("GitHub Activity: a interface da prévia não foi encontrada.");
} else if (typeof document !== "undefined") {
  let requestInProgress = false;
  let latestData = null;

  function setStatus(message, type = "normal") {
    ui.status.textContent = message;
    ui.status.dataset.state = type;
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached || typeof cached.savedAt !== "number" || !cached.profile
        || !Array.isArray(cached.repositories) || !Array.isArray(cached.events)) {
        throw new Error("Formato de cache inválido.");
      }
      return cached;
    } catch (error) {
      console.error("GitHub Activity: não foi possível ler o cache local:", error);
      setStatus("O cache local está inválido ou indisponível; tentando carregar dados públicos.", "warning");
      return null;
    }
  }

  function saveCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
      return true;
    } catch (error) {
      console.error("GitHub Activity: não foi possível salvar o cache local:", error);
      return false;
    }
  }

  async function getJson(path) {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) {
        const remaining = response.headers.get("x-ratelimit-remaining");
        const reset = Number(response.headers.get("x-ratelimit-reset"));
        const retryAt = reset ? new Date(reset * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
        throw new Error(`Limite público da API do GitHub atingido${remaining === "0" && retryAt ? `; tente novamente após ${retryAt}` : ""}.`);
      }
      throw new Error(`GitHub REST API respondeu HTTP ${response.status}.`);
    }
    return response.json();
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Data não informada" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function externalLink(href, text, className = "") {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = text;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    if (className) link.className = className;
    return link;
  }

  function renderRepositories(repositories) {
    ui.repositories.replaceChildren();
    const sorted = sortGitHubRepositories(repositories).slice(0, 8);
    if (!sorted.length) {
      ui.repositories.textContent = "Nenhum repositório público encontrado.";
      return;
    }
    sorted.forEach((repo) => {
      if (!repo || typeof repo.html_url !== "string" || !repo.html_url.startsWith("https://github.com/")) return;
      const item = document.createElement("article");
      item.className = "github-repository";
      const heading = document.createElement("div");
      heading.className = "github-repository-heading";
      const link = externalLink(repo.html_url, String(repo.name || repo.full_name || "Repositório"));
      heading.append(link);
      if (["blog-secreto", "radio-geracao-ativa"].includes(String(repo.name).toLowerCase())) {
        const featured = document.createElement("span");
        featured.className = "github-featured";
        featured.textContent = "DESTAQUE";
        heading.append(featured);
        item.classList.add("is-featured");
      }
      item.append(heading);
      const description = document.createElement("p");
      description.textContent = String(repo.description || "Sem descrição pública.");
      item.append(description);
      const meta = document.createElement("div");
      meta.className = "github-repository-meta";
      meta.append(
        document.createTextNode(repo.language ? String(repo.language) : "Linguagem não informada"),
        document.createTextNode(` ★ ${Number(repo.stargazers_count) || 0}`),
        document.createTextNode(` Forks ${Number(repo.forks_count) || 0}`)
      );
      item.append(meta);
      const updated = document.createElement("time");
      updated.textContent = `Atualizado ${formatDate(repo.updated_at)}`;
      item.append(updated);
      ui.repositories.append(item);
    });
  }

  function renderEvents(events) {
    ui.events.replaceChildren();
    const normalized = events.map(normalizeGitHubEvent).filter(Boolean);
    if (!normalized.length) {
      ui.events.textContent = "Nenhuma atividade pública recente encontrada.";
      return;
    }
    normalized.forEach((event) => {
      const item = document.createElement("article");
      item.className = "github-event";
      const title = document.createElement("div");
      title.className = "github-event-title";
      title.append(document.createTextNode(event.type.replace(/Event$/, "")));
      const date = document.createElement("time");
      date.textContent = formatDate(event.createdAt);
      title.append(date);
      item.append(title);
      item.append(externalLink(event.url || event.repoUrl || "https://github.com", event.repoName || "Repositório"));
      const description = document.createElement("p");
      description.textContent = event.description;
      item.append(description);
      ui.events.append(item);
    });
  }

  function render(data) {
    latestData = data;
    const profile = data.profile;
    ui.name.textContent = profile.name || profile.login || USERNAME;
    ui.bio.textContent = profile.bio || "Perfil público do GitHub.";
    ui.count.textContent = String(Number(profile.public_repos) || 0);
    const avatar = typeof profile.avatar_url === "string" && profile.avatar_url.startsWith("https://") ? profile.avatar_url : "";
    if (avatar) {
      ui.avatar.src = avatar;
      ui.avatar.hidden = false;
      ui.avatar.addEventListener("error", () => { ui.avatar.hidden = true; }, { once: true });
    } else {
      ui.avatar.removeAttribute("src");
      ui.avatar.hidden = true;
    }
    renderRepositories(data.repositories);
    renderEvents(data.events);
    ui.updated.textContent = `Última atualização: ${formatDate(new Date(data.savedAt || Date.now()).toISOString())}`;
    window.dispatchEvent(new CustomEvent("bs:github-updated"));
  }

  async function loadActivity({ force = false } = {}) {
    if (requestInProgress) return;
    const cache = readCache();
    if (!force && cache && Date.now() - cache.savedAt < CACHE_TTL) {
      render(cache);
      setStatus("Dados públicos carregados do cache local temporário.", "success");
      return;
    }
    requestInProgress = true;
    ui.refresh.disabled = true;
    setStatus("Consultando perfil, repositórios e eventos públicos…", "loading");
    try {
      const [profile, repositories, events] = await Promise.all([
        getJson(`/users/${USERNAME}`),
        getJson(`/users/${USERNAME}/repos?sort=updated&direction=desc&per_page=30`),
        getJson(`/users/${USERNAME}/events/public?per_page=30`)
      ]);
      if (!profile || !Array.isArray(repositories) || !Array.isArray(events)) {
        throw new Error("A API do GitHub retornou dados em formato inesperado.");
      }
      const data = { profile, repositories, events, savedAt: Date.now() };
      const cached = saveCache(data);
      render(data);
      setStatus(cached
        ? "Perfil e atividade pública atualizados pela GitHub REST API."
        : "Dados públicos atualizados; não foi possível manter o cache local.", cached ? "success" : "warning");
    } catch (error) {
      console.error("GitHub Activity: falha ao carregar dados:", error);
      if (cache) {
        render(cache);
        setStatus(`${error.message} Exibindo a última cópia temporária disponível.`, "error");
      } else {
        setStatus(`${error.message || "Falha de conexão com o GitHub."} Tente novamente.`, "error");
        ui.repositories.textContent = "Não foi possível carregar os repositórios.";
        ui.events.textContent = "Não foi possível carregar a atividade pública.";
      }
    } finally {
      requestInProgress = false;
      ui.refresh.disabled = false;
    }
  }

  window.githubActivity = Object.freeze({
    getSnapshot() {
      if (!latestData) return [];
      return [
        ...latestData.repositories.slice(0, 8).map((repo) => `${repo.full_name}: ${repo.description || "Sem descrição pública."} (${repo.language || "linguagem não informada"}, ${Number(repo.stargazers_count) || 0} estrelas)`),
        ...latestData.events.map(normalizeGitHubEvent).filter(Boolean).slice(0, 10).map((event) => `${event.type}: ${event.repoName} — ${event.description}`)
      ];
    }
  });
  ui.refresh.addEventListener("click", () => { void loadActivity({ force: true }); });
  void loadActivity();
}
