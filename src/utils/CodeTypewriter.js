import Prism from 'prismjs';

/**
 * Format raw code with Prism and apply line-aware / substring focus & dimming.
 */
export function formatCodeWithFocus(rawCode, grammar, lang = 'javascript', focusSpec = null) {
    if (!rawCode) return '';

    const lines = rawCode.split('\n');
    const fullFocusedLines = new Set();
    const inlineTokens = [];

    if (focusSpec && typeof focusSpec === 'string' && focusSpec.trim()) {
        const rawQueries = focusSpec.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
        rawQueries.forEach(q => {
            const rangeMatch = q.match(/^(\d+)(?:\s*(?:-|–|\.\.|:)\s*(\d+))?$/);
            if (rangeMatch) {
                const start = parseInt(rangeMatch[1], 10) - 1;
                const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) - 1 : start;
                for (let i = start; i <= end; i++) {
                    if (i >= 0 && i < lines.length) {
                        fullFocusedLines.add(i);
                    }
                }
                return;
            }

            if (q.length <= 30 && !q.includes('\n') && !q.includes('{') && !q.includes('}')) {
                inlineTokens.push(q);
            } else {
                if (rawCode.includes(q)) {
                    const matchStartPos = rawCode.indexOf(q);
                    const matchEndPos = matchStartPos + q.length;
                    let charCount = 0;
                    lines.forEach((lineText, idx) => {
                        const lineStartPos = charCount;
                        const lineEndPos = lineStartPos + lineText.length + 1;
                        if (lineStartPos < matchEndPos && lineEndPos > matchStartPos) {
                            fullFocusedLines.add(idx);
                        }
                        charCount = lineEndPos;
                    });
                }
            }
        });
    }

    const hasAnyFocus = fullFocusedLines.size > 0 || inlineTokens.length > 0;

    const formattedLines = lines.map((lineText, idx) => {
        if (!lineText) {
            return '';
        }

        const highlighted = grammar && window.Prism ? window.Prism.highlight(lineText, grammar, lang) : lineText;

        if (!hasAnyFocus) {
            return `<span class="code-line-span" data-line="${idx}">${highlighted}</span>`;
        }

        if (fullFocusedLines.has(idx)) {
            return `<span class="code-line-span code-focus-line" data-line="${idx}">${highlighted}</span>`;
        }

        const matchedToken = inlineTokens.find(tok => lineText.includes(tok));
        if (matchedToken) {
            const tokIndex = lineText.indexOf(matchedToken);
            const beforeText = lineText.slice(0, tokIndex);
            const afterText = lineText.slice(tokIndex + matchedToken.length);

            const beforeHtml = grammar && window.Prism ? window.Prism.highlight(beforeText, grammar, lang) : beforeText;
            const tokHtml = grammar && window.Prism ? window.Prism.highlight(matchedToken, grammar, lang) : matchedToken;
            const afterHtml = grammar && window.Prism ? window.Prism.highlight(afterText, grammar, lang) : afterText;

            return `<span class="code-line-span" data-line="${idx}"><span class="code-dimmed-part">${beforeHtml}</span><span class="code-focus-token">${tokHtml}</span><span class="code-dimmed-part">${afterHtml}</span></span>`;
        }

        return `<span class="code-line-span code-dimmed-line" data-line="${idx}">${highlighted}</span>`;
    });

    return formattedLines.join('\n');
}

