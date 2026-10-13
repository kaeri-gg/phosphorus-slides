function parseBoolAttr(el, attrName, defaultValue = false) {
    if (!el || !el.hasAttribute(attrName)) return defaultValue;
    const val = (el.getAttribute(attrName) || '').trim().toLowerCase();
    if (val === 'false' || val === '0' || val === 'no' || val === 'null' || val === 'none' || val === 'off') {
        return false;
    }
    return true;
}

export class StepParser {
    static parse(rawMarkdown) {
        let content = rawMarkdown;

        // Clean html comments
        content = content.replace(/<!--[\s\S]*?-->/g, '');

        // Escape HTML special characters inside <code ...>...</code> tags before DOMParser
        // so code symbols like <map_fragment>, <T>, or generic types are not stripped as HTML elements
        content = content.replace(/(<code\b[^>]*>)([\s\S]*?)(<\/code>)/gi, (match, openTag, codeBody, closeTag) => {
            const escapedBody = codeBody
                .replace(/&(?!(amp|lt|gt|quot|#39|apos);)/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            return `${openTag}${escapedBody}${closeTag}`;
        });

        // Wrap in a root element for parsing
        const wrappedXml = `<presentation>${content}</presentation>`;
        const parser = new DOMParser();
        const doc = parser.parseFromString(wrappedXml, 'text/html');

        const settings = {};
        const steps = [];

        // Track timeline, gallery and chart definitions across steps
        const timelineRegistry = new Map();
        let lastRegisteredTimeline = null;

        const galleryRegistry = new Map();
        let lastRegisteredGallery = null;

        const chartRegistry = new Map();
        let lastRegisteredChart = null;

        // 1. Extract Global Settings
        doc.querySelectorAll('presentation > setting, presentation > settings').forEach(settingEl => {
            const name = settingEl.getAttribute('name');
            const value = settingEl.getAttribute('value');
            if (name && value) {
                settings[name] = value;
            }

            // Check resolution setting e.g. <setting name="resolution" width="1920" height="1080">
            // or <setting name="resolution" value="1920x1080"> or <settings name="resolution" width="..." height="...">
            if (name === 'resolution' || settingEl.hasAttribute('resolution') || (settingEl.hasAttribute('width') && settingEl.hasAttribute('height'))) {
                let w = settingEl.getAttribute('width') || settingEl.getAttribute('w');
                let h = settingEl.getAttribute('height') || settingEl.getAttribute('h');
                const rawVal = value || settingEl.getAttribute('resolution') || '';

                if (rawVal && (!w || !h)) {
                    if (rawVal.toLowerCase().includes('x')) {
                        const parts = rawVal.toLowerCase().split('x');
                        w = parts[0].trim();
                        h = parts[1].trim();
                    } else if (rawVal.includes(':')) {
                        const parts = rawVal.split(':');
                        const ratioW = parseFloat(parts[0]);
                        const ratioH = parseFloat(parts[1]);
                        if (ratioW && ratioH) {
                            w = 1920;
                            h = Math.round(1920 * (ratioH / ratioW));
                        }
                    }
                }

                if (w && h) {
                    const parsedW = parseInt(w, 10);
                    const parsedH = parseInt(h, 10);
                    const fitMode = (settingEl.getAttribute('fit') || settingEl.getAttribute('mode') || 'contain').toLowerCase();
                    if (!isNaN(parsedW) && !isNaN(parsedH) && parsedW > 100 && parsedH > 100) {
                        settings.resolution = {
                            width: parsedW,
                            height: parsedH,
                            fit: fitMode
                        };
                    }
                }
            }
        });

        // Helper function to process step element
        function processStepElement(stepEl, parentContext = null, siblingIndex = 0) {
            const stepId = stepEl.getAttribute('id') || `step-${steps.length + 1}`;

            // --- 1. Timeline Parsing ---
            const timelineEl = stepEl.querySelector(':scope > timeline');
            let localTimeline = null;

            if (timelineEl) {
                const items = [];
                let activeIndex = parseInt(timelineEl.getAttribute('active') || '0', 10);
                const timelineId = timelineEl.getAttribute('id') || stepId;

                timelineEl.querySelectorAll(':scope > item').forEach((itemEl, idx) => {
                    if (itemEl.getAttribute('active') === 'true') {
                        activeIndex = idx;
                    }
                    items.push({
                        id: itemEl.getAttribute('id') || `t-${idx + 1}`,
                        date: itemEl.getAttribute('date') || '',
                        name: itemEl.getAttribute('name') || itemEl.textContent.trim(),
                        desc: itemEl.getAttribute('desc') || '',
                        icon: itemEl.getAttribute('icon') || ''
                    });
                });

                localTimeline = { id: timelineId, items, activeIndex };
                timelineRegistry.set(timelineId, items);
                lastRegisteredTimeline = { id: timelineId, items };
            }

            const timelineRefAttr = stepEl.getAttribute('timeline') || stepEl.getAttribute('timeline-ref');
            const explicitActiveAttr = stepEl.getAttribute('active') || stepEl.getAttribute('timeline-active') || stepEl.getAttribute('active-item');
            const layoutAttr = stepEl.getAttribute('layout');

            let resolvedTimeline = null;

            if (localTimeline) {
                resolvedTimeline = localTimeline;
            } else if (timelineRefAttr) {
                let targetId = timelineRefAttr;
                let parsedActive = null;

                if (timelineRefAttr.includes(':')) {
                    const parts = timelineRefAttr.split(':');
                    targetId = parts[0];
                    parsedActive = parseInt(parts[1], 10);
                } else if (!isNaN(parseInt(timelineRefAttr, 10)) && !timelineRegistry.has(timelineRefAttr)) {
                    parsedActive = parseInt(timelineRefAttr, 10);
                    targetId = lastRegisteredTimeline ? lastRegisteredTimeline.id : null;
                }

                const targetItems = timelineRegistry.get(targetId) || (lastRegisteredTimeline ? lastRegisteredTimeline.items : null);

                if (targetItems) {
                    let activeIdx = 0;
                    if (explicitActiveAttr !== null && explicitActiveAttr !== undefined && explicitActiveAttr !== '') {
                        activeIdx = parseInt(explicitActiveAttr, 10);
                    } else if (parsedActive !== null) {
                        activeIdx = parsedActive;
                    } else if (parentContext && parentContext.timeline) {
                        activeIdx = parentContext.timeline.activeIndex + 1 + siblingIndex;
                    }

                    activeIdx = Math.max(0, Math.min(activeIdx, targetItems.length - 1));
                    resolvedTimeline = { id: targetId, items: targetItems, activeIndex: activeIdx };
                }
            } else if ((layoutAttr === 'timeline' || (!layoutAttr && parentContext && parentContext.timeline)) && parentContext && parentContext.timeline) {
                let activeIdx = parentContext.timeline.activeIndex;
                if (explicitActiveAttr !== null && explicitActiveAttr !== undefined && explicitActiveAttr !== '') {
                    activeIdx = parseInt(explicitActiveAttr, 10);
                } else {
                    activeIdx = parentContext.timeline.activeIndex + 1 + siblingIndex;
                }
                activeIdx = Math.max(0, Math.min(activeIdx, parentContext.timeline.items.length - 1));
                resolvedTimeline = { id: parentContext.timeline.id, items: parentContext.timeline.items, activeIndex: activeIdx };
            } else if (layoutAttr === 'timeline' && lastRegisteredTimeline) {
                let activeIdx = 0;
                if (explicitActiveAttr !== null && explicitActiveAttr !== undefined && explicitActiveAttr !== '') {
                    activeIdx = parseInt(explicitActiveAttr, 10);
                }
                activeIdx = Math.max(0, Math.min(activeIdx, lastRegisteredTimeline.items.length - 1));
                resolvedTimeline = { id: lastRegisteredTimeline.id, items: lastRegisteredTimeline.items, activeIndex: activeIdx };
            }

            // --- 2. Gallery 3D Parsing ---
            const galleryEl = stepEl.querySelector(':scope > gallery');
            let localGallery = null;

            if (galleryEl) {
                const items = [];
                let activeIndex = parseInt(galleryEl.getAttribute('active') || '0', 10);
                const galleryId = galleryEl.getAttribute('id') || stepId;

                galleryEl.querySelectorAll(':scope > item').forEach((itemEl, idx) => {
                    if (itemEl.getAttribute('active') === 'true') {
                        activeIndex = idx;
                    }
                    items.push({
                        id: itemEl.getAttribute('id') || `g-${idx + 1}`,
                        type: itemEl.getAttribute('type') || 'video',
                        src: itemEl.getAttribute('src') || '',
                        title: itemEl.getAttribute('name') || itemEl.getAttribute('title') || '',
                        name: itemEl.getAttribute('name') || itemEl.getAttribute('title') || '',
                        desc: itemEl.getAttribute('desc') || itemEl.textContent.trim(),
                        poster: itemEl.getAttribute('poster') || ''
                    });
                });

                localGallery = { id: galleryId, items, activeIndex };
                galleryRegistry.set(galleryId, items);
                lastRegisteredGallery = { id: galleryId, items };
            }

            const isExpanded = (
                stepEl.getAttribute('expanded') === 'true' ||
                stepEl.getAttribute('zoom') === 'true' ||
                stepEl.getAttribute('mode') === 'expanded' ||
                stepEl.getAttribute('layout') === 'gallery-expanded' ||
                layoutAttr === 'gallery-expanded' ||
                layoutAttr === 'expanded' ||
                stepEl.hasAttribute('expanded') ||
                stepEl.hasAttribute('zoom')
            );

            const galleryRefAttr = stepEl.getAttribute('gallery') || stepEl.getAttribute('gallery-ref');
            let resolvedGallery = null;

            if (localGallery) {
                resolvedGallery = localGallery;
            } else if (galleryRefAttr) {
                let targetId = galleryRefAttr;
                let parsedActive = null;

                if (galleryRefAttr.includes(':')) {
                    const parts = galleryRefAttr.split(':');
                    targetId = parts[0];
                    parsedActive = parseInt(parts[1], 10);
                } else if (!isNaN(parseInt(galleryRefAttr, 10)) && !galleryRegistry.has(galleryRefAttr)) {
                    parsedActive = parseInt(galleryRefAttr, 10);
                    targetId = lastRegisteredGallery ? lastRegisteredGallery.id : null;
                }

                const targetItems = galleryRegistry.get(targetId) || (lastRegisteredGallery ? lastRegisteredGallery.items : null);

                if (targetItems) {
                    let activeIdx = 0;
                    if (explicitActiveAttr !== null && explicitActiveAttr !== undefined && explicitActiveAttr !== '') {
                        activeIdx = parseInt(explicitActiveAttr, 10);
                    } else if (parsedActive !== null) {
                        activeIdx = parsedActive;
                    } else if (parentContext && parentContext.gallery) {
                        activeIdx = isExpanded ? parentContext.gallery.activeIndex : (parentContext.gallery.activeIndex + 1 + siblingIndex);
                    }

                    activeIdx = Math.max(0, Math.min(activeIdx, targetItems.length - 1));
                    resolvedGallery = { id: targetId, items: targetItems, activeIndex: activeIdx };
                }
            } else if ((layoutAttr === 'gallery' || layoutAttr === 'gallery-expanded' || (!layoutAttr && parentContext && parentContext.gallery)) && parentContext && parentContext.gallery) {
                let activeIdx = parentContext.gallery.activeIndex;
                if (explicitActiveAttr !== null && explicitActiveAttr !== undefined && explicitActiveAttr !== '') {
                    activeIdx = parseInt(explicitActiveAttr, 10);
                } else if (isExpanded) {
                    activeIdx = parentContext.gallery.activeIndex;
                } else {
                    activeIdx = parentContext.gallery.activeIndex + 1 + siblingIndex;
                }
                activeIdx = Math.max(0, Math.min(activeIdx, parentContext.gallery.items.length - 1));
                resolvedGallery = { id: parentContext.gallery.id, items: parentContext.gallery.items, activeIndex: activeIdx };
            } else if (layoutAttr === 'gallery' && lastRegisteredGallery) {
                let activeIdx = 0;
                if (explicitActiveAttr !== null && explicitActiveAttr !== undefined && explicitActiveAttr !== '') {
                    activeIdx = parseInt(explicitActiveAttr, 10);
                }
                activeIdx = Math.max(0, Math.min(activeIdx, lastRegisteredGallery.items.length - 1));
                resolvedGallery = { id: lastRegisteredGallery.id, items: lastRegisteredGallery.items, activeIndex: activeIdx };
            }

            // Determine layout
            let layout = layoutAttr;
            if (!layout) {
                if (resolvedTimeline) {
                    layout = 'timeline';
                } else if (resolvedGallery) {
                    layout = 'gallery';
                } else {
                    layout = parentContext ? parentContext.layout : 'split';
                }
            }

            const isNodesOnly = (layout === 'nodes' || layout === 'nodes-only' || layout === 'canvas' || layout === 'canvas-only' || layout === 'fullscreen');

            // Extract title
            const titleEl = stepEl.querySelector(':scope > title');
            const title = titleEl ? titleEl.textContent.trim() : (isNodesOnly ? '' : (parentContext ? parentContext.title : ''));
            const titleId = titleEl ? (titleEl.getAttribute('id') || '') : '';
            const titleStands = titleEl ? (
                titleEl.getAttribute('stands') ||
                titleEl.getAttribute('acronym') ||
                titleEl.getAttribute('stands-for') ||
                stepEl.getAttribute('stands') ||
                titleEl.getAttribute('prefix') ||
                ''
            ) : (stepEl.getAttribute('stands') || '');
            const titleTypewriter = titleEl ? (
                parseBoolAttr(titleEl, 'typewriter') ||
                parseBoolAttr(titleEl, 'typing') ||
                (titleEl.hasAttribute('stands') ? parseBoolAttr(titleEl, 'typewriter', true) : false) ||
                !!titleStands
            ) : !!titleStands;
            const titleSpeed = titleEl ? (titleEl.getAttribute('speed') || titleEl.getAttribute('typing-speed') || null) : null;
            const titleDelay = titleEl ? (titleEl.getAttribute('delay') || null) : null;

            // Extract badge / tag (inherits from parent if not defined)
            const badgeEl = stepEl.querySelector(':scope > badge, :scope > tag, :scope > category');
            const badge = badgeEl ? badgeEl.textContent.trim() : (stepEl.getAttribute('badge') || (parentContext ? parentContext.badge : ''));
            const badgeColor = badgeEl ? (badgeEl.getAttribute('color') || badgeEl.getAttribute('tint') || '') : (stepEl.getAttribute('badge-color') || (parentContext ? parentContext.badgeColor : ''));

            // Extract subtitle (inherits from parent if not defined)
            const subtitleEl = stepEl.querySelector(':scope > subtitle');
            const subtitle = subtitleEl ? (subtitleEl.innerHTML.trim() || subtitleEl.textContent.trim()) : (isNodesOnly ? '' : (stepEl.getAttribute('subtitle') || (parentContext ? parentContext.subtitle : '')));
            const subtitleDelay = subtitleEl ? (subtitleEl.getAttribute('delay') || subtitleEl.getAttribute('sub-delay') || null) : (stepEl.getAttribute('subtitle-delay') || null);

            // Check if active item/stage changed in an <item>-based stepper
            const activeAttrVal = stepEl.getAttribute('active') || stepEl.getAttribute('active-item') || stepEl.getAttribute('item');
            const isItemStageChange = Boolean(
                parentContext &&
                parentContext.parentItems &&
                parentContext.parentItems.length > 0 &&
                activeAttrVal !== null &&
                activeAttrVal !== undefined &&
                parentContext.lastActiveItem !== undefined &&
                parentContext.lastActiveItem !== activeAttrVal
            );

            // Check if this step explicitly clears / resets inherited canvas diagrams
            const isExplicitReset = (
                stepEl.getAttribute('reset') === 'true' ||
                stepEl.getAttribute('clear') === 'true' ||
                stepEl.getAttribute('mode') === 'reset' ||
                stepEl.hasAttribute('reset') ||
                stepEl.hasAttribute('clear')
            );

            const isCanvasReset = isExplicitReset || isItemStageChange;

            // Extract nodes and circles (with cumulative inheritance from parent/previous sub-steps)
            const localNodesMap = new Map();
            const localGroupsMap = new Map();
            const localEdgesSet = new Set();

            if (!isCanvasReset && parentContext && parentContext.accumulatedNodesMap) {
                parentContext.accumulatedNodesMap.forEach((inheritedNode, nId) => {
                    localNodesMap.set(nId, {
                        ...inheritedNode,
                        highlight: false // By default, reset highlight for new sub-step unless explicitly overridden
                    });
                });
            }

            if (!isCanvasReset && parentContext && parentContext.accumulatedGroupsMap) {
                parentContext.accumulatedGroupsMap.forEach((inheritedGroup, gId) => {
                    localGroupsMap.set(gId, {
                        ...inheritedGroup,
                        nodes: [...inheritedGroup.nodes]
                    });
                });
            }

            if (!isCanvasReset && parentContext && parentContext.accumulatedEdgesSet) {
                parentContext.accumulatedEdgesSet.forEach(e => localEdgesSet.add(e));
            }

            stepEl.querySelectorAll(':scope > node, :scope > nodes > node, :scope > circle, :scope > nodes > circle, :scope > circles > circle').forEach(n => {
                const id = n.getAttribute('id');
                if (id) {
                    const isHighlight = (
                        n.getAttribute('highlight') === 'true' ||
                        n.hasAttribute('highlight') ||
                        stepEl.getAttribute('highlight') === id ||
                        (stepEl.getAttribute('highlight-nodes') || '').split(',').map(s => s.trim()).includes(id)
                    );

                    const existing = localNodesMap.get(id);

                    const isCircle = n.tagName.toLowerCase() === 'circle' || (n.hasAttribute('shape') ? n.getAttribute('shape') === 'circle' : (existing ? existing.shape === 'circle' : false));

                    let size = null;
                    if (n.hasAttribute('size') && !isNaN(parseFloat(n.getAttribute('size')))) {
                        size = parseFloat(n.getAttribute('size'));
                    } else if (existing && existing.size !== null && existing.size !== undefined) {
                        size = existing.size;
                    } else if (isCircle) {
                        size = 68;
                    }

                    const isOrbit = (
                        n.getAttribute('orbit') === 'true' ||
                        n.hasAttribute('orbit') ||
                        n.getAttribute('mode') === 'orbit' ||
                        (existing && !n.hasAttribute('orbit') && existing.orbit)
                    );

                    const orbitSpeed = n.hasAttribute('orbit-speed')
                        ? parseFloat(n.getAttribute('orbit-speed'))
                        : (existing ? existing.orbitSpeed : 1);

                    const orbitRadius = n.hasAttribute('orbit-radius')
                        ? parseFloat(n.getAttribute('orbit-radius'))
                        : (existing ? existing.orbitRadius : 26);

                    const name = n.hasAttribute('name') ? n.getAttribute('name') : (existing ? existing.name : id);
                    const description = (n.hasAttribute('description') || n.hasAttribute('desc'))
                        ? (n.getAttribute('description') || n.getAttribute('desc') || '')
                        : (existing ? existing.description : '');

                    const x = (n.hasAttribute('x') && !isNaN(parseFloat(n.getAttribute('x'))))
                        ? parseFloat(n.getAttribute('x'))
                        : (existing ? existing.x : 50);

                    const y = (n.hasAttribute('y') && !isNaN(parseFloat(n.getAttribute('y'))))
                        ? parseFloat(n.getAttribute('y'))
                        : (existing ? existing.y : 50);

                    const color = n.hasAttribute('color') ? n.getAttribute('color') : (existing ? existing.color : '#38bdf8');
                    const icon = n.hasAttribute('icon') ? n.getAttribute('icon') : (existing ? existing.icon : (isCircle ? 'fa-circle-nodes' : ''));
                    const group = n.hasAttribute('group') ? n.getAttribute('group') : (existing ? existing.group : '');
                    const shape = isCircle ? 'circle' : 'card';

                    localNodesMap.set(id, {
                        id,
                        name,
                        description,
                        x,
                        y,
                        color,
                        icon,
                        group,
                        shape,
                        size,
                        highlight: isHighlight,
                        orbit: isOrbit,
                        orbitSpeed: isNaN(orbitSpeed) ? 1 : orbitSpeed,
                        orbitRadius: isNaN(orbitRadius) ? 26 : orbitRadius
                    });
                }
            });

            // Extract groups
            stepEl.querySelectorAll(':scope > group, :scope > nodes > group, :scope > groups > group').forEach((gEl, gIdx) => {
                const rawName = gEl.getAttribute('name');
                const explicitId = gEl.getAttribute('id');
                const id = explicitId || (rawName ? `group-${rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : `group-${gIdx + 1}`);

                const existing = localGroupsMap.get(id);

                const name = gEl.hasAttribute('name') ? gEl.getAttribute('name') : (existing ? existing.name : '');
                const color = gEl.hasAttribute('color') ? gEl.getAttribute('color') : (existing ? existing.color : '#38bdf8');
                const icon = gEl.hasAttribute('icon') ? gEl.getAttribute('icon') : (existing ? existing.icon : '');
                const border = gEl.hasAttribute('border') ? gEl.getAttribute('border') : (existing ? existing.border : 'dashed');
                const align = gEl.hasAttribute('align') ? gEl.getAttribute('align') : (existing ? existing.align : 'center');

                const rawNodes = gEl.getAttribute('nodes') || gEl.getAttribute('members') || '';
                let memberIds = rawNodes ? rawNodes.split(',').map(s => s.trim()).filter(Boolean) : (existing ? [...existing.nodes] : []);

                // Check nested <node> and <circle> inside <group>
                gEl.querySelectorAll(':scope > node, :scope > circle').forEach(n => {
                    const nId = n.getAttribute('id');
                    if (nId && !memberIds.includes(nId)) {
                        memberIds.push(nId);
                    }
                    if (nId && !localNodesMap.has(nId)) {
                        const isHighlight = (
                            n.getAttribute('highlight') === 'true' ||
                            n.hasAttribute('highlight') ||
                            stepEl.getAttribute('highlight') === nId ||
                            (stepEl.getAttribute('highlight-nodes') || '').split(',').map(s => s.trim()).includes(nId)
                        );

                        const isCircle = n.tagName.toLowerCase() === 'circle' || n.getAttribute('shape') === 'circle';
                        const size = (n.hasAttribute('size') && !isNaN(parseFloat(n.getAttribute('size'))))
                            ? parseFloat(n.getAttribute('size'))
                            : (isCircle ? 68 : null);

                        const isOrbit = (
                            n.getAttribute('orbit') === 'true' ||
                            n.hasAttribute('orbit') ||
                            n.getAttribute('mode') === 'orbit'
                        );
                        const orbitSpeed = n.hasAttribute('orbit-speed') ? parseFloat(n.getAttribute('orbit-speed')) : 1;
                        const orbitRadius = n.hasAttribute('orbit-radius') ? parseFloat(n.getAttribute('orbit-radius')) : 26;

                        localNodesMap.set(nId, {
                            id: nId,
                            name: n.getAttribute('name') || nId,
                            description: n.getAttribute('description') || '',
                            x: (n.hasAttribute('x') && !isNaN(parseFloat(n.getAttribute('x')))) ? parseFloat(n.getAttribute('x')) : 50,
                            y: (n.hasAttribute('y') && !isNaN(parseFloat(n.getAttribute('y')))) ? parseFloat(n.getAttribute('y')) : 50,
                            color: n.getAttribute('color') || color,
                            icon: n.getAttribute('icon') || (isCircle ? 'fa-circle-nodes' : ''),
                            group: id,
                            shape: isCircle ? 'circle' : 'card',
                            size: size,
                            highlight: isHighlight,
                            orbit: isOrbit,
                            orbitSpeed: isNaN(orbitSpeed) ? 1 : orbitSpeed,
                            orbitRadius: isNaN(orbitRadius) ? 26 : orbitRadius
                        });
                    }
                });

                localGroupsMap.set(id, {
                    id,
                    name,
                    color,
                    icon,
                    border,
                    align,
                    nodes: memberIds,
                    x: gEl.hasAttribute('x') ? parseFloat(gEl.getAttribute('x')) : (existing ? existing.x : null),
                    y: gEl.hasAttribute('y') ? parseFloat(gEl.getAttribute('y')) : (existing ? existing.y : null),
                    width: (gEl.hasAttribute('width') || gEl.hasAttribute('w')) ? parseFloat(gEl.getAttribute('width') || gEl.getAttribute('w')) : (existing ? existing.width : null),
                    height: (gEl.hasAttribute('height') || gEl.hasAttribute('h')) ? parseFloat(gEl.getAttribute('height') || gEl.getAttribute('h')) : (existing ? existing.height : null),
                    padding: gEl.hasAttribute('padding') ? parseFloat(gEl.getAttribute('padding')) : (existing ? existing.padding : null)
                });
            });

            // Also auto-group nodes that have group="GroupName"
            localNodesMap.forEach((nodeData, nId) => {
                if (nodeData.group) {
                    const gKey = `auto-group-${nodeData.group.toLowerCase().replace(/\s+/g, '-')}`;
                    if (!localGroupsMap.has(gKey)) {
                        localGroupsMap.set(gKey, {
                            id: gKey,
                            name: nodeData.group,
                            color: nodeData.color || '#38bdf8',
                            icon: '',
                            border: 'dashed',
                            nodes: [nId],
                            x: null, y: null, width: null, height: null, padding: null
                        });
                    } else {
                        const existing = localGroupsMap.get(gKey);
                        if (!existing.nodes.includes(nId)) {
                            existing.nodes.push(nId);
                        }
                    }
                }
            });

            // Extract edges (accumulates with inherited edges)
            stepEl.querySelectorAll(':scope > edge').forEach(e => {
                const from = e.getAttribute('from');
                const to = e.getAttribute('to');
                const fromPort = e.getAttribute('from-port');
                const toPort = e.getAttribute('to-port');
                const portDir = e.getAttribute('port') || e.getAttribute('dir');
                const label = e.getAttribute('label') || e.getAttribute('text') || e.getAttribute('title') || '';

                if (from && to) {
                    let edgeKey = `${from}->${to}`;
                    if (fromPort || toPort) {
                        edgeKey = `${from}:${fromPort || 'auto'}->${to}:${toPort || 'auto'}`;
                    } else if (portDir) {
                        edgeKey = `${from}->${to}#${portDir}`;
                    }
                    if (label) {
                        edgeKey += `|${label}`;
                    }
                    localEdgesSet.add(edgeKey);
                }
            });

            // Extract <code> elements if present
            const codeEls = Array.from(stepEl.querySelectorAll(':scope > code'));
            let extractedCodes = [];
            let explicitHideCode = (
                stepEl.getAttribute('code-visible') === 'false' ||
                stepEl.getAttribute('code') === 'false' ||
                stepEl.getAttribute('hide-code') === 'true' ||
                stepEl.hasAttribute('no-code')
            );

            if (codeEls.length > 0) {
                const hasVisibleFalse = codeEls.some(el => (
                    el.getAttribute('visible') === 'false' ||
                    el.getAttribute('hide') === 'true' ||
                    el.getAttribute('hidden') === 'true' ||
                    el.getAttribute('display') === 'none' ||
                    el.hasAttribute('hidden')
                ));

                if (hasVisibleFalse) {
                    explicitHideCode = true;
                    extractedCodes = [];
                } else {
                    extractedCodes = codeEls.map(el => {
                        const isTypewriter = (
                            parseBoolAttr(el, 'typewriter') ||
                            parseBoolAttr(el, 'typing') ||
                            parseBoolAttr(el, 'auto-type')
                        );
                        const isHighlight = (
                            parseBoolAttr(el, 'highlight') ||
                            parseBoolAttr(el, 'active')
                        );
                        const isIncremental = (
                            parseBoolAttr(el, 'incremental') ||
                            parseBoolAttr(el, 'append') ||
                            parseBoolAttr(stepEl, 'incremental')
                        );
                        const isDecrement = (
                            parseBoolAttr(el, 'decrement') ||
                            parseBoolAttr(el, 'untype') ||
                            parseBoolAttr(el, 'backspace') ||
                            parseBoolAttr(el, 'revert') ||
                            parseBoolAttr(stepEl, 'decrement') ||
                            parseBoolAttr(stepEl, 'untype') ||
                            parseBoolAttr(stepEl, 'revert')
                        );
                        const rawSpeed = el.getAttribute('speed') || el.getAttribute('typing-speed') || el.getAttribute('typewriter-speed') || el.getAttribute('delay');
                        const globalSpeed = settings['typing-speed'] || settings['code-speed'] || settings['typewriter-speed'];
                        const speedVal = rawSpeed || globalSpeed || null;

                        const rawFocus = (
                            el.getAttribute('focus') ||
                            el.getAttribute('focus-lines') ||
                            el.getAttribute('highlight-lines') ||
                            el.getAttribute('highlight-text') ||
                            el.getAttribute('highlight-code') ||
                            (el.getAttribute('highlight') && el.getAttribute('highlight') !== 'true' ? el.getAttribute('highlight') : null) ||
                            stepEl.getAttribute('focus') ||
                            stepEl.getAttribute('highlight-code') ||
                            stepEl.getAttribute('highlight-lines') ||
                            null
                        );

                        return {
                            lang: el.getAttribute('language') || el.getAttribute('lang') || 'javascript',
                            file: el.getAttribute('file') || el.getAttribute('title') || '',
                            typewriter: isTypewriter,
                            incremental: isIncremental,
                            decrement: isDecrement,
                            highlight: isHighlight,
                            focus: rawFocus,
                            speed: speedVal,
                            code: el.textContent.trim()
                        };
                    });
                }
            } else if (!explicitHideCode && parentContext && parentContext.codes && parentContext.codes.length > 0) {
                extractedCodes = JSON.parse(JSON.stringify(parentContext.codes));
            }

            const extractedCode = extractedCodes.length > 0 ? extractedCodes[0] : null;

            // Extract <video-setting> / <video_setting> / <video-zoom> elements ONLY on this step
            const videoSettingEls = Array.from(stepEl.querySelectorAll(':scope > video-setting, :scope > video_setting, :scope > video-zoom, :scope > video-settings'));
            let extractedVideoSettings = [];
            if (videoSettingEls.length > 0) {
                extractedVideoSettings = videoSettingEls.map(el => {
                    return {
                        name: el.getAttribute('name') || el.getAttribute('title') || el.getAttribute('target') || el.getAttribute('file') || null,
                        zoom: el.getAttribute('zoom') || el.getAttribute('scale') || el.getAttribute('value') || null,
                        origin: el.getAttribute('origin') || el.getAttribute('transform-origin') || el.getAttribute('anchor') || el.getAttribute('align') || el.getAttribute('crop') || el.getAttribute('position') || null,
                        speed: el.getAttribute('speed') || el.getAttribute('duration') || null
                    };
                });
            } else if (stepEl.hasAttribute('zoom') || stepEl.hasAttribute('video-zoom') || stepEl.hasAttribute('origin') || stepEl.hasAttribute('video-origin')) {
                extractedVideoSettings.push({
                    name: stepEl.getAttribute('name') || stepEl.getAttribute('video-name') || null,
                    zoom: stepEl.getAttribute('zoom') || stepEl.getAttribute('video-zoom') || null,
                    origin: stepEl.getAttribute('origin') || stepEl.getAttribute('video-origin') || null,
                    speed: stepEl.getAttribute('speed') || null
                });
            }

            // Extract <video> elements if present or inherit/merge with parent
            const videoEls = Array.from(stepEl.querySelectorAll(':scope > video'));
            let extractedVideos = [];
            if (videoEls.length > 0) {
                extractedVideos = videoEls.map(el => {
                    const idAttr = el.getAttribute('id') || null;
                    const widthAttr = el.getAttribute('width') || el.getAttribute('w') || stepEl.getAttribute('video-width') || stepEl.getAttribute('width') || null;
                    const heightAttr = el.getAttribute('height') || el.getAttribute('h') || stepEl.getAttribute('video-height') || stepEl.getAttribute('height') || null;
                    const aspectAttr = el.getAttribute('aspect') || el.getAttribute('aspect-ratio') || el.getAttribute('ratio') || el.getAttribute('resolution') || el.getAttribute('res') || stepEl.getAttribute('video-aspect') || null;
                    const nameAttr = el.getAttribute('name') || el.getAttribute('title') || el.getAttribute('file') || null;
                    const zoomAttr = el.getAttribute('zoom') || el.getAttribute('scale') || stepEl.getAttribute('zoom') || stepEl.getAttribute('video-zoom') || null;
                    const originAttr = el.getAttribute('origin') || el.getAttribute('transform-origin') || el.getAttribute('align') || stepEl.getAttribute('origin') || stepEl.getAttribute('video-origin') || null;
                    const hasExplicitSrc = el.hasAttribute('src') || el.hasAttribute('url');
                    let rawSrc = el.getAttribute('src') || el.getAttribute('url') || null;
                    if (rawSrc) {
                        if (rawSrc === 'mrt' || rawSrc === 'mrt.webm' || rawSrc === 'mrt.mp4') {
                            rawSrc = 'assets/videos/mrt.mp4';
                        } else if (rawSrc.startsWith('videos/')) {
                            rawSrc = 'assets/' + rawSrc;
                        } else if (!rawSrc.includes('/')) {
                            if (/\.(webm|mp4|mov|ogg)$/i.test(rawSrc)) {
                                rawSrc = 'assets/videos/' + rawSrc;
                            } else {
                                rawSrc = 'assets/videos/' + rawSrc + '.mp4';
                            }
                        }
                    }

                    // Check if this overrides/updates an existing parent video
                    let parentVideo = null;
                    if (parentContext && parentContext.videos && parentContext.videos.length > 0) {
                        if (idAttr) {
                            parentVideo = parentContext.videos.find(pv => pv.id === idAttr);
                        }
                        if (!parentVideo && nameAttr) {
                            parentVideo = parentContext.videos.find(pv => pv.name === nameAttr || pv.file === nameAttr || pv.title === nameAttr);
                        }
                        if (!parentVideo && parentContext.videos.length === 1 && !hasExplicitSrc) {
                            parentVideo = parentContext.videos[0];
                        }
                    }

                    if (parentVideo && !hasExplicitSrc) {
                        // Inherit and override parent video configuration
                        return {
                            ...parentVideo,
                            id: idAttr || parentVideo.id || null,
                            name: nameAttr || parentVideo.name,
                            file: el.getAttribute('file') || nameAttr || parentVideo.file,
                            title: nameAttr || parentVideo.title,
                            icon: el.hasAttribute('icon') ? el.getAttribute('icon') : parentVideo.icon,
                            badge: el.hasAttribute('badge') ? el.getAttribute('badge') : parentVideo.badge,
                            height: heightAttr || parentVideo.height,
                            width: widthAttr || parentVideo.width,
                            aspect: aspectAttr || parentVideo.aspect,
                            zoom: zoomAttr !== null ? zoomAttr : parentVideo.zoom,
                            origin: originAttr !== null ? originAttr : parentVideo.origin,
                            maxHeight: el.getAttribute('max-height') || el.getAttribute('max-h') || parentVideo.maxHeight,
                            maxWidth: el.getAttribute('max-width') || el.getAttribute('max-w') || parentVideo.maxWidth,
                            align: el.getAttribute('align') || el.getAttribute('position') || el.getAttribute('valign') || stepEl.getAttribute('video-align') || parentVideo.align,
                            fit: el.getAttribute('fit') || el.getAttribute('object-fit') || parentVideo.fit,
                            window: el.hasAttribute('window') ? (el.getAttribute('window') !== 'false') : (parentVideo && parentVideo.window !== undefined ? parentVideo.window : true),
                            vertical: el.hasAttribute('vertical') ? (el.getAttribute('vertical') === 'true' || el.getAttribute('vertical') === '') : (parentVideo && parentVideo.vertical !== undefined ? parentVideo.vertical : false),
                            highlight: el.hasAttribute('highlight') ? (el.getAttribute('highlight') === 'true' || el.hasAttribute('highlight')) : parentVideo.highlight
                        };
                    }

                    return {
                        id: idAttr || null,
                        src: rawSrc || (parentVideo ? parentVideo.src : 'assets/fire.mp4'),
                        name: nameAttr || (parentVideo ? parentVideo.name : 'Visual Output'),
                        file: el.getAttribute('file') || nameAttr || (parentVideo ? parentVideo.file : 'Visual Output'),
                        title: nameAttr || (parentVideo ? parentVideo.title : 'Visual Output'),
                        icon: el.getAttribute('icon') || (parentVideo ? parentVideo.icon : null),
                        badge: el.getAttribute('badge') || (parentVideo ? parentVideo.badge : null),
                        height: heightAttr || (parentVideo ? parentVideo.height : null),
                        width: widthAttr || (parentVideo ? parentVideo.width : null),
                        aspect: aspectAttr || (parentVideo ? parentVideo.aspect : null),
                        zoom: zoomAttr,
                        origin: originAttr,
                        maxHeight: el.getAttribute('max-height') || el.getAttribute('max-h') || null,
                        maxWidth: el.getAttribute('max-width') || el.getAttribute('max-w') || null,
                        align: el.getAttribute('align') || el.getAttribute('position') || el.getAttribute('valign') || stepEl.getAttribute('video-align') || stepEl.getAttribute('align') || null,
                        fit: el.getAttribute('fit') || el.getAttribute('object-fit') || 'cover',
                        window: el.hasAttribute('window')
                            ? (el.getAttribute('window') !== 'false')
                            : (el.getAttribute('frameless') === 'true' || el.getAttribute('frame') === 'false' || stepEl.getAttribute('window') === 'false' || stepEl.getAttribute('video-window') === 'false' ? false : (parentVideo && parentVideo.window !== undefined ? parentVideo.window : true)),
                        vertical: el.hasAttribute('vertical')
                            ? (el.getAttribute('vertical') === 'true' || el.getAttribute('vertical') === '')
                            : (el.getAttribute('orientation') === 'vertical' || el.getAttribute('portrait') === 'true' || stepEl.getAttribute('vertical') === 'true' || stepEl.getAttribute('video-vertical') === 'true' ? true : (parentVideo && parentVideo.vertical !== undefined ? parentVideo.vertical : false)),
                        highlight: (
                            el.getAttribute('highlight') === 'true' ||
                            el.getAttribute('active') === 'true' ||
                            el.hasAttribute('highlight')
                        )
                    };
                });
            } else if (parentContext && parentContext.videos && parentContext.videos.length > 0) {
                extractedVideos = JSON.parse(JSON.stringify(parentContext.videos));
                // Reset child zoom/origin defaults so child steps don't inherit parent zoom unless specified
                extractedVideos.forEach(v => {
                    v.zoom = null;
                    v.origin = null;
                });
            }

            // Apply video settings (zoom, origin) to videos
            if (extractedVideoSettings.length > 0 && extractedVideos.length > 0) {
                extractedVideoSettings.forEach(setting => {
                    extractedVideos.forEach(v => {
                        if (!setting.name || setting.name === v.name || setting.name === v.file || setting.name === v.title) {
                            if (setting.zoom !== null) v.zoom = setting.zoom;
                            if (setting.origin !== null) v.origin = setting.origin;
                        }
                    });
                });
            }

            const extractedVideo = extractedVideos.length > 0 ? extractedVideos[0] : (parentContext ? parentContext.video : null);

            // Extract <image> / <img> elements if present
            const imageEls = Array.from(stepEl.querySelectorAll(':scope > image, :scope > img, image, img'));
            let extractedImages = [];
            if (imageEls.length > 0) {
                extractedImages = imageEls.map(el => {
                    let rawSrc = el.getAttribute('src') || el.getAttribute('file') || el.getAttribute('url') || el.textContent.trim() || 'assets/icon.svg';
                    if (rawSrc.includes('workshop.jpg') || rawSrc === 'workshop.jpg') {
                        rawSrc = 'assets/images/workshop.jpg';
                    } else if (rawSrc.startsWith('images/')) {
                        rawSrc = 'assets/' + rawSrc;
                    } else if (!rawSrc.includes('/') && /\.(jpe?g|png|webp|svg|gif)$/i.test(rawSrc)) {
                        rawSrc = 'assets/images/' + rawSrc;
                    }
                    const altAttr = el.getAttribute('alt') || el.getAttribute('title') || el.getAttribute('name') || 'Three.js';
                    return {
                        src: rawSrc,
                        name: el.getAttribute('name') || el.getAttribute('title') || altAttr,
                        title: el.getAttribute('title') || el.getAttribute('name') || altAttr,
                        alt: altAttr,
                        width: el.getAttribute('width') || null,
                        height: el.getAttribute('height') || null,
                        fit: el.getAttribute('fit') || el.getAttribute('object-fit') || 'cover',
                        zoom: el.getAttribute('zoom') || null,
                        origin: el.getAttribute('origin') || el.getAttribute('transform-origin') || null,
                        window: el.hasAttribute('window') ? (el.getAttribute('window') !== 'false') : (el.getAttribute('frameless') === 'true' || stepEl.getAttribute('window') === 'false' ? false : true),
                        vertical: el.hasAttribute('vertical') ? (el.getAttribute('vertical') === 'true' || el.getAttribute('vertical') === '') : (stepEl.getAttribute('vertical') === 'true' ? true : false),
                        class: el.getAttribute('class') || '',
                        color: el.getAttribute('color') || el.getAttribute('tint') || 'white'
                    };
                });
            }
            const extractedImage = extractedImages.length > 0 ? extractedImages[0] : null;

            // Extract <profile> elements if present or inherit from parent
            const profileEls = Array.from(stepEl.querySelectorAll(':scope > profile, :scope > profiles > profile, profile'));
            let extractedProfiles = [];
            let extractedProfile = null;
            if (profileEls.length > 0) {
                extractedProfiles = profileEls.map(pEl => {
                    const tags = [];
                    pEl.querySelectorAll('tag, item').forEach(tagEl => {
                        tags.push(tagEl.getAttribute('name') || tagEl.textContent.trim());
                    });

                    const githubAttr = pEl.getAttribute('github') || pEl.getAttribute('gh') || '';
                    const nicknameAttr = pEl.getAttribute('nickname') || pEl.getAttribute('nick') || pEl.getAttribute('alias') || '';
                    const resolvedGithub = githubAttr ? githubAttr.replace(/^@/, '') : '';
                    const resolvedNickname = nicknameAttr ? nicknameAttr.replace(/^@/, '') : '';

                    return {
                        title: pEl.getAttribute('title') || pEl.getAttribute('name') || '',
                        name: pEl.getAttribute('name') || pEl.getAttribute('title') || '',
                        nickname: resolvedNickname,
                        github: resolvedGithub,
                        role: pEl.getAttribute('role') || pEl.getAttribute('subtitle') || '',
                        company: pEl.getAttribute('company') || pEl.getAttribute('org') || '',
                        avatar: pEl.getAttribute('avatar') || pEl.getAttribute('src') || pEl.getAttribute('image') || 'assets/me.jpg',
                        bio: pEl.getAttribute('bio') || pEl.textContent.trim() || '',
                        linkedin: pEl.getAttribute('linkedin') || '',
                        website: pEl.getAttribute('website') || pEl.getAttribute('url') || '',
                        tags: tags.filter(Boolean)
                    };
                });
                extractedProfile = extractedProfiles[0];
            } else if (parentContext && parentContext.profile) {
                extractedProfile = JSON.parse(JSON.stringify(parentContext.profile));
                extractedProfiles = parentContext.profiles ? JSON.parse(JSON.stringify(parentContext.profiles)) : [extractedProfile];
            } else if (layout === 'profile') {
                const tags = [];
                stepEl.querySelectorAll(':scope > tags > tag, :scope > tags > item, :scope > tag').forEach(tagEl => {
                    tags.push(tagEl.getAttribute('name') || tagEl.textContent.trim());
                });

                extractedProfile = {
                    title: title || 'Jean Carlo Deconto',
                    name: title || 'Jean Carlo Deconto',
                    nickname: 'sunag',
                    role: subtitle || 'Author of TSL & NodeMaterial',
                    company: 'Three.js Core Contributor',
                    avatar: 'assets/me.jpg',
                    bio: '',
                    github: '@sunag',
                    linkedin: '',
                    website: '',
                    tags: tags.filter(Boolean)
                };
                extractedProfiles = [extractedProfile];
            }

            // Extract <qrcode> / <qr> element or attribute if present
            const qrEl = stepEl.querySelector(':scope > qrcode, :scope > qr, qrcode, qr');
            let extractedQrCode = null;
            if (qrEl) {
                let rawSrc = qrEl.getAttribute('src') || qrEl.getAttribute('file') || qrEl.getAttribute('image') || qrEl.getAttribute('img') || 'assets/images/cyberpunk.png';
                if (rawSrc.includes('cyberpunk') && !rawSrc.includes('.png')) {
                    rawSrc = 'assets/images/cyberpunk.png';
                } else if (rawSrc.startsWith('images/')) {
                    rawSrc = 'assets/' + rawSrc;
                }
                const rawUrl = qrEl.getAttribute('url') || qrEl.getAttribute('href') || qrEl.getAttribute('link') || 'https://github.com/ektogamat/threejs-conference';
                extractedQrCode = {
                    src: rawSrc,
                    url: rawUrl,
                    title: qrEl.getAttribute('title') || qrEl.getAttribute('label') || '',
                    description: qrEl.getAttribute('desc') || qrEl.getAttribute('description') || '',
                    size: qrEl.getAttribute('size') || null
                };
            } else if (stepEl.hasAttribute('qrcode') || stepEl.hasAttribute('qr')) {
                let rawSrc = stepEl.getAttribute('qrcode') || stepEl.getAttribute('qr') || 'assets/images/cyberpunk.png';
                if (rawSrc === 'true' || rawSrc === '') rawSrc = 'assets/images/cyberpunk.png';
                if (rawSrc.includes('cyberpunk') && !rawSrc.includes('.png')) {
                    rawSrc = 'assets/images/cyberpunk.png';
                } else if (rawSrc.startsWith('images/')) {
                    rawSrc = 'assets/' + rawSrc;
                }
                const rawUrl = stepEl.getAttribute('url') || stepEl.getAttribute('href') || 'https://github.com/ektogamat/threejs-conference';
                extractedQrCode = {
                    src: rawSrc,
                    url: rawUrl,
                    title: 'Scan to Code Along',
                    description: 'Clone or open the repository to build shaders and follow the demo.'
                };
            } else if (parentContext && parentContext.qrcode) {
                const isCommunityOrXPost = stepId === 'workshop-community' ||
                    stepEl.querySelector('video[src*="workshop.mp4"]') !== null;
                if (!isCommunityOrXPost) {
                    extractedQrCode = JSON.parse(JSON.stringify(parentContext.qrcode));
                }
            }

            // Extract <chart> or <graph> element if present
            const chartEl = stepEl.querySelector(':scope > chart, :scope > graph, chart, graph');
            let localChart = null;
            if (chartEl) {
                const axisEl = chartEl.querySelector('axis, axes');
                const seriesEls = Array.from(chartEl.querySelectorAll('series, line, dataset, slice, item, data'));

                const parsePoints = (str) => {
                    if (!str) return [];
                    return str.split(',').map(s => {
                        const num = parseFloat(s.trim());
                        return isNaN(num) ? 0 : num;
                    });
                };

                const parseLabels = (str) => {
                    if (!str) return [];
                    return str.split(',').map(s => s.trim()).filter(Boolean);
                };

                const series = seriesEls.map(sEl => {
                    const rawVal = sEl.getAttribute('value') || sEl.getAttribute('val') || sEl.getAttribute('points') || sEl.getAttribute('values') || sEl.textContent.trim();
                    const isSingleVal = rawVal && !rawVal.includes(',');
                    return {
                        name: sEl.getAttribute('name') || sEl.getAttribute('label') || sEl.getAttribute('title') || 'Série',
                        color: sEl.getAttribute('color') || null,
                        value: isSingleVal ? parseFloat(rawVal) : null,
                        points: parsePoints(rawVal),
                        unit: sEl.getAttribute('unit') || chartEl.getAttribute('unit') || '',
                        area: sEl.getAttribute('area') !== 'false' && sEl.getAttribute('fill') !== 'false',
                        dash: sEl.getAttribute('dash') || sEl.getAttribute('stroke-dash') || null,
                        highlight: sEl.getAttribute('highlight') === 'true' || sEl.hasAttribute('highlight'),
                        icon: sEl.getAttribute('icon') || ''
                    };
                });

                const chartId = chartEl.getAttribute('id') || (parentContext && parentContext.chart ? parentContext.chart.id : stepId);
                const chartMax = chartEl.getAttribute('max') ? parseInt(chartEl.getAttribute('max'), 10) : null;
                const chartUnit = chartEl.getAttribute('unit') || '';
                const chartProgress = stepEl.getAttribute('progress') || chartEl.getAttribute('progress') || null;
                const chartType = chartEl.getAttribute('type') || (layoutAttr === 'doughnut' || layoutAttr === 'donut' ? 'doughnut' : 'line');
                const chartTotal = chartEl.getAttribute('total') || null;
                const chartCenterLabel = chartEl.getAttribute('center-label') || chartEl.getAttribute('hole-label') || chartEl.getAttribute('center-text') || '';
                const chartCenterSub = chartEl.getAttribute('center-sub') || chartEl.getAttribute('hole-sub') || '';
                const chartActive = stepEl.getAttribute('active') || chartEl.getAttribute('active') || chartEl.getAttribute('selected') || null;

                localChart = {
                    id: chartId,
                    title: chartEl.getAttribute('title') || '',
                    subtitle: chartEl.getAttribute('subtitle') || '',
                    type: chartType,
                    unit: chartUnit,
                    total: chartTotal,
                    centerLabel: chartCenterLabel,
                    centerSub: chartCenterSub,
                    active: chartActive,
                    max: chartMax,
                    progress: chartProgress,
                    xAxis: {
                        label: axisEl ? (axisEl.getAttribute('x-label') || '') : '',
                        labels: axisEl ? parseLabels(axisEl.getAttribute('labels') || axisEl.getAttribute('x-labels') || axisEl.getAttribute('x') || '') : []
                    },
                    yAxis: {
                        label: axisEl ? (axisEl.getAttribute('y-label') || '') : '',
                        labels: axisEl ? parseLabels(axisEl.getAttribute('y-labels') || axisEl.getAttribute('y') || '') : [],
                        min: axisEl && axisEl.getAttribute('min') ? parseFloat(axisEl.getAttribute('min')) : null,
                        max: axisEl && axisEl.getAttribute('max') ? parseFloat(axisEl.getAttribute('max')) : null
                    },
                    series: series,
                    interactive: chartEl.getAttribute('interactive') !== 'false',
                    glow: chartEl.getAttribute('glow') !== 'false'
                };
            }

            let resolvedChart = null;
            if (localChart) {
                resolvedChart = localChart;
            } else if (parentContext && parentContext.chart) {
                resolvedChart = JSON.parse(JSON.stringify(parentContext.chart));
                const stepProgress = stepEl.getAttribute('progress');
                if (stepProgress !== null && stepProgress !== undefined && stepProgress !== '') {
                    resolvedChart.progress = stepProgress;
                }
                const stepActive = stepEl.getAttribute('active');
                if (stepActive !== null && stepActive !== undefined && stepActive !== '') {
                    resolvedChart.active = stepActive;
                }
            }

            // Extract markdown description (excluding code tag if in layout="code" or layout="code-compare")
            const clone = stepEl.cloneNode(true);
            let extractedDescription = '';

            // Extract <item>, <stage>, <bullet>, <feature> elements if present
            const explicitItemEls = Array.from(stepEl.querySelectorAll(':scope > item, :scope > stage, :scope > bullet, :scope > feature, :scope > items > item'));
            let explicitItems = [];
            let explicitItemStrings = [];
            if (explicitItemEls.length > 0) {
                explicitItems = explicitItemEls.map((el, idx) => {
                    const itemTitle = el.getAttribute('title') || el.getAttribute('name') || el.getAttribute('label') || '';
                    const itemDesc = el.getAttribute('desc') || el.getAttribute('text') || el.textContent.trim();
                    const isHighlight = (
                        el.getAttribute('highlight') === 'true' ||
                        el.hasAttribute('highlight') ||
                        el.getAttribute('active') === 'true' ||
                        el.hasAttribute('active')
                    );
                    let text = '';
                    if (itemTitle && itemDesc) {
                        text = `**${itemTitle}:** ${itemDesc}`;
                    } else {
                        text = itemTitle || itemDesc;
                    }
                    return {
                        id: el.getAttribute('id') || `item-${idx + 1}`,
                        title: itemTitle,
                        desc: itemDesc,
                        text: text,
                        highlight: isHighlight
                    };
                });
                explicitItemStrings = explicitItems.map(it => it.text).filter(Boolean);
            }

            const isVideoLayout = (layout === 'video-expanded' || layout === 'video-wide' || layout === 'video-full' || layout === 'video');
            const isChildVideoStep = isVideoLayout && parentContext && parentContext.isVideoLayoutParent;
            const isChildItemStep = !isVideoLayout && parentContext && (parentContext.isItemStepsParent || (parentContext.parentItems && parentContext.parentItems.length > 0));
            if (layout === 'code' || layout === 'code-split' || layout === 'code-compare' || extractedCodes.length > 0 || extractedVideos.length > 0) {
                clone.querySelectorAll('code, video, image, img, images, video-setting, video_setting, video-settings, video-zoom, qrcode, qr').forEach(el => el.remove());
                clone.querySelectorAll('step, title, subtitle, badge, timeline, gallery, node, circle, circles, edge, group, groups, setting, profile, profiles, tags, tag, chart, graph, series, line, dataset, axis, slice, item, data, stage, bullet, feature, qrcode, qr').forEach(el => el.remove());
                extractedDescription = clone.innerHTML.trim();
            } else if (layout === 'profile' || extractedProfiles.length > 0) {
                clone.querySelectorAll('step, title, subtitle, badge, timeline, gallery, node, circle, circles, edge, group, groups, setting, profile, profiles, tags, tag, code, video, image, img, images, video-setting, video_setting, video-settings, video-zoom, chart, graph, series, line, dataset, axis, slice, item, data, stage, bullet, feature, qrcode, qr').forEach(el => el.remove());
                extractedDescription = clone.innerHTML.trim();
                if (extractedProfiles.length === 1 && extractedProfile && !extractedProfile.bio && extractedDescription) {
                    extractedProfile.bio = extractedDescription;
                }
            } else if (layout === 'chart' || layout === 'graph' || layout === 'line-chart' || layout === 'doughnut' || layout === 'donut' || resolvedChart) {
                clone.querySelectorAll('step, title, subtitle, badge, timeline, gallery, node, circle, circles, edge, group, groups, setting, profile, profiles, tags, tag, code, video, image, img, images, video-setting, video_setting, video-settings, video-zoom, chart, graph, series, line, dataset, axis, slice, item, data, stage, bullet, feature, qrcode, qr').forEach(el => el.remove());
                extractedDescription = clone.innerHTML.trim();
            } else if (isVideoLayout) {
                clone.querySelectorAll('step, title, subtitle, badge, timeline, gallery, node, circle, circles, edge, group, groups, setting, profile, profiles, tags, tag, code, video, image, img, images, video-setting, video_setting, video-settings, video-zoom, chart, graph, series, line, dataset, axis, slice, item, data, stage, bullet, feature, qrcode, qr').forEach(el => el.remove());
                extractedDescription = clone.innerHTML.trim() || (explicitItemStrings.length > 0 ? explicitItemStrings.join('\n\n') : '');
            } else {
                clone.querySelectorAll('code').forEach(codeEl => {
                    const lang = codeEl.getAttribute('language') || codeEl.getAttribute('lang') || 'javascript';
                    const file = codeEl.getAttribute('file') || codeEl.getAttribute('title') || '';
                    const codeText = codeEl.textContent.trim();
                    const fileComment = file ? `// ${file}\n` : '';
                    const replacement = document.createTextNode(`\n\n\`\`\`${lang}\n${fileComment}${codeText}\n\`\`\`\n\n`);
                    if (codeEl.parentNode) {
                        codeEl.parentNode.replaceChild(replacement, codeEl);
                    }
                });
                clone.querySelectorAll('step, title, subtitle, badge, timeline, gallery, node, circle, circles, edge, group, groups, setting, video, profile, profiles, tags, tag, image, img, images, video-setting, video_setting, video-settings, video-zoom, chart, graph, series, line, dataset, axis, slice, item, data, stage, bullet, feature, qrcode, qr').forEach(el => el.remove());
                extractedDescription = clone.innerHTML.trim() || ((isNodesOnly || isChildItemStep) ? '' : (parentContext ? parentContext.markdown : ''));
            }

            const isCodeCompare = (layout === 'code-compare' || (layout === 'code' && extractedCodes.length >= 2) || extractedCodes.length >= 2 || (extractedCodes.length >= 1 && extractedVideos.length >= 1));
            const isProfileLayout = (layout === 'profile' || (!isVideoLayout && (!!extractedProfile || extractedProfiles.length > 0)));
            const isChartLayout = (layout === 'chart' || layout === 'graph' || layout === 'line-chart' || layout === 'doughnut' || layout === 'donut' || !!resolvedChart);

            // If this is a child step of a video-expanded layout, accumulate items from parent context
            const stepNewItems = explicitItems.length > 0 ? explicitItems : (extractedDescription ? [extractedDescription] : []);
            let cumulativeItems = [];
            if (isVideoLayout) {
                if (parentContext && parentContext.accumulatedVideoItems) {
                    cumulativeItems = [...parentContext.accumulatedVideoItems, ...stepNewItems];
                    parentContext.accumulatedVideoItems = [...cumulativeItems];
                } else if (parentContext && parentContext.isVideoLayoutParent) {
                    if (!parentContext.accumulatedVideoItems) parentContext.accumulatedVideoItems = [];
                    cumulativeItems = [...parentContext.accumulatedVideoItems, ...stepNewItems];
                    parentContext.accumulatedVideoItems = [...cumulativeItems];
                } else if (stepNewItems.length > 0) {
                    cumulativeItems = [...stepNewItems];
                }
            }

            const stepSize = stepEl.getAttribute('size') || stepEl.getAttribute('text-size') || stepEl.getAttribute('font-size') || (parentContext ? parentContext.size : '');
            const stepWidth = stepEl.getAttribute('width') || stepEl.getAttribute('card-width') || stepEl.getAttribute('card') || stepEl.getAttribute('spread') || (parentContext ? parentContext.cardWidth : '');
            const stepAlign = stepEl.getAttribute('align') || stepEl.getAttribute('text-align') || (parentContext ? parentContext.align : '');
            const highlightBulletAttr = stepEl.getAttribute('highlight-bullet') || stepEl.getAttribute('highlight-item') || stepEl.getAttribute('active-bullet') || stepEl.getAttribute('active-item') || stepEl.getAttribute('highlight-index') || (stepEl.getAttribute('highlight') && !isNaN(parseInt(stepEl.getAttribute('highlight'), 10)) ? stepEl.getAttribute('highlight') : null);

            let resolvedItems = null;
            let resolvedActiveIndex = null;
            let introText = '';
            let activeDetail = '';

            if (isChildVideoStep) {
                resolvedItems = (cumulativeItems.length > 0 ? cumulativeItems : explicitItems);
                resolvedActiveIndex = (resolvedItems && resolvedItems.length > 0) ? (resolvedItems.length - 1) : null;
            } else if (isChildItemStep || (parentContext && parentContext.parentItems && parentContext.parentItems.length > 0)) {
                const activeIdxAttr = stepEl.getAttribute('active-item') || stepEl.getAttribute('item') || stepEl.getAttribute('active') || stepEl.getAttribute('active-bullet') || stepEl.getAttribute('highlight-bullet') || stepEl.getAttribute('index');
                let activeIdx = siblingIndex;
                if (activeIdxAttr !== null && activeIdxAttr !== undefined && !isNaN(parseInt(activeIdxAttr, 10))) {
                    const parsedIdx = parseInt(activeIdxAttr, 10);
                    if (parsedIdx >= 1 && parsedIdx <= parentContext.parentItems.length && !stepEl.hasAttribute('active-item-zero')) {
                        activeIdx = parsedIdx - 1;
                    } else {
                        activeIdx = parsedIdx;
                    }
                }
                activeIdx = Math.max(0, Math.min(activeIdx, parentContext.parentItems.length - 1));
                resolvedActiveIndex = activeIdx;
                resolvedItems = parentContext.parentItems.map((it, i) => ({
                    ...it,
                    highlight: (i === activeIdx)
                }));
                introText = parentContext.parentIntro || '';
                activeDetail = extractedDescription || '';
            } else {
                resolvedItems = explicitItems.length > 0 ? explicitItems : (cumulativeItems.length > 0 ? cumulativeItems : null);
                resolvedActiveIndex = null;
                if (explicitItems.length > 0 && extractedDescription) {
                    activeDetail = extractedDescription;
                }
            }

            const edgeAttr = stepEl.getAttribute('edge') || stepEl.getAttribute('edges') || stepEl.getAttribute('show-edge') || stepEl.getAttribute('connect') || stepEl.getAttribute('arrow');
            const isPipeline = (stepEl.getAttribute('pipeline') === 'true' || stepEl.getAttribute('transpile') === 'true' || stepEl.hasAttribute('pipeline') || stepEl.hasAttribute('transpile') || edgeAttr === 'true' || edgeAttr === 'pipeline');
            const isNoEdge = (edgeAttr === 'false' || stepEl.getAttribute('no-edge') === 'true' || stepEl.hasAttribute('no-edge') || stepEl.hasAttribute('no-arrow'));

            const bgAttr = stepEl.getAttribute('background') || stepEl.getAttribute('bg') || stepEl.getAttribute('background-video') || stepEl.getAttribute('bg-video') || (parentContext ? parentContext.background : null);
            const bgPerspectiveAttr = (
                stepEl.getAttribute('background-perspective') === 'true' ||
                stepEl.getAttribute('perspective') === 'true' ||
                stepEl.hasAttribute('background-perspective') ||
                stepEl.hasAttribute('perspective') ||
                (parentContext ? parentContext.backgroundPerspective : false)
            );

            const currentStep = {
                id: stepId,
                title: title,
                titleId: titleId,
                titleTypewriter: titleTypewriter,
                titleStands: titleStands,
                titleSpeed: titleSpeed,
                titleDelay: titleDelay,
                badge: badge,
                badgeColor: badgeColor,
                subtitle: subtitle,
                subtitleDelay: subtitleDelay,
                markdown: extractedDescription,
                introText: introText,
                activeDetail: activeDetail,
                items: resolvedItems,
                activeItemIndex: resolvedActiveIndex,
                highlightBullet: highlightBulletAttr,
                code: extractedCode,
                codes: extractedCodes,
                video: extractedVideo,
                videos: extractedVideos,
                image: extractedImage,
                images: extractedImages,
                profile: extractedProfile,
                profiles: extractedProfiles,
                chart: resolvedChart,
                qrcode: extractedQrCode,
                background: bgAttr,
                backgroundPerspective: bgPerspectiveAttr,
                perspective: bgPerspectiveAttr,
                layout: (layout === 'gallery-expanded' || isExpanded) ? 'gallery' : (isVideoLayout ? 'video-expanded' : (isProfileLayout ? 'profile' : (isChartLayout ? 'chart' : (isCodeCompare ? 'code-compare' : layout)))),
                expanded: isExpanded,
                window: stepEl.hasAttribute('window') ? (stepEl.getAttribute('window') !== 'false') : (parentContext && parentContext.window !== undefined ? parentContext.window : null),
                vertical: stepEl.hasAttribute('vertical') ? (stepEl.getAttribute('vertical') === 'true' || stepEl.getAttribute('vertical') === '') : (parentContext && parentContext.vertical !== undefined ? parentContext.vertical : null),
                size: stepSize,
                cardWidth: stepWidth,
                align: stepAlign,
                timeline: resolvedTimeline,
                gallery: resolvedGallery,
                nodes: localNodesMap,
                groups: localGroupsMap,
                edges: localEdgesSet,
                showEdge: isNoEdge ? false : (isPipeline ? true : (localEdgesSet.size > 0 ? true : (parentContext && parentContext.showEdge !== undefined ? parentContext.showEdge : true))),
                edge: isNoEdge ? false : (isPipeline ? true : (localEdgesSet.size > 0 ? true : (parentContext && parentContext.edge !== undefined ? parentContext.edge : true)))
            };

            const childSteps = Array.from(stepEl.querySelectorAll(':scope > step, :scope > chart > step, :scope > graph > step'));
            const totalStages = (parentContext && parentContext.totalStages) ? parentContext.totalStages : (childSteps.length > 0 ? childSteps.length : (explicitItemStrings.length > 1 ? explicitItemStrings.length : 1));
            currentStep.totalStages = totalStages;

            // If the step is only a wrapper/container for pure small-text detail child steps, don't push a redundant blank parent slide.
            const isTimelineWrapper = (childSteps.length > 0 && layout === 'timeline');
            const isItemStepsParent = (childSteps.length > 0 && explicitItems.length > 0 && !isVideoLayout);
            const isChartWrapper = (childSteps.length > 0 && !extractedDescription && localNodesMap.size === 0 && isChartLayout);
            const isVideoWrapper = (childSteps.length > 0 && !extractedDescription && isVideoLayout);
            const isCodeWrapper = (childSteps.length > 0 && isCodeCompare && extractedCodes.length === 0);
            const isWrapper = isTimelineWrapper || isChartWrapper || isVideoWrapper || isItemStepsParent || isCodeWrapper;

            if (!isWrapper) {
                // If this is a video slide with multiple <item> tags and NO child steps, expand them into auto-incremental steps
                if (isVideoLayout && childSteps.length === 0 && explicitItemStrings.length > 1) {
                    explicitItemStrings.forEach((it, iIdx) => {
                        const subStepItems = explicitItemStrings.slice(0, iIdx + 1);
                        const autoSubStep = {
                            ...currentStep,
                            id: `${stepId}-stage-${iIdx + 1}`,
                            items: subStepItems,
                            activeItemIndex: iIdx,
                            totalStages: explicitItemStrings.length,
                            markdown: subStepItems.join('\n\n')
                        };
                        steps.push(autoSubStep);
                    });
                } else {
                    steps.push(currentStep);
                }
            }

            // Propagate cumulative state to parentContext for subsequent sibling sub-steps
            if (parentContext) {
                if (activeAttrVal !== null && activeAttrVal !== undefined) {
                    parentContext.lastActiveItem = activeAttrVal;
                }
                parentContext.accumulatedNodesMap = new Map();
                localNodesMap.forEach((nodeData, nId) => {
                    parentContext.accumulatedNodesMap.set(nId, { ...nodeData, highlight: false });
                });
                parentContext.accumulatedGroupsMap = new Map();
                localGroupsMap.forEach((groupData, gId) => {
                    parentContext.accumulatedGroupsMap.set(gId, { ...groupData, nodes: [...groupData.nodes] });
                });
                parentContext.accumulatedEdgesSet = new Set(localEdgesSet);
            }

            // Mark context for children
            currentStep.isVideoLayoutParent = isVideoLayout;
            currentStep.isItemStepsParent = isItemStepsParent;
            currentStep.parentItems = explicitItems.length > 0 ? explicitItems : (parentContext ? parentContext.parentItems : []);
            currentStep.parentIntro = extractedDescription || (parentContext ? parentContext.parentIntro : '');
            currentStep.totalStages = totalStages;
            currentStep.accumulatedVideoItems = extractedDescription ? [extractedDescription] : [];
            currentStep.accumulatedNodesMap = new Map();
            localNodesMap.forEach((nodeData, nId) => {
                currentStep.accumulatedNodesMap.set(nId, { ...nodeData, highlight: false });
            });
            currentStep.accumulatedGroupsMap = new Map();
            localGroupsMap.forEach((groupData, gId) => {
                currentStep.accumulatedGroupsMap.set(gId, { ...groupData, nodes: [...groupData.nodes] });
            });
            currentStep.accumulatedEdgesSet = new Set(localEdgesSet);

            // Recursively process child steps
            childSteps.forEach((childEl, idx) => {
                processStepElement(childEl, currentStep, idx);
            });
        }

        // Process top-level steps
        doc.querySelectorAll('presentation > step').forEach((topStepEl, idx) => {
            processStepElement(topStepEl, null, idx);
        });

        return {
            settings,
            steps
        };
    }
}
