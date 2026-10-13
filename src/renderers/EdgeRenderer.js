/**
 * Helper function: Slices a cubic Bezier curve [P0, P1, P2, P3] between t0 and t1 (0 <= t0 <= t1 <= 1)
 * using De Casteljau's subdivision algorithm.
 * 
 * Mathematically generates the exact physical sub-path geometry in real-time!
 */
function sliceCubicBezier(p0, p1, p2, p3, t0, t1) {
    const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

    // Clamp parameters
    const startT = Math.max(0, Math.min(1, t0));
    const endT = Math.max(startT, Math.min(1, t1));

    if (endT - startT < 0.0001) {
        // Point curve at startT
        const pt = lerp(lerp(lerp(p0, p1, startT), lerp(p1, p2, startT), startT), lerp(lerp(p1, p2, startT), lerp(p2, p3, startT), startT), startT);
        return { p0: pt, p1: pt, p2: pt, p3: pt };
    }

    // Step 1: Subdivide at endT to get [0 .. endT]
    const q0 = p0;
    const q1 = lerp(p0, p1, endT);
    const q12 = lerp(p1, p2, endT);
    const q23 = lerp(p2, p3, endT);
    const q2 = lerp(q1, q12, endT);
    const q3 = lerp(lerp(q1, q12, endT), lerp(q12, q23, endT), endT);

    if (startT <= 0.0001) {
        return { p0: q0, p1: q1, p2: q2, p3: q3 };
    }

    // Step 2: Subdivide [q0, q1, q2, q3] at u = startT / endT to extract [startT .. endT]
    const u = startT / endT;
    const r01 = lerp(q0, q1, u);
    const r12 = lerp(q1, q2, u);
    const r23 = lerp(q2, q3, u);
    const r012 = lerp(r01, r12, u);
    const r123 = lerp(r12, r23, u);
    const r0123 = lerp(r012, r123, u);

    return {
        p0: r0123,
        p1: r123,
        p2: r23,
        p3: q3
    };
}

/**
 * Class responsible for drawing connecting cubic Bezier curves
 * and pulsating data light particles on the SVG canvas.
 * 
 * Supports directional flow construction with configurable settings:
 * 1. Configurable line growth duration (<setting name="edge-animation" value="0.6s">).
 * 2. Configurable line delay (<setting name="edge-delay" value="0.38s">).
 * 3. Connection ALWAYS flows directionally from source output to target input.
 * 4. Glowing leading tip circle tracks the advancing front from output to input.
 * 5. Fixed target socket lights up upon arrival.
 * 6. White data pulse particle starts at point 0 (origin) only after full connection.
 */
export class EdgeRenderer {
    constructor(
        canvasContainerId = 'canvas-container',
        edgesGroupId = 'svg-edges-group',
        pulsesGroupId = 'svg-pulses-group',
        clipsGroupId = 'svg-clips-group',
        tipsGroupId = 'svg-tips-group',
        labelsGroupId = 'svg-labels-group',
        socketsGroupId = 'svg-sockets-group'
    ) {
        this.canvasContainerId = canvasContainerId;
        this.edgesGroupId = edgesGroupId;
        this.pulsesGroupId = pulsesGroupId;
        this.clipsGroupId = clipsGroupId;
        this.tipsGroupId = tipsGroupId;
        this.labelsGroupId = labelsGroupId;
        this.socketsGroupId = socketsGroupId;

        this.activeEdges = new Map();
        this.currentNodesMap = new Map();
        this.previousNodesMap = new Map();
        this.currentEdgesSet = new Set();
        this.rafLoopId = null;
        this.pulseDuration = 2200; // default 2200ms
        this.growthDuration = 600; // default 600ms
        this.startDelay = 380; // default 380ms

        this.startLoop();
    }

    setPulseDuration(ms) {
        this.pulseDuration = Math.max(300, ms);
    }

    setGrowthDuration(ms) {
        this.growthDuration = Math.max(100, ms);
    }

    setStartDelay(ms) {
        this.startDelay = Math.max(0, ms);
    }

    startLoop() {
        if (this.rafLoopId) return;

        const loop = () => {
            this.updateFrame();
            this.rafLoopId = requestAnimationFrame(loop);
        };

        this.rafLoopId = requestAnimationFrame(loop);
    }

    stopLoop() {
        if (this.rafLoopId) {
            cancelAnimationFrame(this.rafLoopId);
            this.rafLoopId = null;
        }
    }