export function applyFocusTransition(codeEl, rawCode, grammar, lang = 'javascript', focusSpec = null) {
    if (!codeEl || !rawCode) return;
    const existingSpans = codeEl.querySelectorAll('.code-line-span');
    if (existingSpans && existingSpans.length > 0) {
        const lines = rawCode.split('\n');
        const fullFocusedLines = new Set();
        const inlineTokens = [];

        if (focusSpec && typeof focusSpec === 'string' && focusSpec.trim()) {
            const rawQueries = focusSpec.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
            rawQueries.forEach(q => {
                const rangeMatch = q.match(/^(\d+)(?:\s*(?:-|–|\.\.|:)\s*(\d+))?$/);
                if (rangeMatch) {
                    const start = parseInt(rangeMatch[1], 10) - 1;
                    const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) - 1 : start;
                    for (let i = start; i <= end; i++) {
                        if (i >= 0 && i < lines.length) fullFocusedLines.add(i);
                    }
                    return;
                }
                if (q.length <= 30 && !q.includes('\n') && !q.includes('{') && !q.includes('}')) {
                    inlineTokens.push(q);
                }
            });
        }
        const hasAnyFocus = fullFocusedLines.size > 0 || inlineTokens.length > 0;

        existingSpans.forEach(span => {
            const lineIdx = parseInt(span.getAttribute('data-line'), 10);
            const lineText = lines[lineIdx] || '';

            if (!hasAnyFocus) {
                span.className = 'code-line-span';
                const highlighted = grammar && window.Prism ? window.Prism.highlight(lineText, grammar, lang) : lineText;
                span.innerHTML = highlighted;
            } else if (fullFocusedLines.has(lineIdx)) {
                span.className = 'code-line-span code-focus-line';
                const highlighted = grammar && window.Prism ? window.Prism.highlight(lineText, grammar, lang) : lineText;
                span.innerHTML = highlighted;
            } else {
                const matchedToken = inlineTokens.find(tok => lineText.includes(tok));
                if (matchedToken) {
                    span.className = 'code-line-span';
                    const tokIndex = lineText.indexOf(matchedToken);
                    const beforeText = lineText.slice(0, tokIndex);
                    const afterText = lineText.slice(tokIndex + matchedToken.length);

                    const beforeHtml = grammar && window.Prism ? window.Prism.highlight(beforeText, grammar, lang) : beforeText;
                    const tokHtml = grammar && window.Prism ? window.Prism.highlight(matchedToken, grammar, lang) : matchedToken;
                    const afterHtml = grammar && window.Prism ? window.Prism.highlight(afterText, grammar, lang) : afterText;

                    span.innerHTML = `<span class="code-dimmed-part">${beforeHtml}</span><span class="code-focus-token">${tokHtml}</span><span class="code-dimmed-part">${afterHtml}</span>`;
                } else {
                    span.className = 'code-line-span code-dimmed-line';
                }
            }
        });
        return;
    }
    codeEl.innerHTML = formatCodeWithFocus(rawCode, grammar, lang, focusSpec) + '<span class="typewriter-cursor typewriter-cursor-fadeout"></span>';
}

/**
 * CodeTypewriter - Multi-Instance Realistic Human Code Typing Engine
 * Supports simultaneous or sequential code typing across multiple IDE windows (e.g. JS vs WGSL),
 * line-aware structural diffing for in-place insertions/deletions anywhere in the file,
 * line/token focus & background dimming, configurable speed, Prism syntax highlighting and fading cursors.
 */
export class CodeTypewriter {
    constructor() {
        this.sessions = new Map();
    }

    static parseSpeed(val) {
        if (!val) return 45; // default base: 45ms
        if (typeof val === 'number') return Math.max(1, val);
        val = String(val).trim().toLowerCase();
        if (val === 'ultra-fast' || val === 'ultrafast') return 5;
        if (val === 'fast') return 20;
        if (val === 'normal' || val === 'medium') return 45;
        if (val === 'slow') return 80;
        if (val.endsWith('ms')) return Math.max(1, parseFloat(val) || 45);
        if (val.endsWith('s')) return Math.max(1, (parseFloat(val) || 1) * 1000);
        if (val.endsWith('x')) {
            const factor = parseFloat(val) || 1;
            return factor > 0 ? Math.max(1, 45 / factor) : 45;
        }
        const num = parseFloat(val);
        return isNaN(num) ? 45 : Math.max(1, num);
    }

