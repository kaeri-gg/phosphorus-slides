/**
 * Class responsible for managing the Markdown source editor modal,
 * textarea synchronization, and applying or resetting markdown content.
 */
export class EditorModal {
    constructor({ modalId, inputId, onApply, onReset }) {
        this.modal = document.getElementById(modalId);
        this.textarea = document.getElementById(inputId);
        this.onApply = onApply;
        this.onReset = onReset;

        this.setupBindings();
    }

    setupBindings() {
        const btnOpen = document.getElementById('btn-open-modal');
        const btnClose = document.getElementById('btn-close-modal');
        const btnApply = document.getElementById('btn-apply-markdown');
        const btnReset = document.getElementById('btn-reset-markdown');

        btnOpen?.addEventListener('click', () => this.toggle());
        btnClose?.addEventListener('click', () => this.toggle());

        btnApply?.addEventListener('click', () => {
            if (this.onApply && this.textarea) {
                this.onApply(this.textarea.value);
            }
            this.toggle();
        });

        btnReset?.addEventListener('click', () => {
            if (this.onReset) {
                this.onReset();
            }
        });
    }

    setContent(text) {
        if (this.textarea) {
            this.textarea.value = text;
        }
    }

    getContent() {
        return this.textarea ? this.textarea.value : '';
    }

    isOpen() {
        return this.modal ? !this.modal.classList.contains('hidden') : false;
    }

    toggle() {
        if (this.modal) {
            this.modal.classList.toggle('hidden');
        }
    }
}
