import { MarkdownHelper } from '../utils/MarkdownHelper.js';

/**
 * Specialized 3D Perspective Gallery Renderer
 * Features a centralized horizon line with vanishing point aligned on the right stage,
 * support for expanded / enlarged cinematic video mode with choreographed text fade+blur,
 * video/image auto-play, and seamless GPU-accelerated 3D depth transitions.
 */
export class GalleryRenderer {
    constructor() {
        this.galleryStage = document.getElementById('gallery-stage');
        this.leftPanel = document.getElementById('gallery-left-panel') || (this.galleryStage ? this.galleryStage.querySelector(':scope > div:first-child') : null);
        this.badgeEl = document.getElementById('gallery-badge');
        this.titleEl = document.getElementById('gallery-title');
        this.subtitleEl = document.getElementById('gallery-subtitle');
        this.contentEl = document.getElementById('gallery-content');
        this.paginationEl = document.getElementById('gallery-pagination');
        this.viewport3d = document.getElementById('gallery-3d-viewport');
        this.stackContainer = document.getElementById('gallery-stack-container');

        this.lastGalleryId = null;
        this.lastActiveIndex = null;
        this.lastMarkdownText = null;
    }

    render(step, currentIndex, totalSteps) {
        if (!this.galleryStage || !step.gallery) return;

        const { items, activeIndex } = step.gallery;
        const totalItems = items.length;
        const safeActiveIndex = Math.max(0, Math.min(activeIndex, totalItems - 1));
        const activeItem = items[safeActiveIndex] || {};
        const isExpanded = !!step.expanded;

        const isSameGallery = (this.lastGalleryId === step.gallery.id && this.stackContainer && this.stackContainer.children.length === totalItems);
        this.lastGalleryId = step.gallery.id;
        this.lastActiveIndex = safeActiveIndex;

        // 1. Text Panel Fade + Blur Choreography (Positioned on the left side)
        // Stage 1: Text blurs and fades out first before video expansion
        if (this.leftPanel) {
            if (isExpanded) {
                this.leftPanel.style.transition = 'opacity 0.28s ease-out, filter 0.28s ease-out, transform 0.32s ease-out';
                this.leftPanel.style.opacity = '0';
                this.leftPanel.style.filter = 'blur(10px)';
                this.leftPanel.style.transform = 'translateY(-50%) translateX(-24px) scale(0.98)';
                this.leftPanel.style.pointerEvents = 'none';
            } else {
                // When returning from expanded: wait for video to retreat before smoothly fading text back in
                this.leftPanel.style.transition = 'opacity 0.45s ease-out 0.35s, filter 0.45s ease-out 0.35s, transform 0.45s ease-out 0.35s';
                this.leftPanel.style.opacity = '1';
                this.leftPanel.style.filter = 'blur(0px)';
                this.leftPanel.style.transform = 'translateY(-50%) translateX(0px) scale(1)';
                this.leftPanel.style.pointerEvents = 'auto';
            }
        }

        // Viewport 3D perspective and centering choreography (Synchronized with card transitions)
        if (this.viewport3d) {
            if (isSameGallery) {
                if (isExpanded) {
                    this.viewport3d.style.transition = 'perspective-origin 0.85s cubic-bezier(0.16, 1, 0.3, 1) 0.28s';
                    this.viewport3d.style.perspectiveOrigin = '50% 50%';
                } else {
                    this.viewport3d.style.transition = 'perspective-origin 0.70s cubic-bezier(0.16, 1, 0.3, 1) 0s';
                    this.viewport3d.style.perspectiveOrigin = '68% 50%';
                }
            } else {
                // Initial mount: set instantly without transition
                this.viewport3d.style.transition = 'none';
                this.viewport3d.style.perspectiveOrigin = isExpanded ? '50% 50%' : '68% 50%';
            }
        }

        // 2. Left Panel: Badge Pill
        if (this.badgeEl) {
            const badgeText = step.badge || activeItem.badge || '';
            if (badgeText) {
                const rawColor = (step.badgeColor || activeItem.badgeColor || 'cyan').toLowerCase();
                const badgeClass = (rawColor === 'emerald' || rawColor === 'green')
                    ? 'stage-badge-pill stage-badge-pill-emerald'
                    : ((rawColor === 'purple' || rawColor === 'violet' || rawColor === 'indigo')
                        ? 'stage-badge-pill stage-badge-pill-purple'
                        : (rawColor === 'amber' ? 'stage-badge-pill stage-badge-pill-amber' : 'stage-badge-pill stage-badge-pill-cyan'));

                this.badgeEl.innerHTML = `<span class="${badgeClass}">${badgeText}</span>`;
                this.badgeEl.classList.remove('hidden');
            } else {
                this.badgeEl.innerHTML = '';
                this.badgeEl.classList.add('hidden');
            }
        }

        // 3. Left Panel: Title
        if (this.titleEl) {
            const displayTitle = step.title || activeItem.title || 'Galeria 3D';
            if (this.titleEl.innerText !== displayTitle) {
                this.titleEl.innerText = displayTitle;
                this.titleEl.className = 'slide-title-standard mb-3 text-swap-rise drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]';
            }
        }

        // 3. Left Panel: Subtitle
        if (this.subtitleEl) {
            const displaySubtitle = step.subtitle || (activeItem.title !== step.title ? activeItem.title : '') || '';
            if (displaySubtitle) {
                this.subtitleEl.innerText = displaySubtitle;
                this.subtitleEl.style.display = 'block';
                this.subtitleEl.classList.remove('hidden');
            } else {
                this.subtitleEl.style.display = 'none';
                this.subtitleEl.classList.add('hidden');
            }
        }

        // 4. Left Panel: Markdown Content Body (Preserve text in DOM so it fades smoothly without disappearing)
        if (this.contentEl) {
            const markdownText = step.markdown || activeItem.desc || '';
            if (this.lastMarkdownText !== markdownText) {
                this.lastMarkdownText = markdownText;
                if (markdownText.trim()) {
                    const parsedBody = MarkdownHelper.parse(markdownText);
                    this.contentEl.innerHTML = parsedBody;
                    this.contentEl.classList.remove('text-swap-fall');
                    void this.contentEl.offsetWidth; // Force reflow
                    this.contentEl.classList.add('text-swap-fall');
                    this.contentEl.style.display = 'block';
                } else {
                    this.contentEl.innerHTML = '';
                    this.contentEl.style.display = 'none';
                }
            }
        }

        // 5. Left Panel: Pagination Indicator (Dots + Index)
        if (this.paginationEl) {
            let dotsHtml = '<div class="flex items-center space-x-2">';
            items.forEach((_, idx) => {
                const isDotActive = idx === safeActiveIndex;
                dotsHtml += `
                    <div class="h-1.5 rounded-full transition-all duration-500 ${isDotActive ? 'w-8 bg-cyan-400 shadow-lg shadow-cyan-500/50' : 'w-2 bg-slate-700'}"></div>
                `;
            });
            dotsHtml += `</div><span class="text-xs font-mono text-slate-300 ml-4 font-semibold drop-shadow">${String(safeActiveIndex + 1).padStart(2, '0')} / ${String(totalItems).padStart(2, '0')}</span>`;
            this.paginationEl.innerHTML = dotsHtml;
        }

        // 6. Right Panel: Build or Update 3D Perspective Card Stack
        if (!isSameGallery) {
            this.build3DStack(items, safeActiveIndex, isExpanded);
        } else {
            this.update3DStack(items, safeActiveIndex, isExpanded);
        }
    }

