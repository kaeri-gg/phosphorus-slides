import { MarkdownHelper } from '../utils/MarkdownHelper.js';

/**
 * DoughnutChartRenderer
 * Renderizador de gráfico de rosca (Doughnut/Donut) com transições fluidas e minimalistas:
 * - Deslocamento radial suave ao longo do ângulo médio da fatia ativa (+7px).
 * - Interpolação numérica animada (tween) no HUD central e nas legendas.
 * - Suave micro-crossfade no título central em branco puro.
 * - Elevação elegante e feedback visual no card da legenda correspondente.
 */
export class DoughnutChartRenderer {
    constructor() {
        this.container = document.getElementById('chart-svg-wrapper');
        this.titleEl = document.getElementById('chart-title');
        this.subtitleEl = document.getElementById('chart-subtitle');
        this.descriptionEl = document.getElementById('chart-description');
        this.legendEl = document.getElementById('chart-legend');

        this.currentChartId = null;
        this.activeAnimationRaf = null;
        this.centerTweenRaf = null;
        this.currentCenterVal = 0;
        this.currentActiveSliceIdx = null;

        // Paleta refinada e sutil
        this.defaultPalette = [
            { fill: 'rgba(56, 189, 248, 0.22)', fillActive: 'rgba(56, 189, 248, 0.40)', stroke: '#38bdf8' },
            { fill: 'rgba(129, 140, 248, 0.22)', fillActive: 'rgba(129, 140, 248, 0.40)', stroke: '#818cf8' },
            { fill: 'rgba(45, 212, 191, 0.22)',  fillActive: 'rgba(45, 212, 191, 0.40)',  stroke: '#2dd4bf' },
            { fill: 'rgba(251, 191, 36, 0.20)',  fillActive: 'rgba(251, 191, 36, 0.38)',  stroke: '#fbbf24' },
            { fill: 'rgba(244, 63, 94, 0.20)',   fillActive: 'rgba(244, 63, 94, 0.38)',   stroke: '#f43f5e' },
            { fill: 'rgba(168, 85, 247, 0.20)',  fillActive: 'rgba(168, 85, 247, 0.38)',  stroke: '#a855f7' }
        ];
    }

