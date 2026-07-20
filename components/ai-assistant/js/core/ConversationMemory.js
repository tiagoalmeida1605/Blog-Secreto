import { SecurityManager } from './SecurityManager.js';

export class ConversationMemory {
    constructor(storageManager) {
        this.storage = storageManager;
        this.messages = this.storage.getConversation();
        this.lastResults = this.storage.getLastResults();
        this.lastIntent = this.storage.getLastIntent();
    }

    getMessages() {
        return [...this.messages];
    }

    getRecentMessages(limit = 8) {
        return this.messages.slice(-limit);
    }

    addMessage(role, payload) {
        const message = {
            id: payload.id || SecurityManager.createId(role),
            role,
            text: SecurityManager.sanitize(payload.text || ''),
            timestamp: payload.timestamp || new Date().toISOString(),
            results: Array.isArray(payload.results) ? payload.results : [],
            actions: Array.isArray(payload.actions) ? payload.actions : [],
            meta: payload.meta || {}
        };

        this.messages = this.storage.saveMessage(message);
        return message;
    }

    rememberInteraction(intent, results = []) {
        this.lastIntent = intent || null;
        this.lastResults = Array.isArray(results) ? results.slice(0, 12) : [];
        this.storage.saveMemoryState({
            lastIntent: this.lastIntent,
            lastResults: this.lastResults
        });
    }

    getContext() {
        return {
            recentMessages: this.getRecentMessages(),
            lastIntent: this.lastIntent,
            lastResults: this.lastResults,
            contextual: this.hasContextualReference()
        };
    }

    hasContextualReference(text = '') {
        const normalized = SecurityManager.normalizeForSearch(text);
        if (!normalized) return false;

        return [
            'deles',
            'delas',
            'desse',
            'dessa',
            'destes',
            'dessas',
            'qual deles',
            'qual delas',
            'o primeiro',
            'o segundo',
            'o ultimo',
            'essa lista',
            'esses projetos'
        ].some((term) => normalized.includes(term));
    }

    resolveContextualItems(text) {
        if (!this.hasContextualReference(text)) return [];
        return this.lastResults || [];
    }

    summarizeLastResults(limit = 4) {
        if (!this.lastResults.length) return '';

        return this.lastResults
            .slice(0, limit)
            .map((item) => item.title || item.nome || item.name)
            .filter(Boolean)
            .join(', ');
    }

    clear() {
        this.storage.clearConversation();
        this.storage.saveMemoryState({ lastIntent: null, lastResults: [] });
        this.messages = [];
        this.lastIntent = null;
        this.lastResults = [];
    }

    newConversation() {
        this.storage.startNewConversation();
        this.messages = [];
        this.lastIntent = null;
        this.lastResults = [];
    }
}
