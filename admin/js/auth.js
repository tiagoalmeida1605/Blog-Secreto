/**
 * ==========================================================================
 * Auth Guard - Sistema de Proteção de Rotas (Simulado para Vercel)
 * ==========================================================================
 */

const Auth = {
    SESSION_KEY: 'secreto_session_active',

    // Executa a tentativa de login
    login: function(username, password) {
        // Credenciais temporárias (futuramente virará uma requisição POST para sua API Node)
        if (username === 'admin' && password === 'admin123') {
            sessionStorage.setItem(this.SESSION_KEY, 'true');
            return true;
        }
        return false;
    },

    // Remove o acesso
    logout: function() {
        sessionStorage.removeItem(this.SESSION_KEY);
        window.location.href = 'login.html';
    },

    // Verifica se o usuário está logado
    checkGuard: function() {
        if (sessionStorage.getItem(this.SESSION_KEY) !== 'true') {
            // Se não estiver logado, sabota o carregamento e joga pro login
            window.location.href = 'login.html';
        }
    }
};