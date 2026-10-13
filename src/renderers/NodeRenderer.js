/**
 * Class responsible for managing visual HTML nodes and groups on the canvas.
 * Supports configurable staggered wave delay via settings,
 * differential node and group lifecycle, automatic bounding box calculation,
 * and smooth glassmorphic container animations.
 */
export class NodeRenderer {
    constructor(containerId = 'nodes-container', groupsContainerId = 'groups-container') {
        this.containerId = containerId;
        this.groupsContainerId = groupsContainerId;
        this.currentNodesMap = new Map();
        this.currentGroupsMap = new Map();
        this.pendingRemovalTimers = new Map();
        this.pendingGroupRemovalTimers = new Map();
        this.pendingHighlightTimers = new Map();
        this.staggerDelay = 70; // default 70ms
        this.trackerRafId = null;
        this.orbitRafId = null;
        this.orbitStartTime = null;
        this.activeOrbits = [];

        // Auto-realign groups on window resize
        window.addEventListener('resize', () => {
            this.realignGroups();
        });

        // Use ResizeObserver for responsive layout container tracking
        if (typeof window !== 'undefined' && window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
                this.realignGroups();
            });

            // Observe canvas container when available
            setTimeout(() => {
                const canvasEl = document.getElementById('canvas-container') || document.getElementById('canvas-wrapper');
                if (canvasEl && this.resizeObserver) {
                    this.resizeObserver.observe(canvasEl);
                }
            }, 50);
        }
    }

    startTransitionTracker(durationMs = 900) {
        if (this.trackerRafId) {
            cancelAnimationFrame(this.trackerRafId);
        }

        const startTime = performance.now();
        const track = () => {
            this.realignGroups();
            if (performance.now() - startTime < durationMs) {
                this.trackerRafId = requestAnimationFrame(track);
            } else {
                this.realignGroups(); // Final settling pass
                this.trackerRafId = null;
            }
        };

        this.trackerRafId = requestAnimationFrame(track);
    }

    setStaggerDelay(ms) {
        this.staggerDelay = Math.max(0, ms);
    }

    getContainer() {
        return document.getElementById(this.containerId);
    }

    getGroupsContainer() {
        let groupsContainer = document.getElementById(this.groupsContainerId);
        if (!groupsContainer) {
            const nodesContainer = this.getContainer();
            if (nodesContainer && nodesContainer.parentNode) {
                groupsContainer = document.createElement('div');
                groupsContainer.id = this.groupsContainerId;
                groupsContainer.className = 'absolute inset-0 z-0 pointer-events-none';
                nodesContainer.parentNode.insertBefore(groupsContainer, nodesContainer);
            }
        }
        return groupsContainer;
    }

    getGroupHeadersContainer() {
        let container = document.getElementById('group-headers-container');
        if (!container) {
            const nodesContainer = this.getContainer();
            if (nodesContainer && nodesContainer.parentNode) {
                container = document.createElement('div');
                container.id = 'group-headers-container';
                container.className = 'absolute inset-0 pointer-events-none';
                container.style.zIndex = '18';
                nodesContainer.parentNode.insertBefore(container, nodesContainer);
            }
        }
        return container;
    }

    clear() {
        this.stopOrbit();

        if (this.trackerRafId) {
            cancelAnimationFrame(this.trackerRafId);
            this.trackerRafId = null;
        }

        this.pendingRemovalTimers.forEach(timer => clearTimeout(timer));
        this.pendingRemovalTimers.clear();

        this.pendingGroupRemovalTimers.forEach(timer => clearTimeout(timer));
        this.pendingGroupRemovalTimers.clear();

        const container = this.getContainer();
        if (container) {
            container.innerHTML = '';
        }

        const groupsContainer = this.getGroupsContainer();
        if (groupsContainer) {
            groupsContainer.innerHTML = '';
        }

        const groupHeadersContainer = this.getGroupHeadersContainer();
        if (groupHeadersContainer) {
            groupHeadersContainer.innerHTML = '';
        }

        this.currentNodesMap = new Map();
        this.currentGroupsMap = new Map();
    }

    calculateGroupBounds(groupData, nodesMap) {
        // 1. If explicit coordinates and dimensions are given
        if (groupData.x !== null && groupData.y !== null && groupData.width !== null && groupData.height !== null) {
            const w = Math.min(98, groupData.width);
            const h = Math.min(98, groupData.height);
            const left = Math.max(1, Math.min(99 - w, groupData.x - w / 2));
            const top = Math.max(1, Math.min(99 - h, groupData.y - h / 2));
            return { left, top, width: w, height: h };
        }

        // 2. Compute automatic bounding box from member nodes
        const memberNodeIds = (groupData.nodes || []);
        const memberNodes = memberNodeIds
            .map(nId => nodesMap.get(nId))
            .filter(Boolean);

        if (memberNodes.length === 0) return null;

        const groupsContainer = this.getGroupsContainer();
        const containerW = groupsContainer && groupsContainer.offsetWidth > 100
            ? groupsContainer.offsetWidth
            : (groupsContainer && groupsContainer.clientWidth > 100 ? groupsContainer.clientWidth : 850);
        const containerH = groupsContainer && groupsContainer.offsetHeight > 100
            ? groupsContainer.offsetHeight
            : (groupsContainer && groupsContainer.clientHeight > 100 ? groupsContainer.clientHeight : 550);

        const customPad = groupData.padding !== null && !isNaN(groupData.padding) ? groupData.padding : null;
        const padX_pct = customPad !== null ? (customPad / containerW) * 100 : (26 / containerW) * 100;
        const padTop_pct = customPad !== null ? (customPad / containerH) * 100 : (32 / containerH) * 100;
        const padBottom_pct = customPad !== null ? (customPad / containerH) * 100 : (24 / containerH) * 100;

        const nodeBounds = [];

        // Compute individual bounding rect for each member node with its specific width & height
        memberNodes.forEach(nodeData => {
            const cx = nodeData.x;
            const cy = nodeData.y;

            let nodeHalfW = 100;
            let nodeHalfH = 36;

            const el = document.getElementById(`node-${nodeData.id}`);
            if (el && el.offsetWidth > 0) {
                nodeHalfW = el.offsetWidth / 2;
                nodeHalfH = el.offsetHeight / 2;
            } else if (nodeData.shape === 'circle') {
                const s = nodeData.size || 68;
                nodeHalfW = s / 2;
                nodeHalfH = s / 2 + 16;
            } else {
                // Fallback estimation based on content if DOM element is not yet sized
                const hasIcon = Boolean(nodeData.icon && nodeData.icon.trim() !== '');
                const nameLen = (nodeData.name || '').length;
                if (hasIcon) {
                    nodeHalfW = Math.max(100, (44 + 14 + 28 + nameLen * 10) / 2);
                } else {
                    nodeHalfW = Math.max(100, (40 + nameLen * 12) / 2);
                }
                nodeHalfH = 36;
            }

            const nodeHalfW_pct = (nodeHalfW / containerW) * 100;
            const nodeHalfH_pct = (nodeHalfH / containerH) * 100;

            nodeBounds.push({
                left: cx - nodeHalfW_pct,
                right: cx + nodeHalfW_pct,
                top: cy - nodeHalfH_pct,
                bottom: cy + nodeHalfH_pct
            });
        });

        const minLeft = Math.min(...nodeBounds.map(b => b.left));
        const maxRight = Math.max(...nodeBounds.map(b => b.right));
        const minTop = Math.min(...nodeBounds.map(b => b.top));
        const maxBottom = Math.max(...nodeBounds.map(b => b.bottom));

        const left = minLeft - padX_pct;
        const top = minTop - padTop_pct;
        const width = (maxRight - minLeft) + padX_pct * 2;
        const height = (maxBottom - minTop) + padTop_pct + padBottom_pct;

        return { left, top, width, height };
    }

    realignGroups(nodesMap = null, groupsMap = null) {
        const targetNodes = nodesMap || this.currentNodesMap;
        const targetGroups = groupsMap || this.currentGroupsMap;
        const groupsContainer = this.getGroupsContainer();
        if (!groupsContainer || targetGroups.size === 0) return;

        targetGroups.forEach((groupData, id) => {
            const bounds = this.calculateGroupBounds(groupData, targetNodes);
            if (!bounds) return;

            const groupEl = document.getElementById(`node-group-${id}`);
            if (groupEl) {
                groupEl.style.left = `${bounds.left}%`;
                groupEl.style.top = `${bounds.top}%`;
                groupEl.style.width = `${bounds.width}%`;
                groupEl.style.height = `${bounds.height}%`;
            }

            const headerEl = document.getElementById(`node-group-header-${id}`);
            if (headerEl) {
                headerEl.style.left = `${bounds.left}%`;
                headerEl.style.top = `${bounds.top}%`;
                headerEl.style.width = `${bounds.width}%`;
                headerEl.style.height = `${bounds.height}%`;
            }
        });
    }

    createGroupElement(groupData, bounds, id, staggerIndex = 0, totalNodesCount = 0) {
        const color = groupData.color || '#38bdf8';
        const borderStyle = groupData.border === 'solid' ? '1.5px solid' : '1.5px dashed';
        const iconHtml = groupData.icon ? `<i class="fa-solid ${groupData.icon}"></i>` : `<i class="fa-solid fa-layer-group text-xs"></i>`;

        // Groups animate in AFTER the nodes, spaced sequentially one by one!
        const baseNodeDelay = Math.max(380, totalNodesCount * this.staggerDelay + 120);
        const groupDelay = baseNodeDelay + staggerIndex * 360;

        const groupEl = document.createElement('div');
        groupEl.id = `node-group-${id}`;
        groupEl.className = 'node-group-container absolute rounded-none pointer-events-none transition-all duration-500 ease-out node-bloom';
        groupEl.style.left = `${bounds.left}%`;
        groupEl.style.top = `${bounds.top}%`;
        groupEl.style.width = `${bounds.width}%`;
        groupEl.style.height = `${bounds.height}%`;
        groupEl.style.border = `${borderStyle} ${color}45`;
        groupEl.style.backgroundColor = `${color}08`;
        groupEl.style.boxShadow = `0 0 30px ${color}12, inset 0 0 20px ${color}06`;
        groupEl.style.animationDelay = `${groupDelay}ms`;

        groupEl.innerHTML = `
            <!-- Sharp Cyber Corner Accents -->
            <div class="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2" style="border-color: ${color}90;"></div>
            <div class="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2" style="border-color: ${color}90;"></div>
            <div class="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2" style="border-color: ${color}90;"></div>
            <div class="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2" style="border-color: ${color}90;"></div>
        `;

        groupEl.addEventListener('animationend', () => {
            if (!groupEl.classList.contains('node-exit')) {
                groupEl.classList.remove('node-bloom');
                groupEl.classList.add('node-visible');
                groupEl.style.animationDelay = '';
            }
        }, { once: true });

        // Header element placed into groupHeadersContainer (z-index: 18 - in front of lines)
        if (groupData.name) {
            const align = groupData.align || 'center';
            let alignClasses = 'left-1/2 -translate-x-1/2';
            if (align === 'left' || align === 'start') {
                alignClasses = 'left-4';
            } else if (align === 'right' || align === 'end') {
                alignClasses = 'right-4';
            }

            const headerWrapper = document.createElement('div');
            headerWrapper.id = `node-group-header-${id}`;
            headerWrapper.className = 'node-group-header-wrapper absolute rounded-none pointer-events-none transition-all duration-500 ease-out node-bloom';
            headerWrapper.style.left = `${bounds.left}%`;
            headerWrapper.style.top = `${bounds.top}%`;
            headerWrapper.style.width = `${bounds.width}%`;
            headerWrapper.style.height = `${bounds.height}%`;
            headerWrapper.style.animationDelay = `${groupDelay}ms`;

            headerWrapper.innerHTML = `
                <div class="absolute -top-3.5 ${alignClasses} px-3 py-1 rounded-md font-mono text-xs md:text-[13px] font-bold tracking-wider uppercase flex items-center space-x-2 shadow-lg transition-all duration-300 group-header whitespace-nowrap"
                     style="background: #090d16; color: ${color}; border: 1px solid ${color}55; box-shadow: 0 4px 14px rgba(0,0,0,0.7); backdrop-filter: blur(12px);">
                    ${iconHtml}
                    <span>${groupData.name}</span>
                </div>
            `;

            headerWrapper.addEventListener('animationend', () => {
                if (!headerWrapper.classList.contains('node-exit')) {
                    headerWrapper.classList.remove('node-bloom');
                    headerWrapper.classList.add('node-visible');
                    headerWrapper.style.animationDelay = '';
                }
            }, { once: true });

            const groupHeadersContainer = this.getGroupHeadersContainer();
            if (groupHeadersContainer) {
                const existingHeader = document.getElementById(`node-group-header-${id}`);
                if (existingHeader) existingHeader.remove();
                groupHeadersContainer.appendChild(headerWrapper);
            }
        }

        return groupEl;
    }

    renderCircleContent(nodeData) {
        const hasIcon = Boolean(nodeData.icon && nodeData.icon.trim() !== '');
        const hasDescription = Boolean(nodeData.description && nodeData.description.trim() !== '');
        const color = nodeData.color || '#38bdf8';
        const isHighlighted = Boolean(nodeData.highlight);

        const titleHighlightClass = isHighlighted ? 'node-title-highlighted text-cyan-300' : 'text-white';
        const rawIcon = nodeData.icon ? nodeData.icon.trim() : 'fa-circle-nodes';
        let iconHtml = '';
        if (rawIcon.startsWith('fa-') || rawIcon.includes('fa-') || rawIcon.startsWith('fab ') || rawIcon.startsWith('fas ') || rawIcon.startsWith('far ')) {
            const iconClass = rawIcon.includes(' ')
                ? rawIcon
                : (rawIcon.startsWith('fa-') ? `fa-solid ${rawIcon}` : `fa-solid fa-${rawIcon}`);
            iconHtml = `<i class="${iconClass}"></i>`;
        } else {
            iconHtml = `<span class="font-mono font-bold text-sm md:text-base leading-none tracking-tight">${rawIcon}</span>`;
        }

        const highlightOrbClass = isHighlighted ? 'node-card-highlighted' : '';
        const iconHighlightClass = isHighlighted ? 'node-icon-highlighted' : '';

        // Dynamic size (default 68px)
        const sizePx = nodeData.size || 68;

        const circleStyle = `background: radial-gradient(circle at 35% 30%, rgba(30, 42, 70, 0.96) 0%, rgba(14, 20, 36, 0.98) 60%, rgba(8, 14, 28, 0.99) 100%); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.18); box-shadow: 0 12px 26px -4px rgba(0, 0, 0, 0.65), inset 0 1px 1px rgba(255, 255, 255, 0.22);`;

        return `
            <div class="node-circle-wrapper flex items-center justify-center relative select-none" style="width: ${sizePx}px; height: ${sizePx}px;">
                <!-- Title & Description placed ON TOP above circle -->
                <div class="node-circle-title-container absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-colors duration-500 whitespace-nowrap">
                    <div class="node-title-text ${titleHighlightClass} tracking-tight text-center leading-tight drop-shadow-md">${nodeData.name}</div>
                    ${hasDescription ? `<div class="node-desc-text text-[10px] font-mono ${isHighlighted ? 'text-cyan-200/90' : 'text-slate-400'} mt-0.5 text-center">${nodeData.description}</div>` : ''}
                </div>

                <!-- Outer Technical Orbit Ring -->
                <div class="absolute -inset-2 rounded-full border border-dashed pointer-events-none opacity-25 node-circle-tech-ring" style="border-color: ${color};"></div>

                <!-- Center Glass Circle Core -->
                <div class="glass-card node-glass-card node-circle-orb rounded-full w-full h-full flex items-center justify-center relative overflow-hidden shadow-xl ${highlightOrbClass} cursor-default group" style="${circleStyle}">
                    <!-- Ambient Shimmer Sweep Layer -->
                    <div class="node-shimmer-sweep-layer absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"></div>

                    <!-- Center Holographic Icon -->
                    <div class="node-icon-box node-circle-icon text-xl md:text-2xl flex items-center justify-center transition-transform duration-500 relative z-10 ${iconHighlightClass}" 
                         style="color: ${color}; filter: drop-shadow(0 0 6px ${color}60);">
                        ${iconHtml}
                    </div>
                </div>
            </div>
        `;
    }

    renderNodeContent(nodeData) {
        if (nodeData.shape === 'circle') {
            return this.renderCircleContent(nodeData);
        }

        const color = nodeData.color || '#38bdf8';
        const isHighlighted = Boolean(nodeData.highlight);

        const getDefaultIcon = (name) => {
            const n = (name || '').toLowerCase();
            if (n.includes('shader')) return 'fa-microchip';
            if (n.includes('glsl') || n.includes('wgsl') || n.includes('tsl') || n.includes('embed')) return 'fa-file-code';
            if (n.includes('buffer') || n.includes('database')) return 'fa-database';
            if (n.includes('attribute')) return 'fa-vector-square';
            if (n.includes('event')) return 'fa-bolt';
            if (n.includes('setup')) return 'fa-gears';
            if (n.includes('analyze') || n.includes('diffuse') || n.includes('specular') || n.includes('dot')) return 'fa-chart-pie';
            if (n.includes('generate')) return 'fa-code';
            if (n.includes('vertex')) return 'fa-draw-polygon';
            if (n.includes('fragment')) return 'fa-brush';
            if (n.includes('compute')) return 'fa-server';
            if (n.includes('color')) return 'fa-palette';
            if (n.includes('node')) return 'fa-cube';
            return 'fa-cube';
        };

        const rawIcon = nodeData.icon ? nodeData.icon.trim() : getDefaultIcon(nodeData.name);
        const iconClass = rawIcon.includes(' ')
            ? rawIcon
            : (rawIcon.startsWith('fa-') ? `fa-solid ${rawIcon}` : `fa-solid fa-${rawIcon}`);

        const hasDescription = Boolean(nodeData.description && nodeData.description.trim() !== '');
        const titleHighlightClass = isHighlighted ? 'node-title-highlighted text-cyan-300' : 'text-slate-100 group-hover:text-cyan-300';

        // Dynamic description element
        const descriptionHtml = hasDescription ? `
            <div class="node-desc-text text-[10px] font-mono ${isHighlighted ? 'text-cyan-200/90' : 'text-slate-400'} whitespace-nowrap mt-0.5">${nodeData.description}</div>
        ` : '';

        // Maintain node physical size & aesthetic balance with flexible auto-expansion
        const layoutClasses = 'px-6 py-3.5 min-h-[64px] min-w-[200px] w-max max-w-[340px] justify-center';
        const highlightCardClass = isHighlighted ? 'node-card-highlighted' : 'border-white/10 hover:border-cyan-400/40';
        const shimmerClass = isHighlighted ? 'node-shimmer-sweep' : '';

        // Pure Crystalline Technical Dark Glass Architecture (Matching celestial circle depth)
        const cardStyle = `background: radial-gradient(circle at 25% 25%, rgba(26, 38, 66, 0.95) 0%, rgba(12, 18, 34, 0.98) 70%, rgba(8, 14, 28, 0.99) 100%); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.16); border-bottom-color: ${color}55; box-shadow: 0 14px 30px -4px rgba(0, 0, 0, 0.7), 0 0 14px ${color}12, inset 0 1px 1px rgba(255, 255, 255, 0.2);`;

        return `
            <div class="glass-card node-glass-card ${layoutClasses} rounded-xl shadow-xl flex items-center ${highlightCardClass} group cursor-default relative overflow-hidden" style="${cardStyle}">
                <!-- Large Background Holographic Icon Watermark -->
                <div class="node-bg-icon absolute -right-2 -bottom-2.5 text-5xl md:text-6xl pointer-events-none select-none transition-all duration-700 z-0 opacity-15 overflow-hidden flex items-center justify-center" 
                     style="color: ${color}; filter: drop-shadow(0 0 10px ${color}80);">
                    <i class="${iconClass}"></i>
                </div>

                <!-- Ambient Inner Glow Shimmer -->
                <div class="node-shimmer-sweep-layer absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/10 to-transparent ${shimmerClass} pointer-events-none overflow-hidden"></div>
                
                <!-- Foreground Name & Description Typography -->
                <div class="w-full flex flex-col items-center justify-center text-center relative z-20">
                    <div class="node-title-text whitespace-nowrap ${titleHighlightClass}">${nodeData.name}</div>
                    ${descriptionHtml}
                </div>
            </div>
        `;
    }

    updateExistingNodeElement(nodeEl, nodeData, hasDeactivatingHighlights = false) {
        const cardEl = nodeEl.querySelector('.node-glass-card');
        const bgIconEl = nodeEl.querySelector('.node-bg-icon');
        const iconBox = nodeEl.querySelector('.node-icon-box');
        const titleEl = nodeEl.querySelector('.node-title-text');
        const descEl = nodeEl.querySelector('.node-desc-text');
        const shimmerEl = nodeEl.querySelector('.node-shimmer-sweep-layer');

        if (!cardEl) {
            // Fallback if structure not found
            nodeEl.innerHTML = this.renderNodeContent(nodeData);
            return;
        }

        const color = nodeData.color || '#38bdf8';
        const isHighlighted = Boolean(nodeData.highlight);

        // 1. Highlight states sync
        if (isHighlighted) {
            cardEl.classList.add('node-card-highlighted');
            cardEl.classList.remove('border-white/10', 'hover:border-cyan-400/40');
            if (iconBox) iconBox.classList.add('node-icon-highlighted');
            if (titleEl) {
                titleEl.classList.add('node-title-highlighted', 'text-cyan-300');
                titleEl.classList.remove('text-white');
            }
            if (shimmerEl) {
                shimmerEl.classList.remove('node-shimmer-sweep');
                void shimmerEl.offsetWidth; // force reflow for smooth re-trigger
                shimmerEl.classList.add('node-shimmer-sweep');
            }
        } else {
            cardEl.classList.remove('node-card-highlighted');
            cardEl.classList.add('border-white/10', 'hover:border-cyan-400/40');
            if (iconBox) iconBox.classList.remove('node-icon-highlighted');
            if (titleEl) {
                titleEl.classList.remove('node-title-highlighted', 'text-cyan-300');
                titleEl.classList.add('text-white');
            }
            if (shimmerEl) {
                shimmerEl.classList.remove('node-shimmer-sweep');
            }
        }

        // 2. Name & Description Text Sync
        if (titleEl) {
            if (titleEl.innerText !== nodeData.name) {
                titleEl.innerText = nodeData.name;
            }

            const titleHighlightClass = isHighlighted ? 'node-title-highlighted text-cyan-300' : 'text-white group-hover:text-cyan-300';
            titleEl.className = `node-title-text ${titleHighlightClass}`;
        }
        if (descEl && nodeData.description && descEl.innerText !== nodeData.description) {
            descEl.innerText = nodeData.description;
        }
    }

    createNodeElement(nodeData, id, staggerIndex = 0, hasDeactivatingHighlights = false) {
        const nodeEl = document.createElement('div');
        nodeEl.id = `node-${id}`;
        nodeEl.className = 'absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto node-element node-bloom';
        nodeEl.style.left = `${nodeData.x}%`;
        nodeEl.style.top = `${nodeData.y}%`;
        nodeEl.style.animationDelay = `${staggerIndex * this.staggerDelay}ms`;

        // If another node is currently deactivating, mount in normal resting state first
        const initialData = (nodeData.highlight && hasDeactivatingHighlights)
            ? { ...nodeData, highlight: false }
            : nodeData;

        nodeEl.innerHTML = this.renderNodeContent(initialData);

        if (nodeData.highlight && hasDeactivatingHighlights) {
            const timer = setTimeout(() => {
                this.updateExistingNodeElement(nodeEl, nodeData, false);
                this.pendingHighlightTimers.delete(id);
            }, 1500);
            this.pendingHighlightTimers.set(id, timer);
        }

        nodeEl.addEventListener('animationend', () => {
            if (!nodeEl.classList.contains('node-exit')) {
                nodeEl.classList.remove('node-bloom');
                nodeEl.classList.add('node-visible');
                nodeEl.style.animationDelay = '';
            }
        }, { once: true });

        return nodeEl;
    }

    update(targetNodesMap, targetGroupsMap, targetEdgesSet = null) {
        const container = this.getContainer();
        if (!container) return;

        const incomingMap = targetNodesMap || new Map();
        const incomingGroups = targetGroupsMap || new Map();
        const groupsContainer = this.getGroupsContainer();

        // Check if any previously highlighted node is turning OFF in this transition
        let hasDeactivatingHighlights = false;
        this.currentNodesMap.forEach((prevNode, id) => {
            const nextNode = incomingMap.get(id);
            if (prevNode.highlight && (!nextNode || !nextNode.highlight)) {
                hasDeactivatingHighlights = true;
            }
        });

        // -------------------------------------------------------------
        // 1. NODES LIFECYCLE MANAGEMENT (Update/mount nodes first so sizes are accurate)
        // -------------------------------------------------------------
        // A. Handle Exiting Nodes
        this.currentNodesMap.forEach((nodeData, id) => {
            if (!incomingMap.has(id)) {
                const nodeEl = document.getElementById(`node-${id}`);
                if (nodeEl && !this.pendingRemovalTimers.has(id)) {
                    nodeEl.classList.remove('node-bloom', 'node-visible');
                    nodeEl.classList.add('node-exit');
                    nodeEl.style.animationDelay = '0ms';

                    const timer = setTimeout(() => {
                        if (nodeEl && nodeEl.parentNode) {
                            nodeEl.parentNode.removeChild(nodeEl);
                        }
                        this.pendingRemovalTimers.delete(id);
                    }, 360);

                    this.pendingRemovalTimers.set(id, timer);
                }
            }
        });

        // B. Handle Incoming Nodes (Existing vs Brand New)
        let newStaggerIdx = 0;
        incomingMap.forEach((nodeData, id) => {
            if (this.pendingRemovalTimers.has(id)) {
                clearTimeout(this.pendingRemovalTimers.get(id));
                this.pendingRemovalTimers.delete(id);
            }

            let nodeEl = document.getElementById(`node-${id}`);

            if (!nodeEl || nodeEl.parentElement !== container) {
                // BRAND NEW NODE: Create with staggered entrance bloom animation!
                if (nodeEl) nodeEl.remove();
                nodeEl = this.createNodeElement(nodeData, id, newStaggerIdx, hasDeactivatingHighlights);
                container.appendChild(nodeEl);
                newStaggerIdx++;
            } else {
                // PRE-EXISTING NODE: DO NOT re-trigger entrance animation!
                nodeEl.classList.remove('node-bloom', 'node-exit');
                nodeEl.classList.add('node-visible');
                nodeEl.style.animationDelay = '';

                nodeEl.style.left = `${nodeData.x}%`;
                nodeEl.style.top = `${nodeData.y}%`;

                // Smoothly update existing DOM elements with sequential highlight orchestration
                this.updateExistingNodeElement(nodeEl, nodeData, hasDeactivatingHighlights);
            }
        });

        this.currentNodesMap = new Map();
        incomingMap.forEach((v, k) => this.currentNodesMap.set(k, { ...v }));

        // -------------------------------------------------------------
        // 2. GROUPS LIFECYCLE MANAGEMENT
        // -------------------------------------------------------------
        if (groupsContainer) {
            // A. Handle Exiting Groups
            this.currentGroupsMap.forEach((groupData, id) => {
                if (!incomingGroups.has(id)) {
                    const groupEl = document.getElementById(`node-group-${id}`);
                    const headerEl = document.getElementById(`node-group-header-${id}`);
                    if ((groupEl || headerEl) && !this.pendingGroupRemovalTimers.has(id)) {
                        if (groupEl) {
                            groupEl.classList.remove('node-bloom', 'node-visible');
                            groupEl.classList.add('node-exit');
                            groupEl.style.animationDelay = '0ms';
                        }
                        if (headerEl) {
                            headerEl.classList.remove('node-bloom', 'node-visible');
                            headerEl.classList.add('node-exit');
                            headerEl.style.animationDelay = '0ms';
                        }

                        const timer = setTimeout(() => {
                            if (groupEl && groupEl.parentNode) {
                                groupEl.parentNode.removeChild(groupEl);
                            }
                            if (headerEl && headerEl.parentNode) {
                                headerEl.parentNode.removeChild(headerEl);
                            }
                            this.pendingGroupRemovalTimers.delete(id);
                        }, 360);

                        this.pendingGroupRemovalTimers.set(id, timer);
                    }
                }
            });

            // B. Handle Incoming Groups (Create vs Morph Existing)
            let groupStaggerIdx = 0;
            incomingGroups.forEach((groupData, id) => {
                if (this.pendingGroupRemovalTimers.has(id)) {
                    clearTimeout(this.pendingGroupRemovalTimers.get(id));
                    this.pendingGroupRemovalTimers.delete(id);
                }

                const bounds = this.calculateGroupBounds(groupData, incomingMap);
                if (!bounds) return;

                let groupEl = document.getElementById(`node-group-${id}`);
                let headerEl = document.getElementById(`node-group-header-${id}`);
                const color = groupData.color || '#38bdf8';
                const borderStyle = groupData.border === 'solid' ? '1.5px solid' : '1.5px dashed';

                if (!groupEl || groupEl.parentElement !== groupsContainer) {
                    if (groupEl) groupEl.remove();
                    if (headerEl) headerEl.remove();
                    groupEl = this.createGroupElement(groupData, bounds, id, groupStaggerIdx, incomingMap.size);
                    groupsContainer.appendChild(groupEl);
                    groupStaggerIdx++;
                } else {
                    groupEl.classList.remove('node-bloom', 'node-exit');
                    groupEl.classList.add('node-visible');
                    groupEl.style.animationDelay = '';

                    groupEl.style.left = `${bounds.left}%`;
                    groupEl.style.top = `${bounds.top}%`;
                    groupEl.style.width = `${bounds.width}%`;
                    groupEl.style.height = `${bounds.height}%`;
                    groupEl.style.border = `${borderStyle} ${color}45`;
                    groupEl.style.backgroundColor = `${color}08`;
                    groupEl.style.boxShadow = `0 0 30px ${color}12, inset 0 0 20px ${color}06`;

                    if (headerEl) {
                        headerEl.classList.remove('node-bloom', 'node-exit');
                        headerEl.classList.add('node-visible');
                        headerEl.style.animationDelay = '';
                        headerEl.style.left = `${bounds.left}%`;
                        headerEl.style.top = `${bounds.top}%`;
                        headerEl.style.width = `${bounds.width}%`;
                        headerEl.style.height = `${bounds.height}%`;

                        const innerBadge = headerEl.querySelector('.group-header');
                        if (innerBadge) {
                            innerBadge.style.color = color;
                            innerBadge.style.borderColor = `${color}55`;
                            const align = groupData.align || 'center';
                            innerBadge.classList.remove('left-1/2', '-translate-x-1/2', 'left-4', 'right-4');
                            if (align === 'left' || align === 'start') {
                                innerBadge.classList.add('left-4');
                            } else if (align === 'right' || align === 'end') {
                                innerBadge.classList.add('right-4');
                            } else {
                                innerBadge.classList.add('left-1/2', '-translate-x-1/2');
                            }
                            const span = innerBadge.querySelector('span');
                            if (span) span.innerText = groupData.name;
                        }
                    }
                }
            });

            this.currentGroupsMap = new Map();
            incomingGroups.forEach((v, k) => this.currentGroupsMap.set(k, { ...v }));
        }

        // Track and align groups smoothly across layout/flex transitions (900ms)
        this.realignGroups(incomingMap, incomingGroups);
        this.startTransitionTracker(900);

        // -------------------------------------------------------------
        // 3. ORBITAL ROTATION MANAGEMENT (orbit="true")
        // -------------------------------------------------------------
        const orbits = [];
        incomingMap.forEach((nodeData, id) => {
            if (nodeData.orbit) {
                const hubId = id;
                const hubX = nodeData.x;
                const hubY = nodeData.y;

                // Identify satellite nodes connected to hubId via targetEdgesSet
                const connectedIds = new Set();
                if (targetEdgesSet && targetEdgesSet.size > 0) {
                    targetEdgesSet.forEach(edgeKey => {
                        const [sourcePart, targetPart] = edgeKey.split('->');
                        const sId = (sourcePart || '').split(':')[0].trim();
                        const tId = (targetPart || '').split(':')[0].split('#')[0].trim();
                        if (sId === hubId && incomingMap.has(tId) && tId !== hubId) {
                            connectedIds.add(tId);
                        } else if (tId === hubId && incomingMap.has(sId) && sId !== hubId) {
                            connectedIds.add(sId);
                        }
                    });
                }

                let satelliteIds = Array.from(connectedIds);
                if (satelliteIds.length === 0) {
                    satelliteIds = Array.from(incomingMap.keys()).filter(k => k !== hubId);
                }

                // 1. Calculate direction & starting angle for each satellite
                const satellites = [];
                satelliteIds.forEach(satId => {
                    const satData = incomingMap.get(satId);
                    if (!satData) return;

                    const dx = satData.x - hubX;
                    const dy = satData.y - hubY;
                    const initialAngle = Math.atan2(dy, dx);

                    satellites.push({
                        id: satId,
                        startAngle: initialAngle,
                        speed: (nodeData.orbitSpeed || 1) * (satData.orbitSpeed || 1)
                    });
                });

                // 2. Fixed invariant orbit radius ratio (e.g. 26% of stage width)
                let rVal = 26;
                if (nodeData.orbitRadius && !isNaN(parseFloat(nodeData.orbitRadius))) {
                    rVal = parseFloat(nodeData.orbitRadius);
                }
                const radiusRatio = (rVal > 1) ? (rVal / 100) : rVal;

                if (satellites.length > 0) {
                    orbits.push({
                        hubId: hubId,
                        hubX: hubX,
                        hubY: hubY,
                        radiusRatio: radiusRatio,
                        satellites: satellites
                    });
                }
            }
        });

        if (orbits.length > 0) {
            this.startOrbit(orbits);
        } else {
            this.stopOrbit();
        }
    }

    startOrbit(orbits) {
        this.activeOrbits = orbits;
        if (!this.orbitStartTime) {
            this.orbitStartTime = performance.now();
        }
        if (this.orbitRafId) {
            cancelAnimationFrame(this.orbitRafId);
            this.orbitRafId = null;
        }

        const groupsContainer = this.getGroupsContainer();

        // 1. Create or sync single subtle celestial orbit track ring
        if (groupsContainer) {
            const activeRingIds = new Set();
            this.activeOrbits.forEach(orbit => {
                const hubNode = this.currentNodesMap.get(orbit.hubId);
                const hubColor = (hubNode && hubNode.color) || '#38bdf8';
                const ringId = `orbit-track-${orbit.hubId}`;
                activeRingIds.add(ringId);

                let ringEl = document.getElementById(ringId);
                if (!ringEl) {
                    ringEl = document.createElement('div');
                    ringEl.id = ringId;
                    ringEl.className = 'orbit-track-ring absolute pointer-events-none rounded-full';
                    ringEl.style.border = `1.5px dashed ${hubColor}40`;
                    ringEl.style.boxShadow = `0 0 25px ${hubColor}10, inset 0 0 25px ${hubColor}08`;
                    ringEl.style.transform = 'translate(-50%, -50%)';
                    ringEl.style.opacity = '0';
                    groupsContainer.appendChild(ringEl);

                    requestAnimationFrame(() => {
                        ringEl.style.opacity = '1';
                    });
                }
            });

            // Cleanup non-active rings
            groupsContainer.querySelectorAll('.orbit-track-ring').forEach(el => {
                if (!activeRingIds.has(el.id)) {
                    el.style.opacity = '0';
                    setTimeout(() => el.remove(), 400);
                }
            });
        }

        // 2. Animate Orbit loop (slower speed: ~28 seconds per full revolution)
        const animateOrbit = (now) => {
            if (!this.activeOrbits || this.activeOrbits.length === 0) {
                this.orbitRafId = null;
                return;
            }

            const elapsed = (now - this.orbitStartTime) / 1000; // seconds
            // Base speed: 1 complete revolution every 28 seconds (gentle & majestic)
            const baseAngularSpeed = (Math.PI * 2) / 28;

            const container = this.getContainer();
            const containerW = (container && container.offsetWidth > 100) ? container.offsetWidth : 850;
            const containerH = (container && container.offsetHeight > 100) ? container.offsetHeight : 550;

            this.activeOrbits.forEach(orbit => {
                const { hubId, hubX, hubY, radiusRatio, satellites } = orbit;
                const R_px = radiusRatio * containerW;
                const hubPxX = (hubX / 100) * containerW;
                const hubPxY = (hubY / 100) * containerH;

                // 1. Sync single orbit ring position and diameter with pixel-perfect precision
                const ringEl = document.getElementById(`orbit-track-${hubId}`);
                if (ringEl) {
                    ringEl.style.left = `${hubX}%`;
                    ringEl.style.top = `${hubY}%`;
                    ringEl.style.width = `${R_px * 2}px`;
                    ringEl.style.height = `${R_px * 2}px`;
                }

                // 2. Update satellites along the exact same circular trajectory
                satellites.forEach(sat => {
                    const angle = sat.startAngle + baseAngularSpeed * sat.speed * elapsed;
                    const nodePxX = hubPxX + Math.cos(angle) * R_px;
                    const nodePxY = hubPxY + Math.sin(angle) * R_px;

                    const satEl = document.getElementById(`node-${sat.id}`);
                    if (satEl) {
                        satEl.style.left = `${(nodePxX / containerW) * 100}%`;
                        satEl.style.top = `${(nodePxY / containerH) * 100}%`;
                    }
                });
            });

            this.orbitRafId = requestAnimationFrame(animateOrbit);
        };

        this.orbitRafId = requestAnimationFrame(animateOrbit);
    }

    stopOrbit() {
        if (this.orbitRafId) {
            cancelAnimationFrame(this.orbitRafId);
            this.orbitRafId = null;
        }
        this.activeOrbits = [];
        this.orbitStartTime = null;

        const groupsContainer = this.getGroupsContainer();
        if (groupsContainer) {
            groupsContainer.querySelectorAll('.orbit-track-ring').forEach(el => {
                el.style.opacity = '0';
                setTimeout(() => el.remove(), 400);
            });
        }
    }
}