    clear() {
        this.currentNodesMap = new Map();
        this.previousNodesMap = new Map();
        this.currentEdgesSet = new Set();

        const edgesGroup = document.getElementById(this.edgesGroupId);
        const pulsesGroup = document.getElementById(this.pulsesGroupId);
        const tipsGroup = document.getElementById(this.tipsGroupId);
        const labelsGroup = document.getElementById(this.labelsGroupId);
        const socketsGroup = document.getElementById(this.socketsGroupId);

        if (edgesGroup) edgesGroup.innerHTML = '';
        if (pulsesGroup) pulsesGroup.innerHTML = '';
        if (tipsGroup) tipsGroup.innerHTML = '';
        if (labelsGroup) labelsGroup.innerHTML = '';
        if (socketsGroup) socketsGroup.innerHTML = '';

        this.activeEdges.clear();
    }

    /**
     * Differential synchronization of active edges with dynamic connection growth animations.
     */
    sync(nodesMap, edgesSet) {
        this.currentNodesMap = new Map(nodesMap || []);
        this.currentEdgesSet = new Set(edgesSet || []);

        const canvasContainer = document.getElementById(this.canvasContainerId);
        const edgesGroup = document.getElementById(this.edgesGroupId);
        const pulsesGroup = document.getElementById(this.pulsesGroupId);
        const tipsGroup = document.getElementById(this.tipsGroupId);
        const labelsGroup = document.getElementById(this.labelsGroupId);
        const socketsGroup = document.getElementById(this.socketsGroupId) || tipsGroup || edgesGroup;

        if (!canvasContainer || !edgesGroup || !pulsesGroup) return;

        // 1. Remove edges that no longer belong to this step
        this.activeEdges.forEach((edgeObj, edgeKey) => {
            if (!this.currentEdgesSet.has(edgeKey)) {
                edgeObj.path?.remove();
                edgeObj.socketFromGlow?.remove();
                edgeObj.socketFrom?.remove();
                edgeObj.socketToGlow?.remove();
                edgeObj.socketTo?.remove();
                edgeObj.tipLead1Glow?.remove();
                edgeObj.tipLead1?.remove();
                edgeObj.particle?.remove();
                edgeObj.labelGroup?.remove();
                this.activeEdges.delete(edgeKey);
            }
        });

        // 2. Create ONLY newly added edges with staged delay to wait for nodes to appear
        this.currentEdgesSet.forEach(edgeKey => {
            const existing = this.activeEdges.get(edgeKey);
            if (!existing || !existing.path?.parentElement) {
                if (existing) {
                    existing.path?.remove();
                    existing.socketFromGlow?.remove();
                    existing.socketFrom?.remove();
                    existing.socketToGlow?.remove();
                    existing.socketTo?.remove();
                    existing.tipLead1Glow?.remove();
                    existing.tipLead1?.remove();
                    existing.particle?.remove();
                    existing.labelGroup?.remove();
                    this.activeEdges.delete(edgeKey);
                }

                // Extract source and destination node IDs and label
                let label = '';
                let cleanEdgeKey = edgeKey;
                if (edgeKey.includes('|')) {
                    const parts = edgeKey.split('|');
                    cleanEdgeKey = parts[0];
                    label = parts[1] || '';
                }

                let fromId = cleanEdgeKey;
                let toId = '';
                if (cleanEdgeKey.includes('#')) {
                    const linkParts = cleanEdgeKey.split('#')[0].split('->');
                    fromId = linkParts[0];
                    toId = linkParts[1];
                } else {
                    const linkParts = cleanEdgeKey.split('->');
                    fromId = linkParts[0];
                    toId = linkParts[1];
                }
                if (fromId.includes(':')) fromId = fromId.split(':')[0];
                if (toId.includes(':')) toId = toId.split(':')[0];

                const wasFromPresent = this.previousNodesMap.has(fromId);
                const wasToPresent = this.previousNodesMap.has(toId);

                // Stage the connection delay using configurable startDelay
                const baseDelay = (this.startDelay !== undefined) ? this.startDelay : 380;
                let animDelay = 0;
                if (!wasFromPresent && !wasToPresent) {
                    animDelay = baseDelay; // Wait for both brand-new nodes to bloom in
                } else if (!wasToPresent) {
                    animDelay = Math.round(baseDelay * 0.55); // Wait for the target node to bloom in
                } else if (!wasFromPresent) {
                    animDelay = Math.round(baseDelay * 0.55); // Wait for the source node to bloom in
                }

                // Visible Dashed Path Line
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', 'url(#grad-cyan-purple)');
                path.setAttribute('stroke-width', '2.5');
                path.setAttribute('stroke-dasharray', '6, 4');
                path.setAttribute('class', 'vector-path');
                path.setAttribute('filter', 'url(#glow-filter)');

                // Sockets (Origin & Target Ports) with Subtle Ambient Glow Halos
                const socketFromGlow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                socketFromGlow.setAttribute('r', '8');
                socketFromGlow.setAttribute('fill', '#38bdf8');
                socketFromGlow.setAttribute('opacity', '0.22');
                socketFromGlow.setAttribute('class', 'vector-socket-glow');
                socketFromGlow.style.filter = 'blur(3.5px)';
                socketFromGlow.style.pointerEvents = 'none';
                socketFromGlow.style.display = 'none';

                const socketFrom = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                socketFrom.setAttribute('r', '4');
                socketFrom.setAttribute('fill', '#38bdf8');
                socketFrom.setAttribute('stroke', '#ffffff');
                socketFrom.setAttribute('stroke-width', '1.5');
                socketFrom.setAttribute('class', 'vector-socket');
                socketFrom.style.filter = 'drop-shadow(0 0 3.5px #38bdf8)';
                socketFrom.style.display = 'none';

                const socketToGlow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                socketToGlow.setAttribute('r', '8');
                socketToGlow.setAttribute('fill', '#c084fc');
                socketToGlow.setAttribute('opacity', '0.22');
                socketToGlow.setAttribute('class', 'vector-socket-glow');
                socketToGlow.style.filter = 'blur(3.5px)';
                socketToGlow.style.pointerEvents = 'none';
                socketToGlow.style.display = 'none';

                const socketTo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                socketTo.setAttribute('r', '4');
                socketTo.setAttribute('fill', '#c084fc');
                socketTo.setAttribute('stroke', '#ffffff');
                socketTo.setAttribute('stroke-width', '1.5');
                socketTo.setAttribute('class', 'vector-socket');
                socketTo.style.filter = 'drop-shadow(0 0 3.5px #c084fc)';
                socketTo.style.display = 'none';

                // Leading Tip Circle & Subtle Ambient Glow (Moves from output port to input port)
                const tipLead1Glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                tipLead1Glow.setAttribute('r', '8');
                tipLead1Glow.setAttribute('fill', '#38bdf8');
                tipLead1Glow.setAttribute('opacity', '0.22');
                tipLead1Glow.setAttribute('class', 'vector-socket-glow');
                tipLead1Glow.style.filter = 'blur(3.5px)';
                tipLead1Glow.style.pointerEvents = 'none';
                tipLead1Glow.style.display = 'none';

                const tipLead1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                tipLead1.setAttribute('r', '4');
                tipLead1.setAttribute('fill', '#38bdf8');
                tipLead1.setAttribute('stroke', '#ffffff');
                tipLead1.setAttribute('stroke-width', '1.5');
                tipLead1.setAttribute('class', 'vector-socket');
                tipLead1.style.filter = 'drop-shadow(0 0 3.5px #38bdf8)';
                tipLead1.style.display = 'none';

                // Continuous Light Particle (Data transmission orb)
                const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                particle.setAttribute('r', '4');
                particle.setAttribute('fill', '#ffffff');
                particle.setAttribute('class', 'vector-particle');
                particle.style.filter = 'drop-shadow(0 0 4px #38bdf8)';
                particle.style.display = 'none'; // Hidden until 100% connected

                // Edge Label Element (if label text exists)
                let labelGroup = null;
                if (label) {
                    labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    labelGroup.setAttribute('class', 'edge-label-container edge-label-hidden');
                    labelGroup.style.pointerEvents = 'none';

                    const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    labelBg.setAttribute('class', 'edge-label-bg');
                    labelBg.setAttribute('rx', '8');
                    labelBg.setAttribute('ry', '8');
                    labelBg.setAttribute('fill', 'rgba(10, 15, 30, 0.92)');
                    labelBg.setAttribute('stroke', 'rgba(56, 189, 248, 0.55)');
                    labelBg.setAttribute('stroke-width', '1.5');
                    labelBg.setAttribute('filter', 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.8))');

                    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    textEl.setAttribute('class', 'edge-label-text');
                    textEl.setAttribute('text-anchor', 'middle');
                    textEl.setAttribute('dominant-baseline', 'central');
                    textEl.setAttribute('fill', '#f8fafc');
                    textEl.setAttribute('font-family', "'JetBrains Mono', 'Fira Code', monospace");
                    textEl.setAttribute('font-size', '14.5px');
                    textEl.setAttribute('font-weight', '600');
                    textEl.setAttribute('letter-spacing', '0.02em');
                    textEl.textContent = label;

                    labelGroup.appendChild(labelBg);
                    labelGroup.appendChild(textEl);
                }

                edgesGroup.appendChild(path);
                socketsGroup.appendChild(socketFromGlow);
                socketsGroup.appendChild(socketFrom);
                socketsGroup.appendChild(socketToGlow);
                socketsGroup.appendChild(socketTo);

                if (tipsGroup) {
                    tipsGroup.appendChild(tipLead1Glow);
                    tipsGroup.appendChild(tipLead1);
                } else {
                    pulsesGroup.appendChild(tipLead1Glow);
                    pulsesGroup.appendChild(tipLead1);
                }

                pulsesGroup.appendChild(particle);

                if (labelGroup) {
                    (labelsGroup || edgesGroup).appendChild(labelGroup);
                }

                this.activeEdges.set(edgeKey, {
                    path,
                    socketFromGlow,
                    socketFrom,
                    socketToGlow,
                    socketTo,
                    tipLead1Glow,
                    tipLead1,
                    particle,
                    labelGroup,
                    label,
                    animating: true,
                    animStartTime: performance.now() + animDelay,
                    animDuration: this.growthDuration,
                    particleStartTime: null,
                    wasFromPresent
                });
            }
        });

        // Check if any nodes are currently highlighted
        const highlightedNodeIds = new Set();
        this.currentNodesMap.forEach((nodeData, id) => {
            if (nodeData.highlight) {
                highlightedNodeIds.add(id);
            }
        });
        const hasAnyHighlight = highlightedNodeIds.size > 0;

        // Apply smooth highlight classes to all active edges
        this.activeEdges.forEach((edgeObj, rawEdgeKey) => {
            let cleanEdgeKey = rawEdgeKey.includes('|') ? rawEdgeKey.split('|')[0] : rawEdgeKey;
            let fromId = cleanEdgeKey;
            let toId = '';
            if (cleanEdgeKey.includes('#')) {
                const linkParts = cleanEdgeKey.split('#')[0].split('->');
                fromId = linkParts[0];
                toId = linkParts[1];
            } else {
                const linkParts = cleanEdgeKey.split('->');
                fromId = linkParts[0];
                toId = linkParts[1];
            }
            if (fromId.includes(':')) fromId = fromId.split(':')[0];
            if (toId.includes(':')) toId = toId.split(':')[0];

            const isEdgeHighlighted = !hasAnyHighlight || highlightedNodeIds.has(fromId) || highlightedNodeIds.has(toId);

            if (isEdgeHighlighted) {
                edgeObj.path.classList.add('edge-highlighted');
                edgeObj.path.classList.remove('edge-dimmed');
                edgeObj.socketFrom.classList.add('edge-highlighted');
                edgeObj.socketFrom.classList.remove('edge-dimmed');
                edgeObj.socketFromGlow.classList.add('edge-highlighted');
                edgeObj.socketFromGlow.classList.remove('edge-dimmed');
                edgeObj.socketTo.classList.add('edge-highlighted');
                edgeObj.socketTo.classList.remove('edge-dimmed');
                edgeObj.socketToGlow.classList.add('edge-highlighted');
                edgeObj.socketToGlow.classList.remove('edge-dimmed');
                edgeObj.particle.classList.add('edge-highlighted');
                edgeObj.particle.classList.remove('edge-dimmed');
                if (edgeObj.labelGroup) {
                    edgeObj.labelGroup.classList.add('edge-highlighted');
                    edgeObj.labelGroup.classList.remove('edge-dimmed');
                }
            } else {
                edgeObj.path.classList.add('edge-dimmed');
                edgeObj.path.classList.remove('edge-highlighted');
                edgeObj.socketFrom.classList.add('edge-dimmed');
                edgeObj.socketFrom.classList.remove('edge-highlighted');
                edgeObj.socketFromGlow.classList.add('edge-dimmed');
                edgeObj.socketFromGlow.classList.remove('edge-highlighted');
                edgeObj.socketTo.classList.add('edge-dimmed');
                edgeObj.socketTo.classList.remove('edge-highlighted');
                edgeObj.socketToGlow.classList.add('edge-dimmed');
                edgeObj.socketToGlow.classList.remove('edge-highlighted');
                edgeObj.particle.classList.add('edge-dimmed');
                edgeObj.particle.classList.remove('edge-highlighted');
                if (edgeObj.labelGroup) {
                    edgeObj.labelGroup.classList.add('edge-dimmed');
                    edgeObj.labelGroup.classList.remove('edge-highlighted');
                }
            }
        });

        // Save current nodes map for next step comparison
        this.previousNodesMap = new Map();
        this.currentNodesMap.forEach((v, k) => this.previousNodesMap.set(k, { ...v }));

        // Instant update on current frame
        this.updateFrame();
    }

