import { marked } from 'marked';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike.js';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-c.js';
import 'prismjs/components/prism-glsl.js';

// Expor globalmente para compatibilidade
if (typeof window !== 'undefined') {
    window.marked = marked;
    window.Prism = Prism;
}

/**
 * MarkdownHelper - Centralized helper for rendering rich markdown
 * with Prism.js syntax highlighting, Mac IDE glass frames,
 * SVG file icons (JS, WGSL, TS, GLSL), and highlight="true" glow support.
 */
export class MarkdownHelper {
    static initialized = false;

    static init() {
        if (this.initialized) return;

        // Ensure WGSL grammar is registered in Prism
        if (Prism && !Prism.languages.wgsl) {
            Prism.languages.wgsl = {
                'comment': [
                    { pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/, lookbehind: true },
                    { pattern: /(^|[^\\:])\/\/.*/, lookbehind: true }
                ],
                'attribute': {
                    pattern: /@\w+(?:\([^)]*\))?/,
                    alias: 'builtin'
                },
                'string': {
                    pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
                    greedy: true
                },
                'keyword': /\b(?:align|as|const|continue|break|case|default|discard|else|enable|fallthrough|fn|for|if|let|loop|override|return|struct|switch|type|var|while)\b/,
                'builtin': /\b(?:vec2|vec3|vec4|mat2x2|mat3x3|mat4x4|f32|i32|u32|bool|sampler|texture2d|texture_2d|texture_cube|array|atomic|ptr)\b|<(?:f32|i32|u32|bool)>/,
                'function': /\b[a-zA-Z_]\w*(?=\s*\()/,
                'number': /\b0x[\da-fA-F]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?:f|u|i)?\b/,
                'operator': /[-+*\/%&|^!=<>]=?|&&|\|\||<<|>>/,
                'punctuation': /[{}[\];(),.:]/
            };
        }

        // Register TSL builtins & types (float, vec2, vec3, vec4, Fn, sin, time, etc.) for JS and TS
        const tslBuiltins = /\b(?:Fn|float|vec2|vec3|vec4|mat2|mat3|mat4|ivec2|ivec3|ivec4|uvec2|uvec3|uvec4|bvec2|bvec3|bvec4|int|uint|bool|color|positionLocal|positionWorld|positionView|normalLocal|normalWorld|normalView|uv|time|sin|cos|tan|asin|acos|atan|pow|exp|log|sqrt|abs|sign|floor|ceil|fract|mod|min|max|clamp|mix|step|smoothstep|length|distance|dot|cross|normalize|faceforward|reflect|refract|matrixCompMult|uniform|attribute|varying|texture|sampler)\b/;

        if (Prism && Prism.languages.javascript && !Prism.languages.javascript['tsl-builtin']) {
            Prism.languages.insertBefore('javascript', 'keyword', {
                'tsl-builtin': {
                    pattern: tslBuiltins,
                    alias: ['function', 'builtin']
                }
            });
        }

        if (Prism && Prism.languages.typescript && !Prism.languages.typescript['tsl-builtin']) {
            Prism.languages.insertBefore('typescript', 'keyword', {
                'tsl-builtin': {
                    pattern: tslBuiltins,
                    alias: ['function', 'builtin']
                }
            });
        }

        const renderer = new marked.Renderer();

        // 1. Enhanced Inline Code Span Highlighter with Prism
        renderer.codespan = function({ text }) {
            const cleanText = text || '';
            let highlighted = cleanText;

            if (window.Prism && window.Prism.languages.javascript) {
                highlighted = window.Prism.highlight(cleanText, window.Prism.languages.javascript, 'javascript');
            }

            return `<code class="inline-code-badge">${highlighted}</code>`;
        };

