/**
 * CodeEdgeRenderer - Renders animated glowing compiler & render pipeline connections
 * between JavaScript (TSL) source code, compiled WGSL vertex/fragment outputs,
 * and live Real-time Video Render Outputs.
 * 
 * Features:
 * 1. Pixel-perfect attachment to window card borders (ports/sockets).
 * 2. Continuous real-time frame tracking (handles resize, scroll, typing height expansion).
 * 3. Animated dashed gradient connection paths (Cyan ➔ Purple ➔ Cyan).
 * 4. Pulsating data packet transmission orbs traveling along the compilation & execution paths.
 * 5. Supports both 1-to-1 (Source ➔ Target) and Multi-Stage (Source ➔ Dual Target ➔ Final Target) layouts.
 */
export class CodeEdgeRenderer {
    constructor() {
        this.active = false;
        this.mode = 'multi'; // 'multi' | 'single'
        this.animationFrameId = null;
        this.containerEl = null;
        this.leftId = null;
        this.right0Id = null;
        this.right1Id = null;
        this.targetId = null;
        this.sourceId = null;
        this.startTime = performance.now();
    }

    clear() {
        this.active = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        const existingSvg = document.getElementById('code-compiler-svg-overlay');
        if (existingSvg) existingSvg.remove();
    }

    renderSingle({ containerEl, sourceId, targetId }) {
        this.clear();
        if (!containerEl) return;

        this.mode = 'single';
        this.containerEl = containerEl;
        this.sourceId = sourceId;
        this.targetId = targetId;
        this.active = true;
        this.startTime = performance.now();

        if (!this.containerEl.classList.contains('relative')) {
            this.containerEl.classList.add('relative');
        }

        this.setupSingleSvg();
        this.startLoop();
    }

    render({ containerEl, leftId, right0Id, right1Id, targetId = null }) {
        this.clear();
        if (!containerEl) return;

        this.mode = 'multi';
        this.containerEl = containerEl;
        this.leftId = leftId;
        this.right0Id = right0Id;
        this.right1Id = right1Id;
        this.targetId = targetId;
        this.active = true;
        this.startTime = performance.now();

        if (!this.containerEl.classList.contains('relative')) {
            this.containerEl.classList.add('relative');
        }

        this.setupMultiSvg();
        this.startLoop();
    }

