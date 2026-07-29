/**
 * ==========================================================================
 * Auth Guard - Sistema de Autenticação com Firebase Authentication
 * ==========================================================================
 * Gerencia login, logout e proteção de rotas usando Firebase Auth
 */

import { auth } from "../../firebase/firebase.js";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const Auth = {
    currentUser: null,
    isCheckingAuth: false,

    /**
     * Tenta fazer login com e-mail e senha via Firebase Authentication
     * @param {string} email - Email do usuário
     * @param {string} password - Senha do usuário
     * @returns {Promise<object>} - { success: boolean, message: string }
     */
    async login(email, password) {
        try {
            if (!email || !password) {
                return {
                    success: false,
                    message: 'Preencha e-mail e senha.'
                };
            }

            if (!email.includes('@')) {
                return {
                    success: false,
                    message: 'E-mail inválido.'
                };
            }

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            this.currentUser = userCredential.user;

            return {
                success: true,
                message: 'Login realizado com sucesso!'
            };
        } catch (erro) {
            console.error('Erro de login:', erro.code);

            let mensagem = 'Não foi possível realizar o login.';

            switch (erro.code) {
                case 'auth/invalid-email':
                case 'auth/user-not-found':
                    mensagem = 'E-mail ou senha inválidos.';
                    break;
                case 'auth/wrong-password':
                    mensagem = 'E-mail ou senha inválidos.';
                    break;
                case 'auth/too-many-requests':
                    mensagem = 'Muitas tentativas de login. Tente novamente mais tarde.';
                    break;
                case 'auth/network-request-failed':
                    mensagem = 'Verifique sua conexão com a internet.';
                    break;
            }

            return {
                success: false,
                message: mensagem
            };
        }
    },

    /**
     * Faz logout do usuário
     */
    async logout(event) {
        if (event) {
            event.preventDefault();
        }

        try {
            await signOut(auth);
            this.currentUser = null;
            window.location.href = 'login.html';
        } catch (erro) {
            console.error('Erro ao fazer logout:', erro);
            window.location.href = 'login.html';
        }
    },

    /**
     * Retorna o usuário atualmente autenticado
     */
    getCurrentUser() {
        return this.currentUser;
    },

    /**
     * Verifica se existe uma sessão ativa
     * Usa onAuthStateChanged para monitorar alterações de autenticação
     */
    checkGuard() {
        return new Promise((resolve) => {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    this.currentUser = user;
                    resolve(true);
                } else {
                    this.currentUser = null;
                    const currentPage = window.location.pathname;
                    if (!currentPage.includes('login.html')) {
                        window.location.href = 'login.html';
                    }
                    resolve(false);
                }
            });
        });
    },

    /**
     * Verifica se usuário está autenticado (síncrono)
     * Use para verificações rápidas
     */
    isAuthenticated() {
        return auth.currentUser !== null;
    }
};

window.Auth = Auth;

export { Auth };
