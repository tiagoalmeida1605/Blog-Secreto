export class ThemeManager {
    constructor(storageManager) {
        this.storage = storageManager;
        this.media = window.matchMedia('(prefers-color-scheme: dark)');
        this.root = null;
        this.handleSystemChange = () => this.apply(this.getTheme());
    }

    attach(root) {
        this.root = root;
        this.media.addEventListener?.('change', this.handleSystemChange);
        this.apply(this.getTheme());
    }

    getTheme() {
        return this.storage.getSettings().theme || 'system';
    }

    setTheme(theme) {
        const allowed = ['system', 'light', 'dark'];
        const nextTheme = allowed.includes(theme) ? theme : 'system';
        this.storage.saveSettings({ theme: nextTheme });
        this.apply(nextTheme);
        return nextTheme;
    }

    apply(theme = 'system') {
        if (!this.root) return;

        const resolved = theme === 'system'
            ? (this.media.matches ? 'dark' : 'light')
            : theme;

        this.root.dataset.aiTheme = resolved;
        this.root.dataset.aiThemeMode = theme;
    }
}
