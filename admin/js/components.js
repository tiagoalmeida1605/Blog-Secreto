/**
 * ==========================================================================
 * Components - Lógica Global de UI (Tema, Sidebar Mobile, Toasts e Modais)
 * ==========================================================================
 */
const UI = {
    initialized: false,

    init: function() {
        if (this.initialized) return;
        this.initialized = true;
        this.setupTheme();
        this.setupSidebarMobile();
    },

    setupTheme: function() {
        const themeBtn = document.getElementById('theme-toggle-btn');
        const root = document.documentElement;

        // Recupera o tema do LocalStorage (Padrão: dark)
        const savedTheme = localStorage.getItem('secreto_theme') || 'dark';
        root.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);

        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const currentTheme = root.getAttribute('data-theme') || 'dark';
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

                root.setAttribute('data-theme', newTheme);
                localStorage.setItem('secreto_theme', newTheme);
                this.updateThemeIcon(newTheme);
            });
        }
    },

    updateThemeIcon: function(theme) {
        const icon = document.querySelector('#theme-toggle-btn i');
        if (icon) {
            icon.className = theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
        }
    },

    setupSidebarMobile: function() {
        const mobileBtn = document.getElementById('mobile-menu-btn');
        const sidebar = document.querySelector('.sidebar');
        if (!mobileBtn || !sidebar) return;

        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }

        const toggleSidebar = () => {
            const isOpen = sidebar.classList.toggle('open');
            overlay.classList.toggle('active', isOpen);
            document.body.style.overflow = isOpen ? 'hidden' : '';
        };

        mobileBtn.addEventListener('click', toggleSidebar);
        overlay.addEventListener('click', toggleSidebar);

        const navLinks = document.querySelectorAll('.sidebar-nav a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
                    toggleSidebar();
                }
            });
        });
    },

    showAlert: function(message, type = 'success') {
        const alertBox = document.createElement('div');
        alertBox.className = `alert-toast alert-${type}`;

        Object.assign(alertBox.style, {
            position: 'fixed', bottom: '24px', right: '24px', padding: '14px 20px',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderLeft: `4px solid ${type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
            color: 'var(--text-main)', borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-lg)', zIndex: '99999', opacity: '0',
            transform: 'translateY(10px)', transition: 'all 0.3s ease',
            fontWeight: '500', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px'
        });

        alertBox.innerHTML = `<i class="ph ${type === 'success' ? 'ph-check-circle' : 'ph-warning-circle'}" style="font-size:1.2rem; color:${type === 'success' ? 'var(--success)' : 'var(--danger)'}"></i> ${message}`;
        document.body.appendChild(alertBox);

        setTimeout(() => {
            alertBox.style.opacity = '1';
            alertBox.style.transform = 'translateY(0)';
        }, 10);

        setTimeout(() => {
            alertBox.style.opacity = '0';
            alertBox.style.transform = 'translateY(10px)';
            setTimeout(() => alertBox.remove(), 300);
        }, 3500);
    },

    openModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    closeModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
};

window.UI = UI;
document.addEventListener('DOMContentLoaded', () => UI.init(), { once: true });