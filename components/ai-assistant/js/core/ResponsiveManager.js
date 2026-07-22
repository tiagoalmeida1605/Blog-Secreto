export class ResponsiveManager {
    constructor() {
        this.root = null;
        this.breakpoints = [
            { name: 'xs-320', width: 320 },
            { name: 'xs-360', width: 360 },
            { name: 'xs-375', width: 375 },
            { name: 'sm-425', width: 425 },
            { name: 'md-768', width: 768 },
            { name: 'lg-1024', width: 1024 },
            { name: 'xl-1440', width: 1440 }
        ];
        this.handleResize = () => this.update();
    }

    attach(root) {
        this.root = root;
        window.addEventListener('resize', this.handleResize);
        window.visualViewport?.addEventListener('resize', this.handleResize);
        window.visualViewport?.addEventListener('scroll', this.handleResize);
        this.update();
    }

    update() {
        if (!this.root) return;

        const width = window.innerWidth;
        const vv = window.visualViewport;
        const height = vv ? vv.height : window.innerHeight;
        const offsetTop = vv ? vv.offsetTop : 0;
        const current = this.breakpoints.reduce((active, breakpoint) => {
            return width >= breakpoint.width ? breakpoint.name : active;
        }, 'xs-320');

        this.root.dataset.aiBreakpoint = current;
        this.root.style.setProperty('--ai-viewport-height', `${Math.round(height)}px`);
        this.root.style.setProperty('--ai-viewport-offset-top', `${Math.round(offsetTop)}px`);
        this.root.dataset.aiCompact = width <= 360 ? 'true' : 'false';
    }
}