    build3DStack(items, activeIndex, isExpanded) {
        if (!this.stackContainer) return;
        this.stackContainer.innerHTML = '';

        items.forEach((item, idx) => {
            const card = document.createElement('div');
            card.id = `gallery-card-${idx}`;
            card.className = 'gallery-3d-card absolute inset-0 rounded-xl overflow-hidden glass-card select-none cursor-pointer';
            card.style.transformOrigin = 'center center';
            // Start with no transition during initial mount
            card.style.transition = 'none';

            let mediaMarkup = '';
            if (item.type === 'video') {
                mediaMarkup = `
                    <div class="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
                        <video id="gallery-video-${idx}" class="w-full h-full object-cover" loop muted playsinline preload="metadata">
                            <source src="${item.src}" type="video/mp4">
                        </video>
                        <!-- Soft gradient underlay protecting text readability while bleeding through on the left -->
                        <div class="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/20 to-transparent pointer-events-none"></div>
                        <div class="absolute bottom-5 left-8 right-8 flex items-center justify-between pointer-events-none">
                            <span class="text-xs text-white/90 font-medium drop-shadow-md">${item.title || ''}</span>
                        </div>
                    </div>
                `;
            } else {
                mediaMarkup = `
                    <div class="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
                        <img src="${item.src}" alt="${item.title || 'Galeria'}" class="w-full h-full object-cover" loading="lazy">
                        <!-- Soft gradient underlay protecting text readability while bleeding through on the left -->
                        <div class="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/20 to-transparent pointer-events-none"></div>
                        <div class="absolute bottom-5 left-8 right-8 flex items-center justify-between pointer-events-none">
                            <span class="text-xs text-white/90 font-medium drop-shadow-md">${item.title || ''}</span>
                        </div>
                    </div>
                `;
            }

            card.innerHTML = mediaMarkup;
            this.stackContainer.appendChild(card);
        });

        // Set initial resting transforms with no animation
        this.applyCardTransforms(items, activeIndex, isExpanded, true);

        // Force browser layout flush so the initial 3D positions are set synchronously
        void this.stackContainer.offsetWidth;
    }

    update3DStack(items, activeIndex, isExpanded) {
        this.applyCardTransforms(items, activeIndex, isExpanded, false);
    }