    render(nodesMap, edgesSet) {
        this.sync(nodesMap, edgesSet);
    }

    animateTransition(nodesMap, edgesSet) {
        this.sync(nodesMap, edgesSet);
    }

    /**
     * Real-time continuous animation & tracking frame.
     */
    updateFrame() {
        const canvasContainer = document.getElementById(this.canvasContainerId);
        if (!canvasContainer || this.activeEdges.size === 0) return;

        const canvasRect = canvasContainer.getBoundingClientRect();
        const canvasWidth = canvasContainer.offsetWidth || canvasRect.width;
        const canvasHeight = canvasContainer.offsetHeight || canvasRect.height;
        const scaleX = canvasRect.width > 0 ? (canvasWidth / canvasRect.width) : 1;
        const scaleY = canvasRect.height > 0 ? (canvasHeight / canvasRect.height) : 1;

        if (canvasWidth === 0 || canvasHeight === 0) return;

        const now = performance.now();
        const duration = this.pulseDuration || 2200;

        // Check if any nodes are currently highlighted
        const highlightedNodeIds = new Set();
        this.currentNodesMap.forEach((nodeData, id) => {
            if (nodeData.highlight) {
                highlightedNodeIds.add(id);
            }
        });
        const hasAnyHighlight = highlightedNodeIds.size > 0;

        this.activeEdges.forEach((edgeObj, rawEdgeKey) => {
            let cleanEdgeKey = rawEdgeKey;
            if (rawEdgeKey.includes('|')) {
                cleanEdgeKey = rawEdgeKey.split('|')[0];
            }

            let fromId = cleanEdgeKey;
            let toId = '';
            let explicitFromPort = null;
            let explicitToPort = null;
            let explicitDir = null;

            if (cleanEdgeKey.includes('#')) {
                const parts = cleanEdgeKey.split('#');
                explicitDir = parts[1];
                const linkParts = parts[0].split('->');
                fromId = linkParts[0];
                toId = linkParts[1];
            } else {
                const linkParts = cleanEdgeKey.split('->');
                fromId = linkParts[0];
                toId = linkParts[1];
            }

            if (fromId.includes(':')) {
                const fromParts = fromId.split(':');
                fromId = fromParts[0];
                explicitFromPort = fromParts[1] !== 'auto' ? fromParts[1] : null;
            }
            if (toId.includes(':')) {
                const toParts = toId.split(':');
                toId = toParts[0];
                explicitToPort = toParts[1] !== 'auto' ? toParts[1] : null;
            }

            const source = this.currentNodesMap.get(fromId);
            const target = this.currentNodesMap.get(toId);

            if (!source || !target) return;

            const isEdgeHighlighted = !hasAnyHighlight || highlightedNodeIds.has(fromId) || highlightedNodeIds.has(toId);
            const targetPathOpacity = isEdgeHighlighted ? '0.85' : '0.12';
            const targetSocketOpacity = isEdgeHighlighted ? '1' : '0.12';
            const targetGlowOpacity = isEdgeHighlighted ? '0.22' : '0.03';

            const sourceEl = document.getElementById(`node-${fromId}`);
            const targetEl = document.getElementById(`node-${toId}`);

            let sourceCenterX, sourceCenterY, targetCenterX, targetCenterY;
            let halfW1, halfH1, halfW2, halfH2;
            let r1, r2;

            const sourceOrb = sourceEl?.querySelector('.node-circle-orb');
            const targetOrb = targetEl?.querySelector('.node-circle-orb');
            const sourceIsCircle = Boolean(source.shape === 'circle' || sourceOrb);
            const targetIsCircle = Boolean(target.shape === 'circle' || targetOrb);

            if (sourceEl && targetEl) {
                const sourceRect = sourceEl.getBoundingClientRect();
                const targetRect = targetEl.getBoundingClientRect();

                const sourceOrbRect = sourceOrb ? sourceOrb.getBoundingClientRect() : sourceRect;
                const targetOrbRect = targetOrb ? targetOrb.getBoundingClientRect() : targetRect;

                sourceCenterX = (sourceOrbRect.left + sourceOrbRect.width / 2 - canvasRect.left) * scaleX;
                sourceCenterY = (sourceOrbRect.top + sourceOrbRect.height / 2 - canvasRect.top) * scaleY;
                targetCenterX = (targetOrbRect.left + targetOrbRect.width / 2 - canvasRect.left) * scaleX;
                targetCenterY = (targetOrbRect.top + targetOrbRect.height / 2 - canvasRect.top) * scaleY;

                halfW1 = (sourceRect.width / 2) * scaleX;
                halfH1 = (sourceRect.height / 2) * scaleY;
                halfW2 = (targetRect.width / 2) * scaleX;
                halfH2 = (targetRect.height / 2) * scaleY;

                r1 = (sourceOrbRect.width / 2) * scaleX;
                r2 = (targetOrbRect.width / 2) * scaleX;
            } else {
                halfW1 = 90; halfH1 = 30;
                halfW2 = 90; halfH2 = 30;
                r1 = 34; r2 = 34;
                sourceCenterX = (source.x / 100) * canvasWidth;
                sourceCenterY = (source.y / 100) * canvasHeight;
                targetCenterX = (target.x / 100) * canvasWidth;
                targetCenterY = (target.y / 100) * canvasHeight;
            }

            const deltaX = targetCenterX - sourceCenterX;
            const deltaY = targetCenterY - sourceCenterY;

            let x1, y1, x2, y2, cx1, cy1, cx2, cy2;

            if (sourceIsCircle && targetIsCircle && !explicitFromPort && !explicitToPort && !explicitDir) {
                // Dynamic Radial Circumference (Direct Straight Line between Circles)
                const angle = Math.atan2(targetCenterY - sourceCenterY, targetCenterX - sourceCenterX);

                x1 = sourceCenterX + Math.cos(angle) * r1;
                y1 = sourceCenterY + Math.sin(angle) * r1;

                x2 = targetCenterX - Math.cos(angle) * r2;
                y2 = targetCenterY - Math.sin(angle) * r2;

                // Straight Line Bézier Control Points
                cx1 = x1 + (x2 - x1) / 3;
                cy1 = y1 + (y2 - y1) / 3;
                cx2 = x1 + 2 * (x2 - x1) / 3;
                cy2 = y1 + 2 * (y2 - y1) / 3;
            } else if (sourceIsCircle && !explicitFromPort && !explicitDir) {
                // Source is Circle, Target is Card
                const angle = Math.atan2(targetCenterY - sourceCenterY, targetCenterX - sourceCenterX);

                x1 = sourceCenterX + Math.cos(angle) * r1;
                y1 = sourceCenterY + Math.sin(angle) * r1;

                if (explicitToPort === 'top' || (!explicitToPort && deltaY > Math.abs(deltaX))) {
                    x2 = targetCenterX;
                    y2 = targetCenterY - halfH2;
                } else if (explicitToPort === 'bottom' || (!explicitToPort && deltaY < -Math.abs(deltaX))) {
                    x2 = targetCenterX;
                    y2 = targetCenterY + halfH2;
                } else if (explicitToPort === 'right' || (!explicitToPort && deltaX < 0)) {
                    x2 = targetCenterX + halfW2;
                    y2 = targetCenterY;
                } else {
                    x2 = targetCenterX - halfW2;
                    y2 = targetCenterY;
                }

                cx1 = x1 + (x2 - x1) * 0.45;
                cy1 = y1 + (y2 - y1) * 0.1;
                cx2 = x2 - (x2 - x1) * 0.45;
                cy2 = y2;
            } else if (targetIsCircle && !explicitToPort && !explicitDir) {
                // Source is Card, Target is Circle
                const angle = Math.atan2(targetCenterY - sourceCenterY, targetCenterX - sourceCenterX);

                if (explicitFromPort === 'bottom' || (!explicitFromPort && deltaY > Math.abs(deltaX))) {
                    x1 = sourceCenterX;
                    y1 = sourceCenterY + halfH1;
                } else if (explicitFromPort === 'top' || (!explicitFromPort && deltaY < -Math.abs(deltaX))) {
                    x1 = sourceCenterX;
                    y1 = sourceCenterY - halfH1;
                } else if (explicitFromPort === 'left' || (!explicitFromPort && deltaX < 0)) {
                    x1 = sourceCenterX - halfW1;
                    y1 = sourceCenterY;
                } else {
                    x1 = sourceCenterX + halfW1;
                    y1 = sourceCenterY;
                }

                x2 = targetCenterX - Math.cos(angle) * r2;
                y2 = targetCenterY - Math.sin(angle) * r2;

                cx1 = x1 + (x2 - x1) * 0.45;
                cy1 = y1;
                cx2 = x2 - (x2 - x1) * 0.45;
                cy2 = y2 - (y2 - y1) * 0.1;
            } else {
                // Standard Card to Card Layout (Horizontal, Vertical Bézier, or Outer Arcs)
                if (explicitFromPort === 'left' && explicitToPort === 'left') {
                    x1 = sourceCenterX - halfW1;
                    y1 = sourceCenterY;
                    x2 = targetCenterX - halfW2;
                    y2 = targetCenterY;
                    const curveOffset = Math.max(70, Math.abs(y2 - y1) * 0.45);
                    cx1 = Math.min(x1, x2) - curveOffset;
                    cy1 = y1 + (y2 - y1) * 0.2;
                    cx2 = Math.min(x1, x2) - curveOffset;
                    cy2 = y2 - (y2 - y1) * 0.2;
                } else if (explicitFromPort === 'right' && explicitToPort === 'right') {
                    x1 = sourceCenterX + halfW1;
                    y1 = sourceCenterY;
                    x2 = targetCenterX + halfW2;
                    y2 = targetCenterY;
                    const curveOffset = Math.max(70, Math.abs(y2 - y1) * 0.45);
                    cx1 = Math.max(x1, x2) + curveOffset;
                    cy1 = y1 + (y2 - y1) * 0.2;
                    cx2 = Math.max(x1, x2) + curveOffset;
                    cy2 = y2 - (y2 - y1) * 0.2;
                } else {
                    const isVertical = explicitDir === 'vertical' ||
                                       explicitFromPort === 'bottom' || explicitFromPort === 'top' ||
                                       explicitToPort === 'top' || explicitToPort === 'bottom' ||
                                       (Math.abs(deltaX) < 140 && Math.abs(deltaY) > 60 && !explicitFromPort && !explicitToPort);

                    if (isVertical) {
                        if (explicitFromPort === 'bottom' || (explicitFromPort !== 'top' && deltaY >= 0)) {
                            x1 = sourceCenterX;
                            y1 = sourceCenterY + halfH1;
                        } else {
                            x1 = sourceCenterX;
                            y1 = sourceCenterY - halfH1;
                        }

                        if (explicitToPort === 'top' || (explicitToPort !== 'bottom' && deltaY >= 0)) {
                            x2 = targetCenterX;
                            y2 = targetCenterY - halfH2;
                        } else {
                            x2 = targetCenterX;
                            y2 = targetCenterY + halfH2;
                        }

                        const dy = Math.max(Math.abs(y2 - y1) * 0.5, 30);
                        if (y2 >= y1) {
                            cx1 = x1;
                            cy1 = y1 + dy;
                            cx2 = x2;
                            cy2 = y2 - dy;
                        } else {
                            cx1 = x1;
                            cy1 = y1 - dy;
                            cx2 = x2;
                            cy2 = y2 + dy;
                        }
                    } else {
                        if (explicitFromPort === 'left' || (explicitFromPort !== 'right' && deltaX < 0)) {
                            x1 = sourceCenterX - halfW1;
                            y1 = sourceCenterY;
                        } else {
                            x1 = sourceCenterX + halfW1;
                            y1 = sourceCenterY;
                        }

                        if (explicitToPort === 'right' || (explicitToPort !== 'left' && deltaX < 0)) {
                            x2 = targetCenterX + halfW2;
                            y2 = targetCenterY;
                        } else {
                            x2 = targetCenterX - halfW2;
                            y2 = targetCenterY;
                        }

                        const dx = Math.max(Math.abs(x2 - x1) * 0.55, 45);
                        if (x2 >= x1) {
                            cx1 = x1 + dx;
                            cy1 = y1;
                            cx2 = x2 - dx;
                            cy2 = y2;
                        } else {
                            cx1 = x1 - dx;
                            cy1 = y1;
                            cx2 = x2 + dx;
                            cy2 = y2;
                        }
                    }
                }
            }

            if (Math.abs(x2 - x1) < 0.5) {
                x2 = x1 + 0.5;
                cx1 = x1 + 0.25;
                cx2 = x2 - 0.25;
            }
            if (Math.abs(y2 - y1) < 0.5) {
                y2 = y1 + 0.5;
                cy1 = y1 + 0.25;
                cy2 = y2 - 0.25;
            }
                const p0 = { x: x1, y: y1 };
                const p1 = { x: cx1, y: cy1 };
                const p2 = { x: cx2, y: cy2 };
                const p3 = { x: x2, y: y2 };

                edgeObj.socketFromGlow.setAttribute('cx', x1);
                edgeObj.socketFromGlow.setAttribute('cy', y1);
                edgeObj.socketFrom.setAttribute('cx', x1);
                edgeObj.socketFrom.setAttribute('cy', y1);

                edgeObj.socketToGlow.setAttribute('cx', x2);
                edgeObj.socketToGlow.setAttribute('cy', y2);
                edgeObj.socketTo.setAttribute('cx', x2);
                edgeObj.socketTo.setAttribute('cy', y2);

                let subCurve = { p0, p1, p2, p3 };

                if (edgeObj.animating) {
                    if (now < edgeObj.animStartTime) {
                        subCurve = { p0, p1: p0, p2: p0, p3: p0 };
                        edgeObj.tipLead1Glow.style.display = 'none';
                        edgeObj.tipLead1.style.display = 'none';
                        if (edgeObj.wasFromPresent) {
                            edgeObj.socketFromGlow.style.display = 'block';
                            edgeObj.socketFrom.style.display = 'block';
                        } else {
                            edgeObj.socketFromGlow.style.display = 'none';
                            edgeObj.socketFrom.style.display = 'none';
                        }
                        edgeObj.socketToGlow.style.display = 'none';
                        edgeObj.socketTo.style.display = 'none';
                        edgeObj.particle.style.display = 'none';
                    } else {
                        const elapsed = now - edgeObj.animStartTime;
                        const p = Math.min(1, Math.max(0, elapsed / (edgeObj.animDuration || 600)));
                        const easeP = 1 - Math.pow(1 - p, 3);

                        edgeObj.socketFromGlow.style.display = 'block';
                        edgeObj.socketFrom.style.display = 'block';

                        const r = Math.round(56 + (192 - 56) * easeP);
                        const g = Math.round(189 + (132 - 189) * easeP);
                        const b = Math.round(248 + (252 - 248) * easeP);
                        const curColor = `rgb(${r}, ${g}, ${b})`;

                        if (p >= 1) {
                            edgeObj.animating = false;
                            edgeObj.particleStartTime = now;
                            edgeObj.tipLead1Glow.style.display = 'none';
                            edgeObj.tipLead1.style.display = 'none';
                            edgeObj.socketToGlow.style.display = 'block';
                            edgeObj.socketTo.style.display = 'block';
                            edgeObj.particle.style.display = 'block';
                            subCurve = { p0, p1, p2, p3 };
                        } else {
                            subCurve = sliceCubicBezier(p0, p1, p2, p3, 0, easeP);

                            edgeObj.tipLead1Glow.style.display = 'block';
                            edgeObj.tipLead1Glow.setAttribute('cx', subCurve.p3.x);
                            edgeObj.tipLead1Glow.setAttribute('cy', subCurve.p3.y);
                            edgeObj.tipLead1Glow.setAttribute('fill', curColor);

                            edgeObj.tipLead1.style.display = 'block';
                            edgeObj.tipLead1.setAttribute('cx', subCurve.p3.x);
                            edgeObj.tipLead1.setAttribute('cy', subCurve.p3.y);
                            edgeObj.tipLead1.setAttribute('fill', curColor);
                            edgeObj.tipLead1.style.filter = `drop-shadow(0 0 3.5px ${curColor})`;

                            edgeObj.socketToGlow.style.display = 'none';
                            edgeObj.socketTo.style.display = 'none';
                            edgeObj.particle.style.display = 'none';
                        }
                    }
                } else {
                    edgeObj.tipLead1Glow.style.display = 'none';
                    edgeObj.tipLead1.style.display = 'none';
                    edgeObj.socketFromGlow.style.display = 'block';
                    edgeObj.socketFrom.style.display = 'block';
                    edgeObj.socketToGlow.style.display = 'block';
                    edgeObj.socketTo.style.display = 'block';
                }

                if (edgeObj.animating && now < edgeObj.animStartTime) {
                    edgeObj.path.setAttribute('d', '');
                } else {
                    const activePathData = `M ${subCurve.p0.x} ${subCurve.p0.y} C ${subCurve.p1.x} ${subCurve.p1.y}, ${subCurve.p2.x} ${subCurve.p2.y}, ${subCurve.p3.x} ${subCurve.p3.y}`;
                    edgeObj.path.setAttribute('d', activePathData);
                }

                try {
                    const currentSubLen = edgeObj.path.getTotalLength();

                    if (edgeObj.labelGroup) {
                        if (currentSubLen > 0) {
                            const midPt = edgeObj.path.getPointAtLength(currentSubLen * 0.5);
                            const labelText = edgeObj.label || '';
                            const lw = Math.max(68, labelText.length * 9.2 + 28);
                            const lh = 30;
                            const bg = edgeObj.labelGroup.querySelector('.edge-label-bg');
                            if (bg) {
                                bg.setAttribute('x', -lw / 2);
                                bg.setAttribute('y', -lh / 2);
                                bg.setAttribute('width', lw);
                                bg.setAttribute('height', lh);
                            }
                            edgeObj.labelGroup.setAttribute('transform', `translate(${midPt.x}, ${midPt.y})`);
                        }

                        if (!edgeObj.animating && currentSubLen > 0) {
                            edgeObj.labelGroup.classList.add('edge-label-visible');
                            edgeObj.labelGroup.classList.remove('edge-label-hidden');
                        } else {
                            edgeObj.labelGroup.classList.add('edge-label-hidden');
                            edgeObj.labelGroup.classList.remove('edge-label-visible');
                        }
                    }

                    if (!edgeObj.animating && currentSubLen > 0) {
                        edgeObj.particle.style.display = 'block';

                        const particleStart = edgeObj.particleStartTime || edgeObj.animStartTime || now;
                        const elapsed = Math.max(0, now - particleStart);
                        const t = (elapsed / duration) % 1;

                        const pt = edgeObj.path.getPointAtLength(t * currentSubLen);
                        edgeObj.particle.setAttribute('cx', pt.x);
                        edgeObj.particle.setAttribute('cy', pt.y);

                        const pr = Math.round(56 + (192 - 56) * t);
                        const pg = Math.round(189 + (132 - 189) * t);
                        const pb = Math.round(248 + (252 - 248) * t);
                        const curPulseColor = `rgb(${pr}, ${pg}, ${pb})`;
                        edgeObj.particle.style.filter = `drop-shadow(0 0 6px ${curPulseColor})`;
                    } else {
                        edgeObj.particle.style.display = 'none';
                    }
                } catch (err) {
                }
            });
        }
    }
