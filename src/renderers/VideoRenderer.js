import { MarkdownHelper } from '../utils/MarkdownHelper.js';

/**
 * VideoRenderer
 * Renderizador de palco para Vídeo em Tela Expandida (Cinema Mode):
 * - Descrição e cabeçalho na parte superior com suporte a efeito de máquina de escrever/stands.
 * - Cartão/Badge do autor integrado (perfil Jean Carlo Deconto / @sunag).
 * - Player de vídeo cinematográfico expandido com moldura de alta tecnologia, brilho ambiente e controles interativos.
 */
export class VideoRenderer {
    constructor() {
        this.stageEl = document.getElementById('video-stage');
        this.currentPlayer = null;
        this.lastStepId = null;
    }

    render(step, currentIndex, totalSteps) {
        if (!this.stageEl) return;

        const title = step.title || '';
        const subtitle = step.subtitle || '';
        const markdown = step.markdown || '';

        // Obter informações de perfil do autor (opcional)
        const profile = step.profile || null;
        let profileHtml = '';

        if (profile) {
            const githubUser = (profile.github || '').replace(/^@/, '');
            const nickname = (profile.nickname || '').replace(/^@/, '');
            profileHtml = `
                <!-- Right: Author Profile com Foto à Direita do Nome -->
                <div class="w-full md:w-auto flex items-center justify-end gap-4 sm:gap-5 flex-shrink-0 profile-badge-enter">
                    <!-- Detalhes do Autor (à esquerda da foto, alinhado à direita) -->
                    <div class="flex flex-col justify-center items-end text-right space-y-0.5">
                        <span class="text-sm sm:text-base font-bold text-white tracking-tight leading-tight">${profile.name || ''}</span>
                        
                        ${nickname ? `
                            <span class="text-xs sm:text-[13px] text-slate-300 font-medium leading-tight">${nickname}</span>
                        ` : ''}

                        ${githubUser ? `
                            <!-- GitHub Handle + Ícone -->
                            <div class="flex items-center justify-end gap-1.5">
                                <span class="text-xs sm:text-[13px] font-mono font-bold text-cyan-400">@${githubUser}</span>
                                <i class="fa-brands fa-github text-slate-300 text-xs sm:text-sm"></i>
                            </div>
                        ` : ''}

                        ${profile.role ? `
                            <span class="text-[11px] sm:text-xs text-slate-400 font-medium leading-tight max-w-[280px] text-right">${profile.role}</span>
                        ` : ''}
                    </div>

                    <!-- Avatar com Shimmer Gradient Border e Pulsing Aura Glow (à direita) -->
                    <div class="relative flex-shrink-0 flex items-center justify-center">
                        <div class="avatar-pulsing-glow"></div>
                        <div class="avatar-animated-border-wrapper w-16 h-16 sm:w-20 sm:h-20">
                            <div class="w-full h-full rounded-full overflow-hidden bg-slate-950 p-[2px]">
                                <img src="${profile.avatar || 'assets/me.jpg'}" alt="${profile.name || ''}" 
                                     class="w-full h-full object-cover rounded-full transition duration-700" 
                                     onerror="this.onerror=null; this.src='assets/me.jpg';" />
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        const buildDescriptionHtml = (s) => {
            if (s.items && s.items.length > 0) {
                return `
                    <div class="video-incremental-list space-y-1.5 mt-1 w-full">
                        ${s.items.map((item, idx) => {
                            const isObj = (typeof item === 'object' && item !== null);
                            const itemText = isObj ? (item.text || item.desc || item.title || '') : String(item);
                            const isHighlight = isObj ? item.highlight : false;
                            const isLatest = (idx === s.items.length - 1);
                            const animClass = isLatest ? 'video-item-new-enter' : '';
                            const isActive = isHighlight || isLatest;

                            if (isActive) {
                                return `
                                    <div class="video-item-row flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-cyan-500/40 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all duration-700 ease-out ${animClass}">
                                        <span class="text-cyan-400 font-mono text-sm font-bold flex-shrink-0 flex items-center drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]">
                                            <i class="fa-solid fa-chevron-right text-xs"></i>
                                        </span>
                                        <div class="flex-1 text-white font-medium text-xs sm:text-[13px] leading-snug drop-shadow-sm step-markdown">
                                            ${MarkdownHelper.parse(itemText)}
                                        </div>
                                    </div>
                                `;
                            }

                            return `
                                <div class="video-item-row flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-950/40 border border-slate-800/70 backdrop-blur-sm transition-all duration-700 ease-out opacity-60 hover:opacity-90">
                                    <span class="text-slate-500 font-mono text-sm font-medium flex-shrink-0 flex items-center">
                                        <i class="fa-solid fa-chevron-right text-xs"></i>
                                    </span>
                                    <div class="flex-1 text-slate-300 text-xs sm:text-[13px] leading-snug step-markdown">
                                        ${MarkdownHelper.parse(itemText)}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }
            let qrCardHtml = '';
            if (s.qrcode) {
                const qrSrc = s.qrcode.src || 'assets/images/cyberpunk.png';
                const qrUrl = s.qrcode.url || 'https://github.com/ektogamat/threejs-conference';
                const qrTitle = s.qrcode.title || 'Scan to Code Along';
                const qrDesc = s.qrcode.description || 'Clone or open the repository to build shaders and follow the demo.';
                qrCardHtml = `
                    <div class="workshop-qrcode-card mt-3 p-3 sm:p-3.5 rounded-xl bg-slate-900/85 border border-cyan-500/40 backdrop-blur-md shadow-[0_0_25px_rgba(6,182,212,0.15)] flex items-center gap-3.5 group hover:border-cyan-400/70 transition-all">
                        <div class="relative flex-shrink-0 p-1.5 bg-white rounded-lg shadow">
                            <img src="${qrSrc}" alt="QR Code" class="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded select-none" />
                        </div>
                        <div class="flex flex-col justify-center text-left space-y-1 flex-1 min-w-0">
                            <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-semibold uppercase w-fit">
                                <i class="fa-solid fa-qrcode text-[9px]"></i>
                                <span>${qrTitle}</span>
                            </div>
                            ${qrUrl ? `
                            <a href="${qrUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-300 hover:text-white transition-colors group/link break-all">
                                <i class="fa-brands fa-github text-xs text-white flex-shrink-0"></i>
                                <span class="underline underline-offset-4 decoration-cyan-500/50 group-hover/link:decoration-cyan-300 font-semibold">${qrUrl}</span>
                                <i class="fa-solid fa-arrow-up-right-from-square text-[9px] opacity-70 flex-shrink-0"></i>
                            </a>
                            ` : ''}
                            ${qrDesc ? `<p class="text-[11px] text-slate-300 leading-snug">${qrDesc}</p>` : ''}
                        </div>
                    </div>
                `;
            }

            if (s.markdown) {
                return `
                    <div class="step-markdown text-slate-300 text-xs sm:text-sm leading-relaxed text-left video-header-crossfade">
                        ${MarkdownHelper.parse(s.markdown)}
                        ${qrCardHtml}
                    </div>
                `;
            }
            return qrCardHtml;
        };

        const descHtml = buildDescriptionHtml(step);

        // Obter informações do vídeo ou imagem
        const rawMedia = step.video || (step.videos && step.videos.length > 0 ? step.videos[0] : null) || step.image || (step.images && step.images.length > 0 ? step.images[0] : null);
        let rawSrc = rawMedia ? (rawMedia.src || '') : '';
        const isImage = !!(
            step.image ||
            /\.(jpe?g|png|gif|webp|svg|avif)$/i.test(rawSrc) ||
            step.layout === 'image-expanded' ||
            step.layout === 'image'
        );

        if (isImage && rawSrc) {
            if (rawSrc.includes('workshop.jpg') || rawSrc === 'workshop.jpg') {
                rawSrc = 'assets/images/workshop.jpg';
            } else if (rawSrc.startsWith('images/')) {
                rawSrc = 'assets/' + rawSrc;
            } else if (!rawSrc.includes('/') && /\.(jpe?g|png|webp|svg|gif)$/i.test(rawSrc)) {
                rawSrc = 'assets/images/' + rawSrc;
            }
        }

        const video = rawMedia ? { ...rawMedia, src: rawSrc } : {
            src: 'assets/fire.mp4',
            name: 'GPU Simulation',
            badge: '● 60 FPS • 4K WEBGPU',
            type: 'compute'
        };

        const videoSrc = video.src || (isImage ? 'assets/images/workshop.jpg' : 'assets/fire.mp4');
        const videoTitle = video.name || video.title || video.alt || (video.file ? video.file.replace(/\.[^/.]+$/, '') : '') || (isImage ? 'Workshop' : 'GPU Simulation');
        const videoBadge = video.badge ? String(video.badge).trim() : (isImage ? '● PHOTO' : '');

        const formatDimension = (val, isHeight = false) => {
            if (!val) return null;
            val = String(val).trim();
            if (val === 'full') return '100%';
            if (val === 'auto') return 'auto';
            if (!isNaN(Number(val))) return `${val}px`;
            if (val.endsWith('%') && isHeight) {
                const pct = parseFloat(val);
                return `${Math.round(pct * 6.5)}px`;
            }
            return val;
        };

        const rawHeight = formatDimension(video.height, true);
        const rawWidth = formatDimension(video.width, false);
        const rawMaxHeight = formatDimension(video.maxHeight, true);
        const rawMaxWidth = formatDimension(video.maxWidth, false);

        const frameStyle = [
            rawHeight ? `height: ${rawHeight};` : '',
            rawMaxHeight ? `max-height: ${rawMaxHeight};` : '',
            rawWidth ? `width: ${rawWidth};` : '',
            rawMaxWidth ? `max-width: ${rawMaxWidth};` : '',
        ].filter(Boolean).join(' ');


        const parseCropPosition = (val) => {
            if (!val) return 'center center';
            val = String(val).trim().toLowerCase();
            if (val === 'top' || val === 'top-center' || val === 'center-top') return 'center top';
            if (val === 'bottom' || val === 'bottom-center' || val === 'center-bottom') return 'center bottom';
            if (val === 'left' || val === 'left-center' || val === 'center-left') return 'left center';
            if (val === 'right' || val === 'right-center' || val === 'center-right') return 'right center';
            if (val === 'top-left' || val === 'left-top') return 'left top';
            if (val === 'top-right' || val === 'right-top') return 'top right';
            if (val === 'bottom-left' || val === 'left-bottom') return 'left bottom';
            if (val === 'bottom-right' || val === 'right-bottom') return 'right bottom';
            if (val === 'center') return 'center center';
            return val;
        };

        const parseZoom = (val) => {
            if (!val) return 1;
            val = String(val).trim();
            if (val.endsWith('%')) return parseFloat(val) / 100;
            if (val.toLowerCase().endsWith('x')) return parseFloat(val);
            const num = parseFloat(val);
            return !isNaN(num) && num > 0 ? num : 1;
        };

        const parseOrigin = (val) => {
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
        };

        const parseDuration = (val) => {
            if (!val) return '1.4s';
            val = String(val).trim().toLowerCase();
            if (val === 'slow') return '2.2s';
            if (val === 'normal' || val === 'medium') return '1.4s';
            if (val === 'fast') return '0.8s';
            if (val.endsWith('s') || val.endsWith('ms')) return val;
            const num = parseFloat(val);
            return !isNaN(num) && num > 0 ? (num > 20 ? `${num}ms` : `${num}s`) : '1.4s';
        };

        const cropPosition = parseCropPosition(video.align || video.crop || video.position || video.objectPosition || 'center');
        const zoomScale = parseZoom(video.zoom || video.scale || 1);
        const transformOrigin = parseOrigin(video.origin || video.transformOrigin || 'center center');
        const duration = parseDuration(video.duration || video.speed);

        const hasDescOrItems = !!(step.items && step.items.length > 0) || !!step.markdown;
        const totalStages = Math.max(step.totalStages || 0, (step.items ? step.items.length : 0), (hasDescOrItems ? 3 : 0));
        // Reserva altura generosa com margem para comportar com folga os 3 itens
        const reservedItemsHeight = hasDescOrItems ? Math.max(142, totalStages * 46) : 0;
        const topSectionMinHeight = hasDescOrItems ? `min-height: ${reservedItemsHeight + 74}px;` : '';
        const descContainerHtml = hasDescOrItems ? `
            <div id="video-items-wrapper" class="w-full flex flex-col justify-start mt-2 mb-1" style="min-height: ${reservedItemsHeight}px;">
                ${descHtml}
            </div>
        ` : '';

        const containerSpacingClass = hasDescOrItems ? 'space-y-3 sm:space-y-3.5' : 'space-y-2.5 sm:space-y-3';

        // If video is already rendered and src is the same, only update text descriptions & badge
        const existingPlayer = document.getElementById('video-expanded-player');
        const expectedTag = isImage ? 'IMG' : 'VIDEO';
        if (existingPlayer && this.currentVideoSrc === videoSrc && existingPlayer.tagName === expectedTag) {
            const descWrapper = document.getElementById('video-items-wrapper');
            if (descWrapper) {
                descWrapper.innerHTML = descHtml;
            }

            existingPlayer.style.objectFit = video.fit || 'cover';
            existingPlayer.style.objectPosition = cropPosition;
            existingPlayer.style.willChange = 'transform, transform-origin';
            existingPlayer.style.transition = `transform ${duration} cubic-bezier(0.22, 1, 0.36, 1), transform-origin ${duration} cubic-bezier(0.22, 1, 0.36, 1)`;
            existingPlayer.style.transformOrigin = transformOrigin;
            existingPlayer.style.transform = `scale(${zoomScale})`;

            const titleEl = document.getElementById('video-window-title-text');
            if (titleEl) titleEl.textContent = videoTitle;
            const badgeEl = document.getElementById('video-window-badge-text');
            const badgeContainer = document.getElementById('video-window-badge-container');
            if (badgeEl) badgeEl.textContent = videoBadge;
            if (badgeContainer) badgeContainer.style.display = videoBadge ? 'flex' : 'none';

            this.lastStepId = step.id;
            return;
        }

        this.currentVideoSrc = videoSrc;
        this.lastStepId = step.id;

        // Prepare QR Code and Link Overlays if step has qrcode (only for cyberpunk workshop video, never for workshop-community / x.com post)
        let qrOverlayHtml = '';
        let linkOverlayHtml = '';
        if (step.qrcode && step.id !== 'workshop-community' && !videoSrc.includes('workshop.mp4')) {
            const qrSrc = step.qrcode.src || 'assets/images/cyberpunk.png';
            const qrUrl = step.qrcode.url || 'https://github.com/ektogamat/threejs-conference';
            const qrTitle = step.qrcode.title || '';
            const qrDesc = step.qrcode.description || step.qrcode.desc || '';

            qrOverlayHtml = `
                <!-- Right Overlay: QR Code Fixed on Right (Enxuto) -->
                <div class="workshop-overlay-qr absolute bottom-5 right-5 z-20 flex flex-col items-center p-2.5 sm:p-3 rounded-2xl bg-slate-950/85 border border-cyan-500/40 backdrop-blur-xl shadow-[0_0_35px_rgba(6,182,212,0.25)] hover:border-cyan-400/70 transition-all duration-300 pointer-events-auto select-none group/qr hover:scale-105">
                    <div class="relative p-1.5 bg-white rounded-xl shadow-lg flex items-center justify-center">
                        <img src="${qrSrc}" alt="QR Code" class="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 object-contain rounded-md select-none" />
                    </div>
                    ${qrTitle ? `
                    <div class="mt-2 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
                        <i class="fa-solid fa-qrcode text-[10px]"></i>
                        <span>${qrTitle}</span>
                    </div>
                    ` : ''}
                </div>
            `;

            linkOverlayHtml = `
                <!-- Left Overlay: GitHub Link (Enxuto) -->
                <div class="workshop-overlay-link absolute bottom-5 left-5 z-20 flex flex-col items-start gap-1 sm:gap-1.5 p-3 sm:p-4 rounded-2xl bg-slate-950/85 border border-cyan-500/40 backdrop-blur-xl shadow-[0_0_35px_rgba(6,182,212,0.25)] hover:border-cyan-400/70 transition-all duration-300 pointer-events-auto max-w-[calc(100%-200px)] sm:max-w-2xl lg:max-w-3xl">
                    <a href="${qrUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-sm sm:text-base md:text-lg lg:text-xl font-mono font-bold text-cyan-300 hover:text-white transition-colors group/link break-all">
                        <i class="fa-brands fa-github text-base sm:text-lg text-white flex-shrink-0"></i>
                        <span class="underline underline-offset-4 decoration-cyan-500/60 group-hover/link:decoration-cyan-300">${qrUrl}</span>
                        <i class="fa-solid fa-arrow-up-right-from-square text-xs opacity-75 flex-shrink-0"></i>
                    </a>
                    ${qrDesc ? `<p class="text-xs sm:text-[13px] text-slate-300/90 leading-relaxed font-normal">${qrDesc}</p>` : ''}
                </div>
            `;
        }

        const showWindow = (video.window !== false && step.window !== false && video.frameless !== true);
        const isVertical = (video.vertical === true || step.vertical === true);

        const isCleanVideo = !hasDescOrItems;
        const defaultFrameHeightClass = rawHeight ? '' : (
            isCleanVideo
                ? (isVertical
                    ? 'h-[calc(100vh-210px)] min-h-[560px] max-h-[760px] 2xl:max-h-[800px] w-full'
                    : 'h-[calc(100vh-220px)] min-h-[560px] max-h-[780px] 2xl:max-h-[820px] w-full'
                  )
                : 'h-[500px] max-h-[580px] w-full'
        );
        const containerWidthClass = isCleanVideo
            ? (isVertical ? 'w-full max-w-[680px] sm:max-w-[760px] md:max-w-[820px]' : 'w-full max-w-7xl 2xl:max-w-[1540px]')
            : 'w-full max-w-6xl';

        const outerStyle = [
            rawWidth ? `width: ${rawWidth};` : '',
            rawMaxWidth ? `max-width: ${rawMaxWidth};` : (rawWidth ? `max-width: ${rawWidth};` : '')
        ].filter(Boolean).join(' ');

        const frameBorderClass = showWindow
            ? 'border border-slate-700/70 bg-slate-950/90 backdrop-blur-2xl shadow-2xl'
            : 'border border-slate-800/60 bg-black/95 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_40px_rgba(6,182,212,0.15)]';
        const frameRoundedClass = isVertical ? 'rounded-3xl' : 'rounded-2xl';

        const isWebm = videoSrc.toLowerCase().endsWith('.webm');
        const mimeType = isWebm ? 'video/webm' : 'video/mp4';

        this.stageEl.innerHTML = `
            <div id="video-outer-container" class="${containerWidthClass} flex flex-col items-center justify-center chart-blur-enter ${containerSpacingClass} my-auto" style="${outerStyle}">
                
                <!-- 1. Top Section: Header & Description (Centered when no profile) -->
                <div id="video-top-section" class="w-full flex flex-col ${profile ? 'md:flex-row items-start justify-between' : 'items-center justify-center text-center'} gap-2 md:gap-4 select-none" style="${topSectionMinHeight}">
                    
                    <div class="w-full flex flex-col ${profile ? 'justify-start items-start text-left md:pr-4' : 'justify-center items-center text-center'}">
                        <h1 class="slide-title-standard video-stage-title ${profile ? 'text-left' : 'text-center'} mb-1">
                            ${title}
                        </h1>
                        ${subtitle ? `
                            <p class="slide-subtitle-standard video-stage-subtitle ${profile ? 'text-left' : 'text-center'} mb-1">
                                ${subtitle}
                            </p>
                        ` : ''}

                        ${descContainerHtml}
                    </div>

                    ${profileHtml}
                </div>

                <!-- 2. Expanded Video Cinema Display Container (Diretamente Rente ao Topo) -->
                <div class="w-full relative group pb-1 flex flex-col items-center">
                    
                    <!-- Ambient Backlight Glow com Falloff Suave -->
                    <div class="absolute -inset-3 bg-gradient-to-r from-cyan-500/25 via-sky-500/15 to-purple-500/25 ${isVertical ? 'rounded-[32px]' : 'rounded-3xl'} blur-2xl opacity-60 group-hover:opacity-90 transition-opacity duration-700 pointer-events-none"></div>

                    <!-- Main Cinema Video Window Frame -->
                    <div id="video-cinema-frame" class="relative w-full ${defaultFrameHeightClass} ${frameRoundedClass} overflow-hidden ${frameBorderClass} flex flex-col transition-all duration-500" style="${frameStyle}">
                        
                        ${showWindow ? `
                            <!-- Window Top Bar -->
                            <div class="h-9 px-4 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between select-none flex-shrink-0">
                                <!-- Window Control Dots -->
                                <div class="flex items-center space-x-2">
                                    <span class="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block border border-rose-600/40"></span>
                                    <span class="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block border border-amber-600/40"></span>
                                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block border border-emerald-600/40"></span>
                                </div>

                                <!-- Video Title in Monospace -->
                                <div class="flex items-center gap-2 text-xs font-mono font-semibold text-slate-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-cyan-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                        <path d="M19.03 17.818a3 3 0 0 0 1.97 -2.818v-8a3 3 0 0 0 -3 -3h-12a3 3 0 0 0 -3 3v8c0 1.317 .85 2.436 2.03 2.84" />
                                        <path d="M10 14a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
                                        <path d="M8 21a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2" />
                                    </svg>
                                    <span id="video-window-title-text">${videoTitle}</span>
                                </div>

                                <!-- Status Badge -->
                                <div id="video-window-badge-container" class="flex items-center gap-2" style="${videoBadge ? 'display: flex;' : 'display: none;'}">
                                    <span class="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1.5">
                                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                        <span id="video-window-badge-text">${videoBadge}</span>
                                    </span>
                                </div>
                            </div>
                        ` : ''}

                        <!-- Video / Image Screen Aspect Ratio -->
                        <div class="relative w-full flex-1 bg-black flex items-center justify-center overflow-hidden">
                            ${isImage ? `
                                <img id="video-expanded-player" src="${videoSrc}" alt="${videoTitle}" class="w-full h-full select-none" style="object-fit: ${video.fit || 'cover'}; object-position: ${cropPosition}; transform: scale(${zoomScale}); transform-origin: ${transformOrigin}; transition: transform ${duration} cubic-bezier(0.22, 1, 0.36, 1), transform-origin ${duration} cubic-bezier(0.22, 1, 0.36, 1); will-change: transform, transform-origin;" draggable="false" />
                            ` : `
                                <video id="video-expanded-player" class="w-full h-full" style="object-fit: ${video.fit || (isVertical ? 'cover' : 'cover')}; object-position: ${cropPosition}; transform: scale(${zoomScale}); transform-origin: ${transformOrigin}; transition: transform ${duration} cubic-bezier(0.22, 1, 0.36, 1), transform-origin ${duration} cubic-bezier(0.22, 1, 0.36, 1); will-change: transform, transform-origin;" autoplay loop muted playsinline preload="auto">
                                    <source src="${videoSrc}" type="${mimeType}">
                                </video>
                            `}

                            ${qrOverlayHtml}
                            ${linkOverlayHtml}

                            ${(step.qrcode || !showWindow) ? `
                                <!-- Top-right expand button -->
                                <button id="btn-video-fullscreen" class="absolute top-3 right-3 z-20 w-8 h-8 rounded-xl bg-slate-900/80 hover:bg-cyan-500/40 border border-slate-700/80 text-slate-300 hover:text-white flex items-center justify-center transition opacity-0 group-hover:opacity-100 shadow-lg pointer-events-auto" title="Fullscreen (or press ↑)">
                                    <i class="fa-solid fa-expand text-xs"></i>
                                </button>
                            ` : `
                                <!-- Hover Overlay Controls Bar -->
                                <div id="video-controls-overlay" class="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                                    <div class="flex items-center gap-3 pointer-events-auto">
                                        <button id="btn-video-play-toggle" class="w-8 h-8 rounded-xl bg-slate-900/80 hover:bg-cyan-500/30 border border-slate-700/80 text-white flex items-center justify-center transition">
                                            <i class="fa-solid fa-pause text-xs" id="icon-video-play"></i>
                                        </button>
                                        <button id="btn-video-mute-toggle" class="w-8 h-8 rounded-xl bg-slate-900/80 hover:bg-cyan-500/30 border border-slate-700/80 text-white flex items-center justify-center transition">
                                            <i class="fa-solid fa-volume-xmark text-xs" id="icon-video-mute"></i>
                                        </button>
                                        <span class="text-xs font-mono text-slate-300 font-medium">TSL WebGPU Live Buffer</span>
                                    </div>

                                    <button id="btn-video-fullscreen" class="w-8 h-8 rounded-xl bg-slate-900/80 hover:bg-cyan-500/30 border border-slate-700/80 text-white flex items-center justify-center transition pointer-events-auto">
                                        <i class="fa-solid fa-expand text-xs"></i>
                                    </button>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.initVideoControls();
    }

    initVideoControls() {
        const video = document.getElementById('video-expanded-player');
        if (!video) return;

        this.currentPlayer = video;

        // Iniciar reprodução com tratamento de promise se for vídeo
        if (typeof video.play === 'function') {
            video.play().catch(() => {});
        }

        const playBtn = document.getElementById('btn-video-play-toggle');
        const playIcon = document.getElementById('icon-video-play');
        const muteBtn = document.getElementById('btn-video-mute-toggle');
        const muteIcon = document.getElementById('icon-video-mute');
        const fullscreenBtn = document.getElementById('btn-video-fullscreen');

        if (playBtn && playIcon) {
            playBtn.onclick = () => {
                if (typeof video.play !== 'function') return;
                if (video.paused) {
                    video.play();
                    playIcon.className = 'fa-solid fa-pause text-xs';
                } else {
                    video.pause();
                    playIcon.className = 'fa-solid fa-play text-xs';
                }
            };
        }

        if (muteBtn && muteIcon) {
            muteBtn.onclick = () => {
                video.muted = !video.muted;
                muteIcon.className = video.muted ? 'fa-solid fa-volume-xmark text-xs' : 'fa-solid fa-volume-high text-xs';
            };
        }

        if (fullscreenBtn) {
            fullscreenBtn.onclick = () => {
                if (window.presentationApp && window.presentationApp.videoFullscreenManager && window.presentationApp.videoFullscreenManager.canEnterFullscreen()) {
                    window.presentationApp.videoFullscreenManager.enterFullscreen();
                } else if (video.requestFullscreen) {
                    video.requestFullscreen();
                } else if (video.webkitRequestFullscreen) {
                    video.webkitRequestFullscreen();
                }
            };
        }
    }

    pause() {
        if (this.currentPlayer && typeof this.currentPlayer.pause === 'function' && !this.currentPlayer.paused) {
            this.currentPlayer.pause();
        }
    }

    play() {
        if (this.currentPlayer && typeof this.currentPlayer.play === 'function' && this.currentPlayer.paused) {
            this.currentPlayer.play().catch(() => {});
        }
    }
}
