/**
 * firebaseService.js - Camada única de comunicação com Firestore
 *
 * Responsabilidades:
 * - Inicialização e conexão com Firebase
 * - Listeners em tempo real (onSnapshot) para sincronização automática
 * - Cache inteligente em memória
 * - API unificada para todas as collections do Blog Secreto
 * - Tratamento de erros amigáveis
 * - Reconexão automática
 */

import { db } from '../../firebase/firebase.js';
import {
    collection,
    getDocs,
    onSnapshot,
    query,
    where,
    orderBy,
    limit as firestoreLimit,
    doc,
    getDoc,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/**
 * Nomes das collections do Firestore
 */
export const COLLECTIONS = Object.freeze({
    PROJECTS: 'projetos',
    POSTS: 'posts',
    TAGS: 'tags',
    CATEGORIES: 'categorias',
    SETTINGS: 'configuracoes',
    FAQ: 'faq',
    GALLERY: 'galeria',
    CHANGELOG: 'changelog'
});

/**
 * Estados de conexão
 */
export const CONNECTION_STATE = Object.freeze({
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error'
});

/**
 * Eventos internos do serviço
 */
export const SERVICE_EVENTS = Object.freeze({
    DATA_UPDATED: 'data:updated',
    CONNECTION_CHANGED: 'connection:changed',
    ERROR: 'error',
    CACHE_WARMED: 'cache:warmed'
});

/**
 * FirebaseService - Singleton para comunicação com Firestore
 */
export class FirebaseService {
    constructor() {
        // Verifica se já existe instância (singleton)
        if (FirebaseService.instance) {
            return FirebaseService.instance;
        }
        FirebaseService.instance = this;

        this.db = db;
        this.listeners = new Map(); // collection -> unsubscribe functions
        this.cache = new Map(); // collection -> { data, timestamp, version }
        this.connectionState = CONNECTION_STATE.CONNECTING;
        this.eventCallbacks = new Map(); // event -> Set(callbacks)
        this.retryTimeout = null;
        this.maxRetries = 5;
        this.retryCount = 0;
        this.baseRetryDelay = 1000; // 1 segundo
        this.maxRetryDelay = 30000; // 30 segundos

        // Configurações de cache
        this.cacheConfig = {
            maxAge: 5 * 60 * 1000, // 5 minutos
            staleWhileRevalidate: 30 * 1000 // 30 segundos
        };

        this.init();
    }

    /**
     * Inicializa o serviço
     */
    async init() {
        try {
            // Verifica conectividade inicial
            await this.checkConnection();
            this.setupOnlineOfflineHandlers();
            this.emit(SERVICE_EVENTS.CONNECTION_CHANGED, this.connectionState);
        } catch (error) {
            this.handleError('Falha ao inicializar FirebaseService', error);
        }
    }

    /**
     * Verifica conexão com Firestore
     */
    async checkConnection() {
        try {
            // Tenta ler um documento simples para verificar conexão
            const testRef = collection(this.db, COLLECTIONS.PROJECTS);
            const testQuery = query(testRef, firestoreLimit(1));
            await getDocs(testQuery);
            this.setConnectionState(CONNECTION_STATE.CONNECTED);
            this.retryCount = 0;
            return true;
        } catch (error) {
            this.setConnectionState(CONNECTION_STATE.ERROR);
            throw error;
        }
    }

    /**
     * Configura handlers de online/offline
     */
    setupOnlineOfflineHandlers() {
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }

    /**
     * Handler quando volta online
     */
    async handleOnline() {
        console.log('[FirebaseService] Conexão restaurada, reconectando...');
        this.retryCount = 0;
        await this.reconnectAllListeners();
    }

    /**
     * Handler quando fica offline
     */
    handleOffline() {
        console.warn('[FirebaseService] Offline detectado');
        this.setConnectionState(CONNECTION_STATE.DISCONNECTED);
    }

    /**
     * Reconecta todos os listeners ativos
     */
    async reconnectAllListeners() {
        const collections = [...this.listeners.keys()];
        for (const collectionName of collections) {
            const listenerConfig = this.listeners.get(collectionName);
            if (listenerConfig && listenerConfig.active) {
                await this.subscribe(collectionName, listenerConfig.callback, listenerConfig.options);
            }
        }
    }

    /**
     * Define estado de conexão e notifica listeners
     */
    setConnectionState(state) {
        if (this.connectionState !== state) {
            this.connectionState = state;
            this.emit(SERVICE_EVENTS.CONNECTION_CHANGED, state);
        }
    }

    /**
     * Retorna estado atual da conexão
     */
    getConnectionState() {
        return this.connectionState;
    }

    /**
     * Verifica se está online
     */
    isOnline() {
        return navigator.onLine && this.connectionState === CONNECTION_STATE.CONNECTED;
    }

    // ==================== SISTEMA DE EVENTOS ====================

    /**
     * Registra callback para evento
     */
    on(event, callback) {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, new Set());
        }
        this.eventCallbacks.get(event).add(callback);

        // Retorna função de cleanup
        return () => this.off(event, callback);
    }

    /**
     * Remove callback de evento
     */
    off(event, callback) {
        const callbacks = this.eventCallbacks.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    /**
     * Emite evento para todos os callbacks
     */
    emit(event, data) {
        const callbacks = this.eventCallbacks.get(event);
        if (callbacks) {
            callbacks.forEach(cb => {
                try {
                    cb(data);
                } catch (error) {
                    console.error(`[FirebaseService] Erro no callback de ${event}:`, error);
                }
            });
        }
    }

    // ==================== CACHE INTELIGENTE ====================

    /**
     * Verifica se cache é válido
     */
    isCacheValid(collectionName) {
        const cached = this.cache.get(collectionName);
        if (!cached) return false;

        const age = Date.now() - cached.timestamp;
        return age < this.cacheConfig.maxAge;
    }

    /**
     * Verifica se cache está "stale" mas ainda utilizável (stale-while-revalidate)
     */
    isCacheStaleButUsable(collectionName) {
        const cached = this.cache.get(collectionName);
        if (!cached) return false;

        const age = Date.now() - cached.timestamp;
        return age < this.cacheConfig.maxAge + this.cacheConfig.staleWhileRevalidate;
    }

    /**
     * Obtém dados do cache
     */
    getCachedData(collectionName) {
        const cached = this.cache.get(collectionName);
        return cached ? cached.data : null;
    }

    /**
     * Atualiza cache
     */
    setCache(collectionName, data) {
        this.cache.set(collectionName, {
            data: this.deepClone(data),
            timestamp: Date.now(),
            version: (this.cache.get(collectionName)?.version || 0) + 1
        });
    }

    /**
     * Invalida cache de uma collection
     */
    invalidateCache(collectionName) {
        this.cache.delete(collectionName);
    }

    /**
     * Invalida todos os caches
     */
    invalidateAllCaches() {
        this.cache.clear();
    }

    /**
     * Deep clone para evitar mutações acidentais
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // ==================== SUBSCRIPTIONS EM TEMPO REAL ====================

    /**
     * Inscreve em uma collection com onSnapshot
     * @param {string} collectionName - Nome da collection
     * @param {Function} callback - Callback chamado com dados atualizados
     * @param {Object} options - Opções de query (where, orderBy, limit)
     * @returns {Function} Função de unsubscribe
     */
    subscribe(collectionName, callback, options = {}) {
        const { where: whereClauses = [], orderBy: orderByField = null, limit: limitCount = null } = options;

        // Para conexão se anterior existir
        this.unsubscribe(collectionName);

        if (!this.isOnline()) {
            // Se offline, retorna dados do cache se disponível
            const cached = this.getCachedData(collectionName);
            if (cached) {
                callback(cached, true); // true = from cache
            }
            return () => {}; // no-op unsubscribe
        }

        try {
            let q = collection(this.db, collectionName);

            // Aplica filtros where
            for (const clause of whereClauses) {
                q = query(q, where(...clause));
            }

            // Aplica ordenação
            if (orderByField) {
                q = query(q, orderBy(orderByField.field, orderByField.direction || 'asc'));
            }

            // Aplica limite
            if (limitCount) {
                q = query(q, firestoreLimit(limitCount));
            }

            // Cria listener em tempo real
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Atualiza cache
                this.setCache(collectionName, data);

                // Notifica callback
                callback(data, false); // false = from server

                // Emite evento global
                this.emit(SERVICE_EVENTS.DATA_UPDATED, {
                    collection: collectionName,
                    data,
                    timestamp: Date.now()
                });
            }, (error) => {
                this.handleError(`Erro no listener de ${collectionName}`, error);
                // Tenta reconectar
                this.scheduleReconnect(collectionName, callback, options);
            });

            // Armazena configuração do listener
            this.listeners.set(collectionName, {
                unsubscribe,
                callback,
                options,
                active: true
            });

            this.setConnectionState(CONNECTION_STATE.CONNECTED);

            return unsubscribe;
        } catch (error) {
            this.handleError(`Erro ao criar subscription para ${collectionName}`, error);
            return () => {};
        }
    }

    /**
     * Cancela subscription de uma collection
     */
    unsubscribe(collectionName) {
        const listener = this.listeners.get(collectionName);
        if (listener) {
            listener.unsubscribe();
            listener.active = false;
            this.listeners.delete(collectionName);
        }
    }

    /**
     * Cancela todas as subscriptions
     */
    unsubscribeAll() {
        for (const [collectionName, listener] of this.listeners) {
            listener.unsubscribe();
            listener.active = false;
        }
        this.listeners.clear();
    }

    /**
     * Agenda reconexão com backoff exponencial
     */
    scheduleReconnect(collectionName, callback, options) {
        if (this.retryCount >= this.maxRetries) {
            this.emit(SERVICE_EVENTS.ERROR, {
                collection: collectionName,
                error: new Error('Máximo de tentativas de reconexão atingido'),
                fatal: true
            });
            return;
        }

        const delay = Math.min(
            this.baseRetryDelay * Math.pow(2, this.retryCount) + Math.random() * 1000,
            this.maxRetryDelay
        );

        this.retryCount++;
        console.log(`[FirebaseService] Reconectando ${collectionName} em ${Math.round(delay)}ms (tentativa ${this.retryCount})`);

        this.retryTimeout = setTimeout(() => {
            this.subscribe(collectionName, callback, options);
        }, delay);
    }

    // ==================== LEITURAS SIMPLES (one-time) ====================

    /**
     * Busca todos os documentos de uma collection (com cache)
     */
    async getAll(collectionName, options = {}) {
        const { useCache = true, forceRefresh = false } = options;

        // Tenta cache primeiro
        if (useCache && !forceRefresh && this.isCacheValid(collectionName)) {
            return this.getCachedData(collectionName);
        }

        // Se stale-while-revalidate, retorna cache e busca em background
        if (useCache && !forceRefresh && this.isCacheStaleButUsable(collectionName)) {
            const cached = this.getCachedData(collectionName);
            this.fetchAndCache(collectionName, options).catch(() => {});
            return cached;
        }

        // Busca direta
        return this.fetchAndCache(collectionName, options);
    }

    /**
     * Busca e atualiza cache
     */
    async fetchAndCache(collectionName, options = {}) {
        if (!this.isOnline()) {
            const cached = this.getCachedData(collectionName);
            if (cached) return cached;
            throw new Error('OFFLINE_NO_CACHE');
        }

        try {
            let q = collection(this.db, collectionName);
            const { where: whereClauses = [], orderBy: orderByField = null, limit: limitCount = null } = options;

            for (const clause of whereClauses) {
                q = query(q, where(...clause));
            }
            if (orderByField) {
                q = query(q, orderBy(orderByField.field, orderByField.direction || 'asc'));
            }
            if (limitCount) {
                q = query(q, firestoreLimit(limitCount));
            }

            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            this.setCache(collectionName, data);
            return data;
        } catch (error) {
            // Se erro de permissão ou rede, tenta cache
            const cached = this.getCachedData(collectionName);
            if (cached) {
                console.warn(`[FirebaseService] Usando cache para ${collectionName} devido a erro:`, error.message);
                return cached;
            }
            throw error;
        }
    }

    /**
     * Busca documento por ID
     */
    async getById(collectionName, id, options = {}) {
        const { useCache = true } = options;

        // Tenta cache primeiro
        if (useCache) {
            const cached = this.getCachedData(collectionName);
            if (cached) {
                const found = cached.find(item => item.id === id);
                if (found) return found;
            }
        }

        if (!this.isOnline()) {
            throw new Error('OFFLINE_NO_CACHE');
        }

        try {
            const docRef = doc(this.db, collectionName, id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                return null;
            }

            const data = { id: docSnap.id, ...docSnap.data() };

            // Atualiza item no cache
            if (useCache) {
                const cached = this.getCachedData(collectionName) || [];
                const index = cached.findIndex(item => item.id === id);
                if (index >= 0) {
                    cached[index] = data;
                } else {
                    cached.push(data);
                }
                this.setCache(collectionName, cached);
            }

            return data;
        } catch (error) {
            // Tenta cache em caso de erro
            const cached = this.getCachedData(collectionName);
            if (cached) {
                const found = cached.find(item => item.id === id);
                if (found) return found;
            }
            throw error;
        }
    }

    /**
     * Busca documentos por campo
     */
    async getWhere(collectionName, field, operator, value, options = {}) {
        return this.getAll(collectionName, {
            ...options,
            where: [[field, operator, value]]
        });
    }

    // ==================== MÉTODOS ESPECÍFICOS DO BLOG ====================

    /**
     * Projetos publicados (status ativo)
     */
    async getProjects(options = {}) {
        return this.getAll(COLLECTIONS.PROJECTS, {
            ...options,
            where: [
                ['status', 'in', ['Ativo', 'ativo', 'Publicado', 'publicado']],
                ...(options.where || [])
            ],
            orderBy: { field: 'dataCriacao', direction: 'desc' }
        });
    }

    /**
     * Todos os projetos (admin)
     */
    async getAllProjects(options = {}) {
        return this.getAll(COLLECTIONS.PROJECTS, {
            ...options,
            orderBy: { field: 'dataCriacao', direction: 'desc' }
        });
    }

    /**
     * Posts publicados
     */
    async getPosts(options = {}) {
        return this.getAll(COLLECTIONS.POSTS, {
            ...options,
            where: [
                ['status', 'in', ['Publicado', 'publicado', 'Ativo', 'ativo']],
                ...(options.where || [])
            ],
            orderBy: { field: 'dataPublicacao', direction: 'desc' }
        });
    }

    /**
     * Tags ativas
     */
    async getTags(options = {}) {
        return this.getAll(COLLECTIONS.TAGS, {
            ...options,
            orderBy: { field: 'nome', direction: 'asc' }
        });
    }

    /**
     * Categorias
     */
    async getCategories(options = {}) {
        return this.getAll(COLLECTIONS.CATEGORIES, {
            ...options,
            orderBy: { field: 'nome', direction: 'asc' }
        });
    }

    /**
     * Configurações públicas
     */
    async getPublicSettings() {
        return this.getAll(COLLECTIONS.SETTINGS, {
            where: [['publico', '==', true]]
        });
    }

    /**
     * FAQ ativo
     */
    async getFAQ(options = {}) {
        return this.getAll(COLLECTIONS.FAQ, {
            ...options,
            where: [['ativo', '==', true]],
            orderBy: { field: 'ordem', direction: 'asc' }
        });
    }

    /**
     * Galeria de imagens
     */
    async getGallery(options = {}) {
        return this.getAll(COLLECTIONS.GALLERY, {
            ...options,
            orderBy: { field: 'data', direction: 'desc' }
        });
    }

    /**
     * Changelog
     */
    async getChangelog(options = {}) {
        return this.getAll(COLLECTIONS.CHANGELOG, {
            ...options,
            orderBy: { field: 'data', direction: 'desc' }
        });
    }

    // ==================== SUBSCRIPTIONS ESPECÍFICAS ====================

    /**
     * Inscreve em projetos publicados (tempo real)
     */
    subscribeToProjects(callback, options = {}) {
        return this.subscribe(COLLECTIONS.PROJECTS, callback, {
            where: [['status', 'in', ['Ativo', 'ativo', 'Publicado', 'publicado']]],
            orderBy: { field: 'dataCriacao', direction: 'desc' },
            ...options
        });
    }

    /**
     * Inscreve em todos os projetos (admin)
     */
    subscribeToAllProjects(callback, options = {}) {
        return this.subscribe(COLLECTIONS.PROJECTS, callback, {
            orderBy: { field: 'dataCriacao', direction: 'desc' },
            ...options
        });
    }

    /**
     * Inscreve em posts
     */
    subscribeToPosts(callback, options = {}) {
        return this.subscribe(COLLECTIONS.POSTS, callback, {
            where: [['status', 'in', ['Publicado', 'publicado', 'Ativo', 'ativo']]],
            orderBy: { field: 'dataPublicacao', direction: 'desc' },
            ...options
        });
    }

    /**
     * Inscreve em tags
     */
    subscribeToTags(callback, options = {}) {
        return this.subscribe(COLLECTIONS.TAGS, callback, {
            orderBy: { field: 'nome', direction: 'asc' },
            ...options
        });
    }

    // ==================== UTILITÁRIOS ====================

    /**
     * Busca textual simples no cache/local
     */
    searchInCache(collectionName, searchTerm, fields = ['titulo', 'nome', 'descricao', 'tags', 'categoria']) {
        const data = this.getCachedData(collectionName);
        if (!data || !searchTerm) return data;

        const term = searchTerm.toLowerCase().trim();
        if (!term) return data;

        return data.filter(item => {
            return fields.some(field => {
                const value = item[field];
                if (!value) return false;
                if (Array.isArray(value)) {
                    return value.some(v => String(v).toLowerCase().includes(term));
                }
                return String(value).toLowerCase().includes(term);
            });
        });
    }

    /**
     * Obtém estatísticas do cache
     */
    getCacheStats() {
        const stats = {};
        for (const [collection, cached] of this.cache) {
            stats[collection] = {
                count: cached.data?.length || 0,
                age: Date.now() - cached.timestamp,
                version: cached.version
            };
        }
        return stats;
    }

    /**
     * Limpa cache de collections específicas
     */
    clearCache(...collections) {
        if (collections.length === 0) {
            this.invalidateAllCaches();
        } else {
            collections.forEach(c => this.invalidateCache(c));
        }
    }

    /**
     * Tratamento centralizado de erros
     */
    handleError(context, error) {
        console.error(`[FirebaseService] ${context}:`, error);

        // Erros de permissão ou não encontrado não são fatais
        const isFatal = error.code === 'permission-denied' ||
                       error.code === 'unauthenticated' ||
                       error.message === 'OFFLINE_NO_CACHE';

        this.emit(SERVICE_EVENTS.ERROR, {
            context,
            error,
            fatal: isFatal,
            timestamp: Date.now()
        });

        if (!navigator.onLine) {
            this.setConnectionState(CONNECTION_STATE.DISCONNECTED);
        }
    }

    /**
     * Retorna mensagem de erro amigável
     */
    getFriendlyErrorMessage(error) {
        if (!navigator.onLine) {
            return 'Você está offline. Verifique sua conexão e tente novamente.';
        }

        switch (error.code) {
            case 'permission-denied':
                return 'Não tenho permissão para acessar esses dados no momento.';
            case 'unauthenticated':
                return 'Sessão expirada. Recarregue a página para reconectar.';
            case 'unavailable':
                return 'O serviço está temporariamente indisponível. Tente novamente em alguns instantes.';
            case 'deadline-exceeded':
                return 'A consulta demorou muito para responder. Tente novamente.';
            default:
                if (error.message === 'OFFLINE_NO_CACHE') {
                    return 'Não consegui acessar os dados do Blog e não há cache disponível.';
                }
                return 'Não consegui acessar os dados do Blog agora. Verifique sua conexão e tente novamente.';
        }
    }

    /**
     * Destrói o serviço (cleanup)
     */
    destroy() {
        this.unsubscribeAll();
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
        }
        this.eventCallbacks.clear();
        this.cache.clear();
        FirebaseService.instance = null;
    }
}

// Exporta instância singleton
export const firebaseService = new FirebaseService();

// Torna disponível globalmente para debug
if (typeof window !== 'undefined') {
    window.__FirebaseService = firebaseService;
}