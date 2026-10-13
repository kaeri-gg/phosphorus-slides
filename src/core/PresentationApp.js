import { StepParser } from './StepParser.js';
import { NodeRenderer } from '../renderers/NodeRenderer.js';
import { EdgeRenderer } from '../renderers/EdgeRenderer.js';
import { ContentRenderer } from '../renderers/ContentRenderer.js';
import { EditorModal } from '../ui/EditorModal.js';
import { PresentationTimer } from '../ui/PresentationTimer.js';
import { VideoFullscreenManager } from '../ui/VideoFullscreenManager.js';
import { preloadAllFonts } from '../utils/FontPreloader.js';

export class PresentationApp {
    constructor() {
        this.steps = [];
        this.settings = {};
        this.currentIndex = 0;
        this.rawSource = '';

        // Initialize Specialized Renderers & UI Components
        this.nodeRenderer = new NodeRenderer();
        this.edgeRenderer = new EdgeRenderer();
        this.contentRenderer = new ContentRenderer();
        this.timer = new PresentationTimer();
        this.videoFullscreenManager = new VideoFullscreenManager();

        this.isInitialized = false;
        this.initPromise = null;

        // Initialize UI Components
        this.editorModal = new EditorModal({
            onApply: (newMarkdown) => {
                this.rawSource = newMarkdown;
                this.loadMarkdown(newMarkdown);
            },
            onReset: () => {
                this.loadAsync(this.currentFileUrl || `${import.meta.env.BASE_URL}conference.md`);
            }
        });

        // DOM Controls
        this.btnPrev = document.getElementById('btn-prev-step');
        this.btnNext = document.getElementById('btn-next-step');

        this.isInternalHashChange = false;
        this.targetResolution = null;

        this.setupKeyboardListeners();
        this.setupButtonListeners();
        this.setupHashListeners();

        // Responsive Viewport Scale Listener
        window.addEventListener('resize', () => {
            this.updateViewportScale();
        });
    }

    async init() {
        if (this.isInitialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            await preloadAllFonts();
            this.isInitialized = true;
        })();