    setupSingleSvg() {
        const existingSvg = document.getElementById('code-compiler-svg-overlay');
        if (existingSvg) existingSvg.remove();

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'code-compiler-svg-overlay';
        svg.setAttribute('class', 'absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';

        svg.innerHTML = `
            <defs>
                <linearGradient id="compiler-grad-single" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0">
                    <stop offset="0%" stop-color="#38bdf8" stop-opacity="1" />
                    <stop offset="50%" stop-color="#818cf8" stop-opacity="0.95" />
                    <stop offset="100%" stop-color="#38bdf8" stop-opacity="1" />
                </linearGradient>
                <filter id="compiler-glow-filter" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            <!-- Glow Underlay Path -->
            <path id="compiler-glow-path-single" fill="none" stroke="#38bdf8" stroke-width="5" stroke-opacity="0.32" filter="url(#compiler-glow-filter)" stroke-linecap="round" />

            <!-- Main Gradient Flow Path -->
            <path id="compiler-main-path-single" fill="none" stroke="url(#compiler-grad-single)" stroke-width="2.5" stroke-dasharray="8 5" stroke-linecap="round" class="compiler-edge-animated" />

            <!-- Sockets -->
            <circle id="compiler-socket-source-single" r="4.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" filter="url(#compiler-glow-filter)" />
            <circle id="compiler-socket-target-single" r="4.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" filter="url(#compiler-glow-filter)" />

            <!-- Data Packet Light Transmission Orb -->
            <circle id="compiler-particle-single" r="3.5" fill="#ffffff" filter="url(#compiler-glow-filter)" />
        `;

        this.containerEl.appendChild(svg);
    }

    setupMultiSvg() {
        const existingSvg = document.getElementById('code-compiler-svg-overlay');
        if (existingSvg) existingSvg.remove();

        const hasTarget = !!this.targetId;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'code-compiler-svg-overlay';
        svg.setAttribute('class', 'absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';

        let targetGradients = '';
        let targetPaths = '';
        if (hasTarget) {
            targetGradients = `
                <linearGradient id="compiler-grad-2" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0">
                    <stop offset="0%" stop-color="#c084fc" stop-opacity="1" />
                    <stop offset="50%" stop-color="#818cf8" stop-opacity="0.95" />
                    <stop offset="100%" stop-color="#38bdf8" stop-opacity="1" />
                </linearGradient>
                <linearGradient id="compiler-grad-3" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0">
                    <stop offset="0%" stop-color="#c084fc" stop-opacity="1" />
                    <stop offset="50%" stop-color="#a855f7" stop-opacity="0.95" />
                    <stop offset="100%" stop-color="#38bdf8" stop-opacity="1" />
                </linearGradient>
            `;
            targetPaths = `
                <!-- Second Stage Flow Paths (WGSL ➔ Video Output) -->
                <path id="compiler-glow-path-2" fill="none" stroke="#38bdf8" stroke-width="5" stroke-opacity="0.32" filter="url(#compiler-glow-filter)" stroke-linecap="round" />
                <path id="compiler-glow-path-3" fill="none" stroke="#38bdf8" stroke-width="5" stroke-opacity="0.32" filter="url(#compiler-glow-filter)" stroke-linecap="round" />
                <path id="compiler-main-path-2" fill="none" stroke="url(#compiler-grad-2)" stroke-width="2.5" stroke-dasharray="8 5" stroke-linecap="round" class="compiler-edge-animated" />
                <path id="compiler-main-path-3" fill="none" stroke="url(#compiler-grad-3)" stroke-width="2.5" stroke-dasharray="8 5" stroke-linecap="round" class="compiler-edge-animated" />

                <!-- Stage 2 Sockets -->
                <circle id="compiler-socket-mid-out-0" r="4.5" fill="#c084fc" stroke="#ffffff" stroke-width="1.5" filter="url(#compiler-glow-filter)" />
                <circle id="compiler-socket-mid-out-1" r="4.5" fill="#c084fc" stroke="#ffffff" stroke-width="1.5" filter="url(#compiler-glow-filter)" />
                <circle id="compiler-socket-target-final" r="4.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" filter="url(#compiler-glow-filter)" />

                <!-- Stage 2 Particles -->
                <circle id="compiler-particle-2" r="3.5" fill="#ffffff" filter="url(#compiler-glow-filter)" />
                <circle id="compiler-particle-3" r="3.5" fill="#ffffff" filter="url(#compiler-glow-filter)" />
            `;
        }

        svg.innerHTML = `
            <defs>
                <linearGradient id="compiler-grad-0" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0">
                    <stop offset="0%" stop-color="#38bdf8" stop-opacity="1" />
                    <stop offset="50%" stop-color="#818cf8" stop-opacity="0.95" />
                    <stop offset="100%" stop-color="#c084fc" stop-opacity="1" />
                </linearGradient>
                <linearGradient id="compiler-grad-1" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0">
                    <stop offset="0%" stop-color="#38bdf8" stop-opacity="1" />
                    <stop offset="50%" stop-color="#a855f7" stop-opacity="0.95" />
                    <stop offset="100%" stop-color="#c084fc" stop-opacity="1" />
                </linearGradient>
                ${targetGradients}
                <filter id="compiler-glow-filter" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            <!-- Glow Underlay Paths (JS ➔ WGSL) -->
            <path id="compiler-glow-path-0" fill="none" stroke="#38bdf8" stroke-width="5" stroke-opacity="0.32" filter="url(#compiler-glow-filter)" stroke-linecap="round" />
            <path id="compiler-glow-path-1" fill="none" stroke="#c084fc" stroke-width="5" stroke-opacity="0.32" filter="url(#compiler-glow-filter)" stroke-linecap="round" />

            <!-- Main Gradient Flow Paths (JS ➔ WGSL) -->
            <path id="compiler-main-path-0" fill="none" stroke="url(#compiler-grad-0)" stroke-width="2.5" stroke-dasharray="8 5" stroke-linecap="round" class="compiler-edge-animated" />
            <path id="compiler-main-path-1" fill="none" stroke="url(#compiler-grad-1)" stroke-width="2.5" stroke-dasharray="8 5" stroke-linecap="round" class="compiler-edge-animated" />

            <!-- Sockets (JS ➔ WGSL) -->
            <circle id="compiler-socket-source" r="4.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" filter="url(#compiler-glow-filter)" />
            <circle id="compiler-socket-target-0" r="4.5" fill="#c084fc" stroke="#ffffff" stroke-width="1.5" filter="url(#compiler-glow-filter)" />
            <circle id="compiler-socket-target-1" r="4.5" fill="#c084fc" stroke="#ffffff" stroke-width="1.5" filter="url(#compiler-glow-filter)" />

            <!-- Data Packet Light Transmission Orbs (JS ➔ WGSL) -->
            <circle id="compiler-particle-0" r="3.5" fill="#ffffff" filter="url(#compiler-glow-filter)" />
            <circle id="compiler-particle-1" r="3.5" fill="#ffffff" filter="url(#compiler-glow-filter)" />

            ${targetPaths}
        `;

        this.containerEl.appendChild(svg);
    }

    startLoop() {
        const update = () => {
            if (!this.active) return;
            if (this.mode === 'single') {
                this.updateSingleFrame();
            } else {
                this.updateMultiFrame();
            }
            this.animationFrameId = requestAnimationFrame(update);
        };
        this.animationFrameId = requestAnimationFrame(update);
    }

    updateSingleFrame() {
        const srcEl = document.getElementById(this.sourceId);
        const tgtEl = document.getElementById(this.targetId);
        const svg = document.getElementById('code-compiler-svg-overlay');

        if (!srcEl || !tgtEl || !svg || !this.containerEl) return;

        const srcFrame = srcEl.querySelector('.code-window-frame') || srcEl;
        const tgtFrame = tgtEl.querySelector('.code-window-frame') || tgtEl;

        const cRect = this.containerEl.getBoundingClientRect();
        const sRect = srcFrame.getBoundingClientRect();
        const tRect = tgtFrame.getBoundingClientRect();

        if (tRect.left <= sRect.left + 40 || cRect.width === 0) {
            svg.style.display = 'none';
            return;
        }

        svg.style.display = 'block';

        const scaleX = cRect.width > 0 ? (this.containerEl.offsetWidth / cRect.width) : 1;
        const scaleY = cRect.height > 0 ? (this.containerEl.offsetHeight / cRect.height) : 1;

        const x0 = (sRect.right - cRect.left) * scaleX;
        const y0 = (sRect.top + sRect.height / 2 - cRect.top) * scaleY;
        const x1 = (tRect.left - cRect.left) * scaleX;
        const y1 = (tRect.top + tRect.height / 2 - cRect.top) * scaleY;

        const dx = Math.max(30, (x1 - x0) * 0.52);
        const d = `M ${x0} ${y0} C ${x0 + dx} ${y0}, ${x1 - dx} ${y1}, ${x1} ${y1}`;

        const pathGlow = document.getElementById('compiler-glow-path-single');
        const pathMain = document.getElementById('compiler-main-path-single');
        const gradSingle = document.getElementById('compiler-grad-single');

        if (pathGlow) pathGlow.setAttribute('d', d);
        if (pathMain) pathMain.setAttribute('d', d);
        if (gradSingle) {
            gradSingle.setAttribute('x1', x0);
            gradSingle.setAttribute('y1', y0);
            gradSingle.setAttribute('x2', x1);
            gradSingle.setAttribute('y2', y1);
        }

        const sockSrc = document.getElementById('compiler-socket-source-single');
        const sockTgt = document.getElementById('compiler-socket-target-single');

        if (sockSrc) { sockSrc.setAttribute('cx', x0); sockSrc.setAttribute('cy', y0); }
        if (sockTgt) { sockTgt.setAttribute('cx', x1); sockTgt.setAttribute('cy', y1); }

        const particle = document.getElementById('compiler-particle-single');
        if (particle && pathMain) {
            try {
                const now = performance.now();
                const cycle = 1600;
                const t = ((now - this.startTime) % cycle) / cycle;
                const len = pathMain.getTotalLength();
                if (len > 0) {
                    const pt = pathMain.getPointAtLength(t * len);
                    particle.setAttribute('cx', pt.x);
                    particle.setAttribute('cy', pt.y);
                    particle.setAttribute('opacity', t < 0.05 || t > 0.95 ? (t < 0.05 ? t / 0.05 : (1 - t) / 0.05) : '1');
                }
            } catch (e) {}
        }
    }

    updateMultiFrame() {
        const leftEl = document.getElementById(this.leftId);
        const right0El = document.getElementById(this.right0Id);
        const right1El = document.getElementById(this.right1Id);
        const targetEl = this.targetId ? document.getElementById(this.targetId) : null;
        const svg = document.getElementById('code-compiler-svg-overlay');

        if (!leftEl || !right0El || !right1El || !svg || !this.containerEl) return;

        const leftFrame = leftEl.querySelector('.code-window-frame') || leftEl;
        const right0Frame = right0El.querySelector('.code-window-frame') || right0El;
        const right1Frame = right1El.querySelector('.code-window-frame') || right1El;
        const targetFrame = targetEl ? (targetEl.querySelector('.code-window-frame') || targetEl) : null;

        const cRect = this.containerEl.getBoundingClientRect();
        const lRect = leftFrame.getBoundingClientRect();
        const r0Rect = right0Frame.getBoundingClientRect();
        const r1Rect = right1Frame.getBoundingClientRect();
        const tRect = targetFrame ? targetFrame.getBoundingClientRect() : null;

        if (r0Rect.left <= lRect.left + 40 || cRect.width === 0) {
            svg.style.display = 'none';
            return;
        }

        svg.style.display = 'block';

        const scaleX = cRect.width > 0 ? (this.containerEl.offsetWidth / cRect.width) : 1;
        const scaleY = cRect.height > 0 ? (this.containerEl.offsetHeight / cRect.height) : 1;

        // Stage 1 Socket Coordinates (JS ➔ WGSL)
        const x0 = (lRect.right - cRect.left) * scaleX;
        const y0 = (lRect.top + lRect.height / 2 - cRect.top) * scaleY;

        const x1 = (r0Rect.left - cRect.left) * scaleX;
        const y1 = (r0Rect.top + r0Rect.height / 2 - cRect.top) * scaleY;

        const x2 = (r1Rect.left - cRect.left) * scaleX;
        const y2 = (r1Rect.top + r1Rect.height / 2 - cRect.top) * scaleY;

        const dx0 = Math.max(25, (x1 - x0) * 0.52);

        // Smooth cubic Bezier curves (Stage 1)
        const d0 = `M ${x0} ${y0} C ${x0 + dx0} ${y0}, ${x1 - dx0} ${y1}, ${x1} ${y1}`;
        const d1 = `M ${x0} ${y0} C ${x0 + dx0} ${y0}, ${x2 - dx0} ${y2}, ${x2} ${y2}`;

        const pathGlow0 = document.getElementById('compiler-glow-path-0');
        const pathGlow1 = document.getElementById('compiler-glow-path-1');
        const pathMain0 = document.getElementById('compiler-main-path-0');
        const pathMain1 = document.getElementById('compiler-main-path-1');
        const grad0 = document.getElementById('compiler-grad-0');
        const grad1 = document.getElementById('compiler-grad-1');

        if (pathGlow0) pathGlow0.setAttribute('d', d0);
        if (pathGlow1) pathGlow1.setAttribute('d', d1);
        if (pathMain0) pathMain0.setAttribute('d', d0);
        if (pathMain1) pathMain1.setAttribute('d', d1);

        if (grad0) {
            grad0.setAttribute('x1', x0); grad0.setAttribute('y1', y0);
            grad0.setAttribute('x2', x1); grad0.setAttribute('y2', y1);
        }
        if (grad1) {
            grad1.setAttribute('x1', x0); grad1.setAttribute('y1', y0);
            grad1.setAttribute('x2', x2); grad1.setAttribute('y2', y2);
        }

        const sockSrc = document.getElementById('compiler-socket-source');
        const sockT0 = document.getElementById('compiler-socket-target-0');
        const sockT1 = document.getElementById('compiler-socket-target-1');

        if (sockSrc) { sockSrc.setAttribute('cx', x0); sockSrc.setAttribute('cy', y0); }
        if (sockT0) { sockT0.setAttribute('cx', x1); sockT0.setAttribute('cy', y1); }
        if (sockT1) { sockT1.setAttribute('cx', x2); sockT1.setAttribute('cy', y2); }

        const elapsed = performance.now() - this.startTime;
        const cycleDuration = 1800;
        const t1 = (elapsed % cycleDuration) / cycleDuration;

        const particle0 = document.getElementById('compiler-particle-0');
        const particle1 = document.getElementById('compiler-particle-1');

        if (pathMain0 && particle0) {
            try {
                const len0 = pathMain0.getTotalLength();
                if (len0 > 0) {
                    const pt0 = pathMain0.getPointAtLength(t1 * len0);
                    particle0.setAttribute('cx', pt0.x);
                    particle0.setAttribute('cy', pt0.y);
                    particle0.setAttribute('opacity', t1 < 0.05 || t1 > 0.95 ? (t1 < 0.05 ? t1 / 0.05 : (1 - t1) / 0.05) : '1');
                }
            } catch (e) {}
        }

        if (pathMain1 && particle1) {
            try {
                const len1 = pathMain1.getTotalLength();
                if (len1 > 0) {
                    const pt1 = pathMain1.getPointAtLength(t1 * len1);
                    particle1.setAttribute('cx', pt1.x);
                    particle1.setAttribute('cy', pt1.y);
                    particle1.setAttribute('opacity', t1 < 0.05 || t1 > 0.95 ? (t1 < 0.05 ? t1 / 0.05 : (1 - t1) / 0.05) : '1');
                }
            } catch (e) {}
        }

        // Stage 2: (WGSL ➔ Video Output)
        if (tRect && targetFrame) {
            const x1_out = r0Rect.right - cRect.left;
            const x2_out = r1Rect.right - cRect.left;
            const x3 = tRect.left - cRect.left;
            const y3 = tRect.top + tRect.height / 2 - cRect.top;

            const dx1 = Math.max(25, (x3 - x1_out) * 0.52);

            const d2 = `M ${x1_out} ${y1} C ${x1_out + dx1} ${y1}, ${x3 - dx1} ${y3}, ${x3} ${y3}`;
            const d3 = `M ${x2_out} ${y2} C ${x2_out + dx1} ${y2}, ${x3 - dx1} ${y3}, ${x3} ${y3}`;

            const pathGlow2 = document.getElementById('compiler-glow-path-2');
            const pathGlow3 = document.getElementById('compiler-glow-path-3');
            const pathMain2 = document.getElementById('compiler-main-path-2');
            const pathMain3 = document.getElementById('compiler-main-path-3');
            const grad2 = document.getElementById('compiler-grad-2');
            const grad3 = document.getElementById('compiler-grad-3');

            if (pathGlow2) pathGlow2.setAttribute('d', d2);
            if (pathGlow3) pathGlow3.setAttribute('d', d3);
            if (pathMain2) pathMain2.setAttribute('d', d2);
            if (pathMain3) pathMain3.setAttribute('d', d3);

            if (grad2) {
                grad2.setAttribute('x1', x1_out);
                grad2.setAttribute('y1', y1);
                grad2.setAttribute('x2', x3);
                grad2.setAttribute('y2', y3);
            }
            if (grad3) {
                grad3.setAttribute('x1', x2_out);
                grad3.setAttribute('y1', y2);
                grad3.setAttribute('x2', x3);
                grad3.setAttribute('y2', y3);
            }

            const sockMid0 = document.getElementById('compiler-socket-mid-out-0');
            const sockMid1 = document.getElementById('compiler-socket-mid-out-1');
            const sockFinal = document.getElementById('compiler-socket-target-final');

            if (sockMid0) { sockMid0.setAttribute('cx', x1_out); sockMid0.setAttribute('cy', y1); }
            if (sockMid1) { sockMid1.setAttribute('cx', x2_out); sockMid1.setAttribute('cy', y2); }
            if (sockFinal) { sockFinal.setAttribute('cx', x3); sockFinal.setAttribute('cy', y3); }

            const t2 = ((elapsed + cycleDuration * 0.45) % cycleDuration) / cycleDuration;
            const particle2 = document.getElementById('compiler-particle-2');
            const particle3 = document.getElementById('compiler-particle-3');

            if (pathMain2 && particle2) {
                try {
                    const len2 = pathMain2.getTotalLength();
                    if (len2 > 0) {
                        const pt2 = pathMain2.getPointAtLength(t2 * len2);
                        particle2.setAttribute('cx', pt2.x);
                        particle2.setAttribute('cy', pt2.y);
                        particle2.setAttribute('opacity', t2 < 0.05 || t2 > 0.95 ? (t2 < 0.05 ? t2 / 0.05 : (1 - t2) / 0.05) : '1');
                    }
                } catch (e) {}
            }

            if (pathMain3 && particle3) {
                try {
                    const len3 = pathMain3.getTotalLength();
                    if (len3 > 0) {
                        const pt3 = pathMain3.getPointAtLength(t2 * len3);
                        particle3.setAttribute('cx', pt3.x);
                        particle3.setAttribute('cy', pt3.y);
                        particle3.setAttribute('opacity', t2 < 0.05 || t2 > 0.95 ? (t2 < 0.05 ? t2 / 0.05 : (1 - t2) / 0.05) : '1');
                    }
                } catch (e) {}
            }
        }
    }
}
