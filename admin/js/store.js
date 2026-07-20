/**
 * ==========================================================================
 * Store - Camada de Dados Local (LocalStorage / Simulação de Banco)
 * ==========================================================================
 */

const Store = {
    KEYS: {
        PROJETOS: 'secreto_admin_projetos',
        CONFIG: 'secreto_admin_config'
    },

    init: function() {
        if (!localStorage.getItem(this.KEYS.PROJETOS)) {
            const initialData = [
                {
                    id: 1,
                    nome: "Sistema Nexus",
                    descricao: "Painel de controle focado em privacidade e monitoramento de anomalias em redes locais.",
                    tecnologias: ["JavaScript", "Node.js", "WebSockets"],
                    status: "Ativo",
                    versao: "v1.2.0",
                    imagem: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80",
                    link: "#"
                },
                {
                    id: 2,
                    nome: "Cryptos API",
                    descricao: "API para criptografia end-to-end e troca segura de chaves públicas.",
                    tecnologias: ["Python", "FastAPI", "Docker"],
                    status: "Em Teste",
                    versao: "v0.8.5-beta",
                    imagem: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80",
                    link: "#"
                },
                {
                    id: 3,
                    nome: "Dossiê Scraper",
                    descricao: "Automação de extração de dados públicos (OSINT) e relatórios.",
                    tecnologias: ["Python", "Selenium"],
                    status: "Arquivado",
                    versao: "v2.0.1",
                    imagem: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80",
                    link: "#"
                }
            ];
            localStorage.setItem(this.KEYS.PROJETOS, JSON.stringify(initialData));
        }
    },

    getProjetos: function() {
        return JSON.parse(localStorage.getItem(this.KEYS.PROJETOS)) || [];
    },

    getProjetoById: function(id) {
        const projetos = this.getProjetos();
        return projetos.find(p => p.id === Number(id));
    },

    addProjeto: function(projeto) {
        const projetos = this.getProjetos();
        projeto.id = Date.now();
        projetos.unshift(projeto); // Adiciona no início da lista
        localStorage.setItem(this.KEYS.PROJETOS, JSON.stringify(projetos));
        return projeto;
    },

    updateProjeto: function(id, dadosAtualizados) {
        const projetos = this.getProjetos();
        const index = projetos.findIndex(p => p.id === Number(id));
        if (index !== -1) {
            projetos[index] = { ...projetos[index], ...dadosAtualizados, id: Number(id) };
            localStorage.setItem(this.KEYS.PROJETOS, JSON.stringify(projetos));
        }
    },

    deleteProjeto: function(id) {
        let projetos = this.getProjetos();
        projetos = projetos.filter(p => p.id !== Number(id));
        localStorage.setItem(this.KEYS.PROJETOS, JSON.stringify(projetos));
    },

    getStats: function() {
        const projetos = this.getProjetos();
        return {
            totalProjetos: projetos.length,
            ativos: projetos.filter(p => p.status.toLowerCase() === 'ativo').length,
            emTeste: projetos.filter(p => p.status.toLowerCase() === 'em teste').length
        };
    }
};

Store.init();