    render(step, currentIndex, totalSteps) {
        const chart = step.chart || {};
        const rawSeries = chart.series || [];
        const chartId = chart.id || (step.parentContext ? step.parentContext.id : step.id) || 'doughnut-chart';

        // 1. Painel Esquerdo
        if (this.titleEl) this.titleEl.innerText = chart.title || step.title || 'Distribuição & Métricas';
        if (this.subtitleEl) {
            const sub = chart.subtitle || step.subtitle || '';
            if (sub) {
                this.subtitleEl.innerText = sub;
                this.subtitleEl.classList.remove('hidden');
            } else {
                this.subtitleEl.classList.add('hidden');
            }
        }

        if (this.descriptionEl) {
            const desc = step.markdown || chart.description || '';
            this.descriptionEl.innerHTML = desc ? MarkdownHelper.parse(desc) : '';
        }

        const unit = chart.unit || '%';
        const headerUnit = (chart.unit && chart.unit !== '%') ? chart.unit : '';
        this.centerLabel = chart.centerLabel || this.centerLabel || 'TOTAL';

        // 2. Normalizar Fatias
        const slices = rawSeries.map((s, idx) => {
            let val = 0;
            if (s.value !== undefined && s.value !== null) {
                val = parseFloat(s.value);
            } else if (Array.isArray(s.points) && s.points.length > 0) {
                val = parseFloat(s.points[0]);
            }
            if (isNaN(val) || val < 0) val = 0;

            const palette = this.defaultPalette[idx % this.defaultPalette.length];
            const customColor = s.color;

            return {
                name: s.name || s.label || `Item ${idx + 1}`,
                value: val,
                color: customColor || palette.stroke,
                fill: customColor ? this.hexToRgba(customColor, 0.22) : palette.fill,
                fillActive: customColor ? this.hexToRgba(customColor, 0.40) : palette.fillActive,
                stroke: customColor || palette.stroke,
                unit: s.unit || unit,
                highlight: s.highlight || false,
                dx: 0,
                dy: 0
            };
        });

        const computedTotal = slices.reduce((acc, slice) => acc + slice.value, 0);
        const total = chart.total ? parseFloat(chart.total) : (computedTotal || 100);

        const gapAngle = slices.length > 1 ? 0.04 : 0;
        let currentAngle = -Math.PI / 2;

        slices.forEach(slice => {
            slice.percentage = total > 0 ? (slice.value / total) * 100 : 0;
            const sliceAngle = (slice.value / total) * (Math.PI * 2);
            const startAngle = currentAngle + gapAngle / 2;
            const endAngle = currentAngle + sliceAngle - gapAngle / 2;
            currentAngle += sliceAngle;

            slice.startAngle = startAngle;
            slice.endAngle = endAngle;
            const midAngle = (startAngle + endAngle) / 2;
            slice.dx = parseFloat((Math.cos(midAngle) * 7.5).toFixed(2));
            slice.dy = parseFloat((Math.sin(midAngle) * 7.5).toFixed(2));
        });

        // 3. Índice Ativo
        let activeSliceIdx = null;
        if (chart.active !== undefined && chart.active !== null && chart.active !== '') {
            const num = parseInt(chart.active, 10);
            if (!isNaN(num) && num >= 0 && num < slices.length) {
                activeSliceIdx = num;
            }
        } else if (chart.progress !== undefined && chart.progress !== null && chart.progress !== '') {
            const pNum = parseInt(chart.progress, 10);
            if (!isNaN(pNum) && pNum >= 1 && pNum <= slices.length) {
                activeSliceIdx = pNum - 1;
            }
        } else {
            const highlightIdx = slices.findIndex(s => s.highlight);
            if (highlightIdx !== -1) activeSliceIdx = highlightIdx;
        }

        const isNewChart = (this.currentChartId !== chartId || !this.container.querySelector('#doughnut-svg-root'));
        const maxVal = chart.max || slices.length;
        const currentProgressNum = (activeSliceIdx !== null) ? (activeSliceIdx + 1) : slices.length;

        // 4. Montar Legenda
        this.renderLegend(slices, activeSliceIdx, isNewChart);

        // 5. Montar SVG (com cálculo de deslocamento radial)
        if (isNewChart) {
            this.currentChartId = chartId;
            this.mountSvgStructure(chart, slices, total, headerUnit, currentProgressNum, maxVal, activeSliceIdx);
        } else {
            const progressSvgEl = document.getElementById('chart-svg-progress');
            if (progressSvgEl) progressSvgEl.textContent = `${currentProgressNum} / ${maxVal}`;
            const unitSvgEl = document.getElementById('chart-svg-unit');
            if (unitSvgEl) unitSvgEl.textContent = headerUnit ? headerUnit.toUpperCase() : '';
        }

        // 6. Transição Fluida
        this.animateTransition(slices, total, activeSliceIdx, isNewChart);
        this.currentActiveSliceIdx = activeSliceIdx;
    }

