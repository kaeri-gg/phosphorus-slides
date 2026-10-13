import { TimelineRenderer } from './TimelineRenderer.js';
import { GalleryRenderer } from './GalleryRenderer.js';
import { MarkdownHelper } from '../utils/MarkdownHelper.js';
import { CodeTypewriter, formatCodeWithFocus, applyFocusTransition } from '../utils/CodeTypewriter.js';
import { CodeEdgeRenderer } from './CodeEdgeRenderer.js';
import { LineChartRenderer } from './LineChartRenderer.js';
import { DoughnutChartRenderer } from './DoughnutChartRenderer.js';
import { VideoRenderer } from './VideoRenderer.js';

/**
 * Class responsible for rendering presentation content,
 * switching between:
 * 1. Center Layout (Opening Page)
 * 2. Timeline Layout (Horizontal timeline with dates & steps)
 * 3. Gallery Layout (3D perspective media stack with horizon & vanishing point)
 * 4. Code Layout (Description on left + Code on right, Centered Code-Only, OR Side-by-Side JS vs Stacked WGSL vs Real-time Video Render)
 * 5. Chart Layout (Interactive Multi-line & Doughnut Charts with progression control across steps)
 * 6. Video Expanded Layout (Cinema Mode with top description, author profile & wide video screen)
 * 7. Split Layout (Markdown Card + Canvas, with GPU-accelerated center-to-side translation)
 * 8. Nodes-only Layout (Smooth animated card collapse with full-width centered canvas)
 */
export class ContentRenderer {
    constructor() {
        // Stage containers
        this.heroStage = document.getElementById('hero-stage');
        this.profileStage = document.getElementById('profile-stage');
        this.splitStage = document.getElementById('split-stage');
        this.timelineStage = document.getElementById('timeline-stage');
        this.galleryStage = document.getElementById('gallery-stage');
        this.codeStage = document.getElementById('code-stage');
        this.chartStage = document.getElementById('chart-stage');
        this.videoStage = document.getElementById('video-stage');
        this.cardWrapper = document.getElementById('card-wrapper');
        this.canvasWrapper = document.getElementById('canvas-wrapper');

        // Hero Stage elements
        this.heroTitle = document.getElementById('hero-title');
        this.heroSubtitle = document.getElementById('hero-subtitle');

        // Code Stage elements
        this.codeLeftPanel = document.getElementById('code-left-panel');
        this.codeRightPanel = document.getElementById('code-right-panel');
        this.codeBadge = document.getElementById('code-badge');
        this.codeTitle = document.getElementById('code-title');
        this.codeSubtitle = document.getElementById('code-subtitle');
        this.codeDescription = document.getElementById('code-description');
        this.codeContent = document.getElementById('code-content');
        this.lastCodeContentKey = null;

        // Split Stage elements
        this.stepContent = document.getElementById('step-content');
        this.lastSplitContentKey = null;

        // Shared footer
        this.stepCounterText = document.getElementById('step-counter-text');

        // Specialized Renderers & Helpers
        this.timelineRenderer = new TimelineRenderer();
        this.galleryRenderer = new GalleryRenderer();
        this.lineChartRenderer = new LineChartRenderer();
        this.doughnutChartRenderer = new DoughnutChartRenderer();
        this.videoRenderer = new VideoRenderer();
        this.codeTypewriter = new CodeTypewriter();
        this.codeEdgeRenderer = new CodeEdgeRenderer();
        this.standsTimeouts = [];
        this.lastRenderedTitle = null;
        this.lastRenderedSubtitle = null;
        this.lastCodeLayoutMode = null;
        this.heroExitTimeout = null;
        this.lastActiveStage = null;
        this.lastStageIndex = undefined;
        this.currentStepIndex = 0;
    }

    clearStandsTimeouts() {
        if (this.standsTimeouts) {
            this.standsTimeouts.forEach(t => clearTimeout(t));
            this.standsTimeouts = [];
        }
        if (this.titleTypewriterTimeout) {
            clearTimeout(this.titleTypewriterTimeout);
            this.titleTypewriterTimeout = null;
        }
    }

    isTyping() {
        return !!(this.codeTypewriter && this.codeTypewriter.isTyping());
    }

    flushTypewriter() {
        if (this.codeTypewriter && this.codeTypewriter.isTyping()) {
            return this.codeTypewriter.completeAll();
        }
        return false;
    }