    static computeDiff(fromText, toText) {
        if (!fromText) {
            return { prefixText: '', suffixText: '', deletedText: '', insertedText: toText || '' };
        }
        if (!toText) {
            return { prefixText: '', suffixText: '', deletedText: fromText || '', insertedText: '' };
        }
        if (fromText === toText) {
            return { prefixText: toText, suffixText: '', deletedText: '', insertedText: '' };
        }

        let p = 0;
        while (p < fromText.length && p < toText.length && fromText[p] === toText[p]) {
            p++;
        }

        let sFrom = fromText.length;
        let sTo = toText.length;
        while (sFrom > p && sTo > p && fromText[sFrom - 1] === toText[sTo - 1]) {
            sFrom--;
            sTo--;
        }

        let prefixText = fromText.slice(0, p);
        let suffixText = fromText.slice(sFrom);
        let deletedText = fromText.slice(p, sFrom);
        let insertedText = toText.slice(p, sTo);

        // Slide insertion left if inserting multi-line code so it starts with newline / indentation
        // and ensures suffix starts on a new line (pushing existing code down first)
        if (deletedText === '' && insertedText.includes('\n') && suffixText.length > 0) {
            while (
                prefixText.length > 0 &&
                insertedText.length > 0 &&
                prefixText[prefixText.length - 1] === insertedText[insertedText.length - 1] &&
                !suffixText.startsWith('\n')
            ) {
                const char = prefixText[prefixText.length - 1];
                prefixText = prefixText.slice(0, -1);
                insertedText = char + insertedText.slice(0, -1);
                suffixText = char + suffixText;
            }
        }

        // Unglue same-line trailing punctuation (like ");" or ";") so the caret does not type with
        // closing punctuation floating in front of it.
        const firstNewline = suffixText.indexOf('\n');
        const sameLineSuffix = firstNewline !== -1 ? suffixText.slice(0, firstNewline) : suffixText;
        if (
            sameLineSuffix.length > 0 &&
            /[;,).\]}]+/.test(sameLineSuffix) &&
            /^[\s;,).\]}]+$/.test(sameLineSuffix)
        ) {
            const len = sameLineSuffix.length;
            deletedText = deletedText + sameLineSuffix;
            insertedText = insertedText + sameLineSuffix;
            suffixText = suffixText.slice(len);
        }

        return {
            prefixText,
            suffixText,
            deletedText,
            insertedText
        };
    }

    static computeMultiPatchSteps(fromText, toText) {
        if (!fromText || !toText || fromText === toText) return null;
        const fromLines = fromText.split('\n');
        const toLines = toText.split('\n');
        if (fromLines.length !== toLines.length) return null;

        const changedIndices = [];
        for (let i = 0; i < fromLines.length; i++) {
            if (fromLines[i] !== toLines[i]) {
                changedIndices.push(i);
            }
        }

        // Only split if there are multiple changed lines with unchanged lines or separated positions
        if (changedIndices.length <= 1) return null;

        const steps = [];
        let currentLines = [...fromLines];

        for (let k = 0; k < changedIndices.length; k++) {
            const lineIdx = changedIndices[k];
            currentLines[lineIdx] = toLines[lineIdx];
            steps.push(currentLines.join('\n'));
        }

        return steps;
    }

    isTyping(sessionId = null) {
        if (!this.sessions || this.sessions.size === 0) return false;
        if (sessionId) {
            const session = this.sessions.get(sessionId);
            return !!(session && session.active);
        }
        for (const session of this.sessions.values()) {
            if (session && session.active) {
                return true;
            }
        }
        return false;
    }

    completeAll() {
        if (!this.isTyping()) return false;

        let completedAny = false;
        const activeSessions = Array.from(this.sessions.values());

        activeSessions.forEach(session => {
            if (session && session.active) {
                if (session.timeoutId) {
                    clearTimeout(session.timeoutId);
                    session.timeoutId = null;
                }

                const grammar = (window.Prism && window.Prism.languages[session.lang])
                    ? window.Prism.languages[session.lang]
                    : (window.Prism ? window.Prism.languages.javascript : null);

                const isIncremental = session.incremental || (session.suffixText && session.suffixText.length > 0);

                if (session.targetEl) {
                    if (isIncremental) {
                        const pref = session.prefixText || '';
                        const ins = session.insertedText || '';
                        const suff = session.suffixText || '';
                        const highlight = (s) => (grammar && window.Prism ? window.Prism.highlight(s, grammar, session.lang) : s);

                        if (session.focus) {
                            const fullText = pref + ins + suff;
                            const cursorPos = pref.length + ins.length;
                            const lines = fullText.split('\n');
                            let charPos = 0;
                            const formatted = lines.map((lineText, idx) => {
                                const lineStart = charPos;
                                const lineEnd = lineStart + lineText.length;
                                charPos = lineEnd + 1;
                                let lineHtml = '';
                                if (cursorPos >= lineStart && cursorPos <= lineEnd) {
                                    const col = cursorPos - lineStart;
                                    const before = lineText.slice(0, col);
                                    const after = lineText.slice(col);
                                    lineHtml = (before ? highlight(before) : '') + '<span class="typewriter-cursor typewriter-cursor-fadeout"></span>' + (after ? highlight(after) : '');
                                } else {
                                    lineHtml = lineText ? highlight(lineText) : '';
                                }
                                return `<span class="code-line-span" data-line="${idx}">${lineHtml}</span>`;
                            });
                            session.targetEl.innerHTML = formatted.join('\n');
                        } else {
                            session.targetEl.innerHTML = highlight(pref) + highlight(ins) + '<span class="typewriter-cursor typewriter-cursor-fadeout"></span>' + highlight(suff);
                        }

                        const scrollContainer = session.targetEl.closest('.code-window-body') || session.targetEl.parentElement;
                        if (scrollContainer) {
                            const cursorEl = session.targetEl.querySelector('.typewriter-cursor');
                            if (cursorEl) {
                                const cursorTop = cursorEl.offsetTop;
                                const containerHeight = scrollContainer.clientHeight;
                                if (cursorTop > scrollContainer.scrollTop + containerHeight - 60 || cursorTop < scrollContainer.scrollTop) {
                                    scrollContainer.scrollTop = Math.max(0, cursorTop - containerHeight / 2);
                                }
                            }
                        }
                    } else {
                        let highlighted = session.fullCode;
                        if (session.focus) {
                            highlighted = formatCodeWithFocus(session.fullCode, grammar, session.lang, session.focus);
                        } else if (grammar && window.Prism) {
                            highlighted = window.Prism.highlight(session.fullCode, grammar, session.lang);
                        }

                        session.targetEl.innerHTML = highlighted + '<span class="typewriter-cursor typewriter-cursor-fadeout"></span>';
                        const scrollContainer = session.targetEl.closest('.code-window-body') || session.targetEl.parentElement;
                        if (scrollContainer) {
                            scrollContainer.scrollTop = scrollContainer.scrollHeight;
                        }
                    }
                }

                session.active = false;
                this.sessions.delete(session.id);

                if (session.onComplete) {
                    try {
                        session.onComplete();
                    } catch (err) {
                        console.error('Error in typewriter onComplete:', err);
                    }
                }
                completedAny = true;
            }
        });

        return completedAny;
    }

    stop(sessionId = null) {
        if (sessionId) {
            const session = this.sessions.get(sessionId);
            if (session && session.timeoutId) {
                clearTimeout(session.timeoutId);
            }
            this.sessions.delete(sessionId);
        } else {
            this.sessions.forEach(session => {
                if (session.timeoutId) {
                    clearTimeout(session.timeoutId);
                }
            });
            this.sessions.clear();
        }
    }

    morph({ id = 'default', codeEl, fromCode, toCode, lang = 'javascript', speed = null, focus = null, decrement = false, incremental = false, onComplete = null, _finalToCode = null }) {
        this.stop(id);
        if (!codeEl || toCode === undefined || toCode === null) return;

        const grammar = (window.Prism && window.Prism.languages[lang])
            ? window.Prism.languages[lang]
            : (window.Prism ? window.Prism.languages.javascript : null);

        const highlight = (snippet) => {
            if (!snippet) return '';
            if (grammar && window.Prism) {
                return window.Prism.highlight(snippet, grammar, lang);
            }
            return snippet;
        };

        const fromText = fromCode !== undefined && fromCode !== null ? fromCode : (codeEl.getAttribute('data-raw-code') || '');
        const toText = toCode || '';

        if (fromText === toText) {
            if (focus) {
                codeEl.innerHTML = formatCodeWithFocus(toText, grammar, lang, focus) + '<span class="typewriter-cursor typewriter-cursor-fadeout"></span>';
            } else {
                codeEl.innerHTML = highlight(toText) + '<span class="typewriter-cursor typewriter-cursor-fadeout"></span>';
            }
            if (onComplete) onComplete();
            return;
        }

        // Check if this edit consists of multiple separated line modifications where chaining
        // prevents deleting/backspacing unchanged intermediate lines (e.g. bloomPass between emissive and bloom inspector calls)
        if (!_finalToCode) {
            const multiSteps = CodeTypewriter.computeMultiPatchSteps(fromText, toText);
            if (multiSteps && multiSteps.length > 1) {
                const runStep = (stepIdx, currentFrom) => {
                    const stepTarget = multiSteps[stepIdx];
                    const isLast = (stepIdx === multiSteps.length - 1);
                    this.morph({
                        id,
                        codeEl,
                        fromCode: currentFrom,
                        toCode: stepTarget,
                        lang,
                        speed,
                        focus: isLast ? focus : null,
                        decrement,
                        incremental,
                        _finalToCode: toText,
                        onComplete: () => {
                            if (isLast) {
                                if (onComplete) onComplete();
                            } else {
                                runStep(stepIdx + 1, stepTarget);
                            }
                        }
                    });
                };

                runStep(0, fromText);
                return;
            }
        }

        // Structural Line-Aware Diff
        const diff = CodeTypewriter.computeDiff(fromText, toText);
        let { prefixText, suffixText, deletedText, insertedText } = diff;

        // If the shared prefix does not contain meaningful code (e.g. switching to a different snippet
        // or only sharing a comment/whitespace) and decrement is not explicitly requested,
        // clear immediately and type the new snippet from scratch instead of backspacing the old file.
        const hasMeaningfulCode = (text) => {
            if (!text || !text.trim()) return false;
            const stripped = text
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*/g, '')
                .trim();
            return stripped.length >= 3;
        };

        if (!decrement && !hasMeaningfulCode(prefixText)) {
            deletedText = '';
            prefixText = '';
            suffixText = '';
            insertedText = toText;
        }

        const baseSpeed = CodeTypewriter.parseSpeed(speed);
        const backspaceSpeed = Math.max(4, Math.round(baseSpeed * 0.35));

        const session = {
            id,
            targetEl: codeEl,
            fullCode: _finalToCode || toText,
            sourceCode: fromText,
            prefixText,
            suffixText,
            deletedText,
            insertedText,
            lang,
            baseSpeed,
            focus,
            incremental: !!incremental,
            phase: deletedText.length > 0 ? 'delete' : 'insert',
            deleteIndex: deletedText.length,
            insertIndex: 0,
            timeoutId: null,
            mode: 'morph',
            active: true,
            onComplete
        };

        this.sessions.set(id, session);

        const focusedLinesInTarget = new Set();
        if (focus && typeof focus === 'string' && focus.trim()) {
            const lines = toText.split('\n');
            const queries = focus.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
            queries.forEach(q => {
                const rangeMatch = q.match(/^(\d+)(?:\s*(?:-|–|\.\.|:)\s*(\d+))?$/);
                if (rangeMatch) {
                    const start = parseInt(rangeMatch[1], 10) - 1;
                    const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) - 1 : start;
                    for (let i = start; i <= end; i++) {
                        if (i >= 0 && i < lines.length) focusedLinesInTarget.add(i);
                    }
                    return;
                }
                lines.forEach((lineText, idx) => {
                    if (lineText.includes(q)) {
                        focusedLinesInTarget.add(idx);
                    }
                });
            });
        }

        const isIncrementalOrHasSuffix = incremental || (suffixText && suffixText.length > 0);

        const renderFrame = (currentMidText, isFinal = false) => {
            const cursorClass = isFinal ? 'typewriter-cursor typewriter-cursor-fadeout' : 'typewriter-cursor';

            if (isIncrementalOrHasSuffix) {
                // Incremental or in-place edit:
                // Caret MUST stay at the insertion point, NOT jump to the end of the file!
                if (focus && focusedLinesInTarget.size > 0) {
                    const fullCurrent = prefixText + currentMidText + suffixText;
                    const cursorPos = prefixText.length + currentMidText.length;
                    const lines = fullCurrent.split('\n');
                    let charPos = 0;
                    const formatted = lines.map((lineText, idx) => {
                        const lineStart = charPos;
                        const lineEnd = lineStart + lineText.length;
                        charPos = lineEnd + 1; // account for '\n'

                        let lineHtml = '';
                        if (cursorPos >= lineStart && cursorPos <= lineEnd) {
                            const col = cursorPos - lineStart;
                            const before = lineText.slice(0, col);
                            const after = lineText.slice(col);
                            const beforeHtml = before ? highlight(before) : '';
                            const afterHtml = after ? highlight(after) : '';
                            lineHtml = beforeHtml + `<span class="${cursorClass}"></span>` + afterHtml;
                        } else {
                            lineHtml = lineText ? highlight(lineText) : '';
                        }

                        if (focusedLinesInTarget.has(idx)) {
                            return `<span class="code-line-span code-focus-line" data-line="${idx}">${lineHtml}</span>`;
                        } else {
                            return `<span class="code-line-span code-dimmed-line" data-line="${idx}">${lineHtml}</span>`;
                        }
                    });
                    codeEl.innerHTML = formatted.join('\n');
                } else {
                    const prefHtml = highlight(prefixText);
                    const midHtml = highlight(currentMidText);
                    const suffHtml = highlight(suffixText);
                    codeEl.innerHTML = prefHtml + midHtml + `<span class="${cursorClass}"></span>` + suffHtml;
                }
            } else {
                if (isFinal && focus) {
                    codeEl.innerHTML = formatCodeWithFocus(toText, grammar, lang, focus) + `<span class="${cursorClass}"></span>`;
                } else if (isFinal) {
                    codeEl.innerHTML = highlight(toText) + `<span class="${cursorClass}"></span>`;
                } else if (focus && focusedLinesInTarget.size > 0) {
                    // Focus is active: render line-aware focus & dimming immediately while typing!
                    const fullCurrent = prefixText + currentMidText + suffixText;
                    const cursorPos = prefixText.length + currentMidText.length;
                    const lines = fullCurrent.split('\n');
                    let charPos = 0;
                    const formatted = lines.map((lineText, idx) => {
                        const lineStart = charPos;
                        const lineEnd = lineStart + lineText.length;
                        charPos = lineEnd + 1; // account for '\n'

                        let lineHtml = '';
                        if (cursorPos >= lineStart && cursorPos <= lineEnd) {
                            const col = cursorPos - lineStart;
                            const before = lineText.slice(0, col);
                            const after = lineText.slice(col);
                            const beforeHtml = before ? highlight(before) : '';
                            const afterHtml = after ? highlight(after) : '';
                            lineHtml = beforeHtml + `<span class="${cursorClass}"></span>` + afterHtml;
                        } else {
                            lineHtml = lineText ? highlight(lineText) : '';
                        }

                        if (focusedLinesInTarget.has(idx)) {
                            return `<span class="code-line-span code-focus-line" data-line="${idx}">${lineHtml}</span>`;
                        } else {
                            return `<span class="code-line-span code-dimmed-line" data-line="${idx}">${lineHtml}</span>`;
                        }
                    });
                    codeEl.innerHTML = formatted.join('\n');
                } else {
                    const prefHtml = highlight(prefixText);
                    const midHtml = highlight(currentMidText);
                    const suffHtml = highlight(suffixText);
                    codeEl.innerHTML = prefHtml + midHtml + `<span class="${cursorClass}"></span>` + suffHtml;
                }
            }

            const scrollContainer = codeEl.closest('.code-window-body') || codeEl.parentElement;
            if (scrollContainer) {
                // When finishing an incremental code block, do not scroll!
                if (isFinal && isIncrementalOrHasSuffix) {
                    return;
                }
                const cursorEl = codeEl.querySelector('.typewriter-cursor');
                if (cursorEl) {
                    const cursorTop = cursorEl.offsetTop;
                    const containerHeight = scrollContainer.clientHeight;
                    if (cursorTop > scrollContainer.scrollTop + containerHeight - 60 || cursorTop < scrollContainer.scrollTop) {
                        scrollContainer.scrollTop = Math.max(0, cursorTop - containerHeight / 2);
                    }
                }
            }
        };

        const step = () => {
            if (!session.active) return;

            // Phase 1: Deletion
            if (session.phase === 'delete') {
                if (session.deleteIndex <= 0) {
                    session.phase = 'insert';
                    session.insertIndex = 0;
                    session.timeoutId = setTimeout(step, Math.max(80, baseSpeed * 2));
                    return;
                }

                const batchSize = session.deleteIndex > 80
                    ? Math.min(5, session.deleteIndex)
                    : (session.deleteIndex > 40
                        ? Math.min(3, session.deleteIndex)
                        : (session.deleteIndex > 15
                            ? Math.min(2, session.deleteIndex)
                            : 1));

                session.deleteIndex -= batchSize;
                const currentMid = deletedText.slice(0, session.deleteIndex);
                renderFrame(currentMid, false);

                let delay = backspaceSpeed * (0.8 + Math.random() * 0.3);
                const char = deletedText[session.deleteIndex];
                if (char === '\n') {
                    delay = Math.max(15, backspaceSpeed * 1.3);
                }

                session.timeoutId = setTimeout(step, delay);
                return;
            }

            // Phase 2: Insertion
            if (session.phase === 'insert') {
                if (session.insertIndex >= insertedText.length) {
                    renderFrame(insertedText, true);
                    session.active = false;
                    this.sessions.delete(id);
                    if (onComplete) onComplete();
                    return;
                }

                const batchSize = session.baseSpeed <= 5
                    ? Math.min(Math.ceil(8 / session.baseSpeed), insertedText.length - session.insertIndex)
                    : 1;

                session.insertIndex += batchSize;
                const currentMid = insertedText.slice(0, session.insertIndex);
                renderFrame(currentMid, false);

                const char = insertedText[session.insertIndex - 1];
                let delay = session.baseSpeed * (0.85 + Math.random() * 0.3);

                if (char === '\n') {
                    const nextChar = insertedText[session.insertIndex];
                    if (nextChar === '\n') {
                        delay = 240 + session.baseSpeed * 2.5;
                    } else {
                        delay = 140 + session.baseSpeed * 2;
                    }
                } else if (char === ';' || char === ',') {
                    delay = 70 + session.baseSpeed * 1.5;
                } else if (char === '{' || char === '}' || char === '(' || char === ')') {
                    delay = 50 + session.baseSpeed * 1.2;
                } else if (char === '.') {
                    delay = 30 + session.baseSpeed * 1.0;
                } else if (char === ' ') {
                    delay = 15 + session.baseSpeed * 0.6;
                }

                session.timeoutId = setTimeout(step, delay);
            }
        };

        // Render initial frame
        if (session.phase === 'delete') {
            renderFrame(deletedText, false);
            session.timeoutId = setTimeout(step, Math.max(60, backspaceSpeed));
        } else {
            renderFrame('', false);
            session.timeoutId = setTimeout(step, Math.max(100, baseSpeed * 2));
        }
    }

    // Convenience aliases
    type(options) {
        const fromCode = options.initialIndex ? (options.rawCode || '').slice(0, options.initialIndex) : '';
        return this.morph({
            ...options,
            fromCode: options.fromCode || fromCode,
            toCode: options.rawCode || options.toCode
        });
    }

    backspace(options) {
        return this.morph({
            ...options,
            fromCode: options.fromCode,
            toCode: options.targetCode || options.toCode
        });
    }
}