    hexToRgba(hex, alpha = 0.22) {
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16);
        if (isNaN(num)) return `rgba(56, 189, 248, ${alpha})`;
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    renderLegend(slices, activeSliceIdx, isNewChart) {
        if (!this.legendEl) return;

        this.legendEl.innerHTML = slices.map((s, idx) => {
            const stroke = s.stroke;
            const animClass = isNewChart ? 'chart-legend-animated' : '';
            const animStyle = isNewChart ? `style="animation-delay: ${(0.65 + idx * 0.1)}s;"` : '';
            const isActive = (activeSliceIdx !== null && activeSliceIdx === idx);

            return `
                <div id="doughnut-legend-${idx}" 
                     class="flex flex-col items-center justify-center px-4 py-1.5 rounded-xl select-none transition-all duration-300 cursor-pointer ${animClass} ${isActive ? 'opacity-100 scale-105 bg-slate-800/40' : (activeSliceIdx !== null ? 'opacity-45 hover:opacity-100 hover:scale-105' : 'opacity-85 hover:opacity-100 hover:scale-105')}" 
                     ${animStyle}>
                    <!-- Porcentagem Colorida -->
                    <span id="chart-legend-val-${idx}" class="text-2xl sm:text-3xl font-mono font-bold tracking-tight transition-colors duration-300" style="color: ${stroke};">
                        ${isNewChart ? 0 : s.value}${s.unit}
                    </span>
                    <!-- Nome da Série -->
                    <span class="text-xs font-mono font-medium text-slate-300 mt-1 tracking-wide text-center">
                        ${s.name}
                    </span>
                </div>
            `;
        }).join('');

        slices.forEach((_, idx) => {
            const el = document.getElementById(`doughnut-legend-${idx}`);
            if (el) {
                el.addEventListener('mouseenter', () => this.focusSlice(idx, slices));
                el.addEventListener('mouseleave', () => this.restoreFocus(slices, this.currentActiveSliceIdx, false));
            }
        });
    }

    mountSvgStructure(chart, slices, total, unit, currentProgressNum, maxVal, activeSliceIdx) {
        if (!this.container) return;

        const width = 800;
        const height = 490;
        const cx = 400;
        const cy = 255;
        const outerR = 150;
        const innerR = 100;

        let slicesHtml = '';

        slices.forEach((slice, idx) => {
            const d = this.calculateArcPath(cx, cy, outerR, innerR, slice.startAngle, slice.endAngle);

            slicesHtml += `
                <g id="doughnut-slice-g-${idx}" class="doughnut-slice-group cursor-pointer"
                   data-index="${idx}">
                    <path id="doughnut-slice-p-${idx}" d="${d}" 
                          fill="${slice.fill}" stroke="${slice.stroke}" stroke-width="1.5" stroke-linejoin="round"
                          opacity="0.9" class="doughnut-slice-path" />
                </g>
            `;
        });

        const activeSlice = (activeSliceIdx !== null && slices[activeSliceIdx]) ? slices[activeSliceIdx] : null;
        const initialVal = activeSlice ? activeSlice.value : total;
        const initialUnit = activeSlice ? activeSlice.unit : '%';
        const initialColor = activeSlice ? activeSlice.stroke : '#38bdf8';
        const initialLabel = activeSlice ? activeSlice.name.toUpperCase() : (chart.centerLabel || this.centerLabel || 'TOTAL').toUpperCase();
        this.currentCenterVal = 0;

        this.container.innerHTML = `
            <svg id="doughnut-svg-root" viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible chart-blur-enter">
                <!-- Cabeçalho Nativo do SVG (Idêntico ao LineChart) -->
                <g id="chart-header-group" class="chart-label-animated" style="animation-delay: 0.45s;">
                    <text id="chart-svg-unit" x="${width / 2}" y="32" text-anchor="middle" 
                          fill="rgba(203, 213, 225, 0.85)" font-family="monospace" font-size="12.5" font-weight="600" letter-spacing="1.5">
                        ${unit ? unit.toUpperCase() : ''}
                    </text>
                    <text id="chart-svg-progress" x="${width - 45}" y="32" text-anchor="middle" 
                          fill="rgba(148, 163, 184, 0.8)" font-family="monospace" font-size="13.5" font-weight="bold">
                        ${currentProgressNum} / ${maxVal}
                    </text>
                </g>

                <!-- Trilhas Circulares Sutis -->
                <circle cx="${cx}" cy="${cy}" r="${outerR + 10}" fill="none" stroke="rgba(255, 255, 255, 0.05)" stroke-width="1" />
                <circle cx="${cx}" cy="${cy}" r="${innerR - 10}" fill="none" stroke="rgba(255, 255, 255, 0.04)" stroke-width="1" />

                <!-- Fatias Minimalistas com Deslocamento Suave -->
                <g id="doughnut-slices-group" class="doughnut-slices-enter">
                    ${slicesHtml}
                </g>

                <!-- Núcleo Central Limpo -->
                <circle cx="${cx}" cy="${cy}" r="${innerR - 3}" fill="#080d1a" stroke="rgba(255, 255, 255, 0.09)" stroke-width="1" />

                <g id="doughnut-center-hud" class="pointer-events-none select-none">
                    <!-- Porcentagem Inicial em 0 com Opacidade 0 para Fade-in Progressivo -->
                    <text id="doughnut-center-val" x="${cx}" y="${cy - 2}" text-anchor="middle" 
                          fill="${initialColor}" 
                          font-family="monospace" font-size="38" font-weight="800" letter-spacing="-0.5" style="opacity: 0;">0${initialUnit}</text>
                    <!-- Nome da Série Inicialmente Oculto (Fade-in com o sweep) -->
                    <text id="doughnut-center-label" x="${cx}" y="${cy + 24}" text-anchor="middle" 
                          fill="#ffffff" font-family="monospace" font-size="12.5" font-weight="700" 
                          letter-spacing="0.8" text-transform="uppercase" style="opacity: 0;">${initialLabel}</text>
                </g>
            </svg>
        `;

        slices.forEach((_, idx) => {
            const el = document.getElementById(`doughnut-slice-g-${idx}`);
            if (el) {
                el.addEventListener('mouseenter', () => this.focusSlice(idx, slices));
                el.addEventListener('mouseleave', () => this.restoreFocus(slices, this.currentActiveSliceIdx, false));
            }
        });
    }