    checkAndPrepareSharedTransition(step, activeStage) {
        this.pendingSharedElement = null;
        if (!this.lastActiveStage || this.lastActiveStage === activeStage) return;

        const normalize = (s) => (s || '').toLowerCase().replace(/[`*_~]/g, '').replace(/\s+/g, ' ').trim();
        const stepTitleNorm = normalize(step.title);
        if (!stepTitleNorm) return;

        // Case 1: Forward Transition: HeroStage -> Target Stage (Glide UP from center)
        if (this.lastActiveStage === this.heroStage && this.heroTitle) {
            const prevHeroTitle = this.heroTitle.innerText.trim();
            const prevHeroTitleNorm = normalize(prevHeroTitle);

            if (stepTitleNorm === prevHeroTitleNorm ||
                stepTitleNorm.includes(prevHeroTitleNorm) ||
                prevHeroTitleNorm.includes(stepTitleNorm)) {

                const titleRect = this.heroTitle.getBoundingClientRect();
                const subRect = (this.heroSubtitle && this.heroSubtitle.offsetHeight > 0)
                    ? this.heroSubtitle.getBoundingClientRect()
                    : null;

                if (titleRect && titleRect.width > 0 && titleRect.height > 0) {
                    this.pendingSharedElement = {
                        direction: 'forward',
                        sourceRect: titleRect,
                        sourceSubRect: subRect,
                        title: step.title
                    };

                    // Hide hero stage immediately without fade or exit animation
                    if (this.heroExitTimeout) {
                        clearTimeout(this.heroExitTimeout);
                        this.heroExitTimeout = null;
                    }
                    this.heroStage.classList.add('hidden');
                    this.heroStage.classList.remove('flex', 'hero-stage-exiting');
                    this.heroStage.style.removeProperty('position');
                    this.heroStage.style.removeProperty('top');
                    this.heroStage.style.removeProperty('left');
                    this.heroStage.style.removeProperty('width');
                    this.heroStage.style.removeProperty('height');
                    const titleWrapper = document.getElementById('hero-title-wrapper');
                    if (titleWrapper) {
                        titleWrapper.classList.remove('hero-anim-title', 'hero-anim-exit-up', 'hero-anim-exit-down');
                    }
                    const imageWrapper = document.getElementById('hero-image-wrapper');
                    if (imageWrapper) {
                        imageWrapper.classList.remove('hero-anim-logo', 'hero-anim-logo-exit', 'hero-anim-exit-up', 'hero-anim-exit-down');
                    }
                }
            }
        }
        // Case 2: Backward Transition: Other Stage -> HeroStage (Glide DOWN from top)
        else if (activeStage === this.heroStage) {
            let prevTitleEl = null;
            let prevSubEl = null;

            if (this.lastActiveStage === this.codeStage) {
                const headerEl = document.getElementById('code-header-container');
                if (headerEl) {
                    prevTitleEl = headerEl.querySelector('h1') || headerEl;
                    prevSubEl = headerEl.querySelector('p');
                } else if (this.codeTitle && this.codeTitle.offsetHeight > 0) {
                    prevTitleEl = this.codeTitle;
                    prevSubEl = this.codeSubtitle;
                }
            } else if (this.lastActiveStage === this.splitStage && this.stepContent) {
                prevTitleEl = this.stepContent.querySelector('h1');
                prevSubEl = this.stepContent.querySelector('.step-subtitle-split, .slide-subtitle-standard');
            }

            if (prevTitleEl) {
                const prevTitleNorm = normalize(prevTitleEl.innerText);
                if (stepTitleNorm === prevTitleNorm ||
                    stepTitleNorm.includes(prevTitleNorm) ||
                    prevTitleNorm.includes(stepTitleNorm)) {

                    const titleRect = prevTitleEl.getBoundingClientRect();
                    const subRect = (prevSubEl && prevSubEl.offsetHeight > 0)
                        ? prevSubEl.getBoundingClientRect()
                        : null;

                    if (titleRect && titleRect.width > 0 && titleRect.height > 0) {
                        this.pendingSharedElement = {
                            direction: 'backward',
                            sourceRect: titleRect,
                            sourceSubRect: subRect,
                            title: step.title
                        };
                    }
                }
            }
        }
    }

    showStage(activeStage, displayClass = 'flex') {
        const isForward = (this.lastStageIndex === undefined || this.currentStepIndex >= this.lastStageIndex);
        this.lastStageIndex = this.currentStepIndex;

        const stages = [
            { el: this.heroStage, display: 'flex' },
            { el: this.profileStage, display: 'flex' },
            { el: this.splitStage, display: 'flex' },
            { el: this.timelineStage, display: 'grid' },
            { el: this.galleryStage, display: 'flex' },
            { el: this.codeStage, display: 'flex' },
            { el: this.chartStage, display: 'flex' },
            { el: this.videoStage, display: 'flex' }
        ];

        // If exiting heroStage (Center layout) to another stage, play smooth exit animation
        const isExitingHero = (this.lastActiveStage === this.heroStage && activeStage !== this.heroStage);
        if (isExitingHero && this.heroStage) {
            const titleWrapper = document.getElementById('hero-title-wrapper');
            const imageWrapper = document.getElementById('hero-image-wrapper');

            if (this.pendingSharedElement) {
                if (this.heroExitTimeout) {
                    clearTimeout(this.heroExitTimeout);
                    this.heroExitTimeout = null;
                }
                this.heroStage.classList.add('hidden');
                this.heroStage.classList.remove('flex', 'hero-stage-exiting');
                this.heroStage.style.removeProperty('position');
                this.heroStage.style.removeProperty('top');
                this.heroStage.style.removeProperty('left');
                this.heroStage.style.removeProperty('width');
                this.heroStage.style.removeProperty('height');
                if (titleWrapper) {
                    titleWrapper.classList.remove('hero-anim-title', 'hero-anim-exit-up', 'hero-anim-exit-down');
                }
                if (imageWrapper) {
                    imageWrapper.classList.remove('hero-anim-logo', 'hero-anim-logo-exit', 'hero-anim-exit-up', 'hero-anim-exit-down');
                }
            } else {
                const exitingHero = this.heroStage;

                if (this.heroExitTimeout) {
                    clearTimeout(this.heroExitTimeout);
                    this.heroExitTimeout = null;
                }

                // Capture exact local coordinates before taking exitingHero out of flex document flow
                const oTop = exitingHero.offsetTop;
                const oLeft = exitingHero.offsetLeft;
                const oW = exitingHero.offsetWidth;
                const oH = exitingHero.offsetHeight;

                exitingHero.style.setProperty('position', 'absolute', 'important');
                exitingHero.style.setProperty('top', oTop + 'px', 'important');
                exitingHero.style.setProperty('left', oLeft + 'px', 'important');
                exitingHero.style.setProperty('width', oW + 'px', 'important');
                exitingHero.style.setProperty('height', oH + 'px', 'important');

                exitingHero.classList.remove('hidden');
                exitingHero.classList.add('hero-stage-exiting');

                const hasTitle = (titleWrapper && !titleWrapper.classList.contains('hidden'));
                const hasImage = (imageWrapper && !imageWrapper.classList.contains('hidden'));

                if (hasTitle) {
                    titleWrapper.classList.remove('hero-anim-title', 'hero-anim-exit-up', 'hero-anim-exit-down');
                    void titleWrapper.offsetWidth; // force reflow
                    titleWrapper.classList.add(isForward ? 'hero-anim-exit-up' : 'hero-anim-exit-down');
                }

                if (hasImage) {
                    imageWrapper.classList.remove('hero-anim-logo', 'hero-anim-logo-exit', 'hero-anim-exit-up', 'hero-anim-exit-down');
                    void imageWrapper.offsetWidth; // force reflow
                    imageWrapper.classList.add('hero-anim-logo-exit');
                }

                const exitDuration = hasTitle ? 550 : 360;

                this.heroExitTimeout = setTimeout(() => {
                    exitingHero.classList.add('hidden');
                    exitingHero.classList.remove('flex', 'hero-stage-exiting');
                    exitingHero.style.removeProperty('position');
                    exitingHero.style.removeProperty('top');
                    exitingHero.style.removeProperty('left');
                    exitingHero.style.removeProperty('width');
                    exitingHero.style.removeProperty('height');
                    if (titleWrapper) {
                        titleWrapper.classList.remove('hero-anim-exit-up', 'hero-anim-exit-down');
                    }
                    if (imageWrapper) {
                        imageWrapper.classList.remove('hero-anim-logo-exit', 'hero-anim-exit-up', 'hero-anim-exit-down');
                    }
                    this.heroExitTimeout = null;
                }, exitDuration);
            }
        }

        stages.forEach(({ el, display }) => {
            if (!el) return;
            if (el === activeStage) {
                if (el === this.heroStage) {
                    if (this.heroExitTimeout) {
                        clearTimeout(this.heroExitTimeout);
                        this.heroExitTimeout = null;
                    }
                    this.heroStage.style.removeProperty('position');
                    this.heroStage.style.removeProperty('top');
                    this.heroStage.style.removeProperty('left');
                    this.heroStage.style.removeProperty('width');
                    this.heroStage.style.removeProperty('height');
                    const titleWrapper = document.getElementById('hero-title-wrapper');
                    if (titleWrapper) {
                        titleWrapper.classList.remove('hero-anim-exit-up', 'hero-anim-exit-down');
                    }
                    const imageWrapper = document.getElementById('hero-image-wrapper');
                    if (imageWrapper) {
                        imageWrapper.classList.remove('hero-anim-logo-exit', 'hero-anim-exit-up', 'hero-anim-exit-down');
                    }
                    el.classList.remove('hero-stage-exiting');
                }

                if (this.pendingSharedElement) {
                    el.classList.remove('stage-fade-enter');
                    el.style.animation = 'none';
                } else {
                    el.style.animation = '';
                    if (!el.classList.contains('stage-fade-enter')) {
                        el.classList.add('stage-fade-enter');
                    }
                }

                if (el.classList.contains('hidden')) {
                    el.classList.remove('hidden');
                    el.classList.add(display);
                }
            } else {
                if (el === this.heroStage && isExitingHero && !this.pendingSharedElement) {
                    return; // keep visible during upward exit transition
                }
                if (!el.classList.contains('hidden')) {
                    el.classList.add('hidden');
                    el.classList.remove('flex', 'grid');
                }
            }
        });

        this.lastActiveStage = activeStage;

        if (activeStage !== this.codeStage) {
            this.lastCodeLayoutMode = null;
            this.codeTypewriter.stop();
            this.codeEdgeRenderer.clear();
        }

        if (activeStage !== this.galleryStage && this.galleryRenderer) {
            this.galleryRenderer.pauseAllVideos();
        }

        if (activeStage !== this.videoStage && this.videoRenderer) {
            this.videoRenderer.pause();
        }
    }

    renderBackgroundMedia(step) {
        const bgLayer = document.getElementById('presentation-bg-layer');
        const bgInner = document.getElementById('presentation-bg-inner');
        if (!bgLayer || !bgInner) return;

        const bgSrc = step.background || null;
        const isPerspective = Boolean(step.backgroundPerspective || step.perspective);

        if (bgSrc) {
            const currentVideo = bgInner.querySelector('video');
            const currentSrc = currentVideo ? currentVideo.getAttribute('src') : null;
            const currentPerspective = bgInner.classList.contains('bg-perspective-container');

            if (!currentVideo || currentSrc !== bgSrc || currentPerspective !== isPerspective) {
                if (isPerspective) {
                    bgInner.className = 'bg-perspective-container';
                    bgInner.innerHTML = `
                        <div class="bg-perspective-plane relative">
                            <video class="bg-perspective-video" autoplay loop muted playsinline preload="auto" src="${bgSrc}"></video>
                            <div class="absolute inset-0 pointer-events-none bg-gradient-to-t from-slate-950/50 via-transparent to-transparent"></div>
                        </div>
                    `;
                } else {
                    bgInner.className = 'w-full h-full relative';
                    bgInner.innerHTML = `
                        <video class="bg-fullscreen-video" autoplay loop muted playsinline preload="auto" src="${bgSrc}"></video>
                    `;
                }
            } else if (currentVideo && currentVideo.paused) {
                currentVideo.play().catch(() => { });
            }

            bgLayer.classList.remove('opacity-0');
            bgLayer.classList.add('opacity-100');
        } else {
            bgLayer.classList.remove('opacity-100');
            bgLayer.classList.add('opacity-0');
            const video = bgInner.querySelector('video');
            if (video) {
                setTimeout(() => {
                    if (bgLayer.classList.contains('opacity-0') && video) {
                        video.pause();
                    }
                }, 700);
            }
        }
    }

    render(step, currentIndex, totalSteps) {
        this.currentStepIndex = currentIndex;
        this.clearStandsTimeouts();
        this.renderBackgroundMedia(step);

        const prevPresentationTitle = this.currentPresentationTitle;
        const nextPresentationTitle = step.title ? step.title.trim() : null;
        this.isTitleChanging = Boolean(prevPresentationTitle && nextPresentationTitle && prevPresentationTitle !== nextPresentationTitle);
        this.currentPresentationTitle = nextPresentationTitle;

        const isCenterLayout = (step.layout === 'center' || step.layout === 'hero');
        const isVideoExpandedLayout = (
            step.layout === 'video-expanded' ||
            step.layout === 'video-wide' ||
            step.layout === 'video-full' ||
            step.layout === 'video' ||
            step.layout === 'image-expanded' ||
            step.layout === 'image' ||
            step.layout === 'photo'
        );
        const isProfileLayout = (step.layout === 'profile' || (!isVideoExpandedLayout && !!step.profile));
        const isTimelineLayout = (step.layout === 'timeline');
        const isGalleryLayout = (step.layout === 'gallery');
        const isChartLayout = (step.layout === 'chart' || step.layout === 'graph' || step.layout === 'line-chart' || !!step.chart);
        const isCodeLayout = (
            step.layout === 'code' ||
            step.layout === 'code-only' ||
            step.layout === 'code-split' ||
            step.layout === 'code-compare' ||
            (step.codes && step.codes.length >= 2) ||
            (step.codes && step.codes.length >= 1 && step.video)
        );
        const isNodesOnlyLayout = (
            step.layout === 'nodes-only' ||
            step.layout === 'canvas' ||
            step.layout === 'canvas-only' ||
            step.layout === 'nodes' ||
            step.layout === 'fullscreen'
        );

        // Update shared footer counter
        if (this.stepCounterText) {
            this.stepCounterText.innerText = `${currentIndex + 1} / ${totalSteps}`;
        }

        let targetStage = this.splitStage;
        if (isCenterLayout) {
            targetStage = this.heroStage;
        } else if (isVideoExpandedLayout) {
            targetStage = this.videoStage;
        } else if (isProfileLayout) {
            targetStage = this.profileStage;
        } else if (isTimelineLayout) {
            targetStage = this.timelineStage;
        } else if (isGalleryLayout) {
            targetStage = this.galleryStage;
        } else if (isChartLayout) {
            targetStage = this.chartStage;
        } else if (isCodeLayout) {
            targetStage = this.codeStage;
        } else if (isNodesOnlyLayout) {
            targetStage = this.splitStage;
        }

        this.checkAndPrepareSharedTransition(step, targetStage);

        if (isCenterLayout) {
            this.renderHeroLayout(step);
        } else if (isVideoExpandedLayout) {
            this.renderVideoExpandedLayout(step, currentIndex, totalSteps);
        } else if (isProfileLayout) {
            this.renderProfileLayout(step);
        } else if (isTimelineLayout) {
            this.renderTimelineLayout(step, currentIndex, totalSteps);
        } else if (isGalleryLayout) {
            this.renderGalleryLayout(step, currentIndex, totalSteps);
        } else if (isChartLayout) {
            this.renderChartLayout(step, currentIndex, totalSteps);
        } else if (isCodeLayout) {
            this.renderCodeLayout(step, currentIndex, totalSteps);
        } else if (isNodesOnlyLayout) {
            this.renderNodesOnlyLayout(step, currentIndex);
        } else {
            this.renderSplitLayout(step, currentIndex);
        }
    }

    renderVideoExpandedLayout(step, currentIndex, totalSteps) {
        this.showStage(this.videoStage, 'flex');
        this.lastSplitContentKey = null;
        this.lastCodeContentKey = null;
        this.lastCodeStageTitle = null;
        this.videoRenderer.render(step, currentIndex, totalSteps);
    }

    renderChartLayout(step, currentIndex, totalSteps) {
        this.showStage(this.chartStage, 'flex');
        this.lastSplitContentKey = null;
        this.lastCodeContentKey = null;
        this.lastCodeStageTitle = null;

        const chartType = (step.chart && step.chart.type) ? step.chart.type.toLowerCase() : '';
        if (chartType === 'doughnut' || chartType === 'donut' || step.layout === 'doughnut' || step.layout === 'donut') {
            this.doughnutChartRenderer.render(step, currentIndex, totalSteps);
        } else {
            this.lineChartRenderer.render(step, currentIndex, totalSteps);
        }
    }

    renderHeroLayout(step) {
        this.showStage(this.heroStage, 'flex');
        this.lastSplitContentKey = null;
        this.lastCodeContentKey = null;
        this.lastCodeStageTitle = null;

        const isStandaloneLogo = !!(step.image && !step.title && !step.subtitle);
        const imageWrapper = document.getElementById('hero-image-wrapper');
        const imageContainer = document.getElementById('hero-image-container');
        const titleWrapper = document.getElementById('hero-title-wrapper');
        const subtitleWrapper = document.getElementById('hero-subtitle-wrapper');

        if (imageWrapper && imageContainer) {
            if (step.image) {
                const imgSrc = step.image.src || 'assets/icon.svg';
                const isWhite = step.image.color === 'white' || !step.image.color || step.image.color === '#ffffff';
                const filterClass = isWhite ? 'hero-logo-white' : '';
                const sizeClass = isStandaloneLogo
                    ? 'w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52'
                    : 'w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36';

                imageContainer.innerHTML = `
                    <div class="relative group flex items-center justify-center">
                        <div class="hero-logo-glow"></div>
                        <img src="${imgSrc}" alt="${step.image.alt || 'Three.js'}" class="hero-logo-icon ${filterClass} ${sizeClass} object-contain relative z-10 select-none transition-transform duration-700 group-hover:scale-105" />
                    </div>
                `;
                imageWrapper.className = isStandaloneLogo ? 'my-auto flex items-center justify-center' : 'mb-7';
                imageWrapper.classList.remove('hero-anim-logo', 'hero-anim-logo-exit', 'hero-anim-exit-up', 'hero-anim-exit-down');
                void imageWrapper.offsetWidth; // force reflow for smooth re-trigger
                imageWrapper.classList.add('hero-anim-logo');
                imageWrapper.classList.remove('hidden');
            } else {
                imageContainer.innerHTML = '';
                imageWrapper.className = 'hidden';
            }
        }

        this.clearStandsTimeouts();

        if (titleWrapper && this.heroTitle) {
            if (step.title) {
                const isSameTitleId = (step.titleId && this.currentTitleId && step.titleId === this.currentTitleId);

                if (!isSameTitleId) {
                    titleWrapper.classList.remove('hero-anim-title', 'hero-anim-exit-up', 'hero-anim-exit-down');
                    if (!this.pendingSharedElement) {
                        void titleWrapper.offsetWidth; // force reflow for smooth re-trigger
                        titleWrapper.classList.add('hero-anim-title');
                    }
                }
                titleWrapper.classList.remove('hidden');
                this.currentTitleId = step.titleId || null;

                const stands = step.titleStands || (step.title.toLowerCase().includes('shading language') ? 'TSL' : '');

                if (stands) {
                    const words = step.title.split(/\s+/).filter(Boolean);
                    const wordTails = words.map(w => w.substring(1));

                    const executeStandsChoreography = () => {
                        // Measure exact tail widths off-screen to prevent any 1-frame visual flash in the live DOM
                        const measureTailWidths = (tails) => {
                            const sandbox = document.createElement('div');
                            sandbox.className = 'hero-title-clean';
                            sandbox.style.cssText = 'position:fixed;top:-9999px;left:-9999px;visibility:hidden;pointer-events:none;white-space:nowrap;display:inline-flex;';

                            tails.forEach((tail, idx) => {
                                const span = document.createElement('span');
                                span.className = 'stands-tail';
                                span.textContent = tail;
                                span.id = `tail-measure-${idx}`;
                                sandbox.appendChild(span);
                            });

                            document.body.appendChild(sandbox);
                            const widths = tails.map((_, idx) => {
                                const el = document.getElementById(`tail-measure-${idx}`);
                                return el ? Math.ceil(el.scrollWidth || el.offsetWidth || el.getBoundingClientRect().width) + 4 : 0;
                            });
                            document.body.removeChild(sandbox);
                            return widths;
                        };

                        const liveTailWidths = measureTailWidths(wordTails);

                        // Render directly in the collapsed "TSL" state (no gaps, 0px tail slots, empty tails)
                        const wordsHtml = words.map((w, idx) => {
                            const initial = w.charAt(0);
                            return `
                                <span class="stands-word" id="stands-word-${idx}">
                                    <span class="stands-initial" id="stands-initial-${idx}">${initial}</span>
                                    <span class="stands-tail-slot" id="stands-slot-${idx}" style="width: 0px; overflow: hidden;">
                                        <span class="stands-tail" id="stands-tail-${idx}"></span>
                                        <span class="stands-cursor" id="stands-cursor-${idx}" style="opacity: 0;"></span>
                                    </span>
                                </span>
                            `;
                        }).join('');

                        this.heroTitle.innerHTML = `<div class="hero-stands-container" id="hero-stands-container">${wordsHtml}</div>`;

                        const containerEl = document.getElementById('hero-stands-container');
                        const slotEls = words.map((_, idx) => document.getElementById(`stands-slot-${idx}`));
                        const tailEls = words.map((_, idx) => document.getElementById(`stands-tail-${idx}`));
                        const cursorEls = words.map((_, idx) => document.getElementById(`stands-cursor-${idx}`));

                        const parseDelayToMs = (val, defaultMs = 0) => {
                            if (!val) return defaultMs;
                            if (typeof val === 'number') return val;
                            const str = String(val).trim();
                            if (str.endsWith('ms')) return parseFloat(str);
                            if (str.endsWith('s')) return parseFloat(str) * 1000;
                            const num = parseFloat(str);
                            return isNaN(num) ? defaultMs : num;
                        };

                        const separationDelay = step.titleDelay ? parseDelayToMs(step.titleDelay, 0) : 0;
                        const typeSpeed = step.titleSpeed ? CodeTypewriter.parseSpeed(step.titleSpeed) : 50;

                        // Phase 1: Smooth separation of T, S, L to their exact word slot widths (staying centered)
                        const startSeparation = () => {
                            if (containerEl) {
                                containerEl.classList.add('stands-expanded');
                            }

                            slotEls.forEach((el, idx) => {
                                if (el) {
                                    el.style.transition = 'width 1.25s cubic-bezier(0.16, 1, 0.3, 1)';
                                    el.style.width = `${liveTailWidths[idx]}px`;
                                }
                            });

                            // Phase 2: Simultaneous Typewriter Writing for all words in parallel
                            const timeout2 = setTimeout(() => {
                                // Once slots reach full width, make overflow visible so no character or glow is clipped
                                slotEls.forEach((el) => {
                                    if (el) el.style.overflow = 'visible';
                                });

                                // Show cursors
                                cursorEls.forEach((el) => {
                                    if (el) el.style.opacity = '1';
                                });

                                const maxTailLength = Math.max(...wordTails.map(t => t.length));
                                let charStep = 0;

                                const typeSimultaneous = () => {
                                    if (charStep < maxTailLength) {
                                        wordTails.forEach((tail, idx) => {
                                            if (charStep < tail.length && tailEls[idx]) {
                                                tailEls[idx].textContent = tail.substring(0, charStep + 1);
                                            }
                                        });
                                        charStep++;
                                        const nextTimeout = setTimeout(typeSimultaneous, typeSpeed);
                                        this.standsTimeouts.push(nextTimeout);
                                    } else {
                                        // All words completed simultaneously!
                                        // Release fixed pixel widths so layout stays fluid/responsive
                                        slotEls.forEach(el => {
                                            if (el) {
                                                el.style.width = 'auto';
                                                el.style.overflow = 'visible';
                                            }
                                        });

                                        // Fade out all cursors smoothly after 1.2s
                                        const fadeTimeout = setTimeout(() => {
                                            cursorEls.forEach(c => {
                                                if (c) c.classList.add('typewriter-cursor-fadeout');
                                            });
                                        }, 1200);
                                        this.standsTimeouts.push(fadeTimeout);
                                    }
                                };

                                typeSimultaneous();
                            }, 1300); // wait for 1.25s separation transition to settle
                            this.standsTimeouts.push(timeout2);
                        };

                        if (separationDelay > 0) {
                            const timeout1 = setTimeout(startSeparation, separationDelay);
                            this.standsTimeouts.push(timeout1);
                        } else {
                            requestAnimationFrame(() => {
                                requestAnimationFrame(() => {
                                    startSeparation();
                                });
                            });
                        }
                    };

                    if (document.fonts && document.fonts.status !== 'loaded') {
                        document.fonts.ready.then(() => executeStandsChoreography());
                    } else {
                        executeStandsChoreography();
                    }
                } else {
                    if (step.title.trim() === 'TSL') {
                        this.heroTitle.innerHTML = `<div class="hero-stands-container"><span class="stands-word"><span class="stands-initial">T</span></span><span class="stands-word"><span class="stands-initial">S</span></span><span class="stands-word"><span class="stands-initial">L</span></span></div>`;
                    } else {
                        this.heroTitle.innerText = step.title;
                    }
                }
            } else {
                this.heroTitle.innerText = '';
                titleWrapper.classList.add('hidden');
            }
        }

        if (subtitleWrapper && this.heroSubtitle) {
            const subtitleText = step.subtitle || step.markdown || '';
            if (subtitleText) {
                this.heroSubtitle.innerHTML = MarkdownHelper.parseInline(subtitleText);
                this.heroSubtitle.querySelectorAll('a').forEach(a => {
                    a.setAttribute('target', '_blank');
                    a.setAttribute('rel', 'noopener noreferrer');
                });

                const parseDelayToMs = (val, defaultMs = 0) => {
                    if (!val) return defaultMs;
                    if (typeof val === 'number') return val;
                    const str = String(val).trim();
                    if (str.endsWith('ms')) return parseFloat(str);
                    if (str.endsWith('s')) return parseFloat(str) * 1000;
                    const num = parseFloat(str);
                    return isNaN(num) ? defaultMs : num;
                };

                const delayMs = step.subtitleDelay ? parseDelayToMs(step.subtitleDelay, 0) : 0;

                if (delayMs > 0) {
                    subtitleWrapper.classList.add('hidden');
                    subtitleWrapper.classList.remove('hero-anim-subtitle');
                    subtitleWrapper.style.animationDelay = '0s';

                    const subTimeout = setTimeout(() => {
                        subtitleWrapper.classList.remove('hidden');
                        void subtitleWrapper.offsetWidth;
                        subtitleWrapper.classList.add('hero-anim-subtitle');
                    }, delayMs);
                    this.standsTimeouts.push(subTimeout);
                } else {
                    subtitleWrapper.style.animationDelay = '';
                    subtitleWrapper.classList.remove('hero-anim-subtitle');
                    if (!this.pendingSharedElement) {
                        void subtitleWrapper.offsetWidth; // force reflow for smooth re-trigger
                        subtitleWrapper.classList.add('hero-anim-subtitle');
                    }
                    subtitleWrapper.classList.remove('hidden');
                }
            } else {
                this.heroSubtitle.innerText = '';
                subtitleWrapper.classList.add('hidden');
            }
        }

        if (this.pendingSharedElement && this.pendingSharedElement.direction === 'backward' && this.heroTitle) {
            const newTitleRect = this.heroTitle.getBoundingClientRect();
            const deltaX = (this.pendingSharedElement.sourceRect.left + this.pendingSharedElement.sourceRect.width / 2) - (newTitleRect.left + newTitleRect.width / 2);
            const deltaY = this.pendingSharedElement.sourceRect.top - newTitleRect.top;

            this.heroTitle.animate([
                { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)`, opacity: 1 },
                { transform: 'translate3d(0, 0, 0)', opacity: 1 }
            ], {
                duration: 850,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'none'
            });

