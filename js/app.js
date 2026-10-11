import { auth, db, isFirebaseConfigured } from "./firebase.js";
import { OWNER_UID, isOwnerUidConfigured } from "./config.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (selector) => document.querySelector(selector);
const ui = {
  loginScreen: $("#login-screen"),
  workspace: $("#workspace"),
  libraryView: $("#library-view"),
  projectHub: $("#project-hub"),
  nexusNav: $("#nexus-nav"),
  setupNotice: $("#setup-notice"),
  authFeedback: $("#auth-feedback"),
  loginForm: $("#login-form"),
  loginEmail: $("#login-email"),
  loginPassword: $("#login-password"),
  loginSubmit: $("#login-submit"),
  logout: $("#logout-button"),
  search: $("#search-input"),
  pageTitle: $("#page-title"),
  pageSubtitle: $("#page-subtitle"),
  entryList: $("#entry-list"),
  visibleCount: $("#visible-count"),
  countAll: $("#count-all"),
  statTotal: $("#stat-total"),
  statFavorites: $("#stat-favorites"),
  statRecent: $("#stat-recent"),
  appNotice: $("#app-notice"),
  dialog: $("#entry-dialog"),
  entryForm: $("#entry-form"),
  editorTitle: $("#editor-title"),
  editorFeedback: $("#editor-feedback"),
  entryTitle: $("#entry-title"),
  entryCategory: $("#entry-category"),
  entryContent: $("#entry-content"),
  entryFavorite: $("#entry-favorite"),
  entryArchived: $("#entry-archived"),
  contentCount: $("#content-count"),
  deleteEntry: $("#delete-entry"),
  saveEntry: $("#save-entry")
};

const categories = {
  diary: "Diário",
  study: "Estudos",
  project: "Projetos",
  idea: "Ideias",
  other: "Outros"
};
const viewNames = {
  all: "Todos os registros",
  diary: "Diário",
  study: "Estudos",
  project: "Projetos",
  idea: "Ideias",
  other: "Outros",
  favorites: "Favoritos",
  archived: "Arquivados"
};
const viewSubtitles = {
  all: "Um espaço organizado para o que passa pela sua cabeça.",
  diary: "Pensamentos e registros pessoais, sem plateia.",
  study: "Anotações, revisões e coisas que você quer aprender.",
  project: "Planos, construções e projetos em andamento.",
  idea: "Ideias para explorar quando chegar a hora.",
  other: "Tudo o que não cabe nas outras categorias.",
  favorites: "Os registros que você decidiu manter por perto.",
  archived: "Registros guardados, fora da biblioteca principal."
};
const state = { entries: [], filter: "all", section: "library", query: "", editingId: null, loading: false };

function setNotice(element, message, type = "error") {
  element.textContent = message;
  element.className = `notice ${type === "warn" ? "notice-warn" : type === "success" ? "notice-success" : "notice-error"}${element === ui.appNotice ? " app-notice" : ""}`;
  element.hidden = !message;
}

function showSetupRequirements() {
  ui.setupNotice.hidden = false;
  ui.setupNotice.textContent = !isFirebaseConfigured
    ? "Configuração pendente: crie um projeto Firebase exclusivo para a v2 e preencha v2/js/firebase.js conforme o guia README_V2.md."
    : "Falta configurar o UID proprietário em v2/js/config.js e colocar o mesmo UID em v2/firestore.rules. Até isso ser feito, o login fica desativado.";
  ui.loginForm.querySelectorAll("input, button").forEach((element) => { element.disabled = true; });
}

function showLogin() {
  document.title = "Blog Secreto 2.0";
  document.body.classList.remove("nexus-mode");
  state.section = "library";
  state.entries = [];
  state.query = "";
  ui.libraryView.hidden = false;
  ui.projectHub.hidden = true;
  ui.nexusNav.classList.remove("active");
  ui.nexusNav.setAttribute("aria-pressed", "false");
  ui.search.value = "";
  ui.entryList.replaceChildren();
  ui.visibleCount.textContent = "0 registros";
  ui.statTotal.textContent = "0";
  ui.statFavorites.textContent = "0";
  ui.statRecent.textContent = "0";
  ui.workspace.hidden = true;
  ui.loginScreen.hidden = false;
}