        return this.initPromise;
    }

    async loadAsync(url = `${import.meta.env.BASE_URL}conference.md`) {
        this.currentFileUrl = url;
        if (!this.isInitialized) {
            await this.init();
        }

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            this.rawSource = await res.text();
            this.editorModal.setContent(this.rawSource);
            this.loadMarkdown(this.rawSource);
            return this.rawSource;
        } catch (err) {
            console.error(`Falha ao carregar ${url}:`, err);
            throw err;
        }
    }

    loadMarkdown(rawMarkdown) {
        this.nodeRenderer.clear();
        this.edgeRenderer.clear();
        const parsed = StepParser.parse(rawMarkdown);
        this.settings = parsed.settings || {};
        this.steps = parsed.steps || [];

        if (this.settings) {
            this.applySettings(this.settings);
        }

        const hashIndex = this.getStepIndexFromHash();
        const initialIndex = (hashIndex !== null && hashIndex >= 0 && hashIndex < this.steps.length) ? hashIndex : 0;
        this.goToStep(initialIndex, false);

        // Remove preload barrier cleanly once the initial step layout has painted
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.body.classList.remove('preload');
            });
        });
    }

    parseTimeToMs(val, defaultMs) {
        if (!val) return defaultMs;
        if (typeof val === 'number') return val;
        const str = String(val).trim();
        if (str.endsWith('ms')) {
            return parseFloat(str);
        }
        if (str.endsWith('s')) {
            return parseFloat(str) * 1000;
        }
        const num = parseFloat(str);
        return isNaN(num) ? defaultMs : num;
    }

    applySettings(settings) {
        const root = document.documentElement;
        
        // 1. Slide & Card Transitions
        if (settings.transition) {
            let val = settings.transition;
            if (!isNaN(val)) val = `${val}ms`;
            root.style.setProperty('--app-transition-duration', val);
        }

        // 2. Node Entry / Bloom Duration
        if (settings['node-animation'] || settings.nodeAnimation) {
            let val = settings['node-animation'] || settings.nodeAnimation;
            if (!isNaN(val)) val = `${val}ms`;
            root.style.setProperty('--node-bloom-duration', val);
        }

        // 3. Node Exit Duration
        if (settings['node-exit'] || settings.nodeExit) {
            let val = settings['node-exit'] || settings.nodeExit;
            if (!isNaN(val)) val = `${val}ms`;
            root.style.setProperty('--node-exit-duration', val);
        }

        // 4. Staggered Delay between Nodes
        if (settings['node-stagger'] || settings.nodeStagger || settings.stagger) {
            const val = settings['node-stagger'] || settings.nodeStagger || settings.stagger;
            const ms = this.parseTimeToMs(val, 70);
            this.nodeRenderer.setStaggerDelay(ms);
        }

        // 5. Edge Particle Pulse Speed
        if (settings['pulse-speed'] || settings.pulseSpeed || settings['pulse-duration']) {
            const val = settings['pulse-speed'] || settings.pulseSpeed || settings['pulse-duration'];
            const ms = this.parseTimeToMs(val, 2200);
            this.edgeRenderer.setPulseDuration(ms);
        }

        // 6. Edge Connection Growth Duration (<setting name="edge-animation" value="0.6s"></setting>)
        if (settings['edge-animation'] || settings.edgeAnimation || settings['edge-growth'] || settings.edgeGrowth || settings['line-animation'] || settings.lineAnimation) {
            const val = settings['edge-animation'] || settings.edgeAnimation || settings['edge-growth'] || settings.edgeGrowth || settings['line-animation'] || settings.lineAnimation;
            const ms = this.parseTimeToMs(val, 600);
            this.edgeRenderer.setGrowthDuration(ms);
        }

        // 7. Edge Connection Delay (<setting name="edge-delay" value="0.38s"></setting>)
        if (settings['edge-delay'] || settings.edgeDelay || settings['line-delay'] || settings.lineDelay) {
            const val = settings['edge-delay'] || settings.edgeDelay || settings['line-delay'] || settings.lineDelay;
            const ms = this.parseTimeToMs(val, 380);
            this.edgeRenderer.setStartDelay(ms);
        }

        // 8. Presentation Timer Duration (<setting name="timer" value="20m"></setting>)
        if (this.timer) {
            this.timer.configure(settings);
        }

        // 9. Target Presentation Resolution (Fit-to-Screen Zoom-In/Out)
        // e.g. <setting name="resolution" width="1920" height="1080"></setting>
        if (settings.resolution) {
            this.applyResolution(settings.resolution);
        } else {
            this.applyResolution(null);
        }

        // 10. Stage Max-Width & Horizontal Spreading
        // e.g. <setting name="stage-width" value="wide"></setting> (or "full", "1680px", "100%", "standard")
        const stageWidthSetting = settings['stage-width'] || settings.stageWidth || settings['max-width'] || settings.maxWidth || settings.spread || settings['stage-spread'];
        if (stageWidthSetting) {
            let val = String(stageWidthSetting).trim().toLowerCase();
            let stageMax = '1720px';
            let timelineMax = '1650px';

            if (val === 'full' || val === '100%') {
                stageMax = '100%';
                timelineMax = '100%';
            } else if (val === 'wide' || val === 'spread' || val === 'expanded' || val === 'ultra') {
                stageMax = '1820px';
                timelineMax = '1720px';
            } else if (val === 'standard' || val === 'medium' || val === '1280px') {
                stageMax = '1280px';
                timelineMax = '1152px';
            } else if (val === 'compact' || val === 'narrow') {
                stageMax = '1080px';
                timelineMax = '1000px';
            } else if (!isNaN(parseFloat(val))) {
                const px = parseFloat(val);
                stageMax = val.endsWith('%') ? val : `${px}px`;
                timelineMax = val.endsWith('%') ? val : `${Math.round(px * 0.94)}px`;
            }

            root.style.setProperty('--stage-max-width', stageMax);
            root.style.setProperty('--timeline-max-width', timelineMax);
        } else {
            root.style.setProperty('--stage-max-width', '1720px');
            root.style.setProperty('--timeline-max-width', '1650px');
        }
    }

    applyResolution(resolution) {
        this.targetResolution = resolution;
        this.updateViewportScale();
    }

    updateViewportScale() {
        const viewport = document.getElementById('presentation-viewport');
        if (!viewport) return;

        if (!this.targetResolution || !this.targetResolution.width || !this.targetResolution.height) {
            // Responsive Fluid Mode (Default 100vw/100vh)
            viewport.style.position = 'relative';
            viewport.style.left = '';
            viewport.style.top = '';
            viewport.style.width = '100%';
            viewport.style.height = '100%';
            viewport.style.minHeight = '100vh';
            viewport.style.transform = 'none';
            viewport.style.transformOrigin = '';
            return;
        }

        const targetW = this.targetResolution.width;
        const targetH = this.targetResolution.height;
        const mode = (this.targetResolution.fit || 'contain').toLowerCase();

        const windowW = window.innerWidth;
        const windowH = window.innerHeight;

        // Calculate fit scale factor
        let scale = 1;
        if (mode === 'width' || mode === 'fit-width' || mode === 'w') {
            scale = windowW / targetW;
        } else if (mode === 'height' || mode === 'fit-height' || mode === 'h') {
            scale = windowH / targetH;
        } else {
            // Default 'contain': uniform fit without vertical or horizontal cropping
            scale = Math.min(windowW / targetW, windowH / targetH);
        }

        viewport.style.position = 'absolute';
        viewport.style.left = '50%';
        viewport.style.top = '50%';
        viewport.style.width = `${targetW}px`;
        viewport.style.height = `${targetH}px`;
        viewport.style.minHeight = `${targetH}px`;
        viewport.style.transform = `translate(-50%, -50%) scale(${scale})`;
        viewport.style.transformOrigin = 'center center';

        // Re-align active nodes/groups and edges after scale change
        if (this.nodeRenderer) {
            this.nodeRenderer.realignGroups();
        }
        if (this.edgeRenderer) {
            this.edgeRenderer.updateFrame();
        }
    }

    goToStep(index, updateHistory = true) {
        if (!this.steps || index < 0 || index >= this.steps.length) return;

        if (this.videoFullscreenManager && this.videoFullscreenManager.isFullscreen) {
            this.videoFullscreenManager.exitFullscreen(true);
        }

        this.currentIndex = index;
        const currentStep = this.steps[this.currentIndex];
        if (!currentStep) return;

        const isCenterLayout = (currentStep.layout === 'center' || currentStep.layout === 'hero');
        const isProfileLayout = (currentStep.layout === 'profile');
        const isTimelineLayout = (currentStep.layout === 'timeline');
        const isGalleryLayout = (currentStep.layout === 'gallery');
        const isChartLayout = (currentStep.layout === 'chart' || currentStep.layout === 'graph' || currentStep.layout === 'line-chart');
        const isCodeLayout = (currentStep.layout === 'code' || currentStep.layout === 'code-only' || currentStep.layout === 'code-split' || currentStep.layout === 'code-compare');
        const isVideoLayout = (currentStep.layout === 'video' || currentStep.layout === 'video-expanded' || currentStep.layout === 'video-wide' || currentStep.layout === 'video-full');

        this.contentRenderer.render(currentStep, this.currentIndex, this.steps.length);

        const hasStepNodes = Boolean(currentStep.nodes && currentStep.nodes.size > 0);

        if (isCenterLayout || isProfileLayout || isTimelineLayout || isGalleryLayout || isChartLayout || isVideoLayout || !hasStepNodes) {
            this.nodeRenderer.clear();
            this.edgeRenderer.clear();
        } else {
            this.nodeRenderer.update(currentStep.nodes, currentStep.groups, currentStep.edges);
            this.edgeRenderer.sync(currentStep.nodes, currentStep.edges);
        }

        this.syncHashWithCurrentStep(updateHistory);
    }

    getStepIndexFromHash() {
        const rawHash = (window.location.hash || '').replace(/^#/, '').trim();
        if (!rawHash) return null;

        let target = rawHash;
        if (rawHash.includes('=')) {
            const params = new URLSearchParams(rawHash);
            target = params.get('page') || params.get('step') || params.get('p') || params.get('s') || rawHash.split('=')[1];
        }

        if (!target) return null;

        // 1. Número da página (1-indexed: #page=1, #page=2, #3, etc.)
        const pageNum = parseInt(target, 10);
        if (!isNaN(pageNum) && String(pageNum) === target) {
            const idx = pageNum - 1;
            if (this.steps && idx >= 0 && idx < this.steps.length) {
                return idx;
            }
        }

        // 2. ID do step (#profile, #intro, #timeline-start, #tsl-live-render)
        if (this.steps) {
            const stepIdx = this.steps.findIndex(s => s.id && s.id.toLowerCase() === target.toLowerCase());
            if (stepIdx !== -1) {
                return stepIdx;
            }
        }

        return null;
    }

    syncHashWithCurrentStep(updateHistory = true) {
        if (!this.steps || this.steps.length === 0) return;
        const pageNum = this.currentIndex + 1;
        const newHash = `#page=${pageNum}`;

        if (window.location.hash !== newHash) {
            this.isInternalHashChange = true;
            if (updateHistory) {
                history.pushState(null, '', newHash);
            } else {
                history.replaceState(null, '', newHash);
            }
            setTimeout(() => {
                this.isInternalHashChange = false;
            }, 60);
        }
    }

    setupHashListeners() {
        window.addEventListener('hashchange', () => {
            if (this.isInternalHashChange) return;
            const targetIdx = this.getStepIndexFromHash();
            if (targetIdx !== null && targetIdx !== this.currentIndex) {
                this.goToStep(targetIdx, false);
            }
        });

        window.addEventListener('popstate', () => {
            if (this.isInternalHashChange) return;
            const targetIdx = this.getStepIndexFromHash();
            if (targetIdx !== null && targetIdx !== this.currentIndex) {
                this.goToStep(targetIdx, false);
            }
        });
    }

    next() {
        if (this.contentRenderer && typeof this.contentRenderer.flushTypewriter === 'function') {
            if (this.contentRenderer.flushTypewriter()) {
                return;
            }
        }
        if (this.currentIndex < this.steps.length - 1) {
            this.goToStep(this.currentIndex + 1);
        }
    }

    prev() {
        if (this.currentIndex > 0) {
            this.goToStep(this.currentIndex - 1);
        }
    }

    setupKeyboardListeners() {
        window.addEventListener('keydown', (e) => {
            // Do not capture keys if the user is typing in the markdown editor modal
            if (this.editorModal && this.editorModal.isOpen()) {
                return;
            }

            // If a video is currently in fullscreen, ANY key press returns it to normal
            if (this.videoFullscreenManager && this.videoFullscreenManager.isFullscreen) {
                e.preventDefault();
                this.videoFullscreenManager.exitFullscreen();
                return;
            }

            if (e.key === 'ArrowUp') {
                if (this.videoFullscreenManager && this.videoFullscreenManager.canEnterFullscreen()) {
                    e.preventDefault();
                    this.videoFullscreenManager.enterFullscreen();
                    return;
                }
            }

            if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                this.next();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.prev();
            }
        });
    }

    setupButtonListeners() {
        if (this.btnPrev) {
            this.btnPrev.addEventListener('click', () => this.prev());
        }
        if (this.btnNext) {
            this.btnNext.addEventListener('click', () => this.next());
        }
    }
}
