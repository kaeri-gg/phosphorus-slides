import { MarkdownHelper } from '../utils/MarkdownHelper.js';

/**
 * Class responsible for rendering the horizontal chronological timeline
 * with fixed vertical anchoring (100% frozen in exact 50% Y center of viewport),
 * check icon for active milestones, instant static display on initial load,
 * and arrival transitions exclusively when advancing forward on the timeline.
 */
export class TimelineRenderer {
    constructor() {
        this.timelineStage = document.getElementById('timeline-stage');
        this.titleEl = document.getElementById('timeline-title');
        this.subtitleEl = document.getElementById('timeline-subtitle');
        this.itemsContainer = document.getElementById('timeline-items-container');
        this.progressBar = document.getElementById('timeline-progress-bar');
        this.trackBg = document.getElementById('timeline-track-bg');
        this.trackContainer = document.getElementById('timeline-track-container');
        this.contentEl = document.getElementById('timeline-content');
        this.cardEl = document.getElementById('timeline-card');

        this.lastActiveIndex = null;
        this.lastTimelineId = null;
        this.arrivalTimeoutId = null;
    }

    render(step, currentIndex, totalSteps) {
        if (!this.timelineStage || !step.timeline) return;

        const { items, activeIndex } = step.timeline;
        const totalItems = items.length;
        const safeActiveIndex = Math.max(0, Math.min(activeIndex, totalItems - 1));

        const prevIndex = (this.lastActiveIndex !== null) ? this.lastActiveIndex : safeActiveIndex;
        const isSameTimeline = (this.lastTimelineId === step.timeline.id && this.itemsContainer && this.itemsContainer.children.length === totalItems);
        const isForwardJump = isSameTimeline && (safeActiveIndex > prevIndex);

        this.lastActiveIndex = safeActiveIndex;
        this.lastTimelineId = step.timeline.id;

        if (this.arrivalTimeoutId) {
            clearTimeout(this.arrivalTimeoutId);
            this.arrivalTimeoutId = null;
        }

        // 1. Header (Title & Subtitle in top hemisphere)
        if (this.titleEl) {
            const newTitle = step.title || '';
            const parsedTitle = MarkdownHelper.parseInline(newTitle);
            if (newTitle) {
                if (this.titleEl.innerHTML !== parsedTitle) {
                    this.titleEl.innerHTML = parsedTitle;
                    this.titleEl.className = 'slide-title-standard text-center mb-4 text-swap-rise pointer-events-auto';
                }
                this.titleEl.style.visibility = 'visible';
            } else {
                this.titleEl.innerHTML = '';
                this.titleEl.style.visibility = 'hidden';
            }
        }

        if (this.subtitleEl) {
            const newSubtitle = step.subtitle || '';
            const parsedSubtitle = MarkdownHelper.parseInline(newSubtitle);
            if (this.subtitleEl.innerHTML !== parsedSubtitle) {
                this.subtitleEl.innerHTML = parsedSubtitle;
                this.subtitleEl.className = 'slide-subtitle-standard text-center max-w-4xl xl:max-w-5xl mx-auto min-h-[1.5rem] text-swap-rise pointer-events-auto';
            }
            if (newSubtitle) {
                this.subtitleEl.style.visibility = 'visible';
            } else {
                this.subtitleEl.style.visibility = 'hidden';
            }
        }

        // 2. Track & Progress Horizontal Alignment
        if (totalItems > 1) {
            const startPct = 100 / (2 * totalItems);
            const totalSpanPct = (100 * (totalItems - 1)) / totalItems;
            const progressPct = (safeActiveIndex / (totalItems - 1)) * totalSpanPct;

            if (this.trackBg) {
                this.trackBg.style.left = `${startPct}%`;
                this.trackBg.style.width = `${totalSpanPct}%`;
                this.trackBg.style.top = '72px';
            }

            if (this.progressBar) {
                this.progressBar.style.left = `${startPct}%`;
                this.progressBar.style.width = `${progressPct}%`;
                this.progressBar.style.top = '72px';
            }
        }

        // 3. Persistent DOM: Build initial static or Diff-update existing nodes
        if (!isSameTimeline) {
            this.buildTimelineDOM(items, safeActiveIndex);
        } else {
            this.updateTimelineDOM(items, prevIndex, safeActiveIndex, isForwardJump);
        }

        // 4. Staged Arrival Activation: ONLY when advancing forward along the timeline
        if (isForwardJump) {
            this.arrivalTimeoutId = setTimeout(() => {
                this.activateMilestone(items[safeActiveIndex], safeActiveIndex);
            }, 200);
        }

        // 5. Render Bottom Floating Clean Text
        if (this.contentEl && this.cardEl) {
            if (step.markdown && step.markdown.trim()) {
                const parsedBody = MarkdownHelper.parse(step.markdown);

                if (this.contentEl.innerHTML !== parsedBody) {
                    this.contentEl.innerHTML = parsedBody;
                    this.cardEl.classList.remove('text-swap-fall');
                    void this.cardEl.offsetWidth; // Force reflow
                    this.cardEl.classList.add('text-swap-fall');
                }
                this.cardEl.classList.remove('hidden');
            } else {
                this.cardEl.classList.add('hidden');
            }
        }
    }

