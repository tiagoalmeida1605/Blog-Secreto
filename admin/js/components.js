/**
 * ==========================================================================
 * Components - Lógica Global de Interface (UI)
 * ==========================================================================
 */

const UI = {
    // Inicializa eventos globais
    init: function() {
        this.setupSidebarResponsive();
    },

    // Gerencia o comportamento responsivo da Sidebar no mobile
    setupSidebarResponsive: function() {
        // Se a tela for pequena, podemos querer um botão sanduíche no futuro.
        // Por enquanto, apenas garante que os links funcionem corretamente.
        const navLinks = document.querySelectorAll('.sidebar-nav a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    // Lógica para fechar sidebar no mobile pode entrar aqui
                }
            });
        });
    },

    // Sistema de Alerta Flutuante (Toast)
    showAlert: function(message, type = 'success') {
        const alertBox = document.createElement('div');
        alertBox.className = `alert-toast alert-${type}`;

        // Estilos dinâmicos em JS para evitar poluir o CSS principal temporariamente
        Object.assign(alertBox.style, {
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '16px 24px',
            background: type === 'success' ? '#2ecc71' : 'var(--primary)',
            color: '#fff',
            borderRadius: 'var(--radius)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            zIndex: '9999',
            opacity: '0',
            transform: 'translateY(20px)',
            transition: 'var(--transition)',
            fontWeight: '600'
        });

        alertBox.textContent = message;
        document.body.appendChild(alertBox);

        // Animação de entrada
        setTimeout(() => {
            alertBox.style.opacity = '1';
            alertBox.style.transform = 'translateY(0)';
        }, 10);

        // Remove após 3 segundos
        setTimeout(() => {
            alertBox.style.opacity = '0';
            alertBox.style.transform = 'translateY(20px)';
            setTimeout(() => alertBox.remove(), 300);
        }, 3000);
    },

    // Controle Genérico de Modais
    openModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if(modal) modal.classList.add('active');
    },

    closeModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if(modal) modal.classList.remove('active');
    }
};

// Dispara a inicialização da UI quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
});