function showWorkspace() {
  ui.loginScreen.hidden = true;
  ui.workspace.hidden = false;
}

function ownerConfigurationReady() {
  return isFirebaseConfigured && isOwnerUidConfigured;
}

function categoryName(category) {
  return categories[category] || categories.other;
}

function dateFromTimestamp(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") return null;
  const date = timestamp.toDate();
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(timestamp) {
  const date = dateFromTimestamp(timestamp);
  if (!date) return "Agora mesmo";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function normalizedText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function updateStats() {
  const active = state.entries.filter((entry) => !entry.archived);
  // Favorites are a separate collection view: archived favorites still count.
  const favorites = state.entries.filter((entry) => entry.favorite);
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = state.entries.filter((entry) => {
    const date = dateFromTimestamp(entry.updatedAt);
    return date && date.getTime() >= sevenDaysAgo;
  });
  ui.countAll.textContent = String(active.length);
  ui.statTotal.textContent = String(active.length);
  ui.statFavorites.textContent = String(favorites.length);
  ui.statRecent.textContent = String(recent.length);
}

function getVisibleEntries() {
  return state.entries.filter((entry) => {
    const archived = Boolean(entry.archived);
    if (state.filter === "archived" && !archived) return false;
    // Archived records stay out of the main/category lists, but a favorite
    // should remain discoverable in Favorites even if it was also archived.
    if (state.filter !== "archived" && state.filter !== "favorites" && archived) return false;
    if (Object.hasOwn(categories, state.filter) && entry.category !== state.filter) return false;
    if (state.filter === "favorites" && !entry.favorite) return false;
    if (state.query) {
      const searchable = normalizedText(`${entry.title}\n${entry.content}\n${categoryName(entry.category)}`);
      if (!searchable.includes(normalizedText(state.query))) return false;
    }
    return true;
  });
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function makeButton(label, className, onClick, title = label) {
  const button = makeElement("button", className, label);
  button.type = "button";
  button.title = title;
  button.setAttribute("aria-label", title);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

function createEntryCard(entry) {
  const card = makeElement("article", "entry-card");
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Editar registro: ${entry.title || "Sem título"}`);
  card.addEventListener("click", () => openEditor(entry));
  card.addEventListener("keydown", (event) => {
    if (event.target !== card) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openEditor(entry);
    }
  });

  const top = makeElement("div", "entry-card-top");
  const pill = makeElement("span", "category-pill", categoryName(entry.category));
  pill.dataset.category = entry.category || "other";
  const date = makeElement("span", "card-date", formatDate(entry.updatedAt));
  top.append(pill, date);

  const title = makeElement("h3", "", entry.title || "Sem título");
  const excerptText = String(entry.content || "").trim().replace(/\s+/g, " ");
  const excerpt = makeElement("p", "entry-excerpt", excerptText || "Este registro ainda não tem conteúdo.");

  const footer = makeElement("div", "entry-card-footer");
  const status = makeElement("span", "card-date", entry.favorite ? "Favorito" : "Registro privado");
  const actions = makeElement("div", "card-actions");
  const favorite = makeButton(entry.favorite ? "★" : "☆", `icon-button${entry.favorite ? " is-active" : ""}`, () => toggleEntryFlag(entry, "favorite"), entry.favorite ? "Remover dos favoritos" : "Marcar como favorito");
  const archive = makeButton(entry.archived ? "Restaurar" : "Arquivar", "text-action", () => toggleEntryFlag(entry, "archived"), entry.archived ? "Restaurar registro" : "Arquivar registro");
  const edit = makeButton("Editar", "text-action", () => openEditor(entry), "Editar registro");
  actions.append(favorite, archive, edit);
  footer.append(status, actions);
  card.append(top, title, excerpt, footer);
  return card;
}

function switchSection(section) {
  state.section = section === "nexus" ? "nexus" : "library";
  ui.libraryView.hidden = state.section !== "library";
  ui.projectHub.hidden = state.section !== "nexus";
  ui.nexusNav.classList.toggle("active", state.section === "nexus");
  ui.nexusNav.setAttribute("aria-pressed", String(state.section === "nexus"));
  document.body.classList.toggle("nexus-mode", state.section === "nexus");
  document.title = state.section === "nexus" ? "NEXUS · Dev Space | Blog Secreto 2.0" : "Blog Secreto 2.0";
  document.querySelectorAll("[data-filter]").forEach((button) => {
    const selected = state.section === "library" && button.dataset.filter === state.filter;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  if (state.section === "library") renderEntries();
}

function renderEntries() {
  const visible = getVisibleEntries();
  ui.entryList.replaceChildren();
  ui.entryList.setAttribute("aria-busy", "false");
  ui.visibleCount.textContent = `${visible.length} ${visible.length === 1 ? "registro" : "registros"}`;
  ui.pageTitle.textContent = viewNames[state.filter] || viewNames.all;
  ui.pageSubtitle.textContent = viewSubtitles[state.filter] || viewSubtitles.all;
  document.querySelectorAll("[data-filter]").forEach((button) => {
    const selected = state.section === "library" && button.dataset.filter === state.filter;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  if (state.loading) {
    ui.entryList.append(makeEmptyState("Carregando registros", "Buscando seus dados privados no Firebase...", false));
    return;
  }
  if (!visible.length) {
    let title = "Sua biblioteca está vazia";
    let description = "Crie seu primeiro registro. Ele ficará disponível somente para a conta proprietária.";
    if (state.query) {
      title = "Nenhum resultado encontrado";
      description = "Tente outra palavra ou limpe a busca para ver seus registros.";
    } else if (state.filter === "archived") {
      title = "Nada arquivado por enquanto";
      description = "Quando arquivar um registro, ele aparecerá aqui.";
    } else if (state.filter === "favorites") {
      title = "Nenhum favorito ainda";
      description = "Marque um registro com a estrela para encontrá-lo aqui.";
    } else if (state.filter !== "all") {
      title = `Nenhum registro em ${viewNames[state.filter]}`;
      description = "Crie um registro nesta categoria ou escolha outra seção.";
    }
    ui.entryList.append(makeEmptyState(title, description, !state.query && state.filter !== "archived"));
    return;
  }
  const fragment = document.createDocumentFragment();
  visible.forEach((entry) => fragment.append(createEntryCard(entry)));
  ui.entryList.append(fragment);
}

function makeEmptyState(title, description, includeButton) {
  const section = makeElement("div", "empty-state");
  const symbol = makeElement("div", "empty-symbol", "▤");
  symbol.setAttribute("aria-hidden", "true");
  section.append(symbol, makeElement("h3", "", title), makeElement("p", "", description));
  if (includeButton) {
    const button = makeElement("button", "button button-primary", "＋ Criar primeiro registro");
    button.type = "button";
    button.addEventListener("click", () => openEditor());
    section.append(button);
  }
  return section;
}

async function loadEntries() {
  state.loading = true;
  renderEntries();
  setNotice(ui.appNotice, "");
  try {
    const entriesQuery = query(collection(db, "entries"), orderBy("updatedAt", "desc"));
    const snapshot = await getDocs(entriesQuery);
    state.entries = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    updateStats();
  } catch (error) {
    console.error("Não foi possível carregar os registros:", error);
    state.entries = [];
    setNotice(ui.appNotice, "O Firebase recusou a leitura. Confira se o UID em config.js é idêntico ao UID permitido em firestore.rules e se essas regras foram publicadas no projeto correto.");
  } finally {
    state.loading = false;
    renderEntries();
  }
}

function openEditor(entry = null) {
  state.editingId = entry?.id || null;
  ui.entryForm.reset();
  ui.editorFeedback.hidden = true;
  ui.editorTitle.textContent = entry ? "Editar registro" : "Novo registro";
  ui.entryTitle.value = entry?.title || "";
  ui.entryCategory.value = entry?.category in categories ? entry.category : "diary";
  ui.entryContent.value = entry?.content || "";
  ui.entryFavorite.checked = Boolean(entry?.favorite);
  ui.entryArchived.checked = Boolean(entry?.archived);
  ui.deleteEntry.hidden = !entry;
  ui.saveEntry.disabled = false;
  ui.saveEntry.textContent = "Salvar registro";
  updateContentCount();
  if (!ui.dialog.open) ui.dialog.showModal();
  window.setTimeout(() => ui.entryTitle.focus(), 0);
}

function closeEditor() {
  if (ui.dialog.open) ui.dialog.close();
}

function updateContentCount() {
  const count = ui.entryContent.value.length;
  ui.contentCount.textContent = `${count.toLocaleString("pt-BR")} ${count === 1 ? "caractere" : "caracteres"}`;
}

async function saveEntry(event) {
  event.preventDefault();
  const title = ui.entryTitle.value.trim();
  const content = ui.entryContent.value.trim();
  const category = ui.entryCategory.value;
  if (!title || !content) {
    setNotice(ui.editorFeedback, "Preencha o título e o conteúdo antes de salvar.");
    return;
  }
  if (!Object.hasOwn(categories, category)) {
    setNotice(ui.editorFeedback, "Selecione uma categoria válida.");
    return;
  }

  const payload = {
    title,
    content,
    category,
    favorite: ui.entryFavorite.checked,
    archived: ui.entryArchived.checked,
    updatedAt: serverTimestamp()
  };
  ui.saveEntry.disabled = true;
  ui.saveEntry.textContent = "Salvando...";
  setNotice(ui.editorFeedback, "");
  try {
    if (state.editingId) {
      await updateDoc(doc(db, "entries", state.editingId), payload);
      setNotice(ui.appNotice, "Registro atualizado.", "success");
    } else {
      await addDoc(collection(db, "entries"), { ...payload, createdAt: serverTimestamp() });
      setNotice(ui.appNotice, "Registro salvo com privacidade por padrão.", "success");
    }
    closeEditor();
    await loadEntries();
  } catch (error) {
    console.error("Falha ao salvar registro:", error);
    setNotice(ui.editorFeedback, "Não foi possível salvar. Confirme as regras do Firestore, a conexão e se o UID proprietário está correto.");
  } finally {
    ui.saveEntry.disabled = false;
    ui.saveEntry.textContent = "Salvar registro";
  }
}

async function toggleEntryFlag(entry, key) {
  try {
    await updateDoc(doc(db, "entries", entry.id), { [key]: !Boolean(entry[key]), updatedAt: serverTimestamp() });
    await loadEntries();
  } catch (error) {
    console.error(`Falha ao atualizar ${key}:`, error);
    setNotice(ui.appNotice, "Não foi possível atualizar esse registro. Confira as regras de segurança do Firestore.");
  }
}

async function deleteCurrentEntry() {
  if (!state.editingId) return;
  const confirmed = window.confirm("Excluir este registro permanentemente? Esta ação não pode ser desfeita.");
  if (!confirmed) return;
  ui.deleteEntry.disabled = true;
  try {
    await deleteDoc(doc(db, "entries", state.editingId));
    closeEditor();
    setNotice(ui.appNotice, "Registro excluído.", "success");
    await loadEntries();
  } catch (error) {
    console.error("Falha ao excluir registro:", error);
    setNotice(ui.editorFeedback, "Não foi possível excluir. Confira as regras do Firestore.");
  } finally {
    ui.deleteEntry.disabled = false;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  if (!ownerConfigurationReady()) {
    showSetupRequirements();
    return;
  }
  const email = ui.loginEmail.value.trim();
  const password = ui.loginPassword.value;
  ui.loginSubmit.disabled = true;
  ui.loginSubmit.textContent = "Autenticando...";
  setNotice(ui.authFeedback, "");
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    if (credential.user.uid !== OWNER_UID) {
      await signOut(auth);
      throw new Error("Esta conta não é a conta proprietária configurada.");
    }
  } catch (error) {
    console.error("Falha no login:", error.code || error.message);
    const message = error.message === "Esta conta não é a conta proprietária configurada."
      ? error.message
      : ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"].includes(error.code)
        ? "E-mail ou senha inválidos."
        : error.code === "auth/too-many-requests"
          ? "Muitas tentativas. Aguarde um pouco e tente novamente."
          : "Não foi possível entrar. Verifique a configuração do Firebase e sua conexão.";
    setNotice(ui.authFeedback, message);
  } finally {
    ui.loginSubmit.disabled = false;
    ui.loginSubmit.innerHTML = 'Entrar <span aria-hidden="true">↗</span>';
  }
}

function attachEvents() {
  ui.loginForm.addEventListener("submit", handleLogin);
  ui.logout.addEventListener("click", async () => {
    try { await signOut(auth); } catch (error) { console.error("Falha ao encerrar sessão:", error); }
  });
  $("#new-entry-sidebar").addEventListener("click", () => openEditor());
  $("#new-entry-top").addEventListener("click", () => openEditor());
  $("#cancel-entry").addEventListener("click", closeEditor);
  $("#close-dialog").addEventListener("click", closeEditor);
  ui.entryForm.addEventListener("submit", saveEntry);
  ui.deleteEntry.addEventListener("click", deleteCurrentEntry);
  ui.entryContent.addEventListener("input", updateContentCount);
  ui.search.addEventListener("input", () => { state.query = ui.search.value.trim(); renderEntries(); });
  $("#main-nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    switchSection("library");
  });
  document.querySelectorAll("[data-filter]").forEach((button) => {
    if (button.closest("#main-nav")) return;
    button.addEventListener("click", () => { state.filter = button.dataset.filter; switchSection("library"); });
  });
  ui.nexusNav.addEventListener("click", () => switchSection("nexus"));
  $("#back-to-library").addEventListener("click", () => switchSection("library"));
  ui.projectHub.addEventListener("keydown", (event) => {
    const focusedTab = event.target.closest(".nexus-tabs [role=tab][data-nexus-tab]");
    if (!focusedTab) return;
    const tabs = [...document.querySelectorAll(".nexus-tabs [role=tab][data-nexus-tab]")];
    const index = tabs.indexOf(focusedTab);
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  });
  ui.projectHub.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-nexus-tab]");
    if (!tab) return;
    const target = tab.dataset.nexusTab;
    document.querySelectorAll(".nexus-tabs [role=tab][data-nexus-tab]").forEach((button) => {
      const selected = button.dataset.nexusTab === target;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll("[data-nexus-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.nexusPanel !== target;
    });
    const activePanel = document.querySelector(`[data-nexus-panel="${target}"]`);
    activePanel?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !ui.workspace.hidden && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      ui.search.focus();
    }
    if (event.key === "Escape" && ui.dialog.open) closeEditor();
  });
}

async function boot() {
  attachEvents();
  if (!ownerConfigurationReady()) {
    showSetupRequirements();
    showLogin();
    return;
  }
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showLogin();
      return;
    }
    if (user.uid !== OWNER_UID) {
      await signOut(auth);
      showLogin();
      setNotice(ui.authFeedback, "Esta conta não tem autorização para acessar este espaço.");
      return;
    }
    showWorkspace();
    await loadEntries();
  });
}

boot();
