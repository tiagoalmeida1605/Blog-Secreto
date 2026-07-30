/**
 * TypingIndicator - Animação de processamento em etapas
 * Mostra feedback visual do que a IA está fazendo antes de responder
 */
export class TypingIndicator {
    constructor(typingElement) {
        this.typingEl = typingElement;
        this.currentStep = 0;
        this.steps = [
            { text: 'Entendendo sua pergunta...', duration: 300 },
            { text: 'Pesquisando no Blog...', duration: 400 },
            { text: 'Organizando informações...', duration: 350 },
            { text: 'Preparando resposta...', duration: 250 }
        ];
        this.animationId = null;
        this.dotAnimation = 0;
        this.isRunning = false;
    }

    /**
     * Inicia a animação de digitação em etapas
     */
    async start(abortSignal = null) {
        if (this.isRunning) return;
        this.isRunning = true;

        this.typingEl.hidden = false;
        this.typingEl.setAttribute('aria-busy', 'true');

        // Animação dos pontinhos
        this.animateDots();

        try {
            for (let i = 0; i < this.steps.length; i++) {
                if (abortSignal?.aborted) {
                    throw new DOMException('Abortado', 'AbortError');
                }

                this.currentStep = i;
                await this.showStep(this.steps[i], abortSignal);
            }
        } finally {
            this.stop();
        }
    }

    /**
     * Mostra uma etapa específica
     */
    async showStep(step, abortSignal) {
        const textEl = this.typingEl.querySelector('p');
        if (!textEl) return;

        textEl.textContent = step.text;

        // Aguarda a duração da etapa
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, step.duration);

            if (abortSignal) {
                abortSignal.addEventListener('abort', () => {
                    clearTimeout(timeout);
                    reject(new DOMException('Abortado', 'AbortError'));
                }, { once: true });
            }
        });
    }

    /**
     * Anima os pontinhos de digitação
     */
    animateDots() {
        const dots = this.typingEl.querySelectorAll('span:not(:last-child)');
        let frame = 0;

        const animate = () => {
            if (!this.isRunning) return;

            dots.forEach((dot, i) => {
                const delay = i * 120;
                const phase = (frame + delay) % 600;
                const opacity = phase < 300 ? 0.4 + (phase / 300) * 0.6 : 1 - ((phase - 300) / 300) * 0.6;
                dot.style.opacity = opacity.toFixed(2);
            });

            frame += 50;
            this.animationId = requestAnimationFrame(animate);
        };

        animate();
    }

    /**
     * Para a animação e esconde o indicador
     */
    stop() {
        this.isRunning = false;
        this.typingEl.hidden = true;
        this.typingEl.removeAttribute('aria-busy');

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Reset dos pontinhos
        const dots = this.typingEl.querySelectorAll('span:not(:last-child)');
        dots.forEach(dot => dot.style.opacity = '0.45');
    }

    /**
     * Pula para uma etapa específica (útil para testes)
     */
    skipTo(stepIndex) {
        this.currentStep = Math.min(stepIndex, this.steps.length - 1);
    }

    /**
     * Define etapas personalizadas
     */
    setSteps(steps) {
        this.steps = steps;
    }
}