        renderer.code = function({ text, lang }) {
            let defaultLang = (lang && lang.trim()) ? lang.trim().toLowerCase() : 'javascript';
            let filename = '';
            let cleanText = text || '';
            let isHighlight = false;

            // 1. Check if lang specifies filename (e.g. javascript:fireShader.js)
            if (defaultLang.includes(':')) {
                const parts = defaultLang.split(':');
                defaultLang = parts[0] || 'javascript';
                filename = parts[1] || '';
            }

            if (defaultLang.includes('highlight')) {
                isHighlight = true;
                defaultLang = defaultLang.replace(/[:_]?highlight/g, '') || 'javascript';
            }

            // 2. Check if the first line is a filename comment (e.g. // fireShader.js)
            const firstLineMatch = cleanText.match(/^\/\/\s*([\w\-.]+\.[a-zA-Z0-9]+)\s*\n/);
            if (firstLineMatch) {
                filename = firstLineMatch[1];
                cleanText = cleanText.replace(/^\/\/\s*([\w\-.]+\.[a-zA-Z0-9]+)\s*\n/, '');
            }

            if (cleanText.includes('// highlight:true\n')) {
                isHighlight = true;
                cleanText = cleanText.replace('// highlight:true\n', '');
            }

            const displayFilename = filename || (defaultLang === 'javascript' ? 'shader.js' : (defaultLang === 'wgsl' ? 'shader.wgsl' : `${defaultLang}.code`));
            const displayBadge = defaultLang === 'javascript' ? 'JavaScript' : defaultLang.toUpperCase();
            const highlightClass = isHighlight ? 'code-window-highlighted' : '';

            let highlighted = cleanText;
            if (window.Prism) {
                const grammar = window.Prism.languages[defaultLang] || window.Prism.languages.javascript;
                if (grammar) {
                    highlighted = window.Prism.highlight(cleanText, grammar, defaultLang);
                }
            }

            const codeId = `code-block-${Math.random().toString(36).substr(2, 9)}`;

            // High-resolution SVG file icon (Tabler File-Type-JS SVG)
            let fileSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-amber-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                    <path d="M3 15h3v4.5a1.5 1.5 0 0 1 -3 0" />
                    <path d="M9 20.25c0 .414 .336 .75 .75 .75h1.25a1 1 0 0 0 1 -1v-1a1 1 0 0 0 -1 -1h-1a1 1 0 0 1 -1 -1v-1a1 1 0 0 1 1 -1h1.25a.75 .75 0 0 1 .75 .75" />
                    <path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2h-1" />
                </svg>
            `;

            if (displayFilename.endsWith('.wgsl') || defaultLang === 'wgsl') {
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
            } else if (displayFilename.endsWith('.ts') || defaultLang === 'ts' || defaultLang === 'typescript') {
                fileSvg = `
                    <svg class="w-4 h-4 rounded-[3px] flex-shrink-0 shadow-sm" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="24" height="24" rx="3" fill="#3178C6"/>
                        <path d="M14.5 10.8V8H22V10.8H19.6V19H16.9V10.8H14.5ZM8.6 10.5C9.4 10.5 10.1 10.8 10.6 11.3L12.3 9.7C11.3 8.6 9.9 8 8.4 8C5.2 8 3 10.2 3 13.5C3 16.8 5.2 19 8.4 19C9.9 19 11.3 18.4 12.3 17.3L10.6 15.7C10.1 16.2 9.4 16.5 8.6 16.5C6.9 16.5 5.6 15.2 5.6 13.5C5.6 11.8 6.9 10.5 8.6 10.5Z" fill="#FFFFFF"/>
                    </svg>
                `;
            } else if (displayFilename.endsWith('.glsl') || defaultLang === 'glsl') {
                fileSvg = `
                    <svg class="w-4 h-4 rounded-[3px] flex-shrink-0 shadow-sm" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="24" height="24" rx="3" fill="#0284C7"/>
                        <path d="M12 3L4 7.5V16.5L12 21L20 16.5V7.5L12 3ZM12 5.2L17.8 8.5L12 11.8L6.2 8.5L12 5.2ZM5.5 9.7L11.2 13V19.1L5.5 15.8V9.7ZM12.8 19.1V13L18.5 9.7V15.8L12.8 19.1Z" fill="#FFFFFF"/>
                    </svg>
                `;
            }

            return `
                <div class="code-window-frame my-4 ${highlightClass} select-text">
                    <div class="code-window-header relative flex items-center justify-between px-4 py-2.5 select-none">
                        <!-- Left: macOS Window Controls -->
                        <div class="flex items-center space-x-2 z-10">
                            <span class="w-3 h-3 rounded-full bg-[#ff5f56] inline-block shadow-sm"></span>
                            <span class="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block shadow-sm"></span>
                            <span class="w-3 h-3 rounded-full bg-[#27c93f] inline-block shadow-sm"></span>
                        </div>
                        <!-- Center: Perfectly Centered Header Title -->
                        <div class="absolute inset-0 flex items-center justify-center pointer-events-none px-14">
                            <div class="flex items-center justify-center space-x-2 font-mono text-xs font-semibold text-slate-200 tracking-wide pointer-events-auto max-w-[calc(100%-8rem)]">
                                ${fileSvg}
                                <span class="truncate">${displayFilename}</span>
                            </div>
                        </div>
                        <!-- Right: Perfectly Aligned Language Badge -->
                        <div class="flex items-center justify-end z-10">
                            <span class="px-2.5 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/60 text-[11px] font-mono text-slate-400 font-medium">${displayBadge}</span>
                        </div>
                    </div>
                    <div class="code-window-body">
                        <pre class="language-${defaultLang}"><code id="${codeId}" class="language-${defaultLang}">${highlighted}</code></pre>
                    </div>
                </div>
            `;
        };

        window.marked.setOptions({
            renderer: renderer,
            breaks: true,
            gfm: true
        });

        this.initialized = true;
    }

    static parse(rawMarkdown) {
        if (!rawMarkdown) return '';
        if (typeof rawMarkdown === 'object') {
            rawMarkdown = rawMarkdown.text || rawMarkdown.desc || rawMarkdown.title || JSON.stringify(rawMarkdown);
        }
        rawMarkdown = String(rawMarkdown);

        this.init();

        // Preprocess custom <code ...>...</code> tags into fenced code blocks with file metadata
        let processed = rawMarkdown.replace(/<code(?:\s+(?:lang|language)=["']?(\w+)["']?)?(?:\s+file=["']?([^"'>]+)["']?)?(?:\s+highlight=["']?(\w+)["']?)?(?:\s+(?:lang|language)=["']?(\w+)["']?)?>([\s\S]*?)<\/code>/gi, (match, lang1, file, highlight, lang2, codeContent) => {
            const cleanLang = lang1 || lang2 || 'javascript';
            const fileHeader = file ? `// ${file}\n` : '';
            const highlightHeader = (highlight === 'true' || highlight === '1') ? `// highlight:true\n` : '';
            return `\`\`\`${cleanLang}\n${fileHeader}${highlightHeader}${codeContent.trim()}\n\`\`\``;
        });

        if (window.marked && window.marked.parse) {
            let html = window.marked.parse(processed);
            html = html.replace(/<br\s*\/?>\s*<\/p>/gi, '</p>');
            return html.trim();
        }

        return processed.replace(/\n/g, '<br>');
    }

    static parseInline(rawText) {
        if (!rawText) return '';
        if (typeof rawText === 'object') {
            rawText = rawText.text || rawText.desc || rawText.title || JSON.stringify(rawText);
        }
        rawText = String(rawText);

        this.init();

        if (window.marked && window.marked.parseInline) {
            return window.marked.parseInline(rawText).trim();
        }

        // Fallback: parse basic markdown inline formatting
        return rawText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code class="inline-code-badge">$1</code>');
    }
}