    buildTimelineDOM(items, activeIndex) {
        if (!this.itemsContainer) return;
        this.itemsContainer.innerHTML = '';

        items.forEach((item, idx) => {
            const isPassed = idx < activeIndex;
            const isActive = idx === activeIndex;

            const itemEl = document.createElement('div');
            itemEl.id = `timeline-col-${idx}`;
            itemEl.className = 'flex-1 flex flex-col items-center text-center px-2 md:px-4 relative group select-none transition-all duration-300';

            // Row 1: Date
            let dateClass = 'timeline-date-inactive';
            if (isActive) dateClass = 'timeline-date-active';
            else if (isPassed) dateClass = 'timeline-date-passed';

            const dateMarkup = `
                <div class="h-8 flex items-center justify-center mb-4 z-10">
                    <span id="timeline-date-${idx}" class="timeline-date-label text-sm md:text-base font-mono font-semibold tracking-wider ${dateClass}">
                        ${item.date}
                    </span>
                </div>
            `;

            // Row 2: Orb
            const orbMarkup = `
                <div class="timeline-circle-slot h-12 w-12 flex items-center justify-center z-10 mb-5 relative">
                    <div id="timeline-orb-${idx}" class="timeline-orb-smooth flex items-center justify-center"></div>
                </div>
            `;

            // Row 3: Title
            let titleClass = 'timeline-title-inactive';
            if (isActive) titleClass = 'timeline-title-active';
            else if (isPassed) titleClass = 'timeline-title-passed';

            const descMarkup = item.desc ? `<span class="text-xs md:text-sm text-slate-400 mt-1 leading-snug font-normal">${item.desc}</span>` : '';

            const textMarkup = `
                <div id="timeline-text-${idx}" class="timeline-title-label flex flex-col items-center max-w-[240px] ${titleClass}">
                    <span class="timeline-item-name font-semibold tracking-normal text-center">${item.name}</span>
                    ${descMarkup}
                </div>
            `;

            itemEl.innerHTML = dateMarkup + orbMarkup + textMarkup;
            this.itemsContainer.appendChild(itemEl);

            // Set Initial Orb Visuals (Using check symbol for active and passed)
            const orbEl = itemEl.querySelector(`#timeline-orb-${idx}`);
            if (orbEl) {
                if (isActive) {
                    orbEl.className = 'timeline-orb-smooth timeline-orb-active w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center';
                    orbEl.style.border = '2.5px solid #00aaff';
                    orbEl.style.color = '#00aaff';
                    orbEl.style.boxShadow = '';
                    orbEl.innerHTML = `<i class="fa-solid fa-check text-sm"></i>`;
                } else if (isPassed) {
                    orbEl.className = 'timeline-orb-smooth w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center group-hover:scale-110';
                    orbEl.style.border = '1.5px solid rgba(0, 170, 255, 0.4)';
                    orbEl.style.color = '#00aaff';
                    orbEl.style.boxShadow = 'none';
                    orbEl.innerHTML = `<i class="fa-solid fa-check text-xs"></i>`;
                } else {
                    orbEl.className = 'timeline-orb-smooth w-7 h-7 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 group-hover:scale-110 group-hover:border-slate-700';
                    orbEl.style.border = '1px solid rgb(30 41 59)';
                    orbEl.style.color = '#64748b';
                    orbEl.style.boxShadow = 'none';
                    orbEl.innerHTML = `<div class="w-1.5 h-1.5 rounded-full bg-slate-700"></div>`;
                }
            }
        });
    }

