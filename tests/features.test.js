import test from "node:test";
import assert from "node:assert/strict";
import { editorToMarkdown, markdownToAst, markdownToPlainText } from "../js/markdown.js";
import { filterRgaItems, parseRgaDate } from "../js/rga-watch-feed.js";
import { normalizeGitHubEvent, sortGitHubRepositories } from "../js/github-activity.js";
import {
  activeConversation,
  createConversation,
  loadChatStore,
  redactSensitiveContent,
  selectContextEntries,
  validateChatStore
} from "../js/nexus-chat-store.js";

function text(value) {
  return { nodeType: 3, nodeValue: value };
}

function element(tagName, children = [], attributes = {}) {
  const node = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    childNodes: children,
    children,
    dataset: attributes.dataset || {},
    getAttribute(name) { return attributes[name] || null; },
    get textContent() { return this.childNodes.map((child) => child.nodeType === 3 ? child.nodeValue : child.textContent).join(""); },
    querySelector(selector) {
      if (selector !== "code") return null;
      if (this.tagName === "CODE") return this;
      return this.childNodes.map((child) => child.querySelector?.(selector)).find(Boolean) || null;
    }
  };
  return node;
}

test("Markdown parser preserves legacy plain text and safely rejects unsafe links", () => {
  const oldRecord = "Uma linha antiga\nOutra linha sem formatação.";
  assert.equal(markdownToPlainText(oldRecord), "Uma linha antiga Outra linha sem formatação.");
  assert.ok(markdownToAst(oldRecord)[0].children.some((node) => node.type === "br"));
  assert.equal(editorToMarkdown(element("div", [element("p", [
    text("Uma linha antiga"),
    element("br"),
    text("Outra linha sem formatação.")
  ])])), oldRecord);
  const ast = markdownToAst("## Título\n**forte** e [link](https://example.com) [ruim](javascript:alert(1))");
  assert.equal(ast[0].type, "h2");
  assert.equal(ast[1].children.find((node) => node.type === "strong").children[0].text, "forte");
  assert.equal(ast[1].children.find((node) => node.type === "link").href, "https://example.com/");
  assert.ok(ast[1].children.some((node) => node.type === "text" && node.text.includes("javascript:")));
  assert.equal(markdownToPlainText("## Título\n- **Texto** [rótulo](https://example.com)"), "Título Texto rótulo");
});

test("Editor serialization returns Markdown and restricts link protocols", () => {
  const editor = element("div", [
    element("h2", [text("Cabeçalho")]),
    element("p", [element("strong", [text("forte")]), text(" "), element("a", [text("fora")], { href: "https://example.com/" })]),
    element("p", [element("a", [text("inseguro")], { href: "javascript:alert(1)" })])
  ]);
  assert.equal(editorToMarkdown(editor), "## Cabeçalho\n\n**forte** [fora](https://example.com/)\n\ninseguro");
});

test("RGA combines type, date and text filters over real items", () => {
  const now = new Date(2026, 10, 7, 12).getTime();
  const items = [
    { kind: "noticia", title: "Notícia Hoje", summary: "Destaque", tags: [], order: new Date(2026, 10, 7, 9).getTime() },
    { kind: "video", title: "Vídeo", summary: "Aula", tags: [], order: new Date(2026, 10, 1, 9).getTime() },
    { kind: "playlist", title: "Playlist", summary: "Música", tags: [], order: new Date(2026, 9, 1, 9).getTime() }
  ];
  assert.equal(filterRgaItems(items, { kind: "all", period: "today", now }).length, 1);
  assert.equal(filterRgaItems(items, { kind: "video", period: "7", now }).length, 1);
  assert.equal(filterRgaItems(items, { kind: "all", query: "destaque", now }).length, 1);
  assert.equal(filterRgaItems(items, { kind: "playlist", now }).length, 1);
  assert.equal(new Date(parseRgaDate("2026-11-07")).getDate(), 7);
});

test("GitHub activity descriptions use actual payload data and feature key repositories", () => {
  const push = normalizeGitHubEvent({
    id: "1",
    type: "PushEvent",
    repo: { name: "tiagoalmeida1605/Blog-Secreto" },
    created_at: "2026-11-07T10:00:00Z",
    payload: { ref: "refs/heads/main", commits: [{ message: "Atualiza editor" }, { message: "Ajusta testes" }] }
  });
  assert.equal(push.repoUrl, "https://github.com/tiagoalmeida1605/Blog-Secreto");
  assert.match(push.description, /2 commits: Atualiza editor · Ajusta testes/);
  const pull = normalizeGitHubEvent({
    type: "PullRequestEvent",
    repo: { name: "owner/repo" },
    payload: { action: "opened", pull_request: { title: "Implementa recurso", html_url: "https://github.com/owner/repo/pull/2" } }
  });
  assert.equal(pull.url, "https://github.com/owner/repo/pull/2");
  assert.deepEqual(sortGitHubRepositories([
    { name: "Other", updated_at: "2026-11-07" },
    { name: "Radio-Geracao-Ativa", updated_at: "2026-01-01" },
    { name: "Blog-Secreto", updated_at: "2026-01-01" }
  ]).map((repo) => repo.name), ["Blog-Secreto", "Radio-Geracao-Ativa", "Other"]);
});

test("chat store migrates the existing history without altering the source and validates conversations", () => {
  const legacy = JSON.stringify([
    { role: "user", content: "Pergunta antiga", timestamp: 100 },
    { role: "assistant", content: "Resposta antiga", timestamp: 200 }
  ]);
  const result = loadChatStore(null, legacy, 300);
  assert.equal(result.migrated, true);
  assert.equal(activeConversation(result.store).messages.length, 2);
  assert.equal(activeConversation(result.store).title, "Pergunta antiga");
  assert.equal(validateChatStore(JSON.parse(JSON.stringify(result.store))).activeConversationId, result.store.activeConversationId);
  assert.equal(loadChatStore("{corrompido", legacy, 300).invalid, true);
  const newer = createConversation({ id: "second", now: 400 });
  const saved = { ...result.store, conversations: [...result.store.conversations, newer] };
  assert.equal(validateChatStore(saved).conversations.length, 2);
});

test("context selection is opt-in and redacts recognizable credentials", () => {
  const entries = [
    { id: "one", category: "diary", content: "private" },
    { id: "two", category: "study", content: "public note" }
  ];
  assert.deepEqual(selectContextEntries(entries, [], ""), []);
  assert.deepEqual(selectContextEntries(entries, [], "diary"), [entries[0]]);
  assert.deepEqual(selectContextEntries(entries, ["two"], "diary"), [entries[1]]);
  const filtered = redactSensitiveContent('{"github_token":"ghp_example","password": "dont-send"}');
  assert.doesNotMatch(filtered, /ghp_example|dont-send/);
  assert.match(filtered, /DADO REDIGIDO/);
});