    calculateArcPath(cx, cy, outerR, innerR, startAngle, endAngle) {
        const deltaAngle = endAngle - startAngle;
        if (deltaAngle <= 0) return '';

        const x1 = cx + outerR * Math.cos(startAngle);
        const y1 = cy + outerR * Math.sin(startAngle);
        const x2 = cx + outerR * Math.cos(endAngle);
        const y2 = cy + outerR * Math.sin(endAngle);

        const x3 = cx + innerR * Math.cos(endAngle);
        const y3 = cy + innerR * Math.sin(endAngle);
        const x4 = cx + innerR * Math.cos(startAngle);
        const y4 = cy + innerR * Math.sin(startAngle);

        const largeArc = deltaAngle > Math.PI ? 1 : 0;

        return `M ${x1.toFixed(2)} ${y1.toFixed(2)} ` +
               `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} ` +
               `L ${x3.toFixed(2)} ${y3.toFixed(2)} ` +
               `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
    }

    focusSlice(idx, slices) {
        const slice = slices[idx];
        if (!slice) return;

        slices.forEach((s, sIdx) => {
            const gEl = document.getElementById(`doughnut-slice-g-${sIdx}`);
            const pEl = document.getElementById(`doughnut-slice-p-${sIdx}`);
            const legendEl = document.getElementById(`doughnut-legend-${sIdx}`);

            if (sIdx === idx) {
                if (gEl) gEl.style.transform = `translate(${s.dx}px, ${s.dy}px) scale(1.025)`;
                if (pEl) {
                    pEl.setAttribute('opacity', '1');
                    pEl.setAttribute('stroke-width', '2.4');
                    pEl.style.fill = s.fillActive;
                }
                if (legendEl) {
                    legendEl.classList.add('opacity-100', 'scale-105', 'bg-slate-800/40');
                    legendEl.classList.remove('opacity-45', 'opacity-50');
                }
            } else {
                if (gEl) gEl.style.transform = 'translate(0px, 0px) scale(1)';
                if (pEl) {
                    pEl.setAttribute('opacity', '0.25');
                    pEl.setAttribute('stroke-width', '1.2');
                    pEl.style.fill = s.fill;
                }
                if (legendEl) {
                    legendEl.classList.add('opacity-45');
                    legendEl.classList.remove('opacity-100', 'scale-105', 'bg-slate-800/40');
                }
            }
        });

        // Transição Suave no HUD Central
        this.tweenCenterValue(slice.value, slice.unit, slice.stroke, slice.name.toUpperCase());
    }

    restoreFocus(slices, activeSliceIdx, isAnimate = true) {
        slices.forEach((s, sIdx) => {
            const gEl = document.getElementById(`doughnut-slice-g-${sIdx}`);
            const pEl = document.getElementById(`doughnut-slice-p-${sIdx}`);
            const legendEl = document.getElementById(`doughnut-legend-${sIdx}`);
            const isActive = (activeSliceIdx !== null && activeSliceIdx === sIdx);

            if (isActive) {
                if (gEl) gEl.style.transform = `translate(${s.dx}px, ${s.dy}px) scale(1.025)`;
                if (pEl) {
                    pEl.setAttribute('opacity', '1');
                    pEl.setAttribute('stroke-width', '2.4');
                    pEl.style.fill = s.fillActive;
                }
                if (legendEl) {
                    legendEl.classList.add('opacity-100', 'scale-105', 'bg-slate-800/40');
                    legendEl.classList.remove('opacity-45', 'opacity-50');
                }
            } else {
                if (gEl) gEl.style.transform = 'translate(0px, 0px) scale(1)';
                if (pEl) {
                    pEl.setAttribute('opacity', (activeSliceIdx === null) ? '0.9' : '0.35');
                    pEl.setAttribute('stroke-width', '1.5');
                    pEl.style.fill = s.fill;
                }
                if (legendEl) {
                    if (activeSliceIdx !== null) {
                        legendEl.classList.add('opacity-45');
                        legendEl.classList.remove('opacity-100', 'scale-105', 'bg-slate-800/40');
                    } else {
                        legendEl.classList.add('opacity-85');
                        legendEl.classList.remove('opacity-45', 'scale-105', 'bg-slate-800/40');
                    }
                }
            }
        });

        // Restaurar HUD Central
        if (activeSliceIdx !== null && slices[activeSliceIdx]) {
            const active = slices[activeSliceIdx];
            this.tweenCenterValue(active.value, active.unit, active.stroke, active.name.toUpperCase(), isAnimate);
        } else {
            const computedTotal = slices.reduce((a, b) => a + b.value, 0);
            const defaultLabel = (this.centerLabel || 'TOTAL').toUpperCase();
            this.tweenCenterValue(computedTotal, '%', '#38bdf8', defaultLabel, isAnimate);
        }
    }

    tweenCenterValue(targetVal, targetUnit, targetColor, targetLabel, animate = true) {
        if (this.centerTweenRaf) {
            cancelAnimationFrame(this.centerTweenRaf);
            this.centerTweenRaf = null;
        }

        const valEl = document.getElementById('doughnut-center-val');
        const labelEl = document.getElementById('doughnut-center-label');

        if (!valEl || !labelEl) return;

        // Atualizar cor e label
        valEl.style.fill = targetColor;

        const currentText = (labelEl.textContent || '').trim();
        const newText = (targetLabel || '').trim();

        if (currentText !== newText && animate) {
            labelEl.style.opacity = '0';
            labelEl.style.transform = 'translateY(3px)';
            setTimeout(() => {
                labelEl.textContent = newText;
                labelEl.style.opacity = '1';
                labelEl.style.transform = 'translateY(0px)';
            }, 110);
        } else {
            labelEl.textContent = newText;
            labelEl.style.opacity = '1';
            labelEl.style.transform = 'translateY(0px)';
        }

        if (!animate) {
            this.currentCenterVal = targetVal;
            valEl.textContent = `${targetVal}${targetUnit}`;
            return;
        }

        const startVal = this.currentCenterVal || 0;
        const duration = 280;
        const startTime = performance.now();
        const easeOutQuad = (t) => t * (2 - t);

        const frame = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / duration);
            const ease = easeOutQuad(progress);

            const curVal = Math.round(startVal + (targetVal - startVal) * ease);
            valEl.textContent = `${curVal}${targetUnit}`;

            if (progress < 1) {
                this.centerTweenRaf = requestAnimationFrame(frame);
            } else {
                this.currentCenterVal = targetVal;
                valEl.textContent = `${targetVal}${targetUnit}`;
            }
        };

        this.centerTweenRaf = requestAnimationFrame(frame);
    }

    animateTransition(slices, total, activeSliceIdx, isNewChart) {
        if (this.activeAnimationRaf) {
            cancelAnimationFrame(this.activeAnimationRaf);
            this.activeAnimationRaf = null;
        }

        const containerEl = document.getElementById('doughnut-slices-group');
        const valEl = document.getElementById('doughnut-center-val');
        const labelEl = document.getElementById('doughnut-center-label');

        // Transição suave e imediata se já estiver na página (restaura opacidade e rotação imediatamente)
        if (!isNewChart) {
            if (containerEl) {
                containerEl.style.transform = 'rotate(0deg) scale(1)';
                containerEl.style.opacity = '1';
            }
            if (valEl) {
                valEl.style.opacity = '1';
            }
            if (labelEl) {
                labelEl.style.opacity = '1';
            }

            this.restoreFocus(slices, activeSliceIdx, true);
            slices.forEach((s, idx) => {
                const legendValEl = document.getElementById(`chart-legend-val-${idx}`);
                if (legendValEl) legendValEl.textContent = `${s.value}${s.unit}`;
            });
            return;
        }

        // Animação de entrada inicial
        const startDelay = 180;
        const duration = 850;
        const startTime = performance.now();
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

        if (containerEl) {
            containerEl.style.transform = 'rotate(-75deg) scale(0.9)';
            containerEl.style.transformOrigin = '400px 255px';
            containerEl.style.opacity = '0';
        }

        const frame = (now) => {
            const elapsed = now - startTime;

            if (elapsed < startDelay) {
                this.activeAnimationRaf = requestAnimationFrame(frame);
                return;
            }

            const growElapsed = elapsed - startDelay;
            const progress = Math.min(1, growElapsed / duration);
            const ease = easeOutCubic(progress);

            if (containerEl) {
                const currentRot = -75 + 75 * ease;
                const currentScale = 0.9 + 0.1 * ease;
                containerEl.style.transform = `rotate(${currentRot}deg) scale(${currentScale})`;
                containerEl.style.opacity = `${progress}`;
            }

            // Animar números da legenda
            slices.forEach((s, idx) => {
                const legendValEl = document.getElementById(`chart-legend-val-${idx}`);
                if (legendValEl) {
                    const cur = (progress >= 1) ? s.value : Math.round(s.value * ease);
                    legendValEl.textContent = `${cur}${s.unit}`;
                }
            });

            // Animar HUD Central
            if (valEl) {
                let targetVal = total;
                let targetUnit = '%';
                let targetColor = '#38bdf8';
                if (activeSliceIdx !== null && slices[activeSliceIdx]) {
                    targetVal = slices[activeSliceIdx].value;
                    targetUnit = slices[activeSliceIdx].unit;
                    targetColor = slices[activeSliceIdx].stroke;
                }
                const cur = (progress >= 1) ? targetVal : Math.round(targetVal * ease);
                valEl.textContent = `${cur}${targetUnit}`;
                valEl.style.fill = targetColor;
                valEl.style.opacity = `${progress}`;
                this.currentCenterVal = cur;
            }
            if (labelEl) {
                labelEl.style.fill = '#ffffff';
                labelEl.style.opacity = `${progress}`;
            }

            if (progress < 1) {
                this.activeAnimationRaf = requestAnimationFrame(frame);
            } else {
                this.activeAnimationRaf = null;
                if (containerEl) {
                    containerEl.style.transform = 'rotate(0deg) scale(1)';
                    containerEl.style.opacity = '1';
                }
                if (valEl) valEl.style.opacity = '1';
                if (labelEl) labelEl.style.opacity = '1';
                this.restoreFocus(slices, activeSliceIdx, false);
            }
        };

        this.activeAnimationRaf = requestAnimationFrame(frame);
    }
}
