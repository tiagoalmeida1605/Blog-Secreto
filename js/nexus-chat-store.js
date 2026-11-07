export const CHAT_STORE_VERSION = 2;
export const CHAT_HISTORY_LIMIT = 36;

export function createChatId(now = Date.now()) {
  return globalThis.crypto?.randomUUID?.() || `chat-${now}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createConversation({ id = createChatId(), title = "Nova conversa", now = Date.now(), model } = {}) {
  return {
    id,
    title: String(title).slice(0, 80),
    createdAt: now,
    updatedAt: now,
    ...(model ? { model } : {}),
    messages: []
  };
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return null;
  const valid = messages.filter((message) => message && ["user", "assistant"].includes(message.role)
    && typeof message.content === "string" && message.content.length <= 250_000)
    .map((message) => ({
      role: message.role,
      content: message.content,
      timestamp: Number.isFinite(message.timestamp) ? message.timestamp : 0
    }));
  if (valid.length !== messages.length) return null;
  return valid.slice(-CHAT_HISTORY_LIMIT);
}

function normalizeConversation(conversation) {
  if (!conversation || typeof conversation !== "object"
    || typeof conversation.id !== "string" || !conversation.id
    || typeof conversation.title !== "string"
    || !Number.isFinite(conversation.createdAt) || !Number.isFinite(conversation.updatedAt)) return null;
  const messages = normalizeMessages(conversation.messages);
  if (!messages) return null;
  return {
    id: conversation.id,
    title: conversation.title.slice(0, 80),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    ...(typeof conversation.model === "string" ? { model: conversation.model } : {}),
    messages
  };
}

export function validateChatStore(value) {
  if (!value || typeof value !== "object" || value.version !== CHAT_STORE_VERSION
    || !Array.isArray(value.conversations) || typeof value.activeConversationId !== "string") return null;
  const conversations = value.conversations.map(normalizeConversation);
  if (conversations.some((conversation) => !conversation)
    || !conversations.some((conversation) => conversation.id === value.activeConversationId)) return null;
  if (new Set(conversations.map((conversation) => conversation.id)).size !== conversations.length) return null;
  return { version: CHAT_STORE_VERSION, activeConversationId: value.activeConversationId, conversations };
}

function legacyConversation(raw, now) {
  const messages = normalizeMessages(raw);
  if (!messages || messages.length === 0) return null;
  const firstUserMessage = messages.find((message) => message.role === "user")?.content || "";
  const conversation = createConversation({
    id: `migrated-${now}`,
    title: firstUserMessage.trim().slice(0, 60) || "Conversa anterior",
    now
  });
  conversation.messages = messages;
  conversation.updatedAt = messages.at(-1)?.timestamp || now;
  return conversation;
}

export function loadChatStore(primaryRaw, legacyRaw, now = Date.now()) {
  if (primaryRaw !== null && primaryRaw !== undefined) {
    try {
      const store = validateChatStore(JSON.parse(primaryRaw));
      if (store) return { store, migrated: false, invalid: false };
    } catch {
      return { store: null, migrated: false, invalid: true };
    }
    return { store: null, migrated: false, invalid: true };
  }

  let oldHistory = [];
  let invalid = false;
  if (legacyRaw) {
    try {
      oldHistory = JSON.parse(legacyRaw);
      if (!Array.isArray(oldHistory)) {
        oldHistory = [];
        invalid = true;
      }
    } catch {
      invalid = true;
    }
  }
  const migrated = legacyConversation(oldHistory, now);
  const conversation = migrated || createConversation({ id: `chat-${now}`, now });
  return {
    store: { version: CHAT_STORE_VERSION, activeConversationId: conversation.id, conversations: [conversation] },
    migrated: Boolean(migrated),
    invalid
  };
}

export function activeConversation(store) {
  return store.conversations.find((conversation) => conversation.id === store.activeConversationId) || null;
}

export function selectContextEntries(entries, selectedIds = [], category = "") {
  const selected = new Set(selectedIds);
  if (selected.size) return entries.filter((entry) => selected.has(entry.id));
  if (category) return entries.filter((entry) => entry.category === category);
  return [];
}

export function redactSensitiveContent(value) {
  return String(value)
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[CHAVE PRIVADA REDIGIDA]")
    .replace(/(["']?\b[\w.-]*(?:password|senha|token|api[_-]?key|secret|segredo|credential)[\w.-]*["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1[DADO REDIGIDO]");
}
