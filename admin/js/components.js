/**
 * ==========================================================================
 * Components - Lógica Global de Interface (UI) Moderna
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

        // Verifica preferência salva
        const savedTheme = localStorage.getItem('secreto_theme') || 'dark';
        root.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);

        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const currentTheme = root.getAttribute('data-theme');
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

        // Criar overlay
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);

        const toggleSidebar = () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
            document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
        };

        mobileBtn.addEventListener('click', toggleSidebar);
        overlay.addEventListener('click', toggleSidebar);

        // Fecha ao clicar em um link no mobile
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
        const icon = type === 'success' ? 'ph-check-circle' : 'ph-warning-circle';

        alertBox.innerHTML = `<i class="ph ${icon}" style="font-size: 1.25rem;"></i> <span>${message}</span>`;

        Object.assign(alertBox.style, {
            position: 'fixed', bottom: '24px', right: '24px', padding: '16px 24px',
            background: 'var(--bg-surface)', border: `1px solid var(--${type})`,
            borderLeft: `4px solid var(--${type})`, color: 'var(--text-main)',
            borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-lg)',
            zIndex: '9999', opacity: '0', transform: 'translateX(20px)',
            transition: 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
            fontWeight: '500', display: 'flex', alignItems: 'center', gap: '12px'
        });

        document.body.appendChild(alertBox);

        requestAnimationFrame(() => {
            alertBox.style.opacity = '1';
            alertBox.style.transform = 'translateX(0)';
        });

        setTimeout(() => {
            alertBox.style.opacity = '0';
            alertBox.style.transform = 'translateX(20px)';
            setTimeout(() => alertBox.remove(), 300);
        }, 4000);
    },

    openModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if(modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden'; // Previne scroll no body
        }
    },

    closeModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if(modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
};

window.UI = UI;
document.addEventListener('DOMContentLoaded', () => UI.init(), { once: true });