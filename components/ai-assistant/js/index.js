/**
 * AI Assistant - Barrel Export
 * Ponto de entrada único para todos os módulos do assistente
 */

// Core
export { SecurityManager } from './core/SecurityManager.js';
export { ConversationMemory } from './core/ConversationMemory.js';
export { IntentRecognizer } from './core/IntentRecognizer.js';
export { ChatManager } from './core/ChatManager.js';

// Core - Novos módulos Firebase
export { KnowledgeBase, knowledgeBase } from './core/knowledge.js';
export { SearchEngine, searchEngine, SEARCH_TYPES } from './core/search.js';
export { MemoryManager, memoryManager, ENTITY_TYPES, CONTEXTUAL_INTENTS } from './core/memory.js';
export { ResponseGenerator, responseGenerator } from './core/responses.js';
export { ActionManager, actionManager, ACTION_TYPES, ACTION_VARIANTS } from './core/actions.js';
export { Assistant, assistant, ASSISTANT_STATE, ASSISTANT_EVENTS } from './assistant.js';

// Services
export { StorageManager } from '../services/StorageManager.js';
export { FirebaseService, firebaseService, COLLECTIONS, SERVICE_EVENTS, CONNECTION_STATE } from '../services/firebaseService.js';

// UI
export { MessageRenderer } from '../ui/MessageRenderer.js';
export { TypingIndicator } from '../ui/TypingIndicator.js';

// Providers (legacy - para compatibilidade)
export { LocalProvider } from '../providers/LocalProvider.js';
export { AIProviderManager } from '../providers/AIProviderManager.js';