    applyCardTransforms(items, activeIndex, isExpanded, isInitial = false) {
        items.forEach((item, idx) => {
            const card = document.getElementById(`gallery-card-${idx}`);
            const video = document.getElementById(`gallery-video-${idx}`);
            if (!card) return;

            const offset = idx - activeIndex;

            // Virtualization / Culling: Hide cards far outside the active frustum (-1 <= offset <= 3)
            if (offset < -1 || offset > 3) {
                card.style.display = 'none';
                card.style.visibility = 'hidden';
                card.style.pointerEvents = 'none';
                if (video && !video.paused) {
                    video.pause();
                }
                return;
            } else {
                card.style.display = 'block';
                card.style.visibility = 'visible';
            }

            if (offset === 0) {
                if (isExpanded) {
                    // EXPANDED CINEMA MODE: Starts expanding forward AFTER the text has blurred out (0.28s delay, 0.85s duration)
                    card.style.transition = isInitial ? 'none' : 'transform 0.85s cubic-bezier(0.16, 1, 0.3, 1) 0.28s, box-shadow 0.85s cubic-bezier(0.16, 1, 0.3, 1) 0.28s, opacity 0.45s ease';
                    card.style.transform = 'translate3d(0px, 0px, 120px) rotateY(0deg) scale(1.18)';
                    card.style.opacity = '1';
                    card.style.zIndex = '40';
                    card.style.filter = 'blur(0px) brightness(1.1)';
                    card.style.boxShadow = '0 40px 100px -20px rgba(0, 0, 0, 0.98), 0 0 45px rgba(0, 170, 255, 0.55), 0 0 85px rgba(0, 136, 255, 0.30)';
                    card.style.borderColor = 'transparent';
                    card.style.pointerEvents = 'auto';
                } else {
                    // NORMAL PERSPECTIVE MODE: Moves back smoothly into normal stack position (0.70s duration)
                    card.style.transition = isInitial ? 'none' : 'transform 0.70s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.70s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease';
                    card.style.transform = 'translate3d(160px, 0px, 0px) rotateY(-18deg) scale(1)';
                    card.style.opacity = '1';
                    card.style.zIndex = '30';
                    card.style.filter = 'blur(0px) brightness(1.05)';
                    card.style.boxShadow = '0 30px 60px -15px rgba(0, 0, 0, 0.95), 0 0 32px rgba(0, 170, 255, 0.45), 0 0 65px rgba(0, 136, 255, 0.22)';
                    card.style.borderColor = 'transparent';
                    card.style.pointerEvents = 'auto';
                }

                if (video) {
                    if (video.paused) {
                        video.play().catch(() => {});
                    }
                }
            } else if (offset > 0) {
                // Upcoming Cards on Right Stage: Animate smoothly in depth
                const translateX = isExpanded ? (offset * 140 + 300) : (160 + offset * 110);
                const translateZ = isExpanded ? (-offset * 200) : (-offset * 135);
                const translateY = isExpanded ? 0 : (-offset * 8);
                const rotateY = isExpanded ? (-25 - offset * 5) : (-18 - offset * 4.5);
                const scale = Math.max(0.6, isExpanded ? (1 - offset * 0.1) : (1 - offset * 0.07));
                const opacity = isExpanded ? Math.max(0.1, 0.5 - offset * 0.18) : Math.max(0.28, 0.82 - offset * 0.16);
                const blurPx = Math.min(2, isExpanded ? (offset * 0.9) : (offset * 0.7));

                card.style.transition = isInitial ? 'none' : 'transform 0.68s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.68s ease, filter 0.68s ease, box-shadow 0.68s ease';
                card.style.transform = `translate3d(${translateX}px, ${translateY}px, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
                card.style.opacity = `${opacity}`;
                card.style.zIndex = `${30 - offset}`;
                card.style.filter = `blur(${blurPx}px) brightness(${Math.max(0.65, 0.94 - offset * 0.09)})`;
                card.style.boxShadow = `0 ${20 - offset * 3}px 40px -10px rgba(0, 0, 0, 0.9), 0 0 ${20 - offset * 3}px rgba(56, 189, 248, ${0.25 - offset * 0.05})`;
                card.style.borderColor = 'transparent';
                card.style.pointerEvents = 'auto';

                // Background upcoming card: PAUSE video for performance
                if (video && !video.paused) {
                    video.pause();
                }
            } else {
                // Passed Cards: Smoothly slide off to the left foreground
                const translateX = isExpanded ? (offset * 140 - 120) : (160 + offset * 130 - 60);
                const translateZ = offset * 110;
                const scale = 1 + offset * 0.1;

                card.style.transition = isInitial ? 'none' : 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease';
                card.style.transform = `translate3d(${translateX}px, 0px, ${translateZ}px) rotateY(15deg) scale(${scale})`;
                card.style.opacity = '0';
                card.style.zIndex = '5';
                card.style.filter = 'blur(4px)';
                card.style.pointerEvents = 'none';

                // Passed card: PAUSE video
                if (video && !video.paused) {
                    video.pause();
                }
            }
        });
    }

    pauseAllVideos() {
        if (!this.stackContainer) return;
        this.stackContainer.querySelectorAll('video').forEach(video => {
            if (!video.paused) {
                video.pause();
            }
        });
    }
}
