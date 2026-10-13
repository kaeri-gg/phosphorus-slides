/**
 * VideoFullscreenManager
 * Handles smooth animated FLIP transitions to/from fullscreen for any video playing in the presentation.
 * Pressing ArrowUp expands the active video to full screen with a buttery-smooth transition.
 * Pressing any key returns it to normal in its original position with zero black flicker.
 */
export class VideoFullscreenManager {
    constructor() {
        this.activeVideo = null;
        this.placeholder = null;
        this.backdrop = null;
        this.container = null;
        this.closeBtn = null;
        this.audioBtn = null;
        this.overlayWrapper = null;
        this.isFullscreen = false;
        this.isTransitioning = false;
        this.originalStyles = {};
        this.hideControlsTimeout = null;

        this.setupElements();
    }

    setupElements() {
        // 1. Dimming backdrop attached directly to document.body
        this.backdrop = document.createElement('div');
        this.backdrop.id = 'video-fullscreen-backdrop';
        this.backdrop.className = 'video-fullscreen-backdrop';
        this.backdrop.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.96);
            z-index: 99998;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.50s cubic-bezier(0.16, 1, 0.3, 1);
        `;

        // 2. Video container attached directly to document.body (SIBLING of backdrop, NOT a child, so it never fades out when backdrop fades!)
        this.container = document.createElement('div');
        this.container.id = 'video-fullscreen-box';
        this.container.className = 'video-fullscreen-box';
        this.container.style.cssText = `
            position: fixed;
            z-index: 99999;
            background: #000;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            will-change: left, top, width, height, border-radius;
        `;

        // 3. Floating Close button in top-right
        this.closeBtn = document.createElement('button');
        this.closeBtn.className = 'video-fullscreen-close-btn';
        this.closeBtn.title = 'Exit fullscreen';
        this.closeBtn.innerHTML = `<i class="fa-solid fa-xmark text-sm"></i>`;
        this.closeBtn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 24px;
            z-index: 100002;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(15, 23, 42, 0.75);
            border: 1px solid rgba(148, 163, 184, 0.2);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            backdrop-filter: blur(8px);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease, background 0.2s ease, transform 0.2s ease;
        `;
        this.closeBtn.addEventListener('mouseenter', () => {
            this.closeBtn.style.background = 'rgba(30, 41, 59, 0.9)';
            this.closeBtn.style.transform = 'scale(1.08)';
        });
        this.closeBtn.addEventListener('mouseleave', () => {
            this.closeBtn.style.background = 'rgba(15, 23, 42, 0.75)';
            this.closeBtn.style.transform = 'scale(1)';
        });
        this.closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.exitFullscreen();
        });

        // 4. Floating Audio toggle button in top-right (next to close button)
        this.audioBtn = document.createElement('button');
        this.audioBtn.className = 'video-fullscreen-audio-btn';
        this.audioBtn.title = 'Toggle audio';
        this.audioBtn.innerHTML = `<i class="fa-solid fa-volume-high text-xs"></i>`;
        this.audioBtn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 68px;
            z-index: 100002;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(15, 23, 42, 0.75);
            border: 1px solid rgba(148, 163, 184, 0.2);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            backdrop-filter: blur(8px);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease, background 0.2s ease, transform 0.2s ease;
        `;
        this.audioBtn.addEventListener('mouseenter', () => {
            this.audioBtn.style.background = 'rgba(30, 41, 59, 0.9)';
            this.audioBtn.style.transform = 'scale(1.08)';
        });
        this.audioBtn.addEventListener('mouseleave', () => {
            this.audioBtn.style.background = 'rgba(15, 23, 42, 0.75)';
            this.audioBtn.style.transform = 'scale(1)';
        });
        this.audioBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.activeVideo) {
                this.activeVideo.muted = !this.activeVideo.muted;
                this.updateAudioButton();
                // If unmuted on click, ensure play
                if (!this.activeVideo.muted && this.activeVideo.paused) {
                    this.activeVideo.play().catch(() => {});
                }
            }
        });

        document.body.appendChild(this.backdrop);
        document.body.appendChild(this.container);
        document.body.appendChild(this.closeBtn);
        document.body.appendChild(this.audioBtn);

        // Click on backdrop exits fullscreen
        this.backdrop.addEventListener('click', (e) => {
            if (this.isFullscreen) {
                this.exitFullscreen();
            }
        });

        // Mousemove in fullscreen reveals controls
        window.addEventListener('mousemove', () => {
            if (this.isFullscreen) {
                this.showControlsTemporarily();
            }
        });
    }

    updateAudioButton() {
        if (!this.audioBtn) return;
        const isMuted = !this.activeVideo || this.activeVideo.muted;
        this.audioBtn.innerHTML = isMuted
            ? `<i class="fa-solid fa-volume-xmark text-xs"></i>`
            : `<i class="fa-solid fa-volume-high text-xs text-cyan-400"></i>`;
    }

    showControlsTemporarily() {
        this.closeBtn.style.opacity = '0.85';
        this.closeBtn.style.pointerEvents = 'auto';
        this.audioBtn.style.opacity = '0.85';
        this.audioBtn.style.pointerEvents = 'auto';
        if (this.hideControlsTimeout) clearTimeout(this.hideControlsTimeout);
        this.hideControlsTimeout = setTimeout(() => {
            if (this.isFullscreen) {
                this.closeBtn.style.opacity = '0';
                this.closeBtn.style.pointerEvents = 'none';
                this.audioBtn.style.opacity = '0';
                this.audioBtn.style.pointerEvents = 'none';
            }
        }, 2600);
    }

    toggleFullscreen() {
        if (this.isFullscreen) {
            this.exitFullscreen();
        } else if (this.canEnterFullscreen()) {
            this.enterFullscreen();
        }
    }

    canEnterFullscreen() {
        if (this.isFullscreen || this.isTransitioning) return false;
        return !!this.getActiveVideo();
    }

    hasActiveVideo() {
        return !!this.getActiveVideo();
    }

    getActiveVideo() {
        const activeStage = document.querySelector('main:not(.hidden)');
        if (!activeStage) return null;

        const videos = Array.from(activeStage.querySelectorAll('video:not(.bg-perspective-video):not(.bg-fullscreen-video), #video-expanded-player'));
        return videos.find(v => {
            const rect = v.getBoundingClientRect();
            return rect.width > 30 && rect.height > 30 &&
                window.getComputedStyle(v).display !== 'none' &&
                window.getComputedStyle(v).visibility !== 'hidden';
        }) || null;
    }

    enterFullscreen() {
        if (this.isFullscreen || this.isTransitioning) return;
        const video = this.getActiveVideo();
        if (!video) return;

        this.isTransitioning = true;
        this.isFullscreen = true;
        this.activeVideo = video;

        // 1. Get exact start geometry from the video container in the slide
        const parent = video.parentElement;
        const startRect = parent ? parent.getBoundingClientRect() : video.getBoundingClientRect();

        // 2. Create placeholder at original position (100% width/height so viewport scaling does not double-scale)
        this.placeholder = document.createElement('div');
        this.placeholder.className = 'video-fullscreen-placeholder';
        this.placeholder.style.cssText = `
            width: 100%;
            height: 100%;
            visibility: hidden;
            flex-shrink: 0;
            display: ${window.getComputedStyle(video).display || 'block'};
            border-radius: ${window.getComputedStyle(video).borderRadius || '0px'};
            overflow: hidden;
        `;
        video.parentElement.insertBefore(this.placeholder, video);

        // 3. Save original video styles and computed values
        const comp = window.getComputedStyle(video);
        const parentComp = parent ? window.getComputedStyle(parent) : comp;
        this.originalStyles = {
            width: video.style.width,
            height: video.style.height,
            maxWidth: video.style.maxWidth,
            maxHeight: video.style.maxHeight,
            objectFit: video.style.objectFit,
            computedObjectFit: comp.objectFit || 'cover',
            borderRadius: video.style.borderRadius,
            computedBorderRadius: parentComp.borderRadius || comp.borderRadius || '12px',
            transition: video.style.transition,
            transform: video.style.transform,
            transformOrigin: video.style.transformOrigin,
            objectPosition: video.style.objectPosition,
            muted: video.muted
        };

        // 4. Unmute the video for fullscreen viewing and ensure audio plays
        video.muted = false;
        if (video.paused && typeof video.play === 'function') {
            video.play().catch(() => {});
        }
        this.updateAudioButton();

        // 5. Move video into container in portal
        this.container.appendChild(video);
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.maxWidth = 'none';
        video.style.maxHeight = 'none';
        video.style.objectFit = 'contain';
        video.style.transform = 'none';

        // 5.1 Setup fullscreen QR code & link overlay if present on step (e.g. #workshop)
        this.setupFullscreenOverlays();

        // 6. Place container exactly over initial video bounds
        this.container.style.transition = 'none';
        this.container.style.opacity = '1';
        this.container.style.pointerEvents = 'auto';
        this.container.style.left = `${startRect.left}px`;
        this.container.style.top = `${startRect.top}px`;
        this.container.style.width = `${startRect.width}px`;
        this.container.style.height = `${startRect.height}px`;
        this.container.style.borderRadius = this.originalStyles.computedBorderRadius || '12px';
        this.container.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 200, 255, 0.15)';

        this.backdrop.style.pointerEvents = 'auto';
        this.backdrop.style.opacity = '1';

        // Force reflow
        void this.container.offsetWidth;

        // 7. Next frame: trigger smooth FLIP transition to full screen
        requestAnimationFrame(() => {
            const ease = 'cubic-bezier(0.16, 1, 0.3, 1)';
            const duration = '0.55s';
            this.container.style.transition = `left ${duration} ${ease}, top ${duration} ${ease}, width ${duration} ${ease}, height ${duration} ${ease}, border-radius ${duration} ${ease}, box-shadow ${duration} ${ease}`;
            this.container.style.left = '0px';
            this.container.style.top = '0px';
            this.container.style.width = '100vw';
            this.container.style.height = '100vh';
            this.container.style.borderRadius = '0px';
            this.container.style.boxShadow = 'none';

            setTimeout(() => {
                this.isTransitioning = false;
                this.showControlsTemporarily();
                if (this.overlayWrapper) {
                    this.overlayWrapper.style.opacity = '1';
                }
            }, 300);
        });
    }

    exitFullscreen(instant = false) {
        if (!this.isFullscreen && !this.activeVideo) return;
        if (this.isTransitioning && !instant) return;

        if (instant) {
            this.cleanupImmediate();
            return;
        }

        this.isTransitioning = true;
        this.closeBtn.style.opacity = '0';
        this.closeBtn.style.pointerEvents = 'none';
        if (this.audioBtn) {
            this.audioBtn.style.opacity = '0';
            this.audioBtn.style.pointerEvents = 'none';
        }
        if (this.overlayWrapper) {
            this.overlayWrapper.style.opacity = '0';
        }

        // 1. Target the exact parent container bounds (prevents double-scale viewport reduction!)
        let targetRect = null;
        if (this.placeholder && this.placeholder.parentElement) {
            targetRect = this.placeholder.parentElement.getBoundingClientRect();
        } else if (this.placeholder) {
            targetRect = this.placeholder.getBoundingClientRect();
        }

        if (!targetRect || targetRect.width === 0 || targetRect.height === 0) {
            this.cleanupImmediate();
            return;
        }

        // 2. Seamless Canvas snapshot in placeholder matching the original transform and crop
        if (this.placeholder && this.activeVideo) {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = this.activeVideo.videoWidth || 1280;
                canvas.height = this.activeVideo.videoHeight || 720;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(this.activeVideo, 0, 0, canvas.width, canvas.height);
                canvas.style.cssText = `
                    width: 100%;
                    height: 100%;
                    object-fit: ${this.originalStyles.computedObjectFit || 'cover'};
                    transform: ${this.originalStyles.transform || 'none'};
                    transform-origin: ${this.originalStyles.transformOrigin || 'center center'};
                    object-position: ${this.originalStyles.objectPosition || 'center center'};
                    display: block;
                `;
                this.placeholder.innerHTML = '';
                this.placeholder.appendChild(canvas);
                this.placeholder.style.visibility = 'visible';
            } catch (e) {
                // Ignore canvas security errors if any
            }
        }

        // 3. Smoothly restore video transform (zoomScale), origin, and object-fit during shrink
        const ease = 'cubic-bezier(0.16, 1, 0.3, 1)';
        const duration = '0.50s';
        if (this.activeVideo) {
            this.activeVideo.style.transition = `transform ${duration} ${ease}, transform-origin ${duration} ${ease}, object-position ${duration} ${ease}, object-fit ${duration} ${ease}`;
            this.activeVideo.style.transform = this.originalStyles.transform || '';
            this.activeVideo.style.transformOrigin = this.originalStyles.transformOrigin || '';
            this.activeVideo.style.objectPosition = this.originalStyles.objectPosition || '';
            this.activeVideo.style.objectFit = this.originalStyles.computedObjectFit || 'cover';
        }

        // 4. Animate container back to the exact original box size (NO OPACITY CHANGE, ZERO BLACK BLINK, NO ZOOM BREAK!)
        // Backdrop dims away smoothly to reveal slide
        this.backdrop.style.opacity = '0';
        this.backdrop.style.pointerEvents = 'none';

        // Container smoothly glides into exact targetRect size and border radius
        this.container.style.transition = `left ${duration} ${ease}, top ${duration} ${ease}, width ${duration} ${ease}, height ${duration} ${ease}, border-radius ${duration} ${ease}, box-shadow ${duration} ${ease}`;
        this.container.style.left = `${targetRect.left}px`;
        this.container.style.top = `${targetRect.top}px`;
        this.container.style.width = `${targetRect.width}px`;
        this.container.style.height = `${targetRect.height}px`;
        this.container.style.borderRadius = this.originalStyles.computedBorderRadius || '0px';
        this.container.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.8)';

        setTimeout(() => {
            this.cleanupImmediate();
        }, 510);
    }

    cleanupImmediate() {
        if (this.hideControlsTimeout) {
            clearTimeout(this.hideControlsTimeout);
            this.hideControlsTimeout = null;
        }

        if (this.activeVideo && this.placeholder && this.placeholder.parentElement) {
            // Restore video to original location in DOM
            this.placeholder.parentElement.insertBefore(this.activeVideo, this.placeholder);
            this.placeholder.remove();
            this.placeholder = null;

            // Restore original video styles and muted state
            this.activeVideo.style.width = this.originalStyles.width || '';
            this.activeVideo.style.height = this.originalStyles.height || '';
            this.activeVideo.style.maxWidth = this.originalStyles.maxWidth || '';
            this.activeVideo.style.maxHeight = this.originalStyles.maxHeight || '';
            this.activeVideo.style.objectFit = this.originalStyles.objectFit || '';
            this.activeVideo.style.borderRadius = this.originalStyles.borderRadius || '';
            this.activeVideo.style.transition = this.originalStyles.transition || '';
            this.activeVideo.style.transform = this.originalStyles.transform || '';
            this.activeVideo.style.transformOrigin = this.originalStyles.transformOrigin || '';
            this.activeVideo.style.objectPosition = this.originalStyles.objectPosition || '';

            if (this.originalStyles.muted !== undefined) {
                this.activeVideo.muted = this.originalStyles.muted;
            }

            // Sync slide mute button icon if present
            const muteIcon = document.getElementById('icon-video-mute');
            if (muteIcon) {
                muteIcon.className = this.activeVideo.muted
                    ? 'fa-solid fa-volume-xmark text-xs'
                    : 'fa-solid fa-volume-high text-xs';
            }
        } else if (this.placeholder) {
            this.placeholder.remove();
            this.placeholder = null;
        }

        if (this.overlayWrapper) {
            this.overlayWrapper.remove();
            this.overlayWrapper = null;
        }

        this.backdrop.style.pointerEvents = 'none';
        this.backdrop.style.opacity = '0';
        this.container.style.pointerEvents = 'none';
        this.container.style.opacity = '0';
        this.container.style.transition = 'none';
        this.container.innerHTML = '';
        this.closeBtn.style.opacity = '0';
        this.closeBtn.style.pointerEvents = 'none';
        if (this.audioBtn) {
            this.audioBtn.style.opacity = '0';
            this.audioBtn.style.pointerEvents = 'none';
        }

        this.activeVideo = null;
        this.isFullscreen = false;
        this.isTransitioning = false;
    }

    setupFullscreenOverlays() {
        if (this.overlayWrapper) {
            this.overlayWrapper.remove();
            this.overlayWrapper = null;
        }

        const currentStep = window.presentationApp?.steps?.[window.presentationApp?.currentIndex];
        
        // Never show on x.com post (workshop-community or workshop.mp4 video)
        if (currentStep?.id === 'workshop-community') return;
        const activeVideoSrc = this.activeVideo?.currentSrc || this.activeVideo?.src || '';
        if (activeVideoSrc.includes('workshop.mp4')) return;

        // Only show for the cyberpunk workshop video step
        const isWorkshop = currentStep?.id === 'workshop';
        const qrcodeData = currentStep?.qrcode;

        if (!isWorkshop && !qrcodeData) return;

        const qrSrc = qrcodeData?.src || 'assets/images/cyberpunk.png';
        const qrUrl = qrcodeData?.url || 'https://github.com/ektogamat/threejs-conference';
        const qrTitle = qrcodeData?.title || '';
        const qrDesc = qrcodeData?.description || qrcodeData?.desc || '';

        this.overlayWrapper = document.createElement('div');
        this.overlayWrapper.className = 'video-fullscreen-overlays';
        this.overlayWrapper.style.cssText = `
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 100001;
            opacity: 0;
            transition: opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1);
        `;

        this.overlayWrapper.innerHTML = `
            <!-- Left Overlay: GitHub Link (Fullscreen) -->
            <div class="workshop-overlay-link absolute bottom-6 left-6 z-20 flex flex-col items-start gap-1 sm:gap-2 p-3.5 sm:p-4.5 rounded-2xl bg-slate-950/85 border border-cyan-500/40 backdrop-blur-xl shadow-[0_0_35px_rgba(6,182,212,0.25)] hover:border-cyan-400/70 transition-all duration-300 pointer-events-auto max-w-[calc(100%-240px)] sm:max-w-2xl lg:max-w-3xl select-none">
                <a href="${qrUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2.5 text-base sm:text-lg md:text-xl font-mono font-bold text-cyan-300 hover:text-white transition-colors group/link break-all">
                    <i class="fa-brands fa-github text-lg sm:text-xl text-white flex-shrink-0"></i>
                    <span class="underline underline-offset-4 decoration-cyan-500/60 group-hover/link:decoration-cyan-300">${qrUrl}</span>
                    <i class="fa-solid fa-arrow-up-right-from-square text-xs sm:text-sm opacity-75 flex-shrink-0"></i>
                </a>
                ${qrDesc ? `<p class="text-xs sm:text-sm text-slate-300/90 leading-relaxed font-normal">${qrDesc}</p>` : ''}
            </div>

            <!-- Right Overlay: QR Code Fixed on Right (Fullscreen) -->
            <div class="workshop-overlay-qr absolute bottom-6 right-6 z-20 flex flex-col items-center p-3 sm:p-3.5 rounded-2xl bg-slate-950/85 border border-cyan-500/40 backdrop-blur-xl shadow-[0_0_35px_rgba(6,182,212,0.25)] hover:border-cyan-400/70 transition-all duration-300 pointer-events-auto select-none group/qr hover:scale-105">
                <div class="relative p-2 bg-white rounded-xl shadow-lg flex items-center justify-center">
                    <img src="${qrSrc}" alt="QR Code" class="w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 object-contain rounded-md select-none" />
                </div>
                ${qrTitle ? `
                <div class="mt-2 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
                    <i class="fa-solid fa-qrcode text-[10px]"></i>
                    <span>${qrTitle}</span>
                </div>
                ` : ''}
            </div>
        `;

        this.overlayWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        this.container.appendChild(this.overlayWrapper);
    }
}