            if (this.pendingSharedElement.sourceSubRect && this.heroSubtitle) {
                const newSubRect = this.heroSubtitle.getBoundingClientRect();
                const deltaSubX = (this.pendingSharedElement.sourceSubRect.left + this.pendingSharedElement.sourceSubRect.width / 2) - (newSubRect.left + newSubRect.width / 2);
                const deltaSubY = this.pendingSharedElement.sourceSubRect.top - newSubRect.top;

                this.heroSubtitle.animate([
                    { transform: `translate3d(${deltaSubX}px, ${deltaSubY}px, 0)`, opacity: 1 },
                    { transform: 'translate3d(0, 0, 0)', opacity: 1 }
                ], {
                    duration: 850,
                    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    fill: 'none'
                });
            }

            this.pendingSharedElement = null;
        }
    }

    renderProfileLayout(step) {
        this.showStage(this.profileStage, 'block');
        this.lastSplitContentKey = null;

        const profiles = (step.profiles && step.profiles.length > 0)
            ? step.profiles
            : [step.profile || {
                name: step.title || 'Jean Carlo Deconto',
                nickname: '',
                role: step.subtitle || 'Author of TSL & NodeMaterial',
                company: 'Three.js Core Contributor',
                avatar: 'assets/me.jpg',
                github: 'sunag',
                bio: step.markdown || ''
            }];

        const formatHandle = (val) => {
            if (!val) return '';
            let handle = String(val).trim();
            if (handle.startsWith('http://') || handle.startsWith('https://')) {
                const parts = handle.replace(/\/$/, '').split('/');
                handle = parts[parts.length - 1];
            }
            if (!handle.startsWith('@')) {
                handle = `@${handle}`;
            }
            return handle;
        };

        const parsedBottomMarkdown = step.markdown ? MarkdownHelper.parse(step.markdown) : '';

        // If multiple profiles (e.g. 3 profiles) or multi-card layout:
        if (profiles.length > 1) {
            const colsCount = Math.min(profiles.length, 3);
            const gridColsClass = colsCount === 2 ? 'md:grid-cols-2' : (colsCount >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-1');

            this.profileStage.innerHTML = `
                <!-- Top Zone: Hemisfério Superior (Alinhado exatamente como na Timeline) -->
                <div class="absolute top-0 left-0 right-0 bottom-[calc(50%+140px)] flex flex-col justify-center items-center text-center px-4 overflow-hidden z-10 pointer-events-none profile-anim-header">
                    ${step.title ? `<h1 class="slide-title-standard profile-stage-title text-center mb-3 pointer-events-auto">${step.title}</h1>` : ''}
                    ${step.subtitle ? `<p class="slide-subtitle-standard profile-stage-subtitle text-center max-w-3xl mx-auto min-h-[1.5rem] pointer-events-auto">${step.subtitle}</p>` : ''}
                </div>

                <!-- Middle Zone: Cravado no EXATO CENTRO VERTICAL (top: 50%, -translate-y-1/2) -->
                <div class="absolute top-1/2 left-0 right-0 -translate-y-1/2 w-full flex items-center justify-center px-4 md:px-8 z-20">
                    <div class="grid grid-cols-1 ${gridColsClass} gap-6 lg:gap-10 w-full max-w-5xl items-stretch justify-center">
                        ${profiles.map((p, idx) => {
                const pName = p.name || p.title || 'Jean Carlo Deconto';
                const cleanNick = (p.nickname || '').replace(/^@/, '');
                const cleanGithub = p.github ? formatHandle(p.github).replace(/^@/, '') : '';
                const pBio = p.bio ? MarkdownHelper.parse(p.bio) : '';
                const staggerDelay = 180 + idx * 220;

                return `
                                <div class="flex flex-col items-center text-center relative group transition-all duration-500 p-2 profile-anim-card profile-card-item cursor-default" style="animation-delay: ${staggerDelay}ms;">
                                    <!-- Avatar com Glow -->
                                    <div class="relative flex items-center justify-center mb-4">
                                        <div class="avatar-pulsing-glow"></div>
                                        <div class="avatar-animated-border-wrapper w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32">
                                            <div class="relative z-10 w-full h-full rounded-full overflow-hidden bg-slate-950 p-1 flex items-center justify-center">
                                                <img src="${p.avatar || 'assets/me.jpg'}" alt="${pName}" class="w-full h-full object-cover rounded-full group-hover:scale-105 transition duration-700" onerror="this.onerror=null; this.src='assets/me.jpg';">
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Nome -->
                                    <h3 class="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight mb-1 group-hover:text-cyan-300 transition-colors duration-300">
                                        ${pName}
                                    </h3>

                                    <!-- Nickname (sem ícone e sem @) -->
                                    ${cleanNick ? `
                                        <div class="flex items-center justify-center mb-1 select-none">
                                            <span class="text-xs sm:text-sm text-slate-300 font-medium">${cleanNick}</span>
                                        </div>
                                    ` : ''}

                                    <!-- GitHub Handle -->
                                    ${cleanGithub ? `
                                        <div class="flex items-center justify-center space-x-1.5 mb-1.5 select-none">
                                            <i class="fa-brands fa-github text-sm sm:text-base text-slate-300"></i>
                                            <span class="text-xs sm:text-sm font-mono text-slate-300 font-semibold tracking-wider">@${cleanGithub}</span>
                                        </div>
                                    ` : ''}

                                    <!-- Cargo Principal (Destaque Maior) -->
                                    ${p.role ? `
                                        <p class="text-sm sm:text-base md:text-lg font-semibold text-cyan-300 tracking-tight leading-snug mb-0.5">
                                            ${p.role}
                                        </p>
                                    ` : ''}

                                    <!-- Empresa / Tagline (Linha de Baixo) -->
                                    ${p.company ? `
                                        <p class="text-xs sm:text-sm font-mono text-slate-400 font-normal mb-2.5">
                                            ${p.company}
                                        </p>
                                    ` : ''}

                                    <!-- Divisor Suave -->
                                    <div class="w-12 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent mb-2.5"></div>

                                    <!-- Bio -->
                                    ${pBio ? `
                                        <div class="text-slate-300/85 text-xs sm:text-sm leading-relaxed step-markdown text-center max-w-xs">
                                            ${pBio}
                                        </div>
                                    ` : ''}
                                </div>
                            `;
            }).join('')}
                    </div>
                </div>

                <!-- Bottom Zone: Hemisfério Inferior (Descrição em Markdown perfeitamente alinhada) -->
                <div class="absolute top-[calc(50%+130px)] left-0 right-0 bottom-0 flex flex-col justify-center items-center px-6 overflow-hidden z-10 pointer-events-none profile-anim-bottom">
                    ${parsedBottomMarkdown ? `
                        <div class="w-full max-w-4xl pointer-events-auto">
                            <div class="step-markdown profile-bottom-text text-center text-slate-100 font-normal">${parsedBottomMarkdown}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            // Single classic Profile (aligned harmoniously across the 3 zones)
            const profile = profiles[0];
            const parsedBio = profile.bio ? MarkdownHelper.parse(profile.bio) : '';
            const displayName = profile.name || profile.title || 'Jean Carlo Deconto';
            const cleanNick = (profile.nickname || '').replace(/^@/, '');
            const cleanGithub = profile.github ? formatHandle(profile.github).replace(/^@/, '') : '';

            this.profileStage.innerHTML = `
                <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-20">
                    <div class="flex flex-col items-center justify-center text-center gap-5 sm:gap-6 w-full max-w-3xl mx-auto">
                        <!-- Avatar Circular com Glow -->
                        <div class="flex flex-col items-center profile-anim-card" style="animation-delay: 140ms;">
                            <div class="relative group flex items-center justify-center">
                                <div class="avatar-pulsing-glow"></div>
                                <div class="avatar-animated-border-wrapper w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40">
                                    <div class="relative z-10 w-full h-full rounded-full overflow-hidden bg-slate-950 p-1 flex items-center justify-center">
                                        <img src="${profile.avatar || 'assets/me.jpg'}" alt="${displayName}" class="w-full h-full object-cover rounded-full group-hover:scale-105 transition duration-700" onerror="this.onerror=null; this.src='assets/me.jpg';">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Informações, Cargo e Bio -->
                        <div class="flex flex-col items-center text-center w-full max-w-2xl profile-anim-bottom" style="animation-delay: 380ms;">
                            <h1 class="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight mb-1.5 drop-shadow-md">
                                ${displayName}
                            </h1>

                            <!-- Nickname (sem ícone e sem @) -->
                            ${cleanNick ? `
                                <div class="flex items-center justify-center mt-0.5 mb-2 select-none">
                                    <span class="text-base sm:text-lg font-medium text-slate-300 tracking-normal">${cleanNick}</span>
                                </div>
                            ` : ''}

                            <!-- GitHub Handle -->
                            ${cleanGithub ? `
                                <div class="flex items-center justify-center space-x-2 mt-0.5 mb-2.5 select-none">
                                    <i class="fa-brands fa-github text-base sm:text-lg text-slate-300"></i>
                                    <span class="text-sm sm:text-base font-mono text-slate-200 font-semibold tracking-wide">@${cleanGithub}</span>
                                </div>
                            ` : ''}

                            ${profile.role ? `
                                <p class="text-base sm:text-lg md:text-xl font-semibold text-cyan-300 tracking-tight leading-snug mb-1">
                                    ${profile.role}
                                </p>
                            ` : ''}

                            ${profile.company ? `
                                <p class="text-xs sm:text-sm md:text-base font-mono text-slate-400 font-normal mb-3">
                                    ${profile.company}
                                </p>
                            ` : ''}

                            <div class="w-16 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent mb-3.5"></div>

                            ${parsedBio ? `
                                <div class="text-slate-300/90 text-sm sm:text-base leading-relaxed max-w-xl mx-auto step-markdown text-center">
                                    ${parsedBio}
                                </div>
                            ` : ''}

                            ${parsedBottomMarkdown && parsedBottomMarkdown !== parsedBio ? `
                                <div class="mt-4 text-slate-300/80 text-xs sm:text-sm leading-relaxed max-w-xl mx-auto step-markdown text-center">
                                    ${parsedBottomMarkdown}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
    }

    renderTimelineLayout(step, currentIndex, totalSteps) {
        this.showStage(this.timelineStage, 'grid');
        this.lastSplitContentKey = null;
        this.lastCodeContentKey = null;
        this.lastCodeStageTitle = null;

        this.timelineRenderer.render(step, currentIndex, totalSteps);
    }

    renderGalleryLayout(step, currentIndex, totalSteps) {
        this.showStage(this.galleryStage, 'flex');
        this.lastSplitContentKey = null;
        this.lastCodeContentKey = null;
        this.lastCodeStageTitle = null;

        this.galleryRenderer.render(step, currentIndex, totalSteps);
    }

    renderCodeLayout(step, currentIndex, totalSteps) {
        this.showStage(this.codeStage, 'flex');
        this.lastSplitContentKey = null;

        const hasMultipleCodes = step.codes && step.codes.length >= 2;
        const hasVideo = !!step.video;
        const isCodeCompare = step.layout === 'code-compare' || hasMultipleCodes || (step.codes && step.codes.length >= 1 && hasVideo);
        const isCodeOnly = (step.layout === 'code-only' || (!step.title && !step.markdown && !hasMultipleCodes && !hasVideo));

        const numCodes = (step.codes || []).length;
        const currentCodeStructure = isCodeCompare
            ? (numCodes >= 3 && hasVideo ? 'multi-3-video' : (numCodes >= 3 ? 'multi-3' : (hasVideo ? 'dual-video' : (numCodes === 1 ? 'single-center' : 'dual-code'))))
            : (isCodeOnly ? 'code-only' : 'split-standard');

        const existingGrid = document.getElementById('code-compare-grid');
        const existingSingleCol = document.getElementById('code-single-col');
        const existingDualCol0 = document.getElementById('code-dual-col-0');
        const existingDualCol1 = document.getElementById('code-dual-col-1');
        const existingMultiLeft = document.getElementById('code-multi-col-left');
        const existingSingleCenteredTarget = document.getElementById('code-single-centered-target');

        let isSameSession = false;
        if (this.codeStage && this.codeStage.style.display !== 'none' && this.lastCodeLayoutMode === currentCodeStructure) {
            if (currentCodeStructure === 'single-center' && existingSingleCol) {
                isSameSession = true;
            } else if (currentCodeStructure === 'dual-code' && existingDualCol0 && existingDualCol1) {
                isSameSession = true;
            } else if (currentCodeStructure === 'dual-video' && existingDualCol0 && existingDualCol1) {
                isSameSession = true;
            } else if (currentCodeStructure === 'multi-3-video' && existingMultiLeft) {
                isSameSession = true;
            } else if (currentCodeStructure === 'multi-3' && existingMultiLeft) {
                isSameSession = true;
            } else if (currentCodeStructure === 'code-only' && existingSingleCenteredTarget) {
                isSameSession = true;
            }
        }

        this.lastCodeLayoutMode = currentCodeStructure;

        if (!isSameSession) {
            this.codeTypewriter.stop();
            if (this.codeContent) {
                this.codeContent.classList.remove('code-fade-swap');
                if (!this.pendingSharedElement) {
                    void this.codeContent.offsetWidth; // Force reflow
                    this.codeContent.classList.add('code-fade-swap');
                }
            }
        }

        if (isCodeCompare) {
            // Dual / Multi Code & Video Comparison Mode
            if (this.codeLeftPanel) {
                this.codeLeftPanel.classList.add('hidden');
            }
            if (this.codeRightPanel) {
                this.codeRightPanel.className = 'w-full max-w-[1720px] mx-auto flex flex-col justify-center';
            }

            const isLarge = (step.size === 'large' || step.size === 'xl' || step.size === 'big');
            const titleClass = isLarge ? 'code-compare-title-large' : 'code-compare-title';
            const subClass = isLarge ? 'code-compare-subtitle-large' : 'code-compare-subtitle';
            const sub = step.subtitle ? `<p class="${subClass}">${MarkdownHelper.parseInline(step.subtitle)}</p>` : '';
            const topHeaderContent = step.title ? `<h1 class="${titleClass}">${MarkdownHelper.parseInline(step.title)}</h1>${sub}` : '';
            const headerAnimClass = (this.pendingSharedElement && this.pendingSharedElement.direction === 'forward') ? '' : 'code-header-anim';
            const topHeader = topHeaderContent ? `
                <div id="code-header-container" class="mb-6 md:mb-8 text-center select-none ${headerAnimClass}">
                    ${topHeaderContent}
                </div>
            ` : '';

            if (step.codes.length >= 3 && hasVideo) {
                // 3-Column Complete Pipeline: Col 1 (JS), Col 2 (Stacked WGSL), Col 3 (Live Video Output)
                const gridEl = document.getElementById('code-compare-grid');
                const leftEl = document.getElementById('code-multi-col-left');
                const midTopEl = document.getElementById('code-multi-col-middle-0');
                const midBtmEl = document.getElementById('code-multi-col-middle-1');
                const rightEl = document.getElementById('code-multi-col-right');
                const headerEl = document.getElementById('code-header-container');

                if (isSameSession && leftEl && midTopEl && midBtmEl && rightEl) {
                    if (headerEl) {
                        headerEl.innerHTML = topHeaderContent;
                    }
                    if (step.codes[0]) this.renderCodeWindow(leftEl, step.codes[0], 'multi-left', false, 0);
                    if (step.codes[1]) this.renderCodeWindow(midTopEl, step.codes[1], 'multi-mid-0', true, 0);
                    if (step.codes[2]) this.renderCodeWindow(midBtmEl, step.codes[2], 'multi-mid-1', true, 0);
                    if (step.video) this.renderVideoWindow(rightEl, step.video, 'multi-video', false, 0);
                } else {
                    let gridHtml = `
                        ${topHeader}
                        <div id="code-compare-grid" class="relative grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10 xl:gap-12 w-full items-center">
                            <!-- Left Column: JavaScript / TSL File -->
                            <div id="code-multi-col-left" class="w-full"></div>
                            <!-- Middle Column: 2 Stacked WGSL Files (.vertex.wgsl & .fragment.wgsl) -->
                            <div class="w-full flex flex-col space-y-3 justify-center">
                                <div id="code-multi-col-middle-0" class="w-full"></div>
                                <div id="code-multi-col-middle-1" class="w-full"></div>
                            </div>
                            <!-- Right Column: Real-time Live Video Output Frame -->
                            <div id="code-multi-col-right" class="w-full"></div>
                        </div>
                    `;

                    this.codeContent.innerHTML = gridHtml;

                    const newLeftEl = document.getElementById('code-multi-col-left');
                    const newMidTopEl = document.getElementById('code-multi-col-middle-0');
                    const newMidBtmEl = document.getElementById('code-multi-col-middle-1');
                    const newRightEl = document.getElementById('code-multi-col-right');

                    if (newLeftEl && step.codes[0]) this.renderCodeWindow(newLeftEl, step.codes[0], 'multi-left', false, 40);
                    if (newMidTopEl && step.codes[1]) this.renderCodeWindow(newMidTopEl, step.codes[1], 'multi-mid-0', true, 120);
                    if (newMidBtmEl && step.codes[2]) this.renderCodeWindow(newMidBtmEl, step.codes[2], 'multi-mid-1', true, 200);
                    if (newRightEl && step.video) this.renderVideoWindow(newRightEl, step.video, 'multi-video', false, 280);
                }

                if (step.showEdge !== false && step.edge !== false) {
                    this.codeEdgeRenderer.render({
                        containerEl: gridEl || this.codeContent,
                        leftId: 'code-multi-col-left',
                        right0Id: 'code-multi-col-middle-0',
                        right1Id: 'code-multi-col-middle-1',
                        targetId: 'code-multi-col-right'
                    });
                } else {
                    this.codeEdgeRenderer.clear();
                }

            } else if (step.codes.length >= 3) {
                // Layout 1 on Left (JS), 2 Stacked on Right (.vertex.wgsl & .fragment.wgsl)
                const leftEl = document.getElementById('code-multi-col-left');
                const rightTopEl = document.getElementById('code-multi-col-right-0');
                const rightBottomEl = document.getElementById('code-multi-col-right-1');
                const headerEl = document.getElementById('code-header-container');

                if (isSameSession && leftEl && rightTopEl && rightBottomEl) {
                    if (headerEl) {
                        headerEl.innerHTML = topHeaderContent;
                    }
                    if (step.codes[0]) this.renderCodeWindow(leftEl, step.codes[0], 'multi-left', false, 0);
                    if (step.codes[1]) this.renderCodeWindow(rightTopEl, step.codes[1], 'multi-right-0', true, 0);
                    if (step.codes[2]) this.renderCodeWindow(rightBottomEl, step.codes[2], 'multi-right-1', true, 0);
                } else {
                    let gridHtml = `
                        ${topHeader}
                        <div id="code-compare-grid" class="relative grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-20 xl:gap-24 w-full items-center">
                            <!-- Left Column: JavaScript / TSL File -->
                            <div id="code-multi-col-left" class="w-full"></div>
                            <!-- Right Column: 2 Stacked WGSL Files (.vertex.wgsl & .fragment.wgsl) -->
                            <div class="w-full flex flex-col space-y-3 justify-center">
                                <div id="code-multi-col-right-0" class="w-full"></div>
                                <div id="code-multi-col-right-1" class="w-full"></div>
                            </div>
                        </div>
                    `;

                    this.codeContent.innerHTML = gridHtml;

                    const newLeftEl = document.getElementById('code-multi-col-left');
                    const newRightTopEl = document.getElementById('code-multi-col-right-0');
                    const newRightBottomEl = document.getElementById('code-multi-col-right-1');

                    if (newLeftEl && step.codes[0]) this.renderCodeWindow(newLeftEl, step.codes[0], 'multi-left', false, 40);
                    if (newRightTopEl && step.codes[1]) this.renderCodeWindow(newRightTopEl, step.codes[1], 'multi-right-0', true, 120);
                    if (newRightBottomEl && step.codes[2]) this.renderCodeWindow(newRightBottomEl, step.codes[2], 'multi-right-1', true, 200);
                }

                if (step.showEdge !== false && step.edge !== false) {
                    this.codeEdgeRenderer.render({
                        containerEl: document.getElementById('code-compare-grid') || this.codeContent,
                        leftId: 'code-multi-col-left',
                        right0Id: 'code-multi-col-right-0',
                        right1Id: 'code-multi-col-right-1'
                    });
                } else {
                    this.codeEdgeRenderer.clear();
                }

            } else if (hasVideo && (!step.codes || step.codes.length <= 1)) {
                // Side-by-Side Code + Video OR Smooth Centered Wide Video (when code is hidden / <code visible="false">)
                const isCodeHidden = (!step.codes || step.codes.length === 0);
                const isLarge = (step.size === 'large' || step.size === 'xl' || step.size === 'big');
                const gridEl = document.getElementById('code-compare-grid');
                const col0 = document.getElementById('code-dual-col-0');
                const col1 = document.getElementById('code-dual-col-1');
                const existingVideo = col1 ? col1.querySelector('video') : null;

                if (isSameSession && gridEl && col0 && col1 && existingVideo && (existingVideo.getAttribute('src') === (step.video.src || 'assets/fire.mp4') || (existingVideo.src && existingVideo.src.includes(step.video.src || 'assets/fire.mp4')))) {
                    const headerEl = document.getElementById('code-header-container');
                    if (headerEl) {
                        headerEl.innerHTML = topHeaderContent;
                    } else if (topHeaderContent && gridEl.parentNode) {
                        const newHeader = document.createElement('div');
                        newHeader.id = 'code-header-container';
                        newHeader.className = 'mb-6 md:mb-8 text-center select-none code-header-anim';
                        newHeader.innerHTML = topHeaderContent;
                        gridEl.parentNode.insertBefore(newHeader, gridEl);
                    }

                    // Seamless in-place transition: fade out code and expand video to center
                    if (isCodeHidden) {
                        gridEl.className = 'code-compare-flex-container code-compare-layout-centered mx-auto';
                        col0.className = 'code-col-base code-col-hidden';
                        col1.className = 'code-col-base code-col-centered-wide';
                        this.codeEdgeRenderer.clear();
                        this.updateVideoWindowTransform(col1, step.video);
                    } else {
                        gridEl.className = 'code-compare-flex-container code-compare-layout-split mx-auto';
                        col0.className = 'code-col-base code-col-split';
                        col1.className = 'code-col-base code-col-split';
                        if (step.codes && step.codes[0]) {
                            this.renderCodeWindow(col0, step.codes[0], 'dual-code', false, 0, isLarge);
                        }
                        const existingVideoTitleEl = col1.querySelector('.code-window-header span.truncate');
                        const currentVideoName = step.video ? (step.video.name || step.video.title || (step.video.file ? step.video.file.replace(/\.[^/.]+$/, '') : '') || 'Visual Output') : '';
                        const isSameVideoName = existingVideoTitleEl && existingVideoTitleEl.textContent.trim() === currentVideoName.trim();
                        if (isSameVideoName) {
                            this.updateVideoWindowTransform(col1, step.video);
                        } else if (step.video) {
                            this.renderVideoWindow(col1, step.video, 'dual-video', false, 0);
                        }
                        if (step.showEdge !== false && step.edge !== false) {
                            let edgeLabel = '';
                            if (step.edges && step.edges.size > 0) {
                                for (const ed of step.edges) {
                                    if (ed.includes('|')) {
                                        edgeLabel = ed.split('|')[1];
                                        break;
                                    }
                                }
                            }
                            this.codeEdgeRenderer.renderSingle({
                                containerEl: gridEl,
                                sourceId: 'code-dual-col-0',
                                targetId: 'code-dual-col-1',
                                label: edgeLabel
                            });
                        } else {
                            this.codeEdgeRenderer.clear();
                        }
                    }
                } else {
                    // Initial Build of Fluid Container
                    let gridHtml = `
                        ${topHeader}
                        <div id="code-compare-grid" class="code-compare-flex-container ${isCodeHidden ? 'code-compare-layout-centered' : 'code-compare-layout-split'} mx-auto">
                            <div id="code-dual-col-0" class="code-col-base ${isCodeHidden ? 'code-col-hidden' : 'code-col-split'}"></div>
                            <div id="code-dual-col-1" class="code-col-base ${isCodeHidden ? 'code-col-centered-wide' : 'code-col-split'}"></div>
                        </div>
                    `;

                    this.codeContent.innerHTML = gridHtml;

                    const newGridEl = document.getElementById('code-compare-grid');
                    const newCol0 = document.getElementById('code-dual-col-0');
                    const newCol1 = document.getElementById('code-dual-col-1');

                    if (!isCodeHidden && newCol0 && step.codes && step.codes[0]) {
                        this.renderCodeWindow(newCol0, step.codes[0], 'dual-code', false, 40, isLarge);
                    }
                    if (newCol1) {
                        this.renderVideoWindow(newCol1, step.video, 'dual-video', false, 140);
                    }

                    if (!isCodeHidden && step.showEdge !== false && step.edge !== false) {
                        let edgeLabel = '';
                        if (step.edges && step.edges.size > 0) {
                            for (const ed of step.edges) {
                                if (ed.includes('|')) {
                                    edgeLabel = ed.split('|')[1];
                                    break;
                                }
                            }
                        }
                        this.codeEdgeRenderer.renderSingle({
                            containerEl: newGridEl || this.codeContent,
                            sourceId: 'code-dual-col-0',
                            targetId: 'code-dual-col-1',
                            label: edgeLabel
                        });
                    } else {
                        this.codeEdgeRenderer.clear();
                    }
                }

            } else if (step.codes.length === 1 && !hasVideo) {
                // Single Centered Code with Top Header
                const isLarge = (step.size === 'large' || step.size === 'xl' || step.size === 'big');
                const colEl = document.getElementById('code-single-col');
                const headerEl = document.getElementById('code-header-container');

                if (isSameSession && colEl) {
                    if (headerEl) {
                        headerEl.innerHTML = topHeaderContent;
                    }
                    if (step.codes[0]) {
                        this.renderCodeWindow(colEl, step.codes[0], 'single-center', false, 0, isLarge);
                    }
                } else {
                    let gridHtml = `
                        ${topHeader}
                        <div id="code-compare-grid" class="relative w-full max-w-5xl xl:max-w-6xl mx-auto flex flex-col justify-center items-center">
                            <div id="code-single-col" class="w-full"></div>
                        </div>
                    `;

                    this.codeContent.innerHTML = gridHtml;

                    const newColEl = document.getElementById('code-single-col');
                    if (newColEl && step.codes[0]) {
                        this.renderCodeWindow(newColEl, step.codes[0], 'single-center', false, 40, isLarge);
                    }
                }
                this.codeEdgeRenderer.clear();

            } else {
                // Standard 1 vs 1 side by side (Comparison by default, no transpilation edge unless explicit)
                const isLarge = (step.size === 'large' || step.size === 'xl' || step.size === 'big');
                const col0 = document.getElementById('code-dual-col-0');
                const col1 = document.getElementById('code-dual-col-1');
                const headerEl = document.getElementById('code-header-container');
                const gridEl = document.getElementById('code-compare-grid');

                if (isSameSession && col0 && col1) {
                    if (headerEl) {
                        headerEl.innerHTML = topHeaderContent;
                    }
                    step.codes.slice(0, 2).forEach((codeItem, idx) => {
                        const colEl = document.getElementById(`code-dual-col-${idx}`);
                        if (colEl) {
                            this.renderCodeWindow(colEl, codeItem, `dual-${idx}`, false, 0, isLarge);
                        }
                    });
                } else {
                    let gridHtml = `
                        ${topHeader}
                        <div id="code-compare-grid" class="relative grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8 xl:gap-10 w-full items-center">
                            <div id="code-dual-col-0" class="w-full"></div>
                            <div id="code-dual-col-1" class="w-full"></div>
                        </div>
                    `;

                    this.codeContent.innerHTML = gridHtml;

                    step.codes.slice(0, 2).forEach((codeItem, idx) => {
                        const colEl = document.getElementById(`code-dual-col-${idx}`);
                        if (colEl) {
                            this.renderCodeWindow(colEl, codeItem, `dual-${idx}`, false, idx * 100, isLarge);
                        }
                    });
                }

                const shouldShowEdge = (step.showEdge === true || step.edge === true);
                if (shouldShowEdge) {
                    this.codeEdgeRenderer.renderSingle({
                        containerEl: gridEl || this.codeContent,
                        sourceId: 'code-dual-col-0',
                        targetId: 'code-dual-col-1'
                    });
                } else {
                    this.codeEdgeRenderer.clear();
                }
            }

        } else if (isCodeOnly) {
            this.codeEdgeRenderer.clear();
            const isLarge = (step.size === 'large' || step.size === 'xl' || step.size === 'big');
            // Full-width / Centered Stage
            if (this.codeLeftPanel) {
                this.codeLeftPanel.classList.add('hidden');
            }
            if (this.codeRightPanel) {
                this.codeRightPanel.className = 'w-full max-w-5xl xl:max-w-6xl mx-auto flex flex-col justify-center';
            }

            const titleClass = isLarge ? 'code-compare-title-large' : 'code-compare-title';
            const subClass = isLarge ? 'code-compare-subtitle-large' : 'code-compare-subtitle';
            const sub = step.subtitle ? `<p class="${subClass}">${MarkdownHelper.parseInline(step.subtitle)}</p>` : '';
            const topHeaderContent = step.title ? `<h1 class="${titleClass}">${MarkdownHelper.parseInline(step.title)}</h1>${sub}` : '';
            const headerAnimClass = (this.pendingSharedElement && this.pendingSharedElement.direction === 'forward') ? '' : 'code-header-anim';
            const topHeader = topHeaderContent ? `
                <div id="code-header-container" class="mb-6 md:mb-8 text-center select-none ${headerAnimClass}">
                    ${topHeaderContent}
                </div>
            ` : '';

            const target = document.getElementById('code-single-centered-target');
            const headerEl = document.getElementById('code-header-container');

            if (isSameSession && target) {
                if (headerEl) {
                    headerEl.innerHTML = topHeaderContent;
                }
                if (hasVideo) {
                    this.renderVideoWindow(target, step.video, 'video-single', false, 0);
                } else {
                    const codeItem = step.code || (step.codes && step.codes[0]) || { lang: 'javascript', file: 'shader.js', code: step.markdown || '', typewriter: false };
                    this.renderCodeWindow(target, codeItem, 'single', false, 0, isLarge);
                }
            } else {
                this.codeContent.innerHTML = `
                    ${topHeader}
                    <div id="code-single-centered-target" class="w-full"></div>
                `;
                const newTarget = document.getElementById('code-single-centered-target');
                if (hasVideo) {
                    this.renderVideoWindow(newTarget, step.video, 'video-single', false, 0);
                } else {
                    const codeItem = step.code || (step.codes && step.codes[0]) || { lang: 'javascript', file: 'shader.js', code: step.markdown || '', typewriter: false };
                    this.renderCodeWindow(newTarget, codeItem, 'single', false, 0, isLarge);
                }
            }

        } else {
            this.codeEdgeRenderer.clear();
            const hasCode = !!step.code || (step.codes && step.codes.length > 0) || hasVideo;
            const isLarge = (step.size === 'large' || step.size === 'xl' || step.size === 'big');

            // Split Stage vs Centered Stage
            if (this.codeLeftPanel) {
                this.codeLeftPanel.classList.remove('hidden');
                if (hasCode) {
                    this.codeLeftPanel.className = 'code-panel-base code-panel-split';
                } else {
                    this.codeLeftPanel.className = 'code-panel-base code-panel-centered';
                }
            }

            if (this.codeRightPanel) {
                if (hasCode) {
                    this.codeRightPanel.className = 'code-right-base code-right-visible';
                } else {
                    this.codeRightPanel.className = 'code-right-base code-right-hidden';
                    this.codeContent.innerHTML = '';
                }
            }

            const hadCode = this.lastHadCode === true;
            const isEnteringSplitFromCentered = (!hadCode && hasCode);
            this.lastHadCode = hasCode;

            if (this.codeHighlightTimeout) {
                clearTimeout(this.codeHighlightTimeout);
                this.codeHighlightTimeout = null;
            }
            if (this.codeRenderTimeout) {
                clearTimeout(this.codeRenderTimeout);
                this.codeRenderTimeout = null;
            }

            if (this.codeBadge) {
                if (step.badge) {
                    const rawColor = (step.badgeColor || 'cyan').toLowerCase();
                    const badgeClass = (rawColor === 'emerald' || rawColor === 'green')
                        ? 'stage-badge-pill stage-badge-pill-emerald'
                        : ((rawColor === 'purple' || rawColor === 'violet' || rawColor === 'indigo')
                            ? 'stage-badge-pill stage-badge-pill-purple'
                            : (rawColor === 'amber' ? 'stage-badge-pill stage-badge-pill-amber' : 'stage-badge-pill stage-badge-pill-cyan'));

                    this.codeBadge.innerHTML = `<span class="${badgeClass}">${step.badge}</span>`;
                    this.codeBadge.classList.remove('hidden');
                    this.codeBadge.classList.remove('stage-badge-enter');
                    void this.codeBadge.offsetWidth; // Force reflow
                    this.codeBadge.classList.add('stage-badge-enter');
                } else {
                    this.codeBadge.innerHTML = '';
                    this.codeBadge.classList.add('hidden');
                    this.codeBadge.classList.remove('stage-badge-enter');
                }
            }

            if (this.codeTitle && step.title) {
                if (this.codeTitle.innerText !== step.title) {
                    this.codeTitle.innerText = step.title;
                    if (!this.pendingSharedElement) {
                        this.codeTitle.classList.remove('text-swap-rise');
                        void this.codeTitle.offsetWidth;
                        this.codeTitle.classList.add('text-swap-rise');
                    } else {
                        this.codeTitle.classList.remove('text-swap-rise');
                    }
                }
            }

            if (this.codeSubtitle) {
                const sub = step.subtitle || '';
                if (sub) {
                    const parsedSub = MarkdownHelper.parseInline(sub);
                    if (this.codeSubtitle.innerHTML !== parsedSub) {
                        this.codeSubtitle.innerHTML = parsedSub;
                        this.codeSubtitle.classList.remove('hidden');
                        if (!this.pendingSharedElement) {
                            this.codeSubtitle.classList.remove('text-swap-rise');
                            void this.codeSubtitle.offsetWidth;
                            this.codeSubtitle.classList.add('text-swap-rise');
                        } else {
                            this.codeSubtitle.classList.remove('text-swap-rise');
                        }
                    } else {
                        this.codeSubtitle.classList.remove('hidden');
                    }
                } else {
                    this.codeSubtitle.classList.add('hidden');
                    this.codeSubtitle.innerHTML = '';
                }
            }

            if (this.codeDescription) {
                const hasExplicitItems = (step.items && step.items.length > 0);
                const hasActiveHighlight = hasExplicitItems && step.items.some(it => (typeof it === 'object' && (it.highlight || it.active)));
                const textKey = (step.introText || (hasExplicitItems ? '' : step.markdown) || '').trim();
                const itemsKey = hasExplicitItems ? step.items.map(it => (typeof it === 'object' ? it.text || it.title : it)).join('|') : '';
                const baseCodeStructureKey = `${step.title}::${step.subtitle}::${textKey}::${itemsKey}`;
                let detailText = step.activeDetail || (step.markdown && step.markdown.trim() !== (step.introText || '').trim() ? step.markdown : '');

                const updateHighlights = () => {
                    const itemRows = this.codeDescription.querySelectorAll('.feature-item-row');
                    itemRows.forEach((row, idx) => {
                        const item = step.items[idx];
                        const isObj = (typeof item === 'object' && item !== null);
                        const isHighlight = (step.activeItemIndex !== null && step.activeItemIndex !== undefined)
                            ? (idx === step.activeItemIndex)
                            : (isObj && (item.highlight || item.active));
                        row.className = `feature-item-row ${isHighlight ? 'feature-item-highlight' : (hasActiveHighlight ? 'feature-item-muted' : '')}`;
                    });

                    const detailEl = this.codeDescription.querySelector('.active-item-detail-text');
                    if (detailEl) {
                        if (detailText) {
                            detailEl.innerHTML = MarkdownHelper.parse(detailText);
                            detailEl.classList.remove('detail-text-swap');
                            void detailEl.offsetWidth;
                            detailEl.classList.add('detail-text-swap');
                        } else {
                            detailEl.innerHTML = '';
                        }
                    }
                };

                if (this.lastCodeContentKey === baseCodeStructureKey && hasExplicitItems) {
                    if (isEnteringSplitFromCentered) {
                        // Delay highlight strictly until slide transition completes (650ms)
                        this.codeHighlightTimeout = setTimeout(updateHighlights, 650);
                    } else {
                        updateHighlights();
                    }
                } else {
                    this.lastCodeContentKey = baseCodeStructureKey;

                    const introHtml = step.introText ? `<div class="step-intro-text text-slate-300 text-sm sm:text-base leading-relaxed mb-3">${MarkdownHelper.parse(step.introText)}</div>` : '';
                    const parsedBody = (hasExplicitItems || step.introText) ? '' : (step.markdown ? MarkdownHelper.parse(step.markdown) : '');

                    let featureItemsHtml = '';
                    if (hasExplicitItems) {
                        featureItemsHtml = `
                            <div class="feature-items-list">
                                ${step.items.map((item, idx) => {
                            const isObj = (typeof item === 'object' && item !== null);
                            const itemHighlight = isObj && (item.highlight || item.active);
                            const isHighlight = isEnteringSplitFromCentered ? false : ((step.activeItemIndex !== null && step.activeItemIndex !== undefined) ? (idx === step.activeItemIndex) : itemHighlight);
                            const itemText = isObj ? (item.title || item.text) : String(item);
                            const hlClass = isHighlight ? 'feature-item-highlight' : (hasActiveHighlight && !isEnteringSplitFromCentered ? 'feature-item-muted' : '');
                            return `
                                        <div class="feature-item-row ${hlClass}" style="animation-delay: ${0.08 + idx * 0.04}s;">
                                            <span class="feature-item-icon"></span>
                                            <div class="feature-item-text">${MarkdownHelper.parseInline(itemText)}</div>
                                        </div>
                                    `;
                        }).join('')}
                            </div>
                        `;
                    }

                    const detailHtml = hasExplicitItems ? `<div class="active-item-detail-text">${detailText && !isEnteringSplitFromCentered ? MarkdownHelper.parse(detailText) : ''}</div>` : '';

                    this.codeDescription.innerHTML = introHtml + parsedBody + featureItemsHtml + detailHtml;
                    this.codeDescription.classList.remove('text-swap-fall');
                    void this.codeDescription.offsetWidth;
                    this.codeDescription.classList.add('text-swap-fall');

                    if (isEnteringSplitFromCentered && hasExplicitItems) {
                        this.codeHighlightTimeout = setTimeout(updateHighlights, 650);
                    }
                }
            }

            if (hasCode) {
                const startCodeDisplay = () => {
                    if (this.codeRightPanel) {
                        this.codeRightPanel.className = 'code-right-base code-right-visible';
                    }
                    if (hasVideo) {
                        this.renderVideoWindow(this.codeContent, step.video, 'video-single', false, 0);
                    } else {
                        const codeItem = step.code || (step.codes && step.codes[0]) || { lang: 'javascript', file: 'shader.js', code: step.markdown || '', typewriter: false };
                        this.renderCodeWindow(this.codeContent, codeItem, 'single', false, 0, isLarge);
                    }
                };

                if (isEnteringSplitFromCentered) {
                    // Reveal code window and start typing shortly after the item highlight blooms (1080ms)
                    this.codeRightPanel.className = 'code-right-base code-right-hidden';
                    this.codeRenderTimeout = setTimeout(startCodeDisplay, 700);
                } else {
                    startCodeDisplay();
                }
            }
        }

        if (this.pendingSharedElement && this.pendingSharedElement.direction === 'forward') {
            const headerEl = document.getElementById('code-header-container');
            if (headerEl) {
                headerEl.classList.remove('code-header-anim');
                headerEl.style.opacity = '1';
                const newRect = headerEl.getBoundingClientRect();
                const deltaY = this.pendingSharedElement.sourceRect.top - newRect.top;
                const deltaX = (this.pendingSharedElement.sourceRect.left + this.pendingSharedElement.sourceRect.width / 2) - (newRect.left + newRect.width / 2);

                headerEl.animate([
                    { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)`, opacity: 1 },
                    { transform: 'translate3d(0, 0, 0)', opacity: 1 }
                ], {
                    duration: 850,
                    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    fill: 'none'
                });

                const gridEl = document.getElementById('code-compare-grid') || document.getElementById('code-single-centered-target');
                if (gridEl) {
                    gridEl.animate([
                        { opacity: 0, transform: 'translate3d(0, 24px, 0)' },
                        { opacity: 1, transform: 'translate3d(0, 0, 0)' }
                    ], {
                        duration: 700,
                        delay: 100,
                        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                        fill: 'both'
                    });
                }
            } else if (this.codeTitle && this.codeTitle.offsetHeight > 0) {
                this.codeTitle.classList.remove('text-swap-rise');
                this.codeTitle.style.opacity = '1';
                const newTitleRect = this.codeTitle.getBoundingClientRect();
                const deltaX = this.pendingSharedElement.sourceRect.left - newTitleRect.left;
                const deltaY = this.pendingSharedElement.sourceRect.top - newTitleRect.top;

                this.codeTitle.animate([
                    { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)`, opacity: 1 },
                    { transform: 'translate3d(0, 0, 0)', opacity: 1 }
                ], {
                    duration: 850,
                    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    fill: 'none'
                });

                if (this.pendingSharedElement.sourceSubRect && this.codeSubtitle && this.codeSubtitle.offsetHeight > 0) {
                    this.codeSubtitle.classList.remove('text-swap-rise');
                    this.codeSubtitle.style.opacity = '1';
                    const newSubRect = this.codeSubtitle.getBoundingClientRect();
                    const deltaSubX = this.pendingSharedElement.sourceSubRect.left - newSubRect.left;
                    const deltaSubY = this.pendingSharedElement.sourceSubRect.top - newSubRect.top;

                    this.codeSubtitle.animate([
                        { transform: `translate3d(${deltaSubX}px, ${deltaSubY}px, 0)`, opacity: 1 },
                        { transform: 'translate3d(0, 0, 0)', opacity: 1 }
                    ], {
                        duration: 850,
                        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                        fill: 'none'
                    });
                }

                if (this.codeRightPanel) {
                    this.codeRightPanel.animate([
                        { opacity: 0, transform: 'translate3d(0, 24px, 0)' },
                        { opacity: 1, transform: 'translate3d(0, 0, 0)' }
                    ], {
                        duration: 700,
                        delay: 100,
                        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                        fill: 'both'
                    });
                }
            }

            this.pendingSharedElement = null;
        }
    }

    parseZoom(val) {
        if (!val) return 1;
        val = String(val).trim();
        if (val.endsWith('%')) return parseFloat(val) / 100;
        if (val.toLowerCase().endsWith('x')) return parseFloat(val);
        const num = parseFloat(val);
        return !isNaN(num) && num > 0 ? num : 1;
    }

    parseOrigin(val) {
        if (!val) return 'center center';
        val = String(val).trim().toLowerCase().replace(/,/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ');
        const parts = val.split(' ');
        if (parts.length === 2) {
            const hasBottom = parts.includes('bottom');
            const hasTop = parts.includes('top');
            const hasLeft = parts.includes('left');
            const hasRight = parts.includes('right');
            const hasCenter = parts.includes('center');

            if (hasBottom && hasLeft) return 'left bottom';
            if (hasBottom && hasRight) return 'right bottom';
            if (hasTop && hasLeft) return 'left top';
            if (hasTop && hasRight) return 'right top';
            if (hasBottom && hasCenter) return 'center bottom';
            if (hasTop && hasCenter) return 'center top';
            if (hasLeft && hasCenter) return 'left center';
            if (hasRight && hasCenter) return 'right center';
        }
        if (val === 'bottom') return 'center bottom';
        if (val === 'top') return 'center top';
        if (val === 'left') return 'left center';
        if (val === 'right') return 'right center';
        if (val === 'center') return 'center center';
        return val;
    }

    parseDuration(val) {
        if (!val) return '1.4s';
        val = String(val).trim().toLowerCase();
        if (val === 'slow') return '2.2s';
        if (val === 'normal' || val === 'medium') return '1.4s';
        if (val === 'fast') return '0.8s';
        if (val.endsWith('s') || val.endsWith('ms')) return val;
        const num = parseFloat(val);
        return !isNaN(num) && num > 0 ? (num > 20 ? `${num}ms` : `${num}s`) : '1.4s';
    }

    updateVideoWindowTransform(containerEl, videoItem) {
        if (!containerEl || !videoItem) return;
        const videoEl = containerEl.querySelector('video');
        if (!videoEl) return;

        const zoomScale = this.parseZoom(videoItem.zoom || videoItem.scale || (videoItem.setting ? videoItem.setting.zoom : 1));
        const transformOrigin = this.parseOrigin(videoItem.origin || videoItem.transformOrigin || (videoItem.setting ? videoItem.setting.origin : 'center center'));
        const duration = this.parseDuration(videoItem.duration || videoItem.speed);

        videoEl.style.willChange = 'transform, transform-origin, object-position';
        videoEl.style.transition = `transform ${duration} cubic-bezier(0.22, 1, 0.36, 1), transform-origin ${duration} cubic-bezier(0.22, 1, 0.36, 1), object-position ${duration} cubic-bezier(0.22, 1, 0.36, 1)`;
        videoEl.style.transformOrigin = transformOrigin;
        videoEl.style.objectPosition = transformOrigin;
        videoEl.style.transform = `scale(${zoomScale})`;
    }

    renderVideoWindow(containerEl, videoItem, sessionId = 'default', isCompact = false, staggerDelay = 0) {
        const src = videoItem.src || 'assets/fire.mp4';
        const displayName = videoItem.name || videoItem.title || (videoItem.file ? videoItem.file.replace(/\.[^/.]+$/, '') : '') || 'Visual Output';
        const displayBadge = videoItem.badge ? String(videoItem.badge).trim() : 'Three.js';
        const isHighlighted = !!videoItem.highlight;
        const highlightClass = isHighlighted ? 'code-window-highlighted' : '';
        const headerPadding = isCompact ? 'px-3 py-1.5' : 'px-4 py-2.5';
        const frameMargin = isCompact ? 'my-0' : 'my-2';
        const animDelayStyle = staggerDelay > 0 ? `style="animation-delay: ${staggerDelay}ms;"` : '';

        // Calculate aspect ratio from width & height, or aspect/resolution attribute
        let aspectRatio = '16/10';
        if (videoItem.width && videoItem.height) {
            const w = parseFloat(videoItem.width);
            const h = parseFloat(videoItem.height);
            if (!isNaN(w) && !isNaN(h) && h > 0) {
                aspectRatio = `${w} / ${h}`;
            }
        } else if (videoItem.aspect) {
            const asp = String(videoItem.aspect).trim();
            if (asp.includes('x')) {
                const [w, h] = asp.split('x').map(parseFloat);
                if (!isNaN(w) && !isNaN(h) && h > 0) aspectRatio = `${w} / ${h}`;
            } else if (asp.includes(':')) {
                aspectRatio = asp.replace(':', ' / ');
            } else if (asp.includes('/')) {
                aspectRatio = asp;
            } else if (!isNaN(parseFloat(asp))) {
                aspectRatio = asp;
            }
        }

        const fitMode = (videoItem.fit || videoItem.objectFit || 'cover').toLowerCase();
        const objectFitClass = fitMode === 'contain' ? 'object-contain' : (fitMode === 'fill' ? 'object-fill' : 'object-cover');

        const isWebm = src.toLowerCase().endsWith('.webm');
        const mimeType = isWebm ? 'video/webm' : 'video/mp4';

        const zoomScale = this.parseZoom(videoItem.zoom || videoItem.scale || (videoItem.setting ? videoItem.setting.zoom : 1));
        const transformOrigin = this.parseOrigin(videoItem.origin || videoItem.transformOrigin || (videoItem.setting ? videoItem.setting.origin : 'center center'));
        const duration = this.parseDuration(videoItem.duration || videoItem.speed);

        // Only render icon if explicitly specified in video tag
        let iconHtml = '';
        if (videoItem.icon && String(videoItem.icon).trim() !== '') {
            const rawIcon = String(videoItem.icon).trim();
            if (rawIcon.startsWith('fa-') || rawIcon.includes('fa-') || rawIcon.startsWith('fab ') || rawIcon.startsWith('fas ') || rawIcon.startsWith('far ')) {
                const iconClass = rawIcon.includes(' ')
                    ? rawIcon
                    : (rawIcon.startsWith('fa-') ? `fa-solid ${rawIcon}` : `fa-solid fa-${rawIcon}`);
                iconHtml = `<i class="${iconClass} text-cyan-400 text-xs flex-shrink-0"></i>`;
            } else if (rawIcon.startsWith('<svg') || rawIcon.includes('<svg')) {
                iconHtml = rawIcon;
            } else {
                iconHtml = `<span class="font-mono font-bold text-xs text-cyan-400 leading-none">${rawIcon}</span>`;
            }
        }

        containerEl.innerHTML = `
            <div class="code-window-frame code-window-anim ${frameMargin} ${highlightClass} select-none overflow-hidden shadow-2xl" ${animDelayStyle}>
                <div class="code-window-header relative flex items-center justify-between ${headerPadding} select-none">
                    <!-- Left: Window Controls -->
                    <div class="flex items-center space-x-2 z-10">
                        <span class="w-2.5 h-2.5 rounded-full bg-[#ff5f56] inline-block shadow-sm"></span>
                        <span class="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] inline-block shadow-sm"></span>
                        <span class="w-2.5 h-2.5 rounded-full bg-[#27c93f] inline-block shadow-sm cursor-pointer hover:opacity-80 transition" title="Fullscreen (↑)" onclick="window.presentationApp?.videoFullscreenManager?.toggleFullscreen()"></span>
                    </div>

                    <!-- Center: Perfectly Centered Window Title across entire window width -->
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none px-14">
                        <div class="flex items-center justify-center space-x-2 font-mono text-xs font-semibold text-slate-200 tracking-wide pointer-events-auto max-w-[calc(100%-8rem)]">
                            ${iconHtml}
                            <span class="truncate">${displayName}</span>
                        </div>
                    </div>

                    <!-- Right: Badge / Status -->
                    <div class="flex items-center justify-end z-10">
                        <span class="px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/60 text-[10px] font-mono text-slate-400 font-medium">${displayBadge}</span>
                    </div>
                </div>
                <div class="relative w-full bg-slate-950 flex items-center justify-center overflow-hidden cursor-pointer" ondblclick="window.presentationApp?.videoFullscreenManager?.toggleFullscreen()" style="max-height: clamp(340px, 580px, 650px); min-height: 240px; aspect-ratio: ${aspectRatio};">
                    <video class="w-full h-full ${objectFitClass}" autoplay loop muted playsinline preload="auto" src="${src}" style="transform: scale(${zoomScale}); transform-origin: ${transformOrigin}; object-position: ${transformOrigin}; transition: transform ${duration} cubic-bezier(0.22, 1, 0.36, 1), transform-origin ${duration} cubic-bezier(0.22, 1, 0.36, 1), object-position ${duration} cubic-bezier(0.22, 1, 0.36, 1); will-change: transform, transform-origin, object-position;">
                        <source src="${src}" type="${mimeType}">
                    </video>
                    <div class="absolute inset-0 pointer-events-none bg-gradient-to-t from-slate-950/40 via-transparent to-transparent"></div>
                </div>
            </div>
        `;
    }

    renderCodeWindow(containerEl, codeItem, sessionId = 'default', isCompact = false, staggerDelay = 0, isLarge = false) {
        const lang = (codeItem.lang || 'javascript').toLowerCase();
        const filename = codeItem.file || (lang === 'javascript' ? 'shader.js' : (lang === 'wgsl' ? 'shader.wgsl' : `${lang}.code`));
        const displayBadge = lang === 'javascript' ? 'JavaScript' : lang.toUpperCase();
        const rawCode = codeItem.code || '';
        const isTypewriter = !!codeItem.typewriter;
        const isHighlighted = !!codeItem.highlight;
        const targetId = `code-target-${sessionId}`;
        const existingCodeSnippetEl = containerEl.querySelector(`#${targetId}`);
        const existingFrame = containerEl.querySelector('.code-window-frame');
        const existingFilenameEl = containerEl.querySelector('.code-window-header span.truncate');
        const isSameWindow = !!(existingCodeSnippetEl && existingFrame && (!existingFilenameEl || existingFilenameEl.textContent.trim() === filename.trim()));

        if (isSameWindow && existingCodeSnippetEl) {
            if (existingFrame) {
                existingFrame.classList.toggle('code-window-highlighted', isHighlighted);
            }

            const previousRawCode = existingCodeSnippetEl.getAttribute('data-raw-code') || '';
            const previousFocus = existingCodeSnippetEl.getAttribute('data-focus') || '';
            const currentFocus = codeItem.focus || '';

            existingCodeSnippetEl.setAttribute('data-raw-code', rawCode);
            existingCodeSnippetEl.setAttribute('data-focus', currentFocus);

            if (isTypewriter) {
                if (previousRawCode === rawCode) {
                    if (previousFocus !== currentFocus) {
                        const grammar = (window.Prism && window.Prism.languages[lang])
                            ? window.Prism.languages[lang]
                            : (window.Prism ? window.Prism.languages.javascript : null);
                        applyFocusTransition(existingCodeSnippetEl, rawCode, grammar, lang, currentFocus);
                    }
                    return;
                }
                this.codeTypewriter.morph({
                    id: sessionId,
                    codeEl: existingCodeSnippetEl,
                    fromCode: previousRawCode,
                    toCode: rawCode,
                    lang: lang,
                    speed: codeItem.speed || null,
                    focus: currentFocus || null,
                    decrement: !!codeItem.decrement,
                    incremental: !!codeItem.incremental
                });
            } else {
                this.codeTypewriter.stop(sessionId);
                const grammar = (window.Prism && window.Prism.languages[lang])
                    ? window.Prism.languages[lang]
                    : (window.Prism ? window.Prism.languages.javascript : null);
                applyFocusTransition(existingCodeSnippetEl, rawCode, grammar, lang, currentFocus || null);
            }
            return;
        }

        // Select correct SVG Icon (Tabler File-Type-JS SVG)
        let fileSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-amber-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M3 15h3v4.5a1.5 1.5 0 0 1 -3 0" />
                <path d="M9 20.25c0 .414 .336 .75 .75 .75h1.25a1 1 0 0 0 1 -1v-1a1 1 0 0 0 -1 -1h-1a1 1 0 0 1 -1 -1v-1a1 1 0 0 1 1 -1h1.25a.75 .75 0 0 1 .75 .75" />
                <path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2h-1" />
            </svg>
        `;

        if (filename.endsWith('.wgsl') || lang === 'wgsl') {
            fileSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-purple-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                    <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" />
                    <path d="M8 13h1v3h-1l0 -3" />
                    <path d="M12 13v3" />
                    <path d="M15 13h1v3h-1l0 -3" />
                </svg>
            `;
        } else if (filename.endsWith('.ts') || lang === 'ts' || lang === 'typescript') {
            fileSvg = `
                <svg class="w-4 h-4 rounded-[3px] flex-shrink-0 shadow-sm" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="24" height="24" rx="3" fill="#3178C6"/>
                    <path d="M14.5 10.8V8H22V10.8H19.6V19H16.9V10.8H14.5ZM8.6 10.5C9.4 10.5 10.1 10.8 10.6 11.3L12.3 9.7C11.3 8.6 9.9 8 8.4 8C5.2 8 3 10.2 3 13.5C3 16.8 5.2 19 8.4 19C9.9 19 11.3 18.4 12.3 17.3L10.6 15.7C10.1 16.2 9.4 16.5 8.6 16.5C6.9 16.5 5.6 15.2 5.6 13.5C5.6 11.8 6.9 10.5 8.6 10.5Z" fill="#FFFFFF"/>
                </svg>
            `;
        } else if (filename.endsWith('.glsl') || lang === 'glsl') {
            fileSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-sky-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5" />
                    <path d="M12 12l8 -4.5" />
                    <path d="M12 12l0 9" />
                    <path d="M12 12l-8 -4.5" />
                </svg>
            `;
        }

        const sizeClass = isLarge ? 'code-window-large' : '';
        const bodyClass = isCompact ? 'code-window-compact p-2.5' : (isLarge ? 'p-4' : 'p-3.5');
        const headerPadding = isCompact ? 'px-3 py-1.5' : (isLarge ? 'px-5 py-3' : 'px-4 py-2.5');
        const frameMargin = isCompact ? 'my-0' : 'my-2';
        const highlightClass = isHighlighted ? 'code-window-highlighted' : '';
        const animDelayStyle = staggerDelay > 0 ? `style="animation-delay: ${staggerDelay}ms;"` : '';

        containerEl.innerHTML = `
            <div class="code-window-frame code-window-anim ${sizeClass} ${frameMargin} ${highlightClass} select-text" ${animDelayStyle}>
                <div class="code-window-header relative flex items-center justify-between ${headerPadding} select-none">
                    <!-- Left: Window Controls -->
                    <div class="flex items-center space-x-2 z-10">
                        <span class="w-2.5 h-2.5 rounded-full bg-[#ff5f56] inline-block shadow-sm"></span>
                        <span class="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] inline-block shadow-sm"></span>
                        <span class="w-2.5 h-2.5 rounded-full bg-[#27c93f] inline-block shadow-sm"></span>
                    </div>

                    <!-- Center: Perfectly Centered Window Title across entire window width -->
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none px-14">
                        <div class="flex items-center justify-center space-x-2 font-mono text-xs font-semibold text-slate-200 tracking-wide pointer-events-auto max-w-[calc(100%-8rem)]">
                            ${fileSvg}
                            <span class="truncate">${filename}</span>
                        </div>
                    </div>

                    <!-- Right: Badge / Status -->
                    <div class="flex items-center justify-end z-10">
                        <span class="px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/60 text-[10px] font-mono text-slate-400 font-medium">${displayBadge}</span>
                    </div>
                </div>
                <div class="code-window-body ${bodyClass}">
                    <pre class="language-${lang}"><code id="${targetId}" class="language-${lang}"></code></pre>
                </div>
            </div>
        `;

        const codeSnippetEl = document.getElementById(targetId);
        if (codeSnippetEl) {
            codeSnippetEl.setAttribute('data-raw-code', rawCode);
            codeSnippetEl.setAttribute('data-focus', codeItem.focus || '');
        }
        if (isTypewriter && codeSnippetEl) {
            this.codeTypewriter.type({
                id: sessionId,
                codeEl: codeSnippetEl,
                rawCode: rawCode,
                lang: lang,
                speed: codeItem.speed || null,
                focus: codeItem.focus || null
            });
        } else if (codeSnippetEl) {
            const grammar = (window.Prism && window.Prism.languages[lang])
                ? window.Prism.languages[lang]
                : (window.Prism ? window.Prism.languages.javascript : null);

            codeSnippetEl.innerHTML = formatCodeWithFocus(rawCode, grammar, lang, codeItem.focus || null);
        }
    }

    renderNodesOnlyLayout(step, currentIndex) {
        this.showStage(this.splitStage, 'flex');
        this.lastSplitContentKey = null;
        this.lastCodeContentKey = null;
        this.lastCodeStageTitle = null;

        const hasTitle = Boolean(step.title && step.title.trim());

        if (this.cardWrapper) {
            this.cardWrapper.classList.remove('hidden');
            if (hasTitle) {
                this.cardWrapper.className = 'card-wrapper-base card-wrapper-top z-20';
                const titleHtml = `<h1 class="slide-title-standard text-center mb-1 text-white">${MarkdownHelper.parseInline(step.title)}</h1>`;
                const subtitleHtml = step.subtitle ? `<p class="slide-subtitle-standard text-center text-slate-400 font-normal">${MarkdownHelper.parseInline(step.subtitle)}</p>` : '';
                if (this.stepContent) {
                    this.stepContent.innerHTML = `
                        <div class="w-full flex flex-col items-center justify-center text-center">
                            ${titleHtml}
                            ${subtitleHtml}
                        </div>
                    `;
                }
            } else {
                this.cardWrapper.className = 'card-wrapper-base card-wrapper-collapsed z-20';
                if (this.stepContent) this.stepContent.innerHTML = '';
            }
        }

        if (this.canvasWrapper) {
            this.canvasWrapper.classList.remove('hidden');
            this.canvasWrapper.className = hasTitle
                ? 'canvas-wrapper-base canvas-wrapper-full canvas-wrapper-visible flex-1 w-full'
                : 'canvas-wrapper-base canvas-wrapper-full canvas-wrapper-visible';
        }
    }

    renderSplitLayout(step, currentIndex) {
        this.showStage(this.splitStage, 'flex');
        this.lastCodeContentKey = null;
        this.lastCodeStageTitle = null;

        const hasNodes = Boolean(step.nodes && step.nodes.size > 0);
        const hasCode = Boolean(step.code || (step.codes && step.codes.length > 0) || step.video);
        const hasVisual = hasNodes || hasCode;
        const isWide = (step.cardWidth === 'wide' || step.cardWidth === 'full' || step.cardWidth === 'large' || step.layout === 'wide' || step.layout === 'full');
        const isLarge = (step.size === 'large' || step.size === 'xl' || step.size === 'big' || step.layout === 'large' || step.size === 'huge');
        const hasExplicitItems = (step.items && step.items.length > 0);
        const hasActiveHighlight = hasExplicitItems && (step.activeItemIndex !== null && step.activeItemIndex !== undefined || step.items.some(it => (typeof it === 'object' && it.highlight)));
        const hasBullets = hasExplicitItems || !!(step.markdown && (step.markdown.includes('- ') || step.markdown.includes('* ') || step.markdown.includes('1. ') || step.markdown.includes('<li>') || step.markdown.includes('<ul>') || step.markdown.includes('<item')));

        const wasCentered = this.cardWrapper ? (this.cardWrapper.classList.contains('card-wrapper-centered') || this.cardWrapper.classList.contains('card-wrapper-wide')) : false;
        const isTransitioningFromCenter = wasCentered && hasVisual;

        const isTitleChanging = Boolean(
            (this.currentPresentationTitle && this.lastRenderedSplitTitle && this.currentPresentationTitle.trim() !== this.lastRenderedSplitTitle.trim()) ||
            (this.lastRenderedTitle && step.title && this.lastRenderedTitle.trim() !== step.title.trim()) ||
            (this.lastActiveStage && this.lastActiveStage !== this.splitStage)
        );

        if (this.repositionRaf) {
            cancelAnimationFrame(this.repositionRaf);
            this.repositionRaf = null;
        }

        if (this.cardWrapper) {
            this.cardWrapper.classList.remove('hidden');
            let baseClasses = 'card-wrapper-base z-20';

            if (isTitleChanging) {
                // Instantly move the div to its target position before transition, avoiding horizontal sliding
                this.cardWrapper.style.transition = 'none';
            }

            if (hasVisual) {
                this.cardWrapper.className = `${baseClasses} card-wrapper-split`;
            } else if (isWide) {
                this.cardWrapper.className = `${baseClasses} card-wrapper-wide`;
            } else {
                this.cardWrapper.className = `${baseClasses} card-wrapper-centered`;
            }

            if (isLarge) {
                this.cardWrapper.classList.add('step-card-large');
            } else {
                this.cardWrapper.classList.remove('step-card-large');
            }

            if (hasBullets || step.align === 'left') {
                this.cardWrapper.classList.add('step-card-has-bullets');
                this.cardWrapper.classList.remove('text-center');
            } else if (!hasVisual && !isWide) {
                this.cardWrapper.classList.remove('step-card-has-bullets');
                this.cardWrapper.classList.add('text-center');
            } else {
                this.cardWrapper.classList.add('step-card-has-bullets');
                this.cardWrapper.classList.remove('text-center');
            }

            if (isTitleChanging) {
                void this.cardWrapper.offsetWidth; // Force synchronous layout reflow at target position
            }
        }

        const splitCodeEl = document.getElementById('split-code-content');
        const canvasContainerEl = document.getElementById('canvas-container');

        if (this.canvasWrapper) {
            this.canvasWrapper.classList.remove('hidden');
            if (isTitleChanging) {
                this.canvasWrapper.style.transition = 'none';
            }
            if (hasVisual) {
                this.canvasWrapper.className = 'canvas-wrapper-base canvas-wrapper-visible';
            } else {
                this.canvasWrapper.className = 'canvas-wrapper-base canvas-wrapper-hidden';
            }
            if (isTitleChanging) {
                void this.canvasWrapper.offsetWidth;
            }
        }

        if (isTitleChanging) {
            this.repositionRaf = requestAnimationFrame(() => {
                if (this.cardWrapper) this.cardWrapper.style.removeProperty('transition');
                if (this.canvasWrapper) this.canvasWrapper.style.removeProperty('transition');
                this.repositionRaf = null;
            });
        }

        // Code Window or Nodes Canvas switching inside canvasWrapper
        if (hasCode) {
            if (canvasContainerEl) canvasContainerEl.classList.add('hidden');
            if (splitCodeEl) {
                splitCodeEl.classList.remove('hidden');
                const codeStaggerDelay = isTransitioningFromCenter ? 750 : 0;
                const isLarge = (step.size === 'large' || step.size === 'xl' || step.size === 'big');

                if (step.video) {
                    const currentSplitVideoKey = `${step.id || ''}::${step.video.id || ''}::${step.video.src || ''}::${step.video.name || ''}`;
                    if (this.lastSplitCodeKey !== currentSplitVideoKey || !splitCodeEl.querySelector('.code-window-frame')) {
                        this.lastSplitCodeKey = currentSplitVideoKey;
                        this.renderVideoWindow(splitCodeEl, step.video, 'split-video', false, codeStaggerDelay);
                    }
                } else {
                    const codeItem = step.code || (step.codes && step.codes[0]) || { lang: 'javascript', file: 'shader.js', code: step.markdown || '', typewriter: false };
                    const currentSplitCodeKey = `${step.id || ''}::${codeItem.file || ''}::${codeItem.code || ''}`;

                    if (this.lastSplitCodeKey !== currentSplitCodeKey || !splitCodeEl.querySelector('.code-window-frame')) {
                        this.lastSplitCodeKey = currentSplitCodeKey;
                        this.renderCodeWindow(splitCodeEl, codeItem, 'split-code', false, codeStaggerDelay, isLarge);
                    }
                }
            }
        } else if (hasNodes) {
            if (splitCodeEl) {
                splitCodeEl.classList.add('hidden');
                splitCodeEl.innerHTML = '';
            }
            if (canvasContainerEl) canvasContainerEl.classList.remove('hidden');
        } else {
            if (splitCodeEl) {
                splitCodeEl.classList.add('hidden');
                splitCodeEl.innerHTML = '';
            }
            if (canvasContainerEl) canvasContainerEl.classList.remove('hidden');
        }

        if (this.stepContent) {
            const textKey = (step.introText || (hasExplicitItems ? '' : step.markdown) || '').trim();
            const itemsKey = hasExplicitItems ? step.items.map(it => (typeof it === 'object' ? it.text || it.title : it)).join('|') : '';
            const qrcodeKey = step.qrcode ? `${step.qrcode.src}::${step.qrcode.url}::${step.qrcode.title}` : '';
            const baseStructureKey = `${step.title}::${step.subtitle}::${textKey}::${itemsKey}::${step.size}::${step.cardWidth}::${hasExplicitItems}::${hasVisual}::${qrcodeKey}`;
            const hasCodeOnRight = Boolean((step.codes && step.codes.length > 0) || step.code || step.video);
            const hasNodesOnRight = Boolean(step.nodes && step.nodes.size > 0);
            let detailText = step.activeDetail || (step.markdown && step.markdown.trim() !== (step.introText || '').trim() ? step.markdown : '');

            // If the step has visual content on the right (code window or node graph), do NOT render code in active-item-detail-text
            if (hasCodeOnRight || hasNodesOnRight) {
                if (detailText && (detailText.includes('```') || detailText.includes('<code') || detailText.includes('<pre') || detailText.trim() === (step.code?.code || '').trim())) {
                    detailText = '';
                }
            }

            const updateHighlights = () => {
                if (hasExplicitItems) {
                    const itemRows = this.stepContent.querySelectorAll('.feature-item-row');
                    itemRows.forEach((row, idx) => {
                        const item = step.items[idx];
                        const isObj = (typeof item === 'object' && item !== null);
                        const isHighlight = (step.activeItemIndex !== null && step.activeItemIndex !== undefined)
                            ? (idx === step.activeItemIndex)
                            : (isObj && (item.highlight || item.active));
                        row.className = `feature-item-row ${isHighlight ? 'feature-item-highlight' : (hasActiveHighlight ? 'feature-item-muted' : '')}`;
                    });

                    const detailEl = this.stepContent.querySelector('.active-item-detail-text');
                    if (detailEl) {
                        if (detailText) {
                            detailEl.innerHTML = MarkdownHelper.parse(detailText);
                            detailEl.classList.remove('detail-text-swap');
                            void detailEl.offsetWidth;
                            detailEl.classList.add('detail-text-swap');
                        } else {
                            detailEl.innerHTML = '';
                        }
                    }
                }
            };

            const existingItemsList = this.stepContent.querySelector('.feature-items-list');
            const isSameTitle = Boolean(this.lastRenderedTitle && step.title && this.lastRenderedTitle.trim() === step.title.trim());
            const isSameSubtitle = Boolean(this.lastRenderedSubtitle && step.subtitle && this.lastRenderedSubtitle.trim() === step.subtitle.trim());
            const isProgressiveItemsUpdate = isSameTitle && isSameSubtitle && hasExplicitItems && Boolean(existingItemsList) && !isTransitioningFromCenter;

            // If the base structure is identical, do not re-render DOM - just animate highlight
            if (this.lastSplitContentKey === baseStructureKey) {
                if (isTransitioningFromCenter) {
                    const t = setTimeout(() => {
                        updateHighlights();
                    }, 650);
                    this.standsTimeouts.push(t);
                } else {
                    updateHighlights();
                }
            } else if (isProgressiveItemsUpdate) {
                this.lastSplitContentKey = baseStructureKey;
                this.lastRenderedTitle = step.title || null;
                this.lastRenderedSplitTitle = step.title || null;
                this.lastRenderedSubtitle = step.subtitle || null;

                const h1El = this.stepContent.querySelector('h1');
                const subEl = this.stepContent.querySelector('.step-subtitle-split');
                if (h1El && !h1El.classList.contains('title-persistent')) {
                    h1El.classList.add('title-persistent');
                }
                if (subEl && !subEl.classList.contains('subtitle-persistent')) {
                    subEl.classList.add('subtitle-persistent');
                }

                // 1. First: capture current bounding rects for smooth FLIP layout transition
                const firstH1Rect = h1El ? h1El.getBoundingClientRect() : null;
                const firstSubRect = subEl ? subEl.getBoundingClientRect() : null;
                const existingRows = Array.from(existingItemsList.querySelectorAll('.feature-item-row'));
                const firstRowRects = existingRows.map(row => row.getBoundingClientRect());

                // 2. DOM update: update existing rows, append new items, update details
                step.items.forEach((item, idx) => {
                    const isObj = (typeof item === 'object' && item !== null);
                    const itemHighlight = isObj && (item.highlight || item.active);
                    const isHighlight = (step.activeItemIndex !== null && step.activeItemIndex !== undefined)
                        ? (idx === step.activeItemIndex)
                        : itemHighlight;
                    const itemText = isObj ? (item.title || item.text) : String(item);
                    const hlClass = isHighlight ? 'feature-item-highlight' : (hasActiveHighlight ? 'feature-item-muted' : '');

                    if (idx < existingRows.length) {
                        const row = existingRows[idx];
                        row.className = `feature-item-row ${hlClass}`;
                        row.classList.remove('feature-item-enter');
                        const textEl = row.querySelector('.feature-item-text');
                        if (textEl && textEl.innerHTML !== MarkdownHelper.parseInline(itemText)) {
                            textEl.innerHTML = MarkdownHelper.parseInline(itemText);
                        }
                    } else {
                        const newRow = document.createElement('div');
                        newRow.className = `feature-item-row ${hlClass} feature-item-enter`;
                        newRow.style.animationDelay = '0.04s';
                        newRow.innerHTML = `
                            <span class="feature-item-icon"></span>
                            <div class="feature-item-text">${MarkdownHelper.parseInline(itemText)}</div>
                        `;
                        existingItemsList.appendChild(newRow);
                    }
                });

                if (existingRows.length > step.items.length) {
                    for (let i = step.items.length; i < existingRows.length; i++) {
                        existingRows[i].remove();
                    }
                }

                let detailEl = this.stepContent.querySelector('.active-item-detail-text');
                if (!detailEl && detailText) {
                    detailEl = document.createElement('div');
                    detailEl.className = 'active-item-detail-text';
                    this.stepContent.appendChild(detailEl);
                }
                if (detailEl) {
                    if (detailText) {
                        detailEl.innerHTML = MarkdownHelper.parse(detailText);
                        detailEl.classList.remove('detail-text-swap');
                        void detailEl.offsetWidth;
                        detailEl.classList.add('detail-text-swap');
                    } else {
                        detailEl.innerHTML = '';
                    }
                }

                // 3. Last & Invert & Play: Smooth layout glide with FLIP via Web Animations API
                const elementsToGlide = [];
                if (h1El && firstH1Rect) {
                    const lastH1Rect = h1El.getBoundingClientRect();
                    const deltaY = firstH1Rect.top - lastH1Rect.top;
                    if (Math.abs(deltaY) > 0.5) {
                        elementsToGlide.push({ el: h1El, deltaY });
                    }
                }
                if (subEl && firstSubRect) {
                    const lastSubRect = subEl.getBoundingClientRect();
                    const deltaY = firstSubRect.top - lastSubRect.top;
                    if (Math.abs(deltaY) > 0.5) {
                        elementsToGlide.push({ el: subEl, deltaY });
                    }
                }
                existingRows.forEach((row, i) => {
                    if (i < step.items.length && firstRowRects[i]) {
                        const lastRowRect = row.getBoundingClientRect();
                        const deltaY = firstRowRects[i].top - lastRowRect.top;
                        if (Math.abs(deltaY) > 0.5) {
                            elementsToGlide.push({ el: row, deltaY });
                        }
                    }
                });

                elementsToGlide.forEach(({ el, deltaY }) => {
                    el.animate([
                        { transform: `translate3d(0, ${deltaY}px, 0)` },
                        { transform: 'translate3d(0, 0, 0)' }
                    ], {
                        duration: 850,
                        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                        fill: 'none'
                    });
                });
            } else {
                this.lastSplitContentKey = baseStructureKey;

                const isSameTitle = Boolean(this.lastRenderedTitle && step.title && this.lastRenderedTitle.trim() === step.title.trim());
                const isPersistentTitle = isSameTitle || isTransitioningFromCenter || Boolean(this.pendingSharedElement);
                this.lastRenderedTitle = step.title || null;
                this.lastRenderedSplitTitle = step.title || null;

                const isSameSubtitle = Boolean(this.lastRenderedSubtitle && step.subtitle && this.lastRenderedSubtitle.trim() === step.subtitle.trim());
                const isPersistentSubtitle = Boolean((isSameSubtitle || isTransitioningFromCenter || Boolean(this.pendingSharedElement)) && step.subtitle);
                this.lastRenderedSubtitle = step.subtitle || null;

                // Capture previous title & subtitle bounding rects before DOM update if staying under same title
                const prevH1 = this.stepContent.querySelector('h1');
                const prevSub = this.stepContent.querySelector('.step-subtitle-split, .slide-subtitle-standard');
                const firstH1Rect = (isSameTitle && prevH1) ? prevH1.getBoundingClientRect() : null;
                const firstSubRect = (isSameSubtitle && prevSub) ? prevSub.getBoundingClientRect() : null;

                const titleClass = isPersistentTitle ? 'title-persistent' : '';
                const subtitleClass = isPersistentSubtitle ? 'subtitle-persistent' : '';

                const titleHtml = step.title ? `<h1 class="${titleClass}">${MarkdownHelper.parseInline(step.title)}</h1>` : '';
                const subtitleHtml = step.subtitle ? `<p class="slide-subtitle-standard step-subtitle-split font-normal ${subtitleClass}">${MarkdownHelper.parseInline(step.subtitle)}</p>` : '';
                const introHtml = step.introText ? `<div class="step-intro-text text-slate-300 text-sm sm:text-base leading-relaxed mb-3">${MarkdownHelper.parse(step.introText)}</div>` : '';
                const parsedBody = (hasExplicitItems || step.introText) ? '' : (step.markdown ? MarkdownHelper.parse(step.markdown) : '');

                let featureItemsHtml = '';
                if (hasExplicitItems) {
                    featureItemsHtml = `
                        <div class="feature-items-list">
                            ${step.items.map((item, idx) => {
                        const isObj = (typeof item === 'object' && item !== null);
                        const itemHighlight = isObj && (item.highlight || item.active);
                        const isHighlight = isTransitioningFromCenter ? false : ((step.activeItemIndex !== null && step.activeItemIndex !== undefined) ? (idx === step.activeItemIndex) : itemHighlight);
                        const itemText = isObj ? (item.title || item.text) : String(item);
                        const hlClass = isHighlight ? 'feature-item-highlight' : (!isTransitioningFromCenter && hasActiveHighlight ? 'feature-item-muted' : '');
                        return `
                                    <div class="feature-item-row ${hlClass}" style="animation-delay: ${0.08 + idx * 0.04}s;">
                                        <span class="feature-item-icon"></span>
                                        <div class="feature-item-text">${MarkdownHelper.parseInline(itemText)}</div>
                                    </div>
                                `;
                    }).join('')}
                        </div>
                    `;
                }

                const detailHtml = hasExplicitItems ? `<div class="active-item-detail-text">${detailText ? MarkdownHelper.parse(detailText) : ''}</div>` : '';

                let qrcodeHtml = '';
                if (step.qrcode) {
                    const qrSrc = step.qrcode.src || 'assets/images/cyberpunk.png';
                    const qrUrl = step.qrcode.url || 'https://github.com/ektogamat/threejs-conference';
                    const displayUrl = qrUrl.replace(/^https?:\/\//, '');
                    const qrTitle = step.qrcode.title || 'Scan to Code Along';
                    const qrDesc = step.qrcode.description || 'Clone or open the repository to build shaders and follow the demo.';
                    qrcodeHtml = `
                        <div class="workshop-qrcode-card mt-6 p-4 sm:p-5 rounded-2xl bg-slate-900/85 border border-cyan-500/40 backdrop-blur-xl shadow-[0_0_35px_rgba(6,182,212,0.18)] flex flex-col sm:flex-row items-center gap-4 sm:gap-4.5 group hover:border-cyan-400/70 transition-all duration-500">
                            <div class="relative flex-shrink-0">
                                <div class="absolute -inset-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 opacity-40 blur-md group-hover:opacity-75 transition duration-500"></div>
                                <div class="relative p-2 bg-white rounded-xl shadow-lg flex items-center justify-center">
                                    <img src="${qrSrc}" alt="QR Code" class="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-md select-none" />
                                </div>
                            </div>
                            <div class="flex flex-col justify-center text-left space-y-2 flex-1 min-w-0">
                                <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[11px] font-semibold tracking-wider uppercase w-fit">
                                    <i class="fa-solid fa-qrcode text-xs"></i>
                                    <span>${qrTitle}</span>
                                </div>
                                ${qrUrl ? `
                                <a href="${qrUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-xs sm:text-[13px] font-mono text-cyan-300 hover:text-white transition-colors group/link">
                                    <i class="fa-brands fa-github text-sm text-white flex-shrink-0"></i>
                                    <span class="underline underline-offset-4 decoration-cyan-500/50 group-hover/link:decoration-cyan-300 font-semibold tracking-tight whitespace-nowrap">${displayUrl}</span>
                                    <i class="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-70 flex-shrink-0"></i>
                                </a>
                                ` : ''}
                                ${qrDesc ? `<p class="text-xs text-slate-300/90 leading-relaxed font-normal">${qrDesc}</p>` : ''}
                            </div>
                        </div>
                    `;
                }

                const bodyHtml = introHtml + parsedBody + featureItemsHtml + detailHtml + qrcodeHtml;

                const hasBodyContent = Boolean(bodyHtml && bodyHtml.trim() !== '');

                if (isTransitioningFromCenter) {
                    this.stepContent.innerHTML = titleHtml + subtitleHtml + (hasBodyContent ? `<div class="step-body-delayed opacity-0 transition-opacity duration-300"></div>` : '');
                    this.stepContent.classList.remove('step-content-anim');
                    void this.stepContent.offsetWidth;

                    const t = setTimeout(() => {
                        if (hasBodyContent) {
                            let bodyEl = this.stepContent.querySelector('.step-body-delayed');
                            if (!bodyEl) {
                                bodyEl = document.createElement('div');
                                bodyEl.className = 'step-body-delayed opacity-0 transition-opacity duration-300';
                                this.stepContent.appendChild(bodyEl);
                            }
                            bodyEl.innerHTML = bodyHtml;
                            bodyEl.classList.remove('opacity-0');
                            bodyEl.classList.add('step-content-anim');

                            // Stagger individual list items
                            const listItems = bodyEl.querySelectorAll('li');
                            listItems.forEach((li, idx) => {
                                li.style.animationDelay = `${0.12 + idx * 0.06}s`;
                            });
                        }
                        updateHighlights();
                    }, 650);
                    this.standsTimeouts.push(t);
                } else {
                    this.stepContent.innerHTML = titleHtml + subtitleHtml + bodyHtml;
                    if (!isSameTitle) {
                        this.stepContent.classList.remove('step-content-anim');
                        void this.stepContent.offsetWidth; // Force reflow
                        this.stepContent.classList.add('step-content-anim');
                    } else {
                        this.stepContent.classList.remove('step-content-anim');
                    }

                    // Stagger individual list items if regular markdown lists exist
                    const listItems = this.stepContent.querySelectorAll('li');
                    listItems.forEach((li, idx) => {
                        li.style.animationDelay = `${0.12 + idx * 0.06}s`;
                    });
                }

                // Smooth FLIP layout glide via Web Animations API for title & subtitle when content changes under the same title
                if (firstH1Rect) {
                    const newH1 = this.stepContent.querySelector('h1');
                    if (newH1) {
                        const lastH1Rect = newH1.getBoundingClientRect();
                        const deltaY = firstH1Rect.top - lastH1Rect.top;
                        if (Math.abs(deltaY) > 0.5) {
                            newH1.animate([
                                { transform: `translate3d(0, ${deltaY}px, 0)` },
                                { transform: 'translate3d(0, 0, 0)' }
                            ], {
                                duration: 850,
                                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                                fill: 'none'
                            });
                        }
                    }
                }

                if (firstSubRect) {
                    const newSub = this.stepContent.querySelector('.step-subtitle-split, .slide-subtitle-standard');
                    if (newSub) {
                        const lastSubRect = newSub.getBoundingClientRect();
                        const deltaY = firstSubRect.top - lastSubRect.top;
                        if (Math.abs(deltaY) > 0.5) {
                            newSub.animate([
                                { transform: `translate3d(0, ${deltaY}px, 0)` },
                                { transform: 'translate3d(0, 0, 0)' }
                            ], {
                                duration: 850,
                                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                                fill: 'none'
                            });
                        }
                    }
                }

                // If new body elements were added/changed under the same title, smoothly animate them in
                if (isSameTitle && isSameSubtitle && (firstH1Rect || firstSubRect)) {
                    const bodyElements = Array.from(this.stepContent.querySelectorAll('p:not(.step-subtitle-split), .step-intro-text, ul, li'));
                    bodyElements.forEach((el, idx) => {
                        el.animate([
                            { opacity: 0, transform: 'translate3d(0, 16px, 0)' },
                            { opacity: 1, transform: 'translate3d(0, 0, 0)' }
                        ], {
                            duration: 700,
                            delay: 60 + idx * 40,
                            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                            fill: 'both'
                        });
                    });
                }
            }
        }

        if (this.pendingSharedElement && this.pendingSharedElement.direction === 'forward') {
            const h1El = this.stepContent ? this.stepContent.querySelector('h1') : null;
            const subEl = this.stepContent ? this.stepContent.querySelector('.step-subtitle-split, .slide-subtitle-standard') : null;

            if (h1El) {
                h1El.classList.remove('text-swap-rise');
                h1El.style.opacity = '1';
                const newTitleRect = h1El.getBoundingClientRect();
                const deltaX = (this.pendingSharedElement.sourceRect.left + this.pendingSharedElement.sourceRect.width / 2) - (newTitleRect.left + newTitleRect.width / 2);
                const deltaY = this.pendingSharedElement.sourceRect.top - newTitleRect.top;

                h1El.animate([
                    { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)`, opacity: 1 },
                    { transform: 'translate3d(0, 0, 0)', opacity: 1 }
                ], {
                    duration: 850,
                    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    fill: 'none'
                });
            }

            if (subEl && this.pendingSharedElement.sourceSubRect) {
                subEl.classList.remove('text-swap-rise');
                subEl.style.opacity = '1';
                const newSubRect = subEl.getBoundingClientRect();
                const deltaSubX = (this.pendingSharedElement.sourceSubRect.left + this.pendingSharedElement.sourceSubRect.width / 2) - (newSubRect.left + newSubRect.width / 2);
                const deltaSubY = this.pendingSharedElement.sourceSubRect.top - newSubRect.top;

                subEl.animate([
                    { transform: `translate3d(${deltaSubX}px, ${deltaSubY}px, 0)`, opacity: 1 },
                    { transform: 'translate3d(0, 0, 0)', opacity: 1 }
                ], {
                    duration: 850,
                    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    fill: 'none'
                });
            }

            const itemsList = this.stepContent ? this.stepContent.querySelector('.feature-items-list') : null;
            const bodyText = this.stepContent ? this.stepContent.querySelector('.step-intro-text, .active-item-detail-text, .step-body-delayed') : null;
            const elementsToEnter = [itemsList, bodyText].filter(Boolean);
            elementsToEnter.forEach((el) => {
                el.animate([
                    { opacity: 0, transform: 'translate3d(0, 20px, 0)' },
                    { opacity: 1, transform: 'translate3d(0, 0, 0)' }
                ], {
                    duration: 700,
                    delay: 120,
                    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    fill: 'both'
                });
            });

            this.pendingSharedElement = null;
        }
    }
}