    updateTimelineDOM(items, prevIndex, activeIndex, isForwardJump) {
        items.forEach((item, idx) => {
            const isPassed = idx < activeIndex;
            const isActive = idx === activeIndex;

            const dateEl = document.getElementById(`timeline-date-${idx}`);
            const orbEl = document.getElementById(`timeline-orb-${idx}`);
            const textEl = document.getElementById(`timeline-text-${idx}`);

            if (!dateEl || !orbEl || !textEl) return;

            // 1. Previous active node -> Smoothly shrinks down!
            if (idx === prevIndex && idx !== activeIndex) {
                dateEl.className = 'timeline-date-label text-sm md:text-base font-mono font-semibold tracking-wider ' + (isPassed ? 'timeline-date-passed' : 'timeline-date-inactive');
                textEl.className = 'timeline-title-label flex flex-col items-center max-w-[240px] ' + (isPassed ? 'timeline-title-passed' : 'timeline-title-inactive');

                if (isPassed) {
                    orbEl.className = 'timeline-orb-smooth w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center group-hover:scale-110';
                    orbEl.style.border = '1.5px solid rgba(0, 170, 255, 0.4)';
                    orbEl.style.color = '#00aaff';
                    orbEl.style.boxShadow = 'none';
                    orbEl.innerHTML = `<i class="fa-solid fa-check text-xs"></i>`;
                } else {
                    orbEl.className = 'timeline-orb-smooth w-7 h-7 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 group-hover:scale-110 group-hover:border-slate-700';
                    orbEl.style.border = '1px solid rgb(30 41 59)';
                    orbEl.style.color = '#64748b';
                    orbEl.style.boxShadow = 'none';
                    orbEl.innerHTML = `<div class="w-1.5 h-1.5 rounded-full bg-slate-700"></div>`;
                }
            } else if (isActive) {
                if (!isForwardJump) {
                    this.activateMilestone(item, idx);
                } else {
                    // Stay in waiting state until arrival timeout triggers activateMilestone
                    dateEl.className = 'timeline-date-label text-sm md:text-base font-mono font-semibold tracking-wider timeline-date-inactive';
                    textEl.className = 'timeline-title-label flex flex-col items-center max-w-[240px] timeline-title-inactive';
                    orbEl.className = 'timeline-orb-smooth w-7 h-7 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600';
                    orbEl.style.border = '1px solid rgb(30 41 59)';
                    orbEl.style.color = '#64748b';
                    orbEl.style.boxShadow = 'none';
                    orbEl.innerHTML = `<div class="w-1.5 h-1.5 rounded-full bg-slate-700"></div>`;
                }
            } else {
                dateEl.className = 'timeline-date-label text-sm md:text-base font-mono font-semibold tracking-wider ' + (isPassed ? 'timeline-date-passed' : 'timeline-date-inactive');
                textEl.className = 'timeline-title-label flex flex-col items-center max-w-[240px] ' + (isPassed ? 'timeline-title-passed' : 'timeline-title-inactive');
            }
        });
    }

    activateMilestone(item, index) {
        const dateEl = document.getElementById(`timeline-date-${index}`);
        const orbEl = document.getElementById(`timeline-orb-${index}`);
        const textEl = document.getElementById(`timeline-text-${index}`);

        if (dateEl) {
            dateEl.className = 'timeline-date-label text-sm md:text-base font-mono font-semibold tracking-wider timeline-date-active';
        }
        if (orbEl) {
            orbEl.className = 'timeline-orb-smooth timeline-orb-active w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center';
            orbEl.style.border = '2.5px solid #00aaff';
            orbEl.style.color = '#00aaff';
            orbEl.style.boxShadow = '';
            orbEl.innerHTML = `<i class="fa-solid fa-check text-sm"></i>`;
        }
        if (textEl) {
            textEl.className = 'timeline-title-label flex flex-col items-center max-w-[240px] timeline-title-active';
        }
    }
}
