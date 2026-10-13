/**
 * PresentationTimer - Minimal Transparent Presentation Countdown Timer
 * Displays in the top header without background or extra buttons:
 * - Single click: Pause / Resume
 * - Double click: Reset / Fresh restart
 * - Configured via settings (e.g. <setting name="timer" value="20m">)
 */
export class PresentationTimer {
    constructor() {
        this.containerEl = document.getElementById('presentation-timer');
        this.displayEl = document.getElementById('timer-display');
        this.iconEl = document.getElementById('timer-icon');

        this.totalDurationSec = 20 * 60; // Default 20 minutes
        this.remainingSec = this.totalDurationSec;
        this.isRunning = false;
        this.intervalId = null;
        this.clickTimer = null;

        this.setupEventListeners();
        this.updateDisplay();
    }

    static parseDuration(val) {
        if (!val) return 20 * 60; // 20 minutes default
        if (typeof val === 'number') return Math.max(1, val);
        const str = String(val).trim().toLowerCase();

        // Format: MM:SS (e.g. "20:00", "15:30")
        if (str.includes(':')) {
            const parts = str.split(':').map(p => parseInt(p, 10) || 0);
            if (parts.length === 2) {
                return parts[0] * 60 + parts[1];
            } else if (parts.length === 3) {
                return parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
        }

        // Format: "20m", "20min", "20 minutes"
        if (str.includes('m')) {
            const mins = parseFloat(str) || 20;
            return Math.max(1, Math.round(mins * 60));
        }

        // Format: "1h", "1.5h"
        if (str.includes('h')) {
            const hours = parseFloat(str) || 1;
            return Math.max(1, Math.round(hours * 3600));
        }

        // Format: "45s", "120s"
        if (str.includes('s')) {
            const secs = parseFloat(str) || 1200;
            return Math.max(1, Math.round(secs));
        }

        const num = parseFloat(str);
        if (!isNaN(num)) {
            // If <= 180, treat as minutes; otherwise treat as seconds
            return num <= 180 ? Math.round(num * 60) : Math.round(num);
        }

        return 20 * 60;
    }

    configure(settings) {
        const rawTimerVal = (
            settings.timer ||
            settings['timer-duration'] ||
            settings.duration ||
            settings.time ||
            settings.cronometro ||
            settings['cronometro-tempo']
        );

        const newDurationSec = PresentationTimer.parseDuration(rawTimerVal);

        // Only reset if duration actually changed
        if (newDurationSec !== this.totalDurationSec) {
            this.totalDurationSec = newDurationSec;
            this.reset();
        }

        // Auto-start if not running
        if (!this.isRunning) {
            this.start();
        }
    }

    setupEventListeners() {
        if (!this.containerEl) return;

        // Smart click handler: 1 click = pause/resume, 2 clicks = reset (fresh)
        this.containerEl.addEventListener('click', (e) => {
            e.preventDefault();

            if (this.clickTimer) {
                // Double click detected!
                clearTimeout(this.clickTimer);
                this.clickTimer = null;
                this.reset();
                this.flashFeedback('fresh');
            } else {
                this.clickTimer = setTimeout(() => {
                    this.clickTimer = null;
                    // Single click detected!
                    this.toggle();
                    this.flashFeedback(this.isRunning ? 'start' : 'pause');
                }, 260);
            }
        });

        this.containerEl.addEventListener('dblclick', (e) => {
            e.preventDefault();
            if (this.clickTimer) {
                clearTimeout(this.clickTimer);
                this.clickTimer = null;
            }
            this.reset();
            this.flashFeedback('fresh');
        });
    }

    flashFeedback(type) {
        if (!this.displayEl) return;
        this.displayEl.classList.remove('scale-110', 'text-amber-400', 'text-cyan-300');
        void this.displayEl.offsetWidth; // Force reflow
        if (type === 'fresh') {
            this.displayEl.classList.add('scale-110', 'text-cyan-300');
        } else if (type === 'pause') {
            this.displayEl.classList.add('scale-105', 'text-amber-400');
        }
        setTimeout(() => {
            this.displayEl.classList.remove('scale-110', 'scale-105', 'text-amber-400', 'text-cyan-300');
        }, 300);
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;

        if (this.iconEl) {
            this.iconEl.classList.add('animate-pulse');
        }

        this.intervalId = setInterval(() => {
            this.tick();
        }, 1000);

        this.updateDisplay();
    }

    pause() {
        if (!this.isRunning) return;
        this.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        if (this.iconEl) {
            this.iconEl.classList.remove('animate-pulse');
        }

        this.updateDisplay();
    }

    toggle() {
        if (this.isRunning) {
            this.pause();
        } else {
            this.start();
        }
    }

    reset() {
        this.pause();
        this.remainingSec = this.totalDurationSec;
        this.updateDisplay();
        this.start();
    }

    tick() {
        this.remainingSec--;
        this.updateDisplay();
    }

    updateDisplay() {
        if (!this.displayEl) return;

        const isOvertime = this.remainingSec < 0;
        const absSec = Math.abs(this.remainingSec);

        const hours = Math.floor(absSec / 3600);
        const mins = Math.floor((absSec % 3600) / 60);
        const secs = absSec % 60;

        let formattedTime = '';
        if (hours > 0) {
            formattedTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        } else {
            formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }

        if (isOvertime) {
            formattedTime = `+${formattedTime}`;
        }

        this.displayEl.textContent = formattedTime;

        // Visual alerts based on time threshold
        if (this.containerEl && this.iconEl && this.displayEl) {
            this.displayEl.classList.remove('text-red-400', 'text-amber-400', 'text-slate-300', 'text-slate-500');
            this.containerEl.classList.remove('border-red-500/70', 'border-amber-500/60', 'shadow-[0_0_12px_rgba(244,63,94,0.3)]');

            if (isOvertime) {
                this.displayEl.classList.add('text-red-400');
                this.containerEl.classList.add('border-red-500/70', 'shadow-[0_0_12px_rgba(244,63,94,0.3)]');
                this.iconEl.className = 'fa-solid fa-triangle-exclamation text-red-400 animate-pulse';
            } else if (this.remainingSec <= 120) {
                // < 2 minutes: Warning state (Amber)
                this.displayEl.classList.add('text-amber-400');
                this.containerEl.classList.add('border-amber-500/60');
                this.iconEl.className = 'fa-solid fa-stopwatch text-amber-400 animate-pulse';
            } else {
                // Normal state
                if (this.isRunning) {
                    this.displayEl.classList.add('text-slate-300');
                    this.iconEl.className = 'fa-regular fa-clock text-cyan-400 animate-pulse';
                } else {
                    this.displayEl.classList.add('text-slate-500');
                    this.iconEl.className = 'fa-regular fa-clock text-slate-500';
                }
            }
        }
    }
}
