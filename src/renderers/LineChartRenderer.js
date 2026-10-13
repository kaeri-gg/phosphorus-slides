import { MarkdownHelper } from '../utils/MarkdownHelper.js';

/**
 * LineChartRenderer
 * Responsável por renderizar gráficos de linhas vetoriais interativos e modernos (SVG),
 * com orquestração cinematográfica de inicialização:
 * 1. O grid e eixos são construídos a partir do ponto zero (origem) para cima e para a direita.
 * 2. Os rótulos de escala e anos (2012, 2016...) surgem progressivamente.
 * 3. As curvas e pontos de dados são traçados logo em seguida com interpolação precisa.
 * 4. As legendas de métricas surgem de forma progressiva e contam em tempo real.
 */
export class LineChartRenderer {
    constructor() {
        this.container = document.getElementById('chart-svg-wrapper');
        this.titleEl = document.getElementById('chart-title');
        this.subtitleEl = document.getElementById('chart-subtitle');
        this.descriptionEl = document.getElementById('chart-description');
        this.legendEl = document.getElementById('chart-legend');

        this.currentChartId = null;
        this.seriesLengths = new Map(); // seriesIndex -> { totalLength, pointLengths: [] }
        this.activeAnimationRaf = null;
        this.prevActiveCount = 1;
        this.currentActiveCount = 1;
    }

    render(step, currentIndex, totalSteps) {
        const chart = step.chart || {};
        const series = chart.series || [];
        const xAxisObj = chart.xAxis || {};
        const xAxisLabels = (xAxisObj && Array.isArray(xAxisObj.labels) && xAxisObj.labels.length > 0)
            ? xAxisObj.labels
            : (Array.isArray(xAxisObj) ? xAxisObj : []);

        const yAxisObj = chart.yAxis || {};
        const yAxisValues = (yAxisObj && Array.isArray(yAxisObj.values) && yAxisObj.values.length > 0)
            ? yAxisObj.values
            : ((yAxisObj && Array.isArray(yAxisObj.labels) && yAxisObj.labels.length > 0)
                ? yAxisObj.labels.map(Number).filter(n => !isNaN(n))
                : (Array.isArray(yAxisObj) ? yAxisObj.map(Number).filter(n => !isNaN(n)) : []));

        const chartId = chart.id || (step.parentContext ? step.parentContext.id : step.id) || 'default-chart';

        // Atualizar Textos e Metadados
        if (this.titleEl) this.titleEl.innerText = chart.title || step.title || 'Gráfico de Desempenho';
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

        const unit = chart.unit || 'Throughput / FPS';

        // Calcular limites de pontos e progressão
        let maxPointsCount = 0;
        series.forEach(s => {
            if (s.points && s.points.length > maxPointsCount) {
                maxPointsCount = s.points.length;
            }
        });
        if (xAxisLabels.length > maxPointsCount) maxPointsCount = xAxisLabels.length;
        if (maxPointsCount === 0) maxPointsCount = 5;

        // Determinar o progresso ativo (1-indexed count of visible points)
        let activeCount = maxPointsCount;
        if (chart.progress !== undefined && chart.progress !== null && chart.progress !== '') {
            const pVal = String(chart.progress).trim();
            if (pVal.endsWith('%')) {
                const pct = parseFloat(pVal) / 100;
                activeCount = Math.max(1, Math.round(pct * maxPointsCount));
            } else {
                const num = parseInt(pVal, 10);
                if (!isNaN(num)) {
                    activeCount = Math.max(1, Math.min(num, maxPointsCount));
                }
            }
        }

        const maxVal = chart.max || maxPointsCount;

        // Verificar se é inicialização de novo gráfico
        const isNewChart = (this.currentChartId !== chartId || !this.container.querySelector('#chart-svg-root'));

        // Renderizar Legenda com Números Grandes e Entrada Progressiva se for novo gráfico
        this.renderLegend(series, activeCount, isNewChart);

        // Montar estrutura SVG base se o gráfico for novo ou se o container estiver vazio
        if (isNewChart) {
            this.currentChartId = chartId;
            this.prevActiveCount = 1;
            this.mountSvgStructure(chart, series, xAxisLabels, yAxisValues, yAxisObj, maxPointsCount, unit, activeCount, maxVal);
        } else {
            const progressSvgEl = document.getElementById('chart-svg-progress');
            if (progressSvgEl) progressSvgEl.textContent = `${activeCount} / ${maxVal}`;
            const unitSvgEl = document.getElementById('chart-svg-unit');
            if (unitSvgEl) unitSvgEl.textContent = unit.toUpperCase();
        }

        // Animar a construção das linhas de forma contínua e sem piscadas
        this.animateGrowthTo(series, activeCount, maxPointsCount, isNewChart);
        this.prevActiveCount = activeCount;
        this.currentActiveCount = activeCount;
    }

    renderLegend(series, activeCount, isNewChart) {
        if (!this.legendEl) return;

        this.legendEl.innerHTML = series.map((s, idx) => {
            const color = s.color || this.getDefaultColor(idx);
            const currentPointVal = (s.points && s.points[activeCount - 1] !== undefined) ? s.points[activeCount - 1] : '-';
            const animClass = isNewChart ? 'chart-legend-animated' : '';
            const animStyle = isNewChart ? `style="animation-delay: ${(0.85 + idx * 0.2)}s;"` : '';

            return `
                <div class="flex flex-col items-center justify-center px-4 py-1 select-none transition-all duration-300 ${animClass}" ${animStyle}>
                    <!-- Número em Destaque Maior no Topo (Com ID dinâmico para contagem em tempo real) -->
                    <span id="chart-legend-val-${idx}" class="text-2xl sm:text-3xl font-mono font-black tracking-tight" style="color: ${color}; text-shadow: 0 0 16px ${color}50;">
                        ${isNewChart ? 0 : currentPointVal}
                    </span>
                    <!-- Nome da Série Embaixo (Com espaçamento confortável) -->
                    <span class="text-xs sm:text-sm font-mono font-semibold text-slate-200 mt-2 tracking-wide text-center drop-shadow-sm">
                        ${s.name || `Série ${idx + 1}`}
                    </span>
                </div>
            `;
        }).join('');
    }

    mountSvgStructure(chart, series, xAxisLabels, yAxisValues, yAxisObj, maxPointsCount, unit = 'FPS', activeCount = 1, maxVal = 5) {
        if (!this.container) return;

        const width = 800;
        const height = 490;
        const padding = { top: 40, right: 40, bottom: 50, left: 65 };

        const innerWidth = width - padding.left - padding.right;
        const innerHeight = height - padding.top - padding.bottom;

        // Calcular Min e Max dos valores Y
        let minY = (yAxisObj && yAxisObj.min !== null && yAxisObj.min !== undefined) ? yAxisObj.min : 0;
        let maxY = (yAxisObj && yAxisObj.max !== null && yAxisObj.max !== undefined) ? yAxisObj.max : 100;

        let allValues = [];
        series.forEach(s => {
            if (s.points) allValues.push(...s.points);
        });

        if (yAxisValues && yAxisValues.length > 0) {
            allValues.push(...yAxisValues);
        }

        if (allValues.length > 0) {
            const rawMax = Math.max(...allValues);
            const rawMin = Math.min(...allValues);
            if (!yAxisObj || yAxisObj.min === null || yAxisObj.min === undefined) minY = Math.min(0, rawMin);
            if (!yAxisObj || yAxisObj.max === null || yAxisObj.max === undefined) maxY = Math.ceil((rawMax * 1.15) / 10) * 10 || 100;
        }

        const getX = (index) => {
            if (maxPointsCount <= 1) return padding.left + innerWidth / 2;
            return padding.left + (index / (maxPointsCount - 1)) * innerWidth;
        };

        const getY = (val) => {
            const ratio = (val - minY) / (maxY - minY || 1);
            return padding.top + innerHeight - ratio * innerHeight;
        };

        // Grid Horizontal (Eixo Y) construído da esquerda para a direita
        const gridSteps = 5;
        let yGridHtml = '';
        let yLabelsHtml = '';
        for (let i = 0; i <= gridSteps; i++) {
            const val = minY + (i / gridSteps) * (maxY - minY);
            const yPos = getY(val);
            const formattedVal = Number.isInteger(val) ? val : val.toFixed(1);

            yGridHtml += `
                <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" 
                      stroke="rgba(255, 255, 255, 0.08)" stroke-dasharray="3 4" stroke-width="1" 
                      class="chart-grid-sweep-x" style="animation-delay: ${(i * 0.09)}s;" />
            `;
            yLabelsHtml += `
                <text x="${padding.left - 14}" y="${yPos + 5}" text-anchor="end" 
                      fill="rgba(203, 213, 225, 0.85)" font-family="monospace" font-size="13.5" font-weight="600"
                      class="chart-label-animated" style="animation-delay: ${(0.28 + i * 0.08)}s;">
                    ${formattedVal}
                </text>
            `;
        }

        // Grid Vertical e Rótulos do Eixo X construídos de baixo para cima
        let xGridHtml = '';
        let xLabelsHtml = '';
        for (let i = 0; i < maxPointsCount; i++) {
            const xPos = getX(i);
            const labelText = xAxisLabels[i] || `Ponto ${i + 1}`;

            xGridHtml += `
                <line x1="${xPos}" y1="${padding.top + innerHeight}" x2="${xPos}" y2="${padding.top}" 
                      stroke="rgba(255, 255, 255, 0.05)" stroke-width="1" 
                      class="chart-grid-sweep-y" style="animation-delay: ${(i * 0.1)}s;" />
            `;
            xLabelsHtml += `
                <text id="chart-xlabel-${i}" x="${xPos}" y="${padding.top + innerHeight + 26}" text-anchor="middle" 
                      fill="rgba(148, 163, 184, 0.7)" 
                      font-family="monospace" font-size="14.5" font-weight="600" 
                      class="chart-label-animated transition-colors duration-400" style="animation-delay: ${(0.38 + i * 0.09)}s;">
                    ${labelText}
                </text>
            `;
        }

        // Filtros e Defs
        let defsHtml = `
            <filter id="chart-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        `;

        // Curvas e Elementos das Séries
        let pathsHtml = '';
        let dotsHtml = '';

        series.forEach((s, sIdx) => {
            const color = s.color || this.getDefaultColor(sIdx);
            const points = s.points || [];
            if (points.length === 0) return;

            const allCoords = points.map((val, pIdx) => ({
                x: getX(pIdx),
                y: getY(val),
                val: val,
                label: xAxisLabels[pIdx] || `Etapa ${pIdx + 1}`
            }));

            const fullLinePathD = this.generateSmoothPath(allCoords);

            // Linha com Glow Puro e Stroke Offset Dinâmico
            pathsHtml += `
                <path id="chart-path-${sIdx}" d="${fullLinePathD}" fill="none" stroke="${color}" stroke-width="3.5" 
                      stroke-linecap="round" stroke-linejoin="round" filter="url(#chart-glow-filter)"
                      class="chart-curve-path" />
            `;

            // Pontos de Dados com Halo Integrado 100% Concêntrico (Sem duplicações)
            allCoords.forEach((pt, pIdx) => {
                dotsHtml += `
                    <g id="chart-point-${sIdx}-${pIdx}" class="chart-point-marker chart-point-hidden" 
                       data-series="${s.name}" data-val="${pt.val}" data-x="${pt.x}" data-y="${pt.y}">
                        <!-- Halo / Anel de Pulso Concêntrico do Ponto Ativo -->
                        <circle id="chart-point-halo-${sIdx}-${pIdx}" cx="${pt.x}" cy="${pt.y}" r="11" 
                                fill="none" stroke="${color}" stroke-width="2" opacity="0" class="transition-opacity duration-300" />
                        
                        <!-- Ponto Central Base -->
                        <circle id="chart-point-core-${sIdx}-${pIdx}" cx="${pt.x}" cy="${pt.y}" r="5.5" 
                                fill="#0f172a" stroke="${color}" stroke-width="2.8" />
                    </g>
                `;
            });
        });

        // Montar SVG com Cabeçalho e Eixos que varrem a partir da origem (ponto zero)
        this.container.innerHTML = `
            <svg id="chart-svg-root" viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible chart-blur-enter">
                <defs>${defsHtml}</defs>

                <!-- Cabeçalho Nativo do SVG: Unidade Centralizada e Passos Alinhados com a Linha 2025 -->
                <g id="chart-header-group" class="chart-label-animated" style="animation-delay: 0.55s;">
                    <text id="chart-svg-unit" x="${padding.left + innerWidth / 2}" y="${padding.top - 15}" text-anchor="middle" 
                          fill="rgba(203, 213, 225, 0.85)" font-family="monospace" font-size="12.5" font-weight="600" letter-spacing="1.5">
                        ${unit.toUpperCase()}
                    </text>
                    <text id="chart-svg-progress" x="${width - padding.right}" y="${padding.top - 15}" text-anchor="middle" 
                          fill="rgba(148, 163, 184, 0.8)" font-family="monospace" font-size="13.5" font-weight="bold">
                        ${activeCount} / ${maxVal}
                    </text>
                </g>

                <!-- Grid Construído Progressivamente -->
                <g id="chart-grid-group">${yGridHtml}${xGridHtml}</g>
                <g id="chart-labels-group">${yLabelsHtml}${xLabelsHtml}</g>

                <!-- Eixos Principais que disparam a partir do Ponto Zero (Origem: Canto Inferior Esquerdo) -->
                <!-- Eixo X: do Ponto Zero para a Direita -->
                <line x1="${padding.left}" y1="${padding.top + innerHeight}" x2="${width - padding.right}" y2="${padding.top + innerHeight}" 
                      stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" class="chart-axis-sweep-x" />
                
                <!-- Eixo Y: do Ponto Zero para Cima -->
                <line x1="${padding.left}" y1="${padding.top + innerHeight}" x2="${padding.left}" y2="${padding.top}" 
                      stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" class="chart-axis-sweep-y" />

                <!-- Curvas e Áreas -->
                <g id="chart-paths-group">${pathsHtml}</g>

                <!-- Pontos de Dados Concêntricos -->
                <g id="chart-dots-group">${dotsHtml}</g>
            </svg>
        `;

        // Medir comprimentos exatos dos caminhos SVG com precisão sub-pixel (Busca binária)
        this.measureSeriesLengths(series, maxPointsCount, getX);
    }

    measureSeriesLengths(series, maxPointsCount, getX) {
        this.seriesLengths.clear();

        series.forEach((s, sIdx) => {
            const pathEl = document.getElementById(`chart-path-${sIdx}`);
            if (!pathEl) return;

            const totalLength = pathEl.getTotalLength();
            const points = s.points || [];
            const pointLengths = [];

            // Obter comprimento exato via busca binária (precisão < 0.001px)
            for (let pIdx = 0; pIdx < points.length; pIdx++) {
                const targetX = getX(pIdx);
                let low = 0;
                let high = totalLength;
                let bestLength = 0;

                // 24 iterações de bisseção matemática
                for (let iter = 0; iter < 24; iter++) {
                    const mid = (low + high) / 2;
                    const pt = pathEl.getPointAtLength(mid);
                    if (pt.x < targetX) {
                        low = mid;
                    } else {
                        high = mid;
                    }
                    bestLength = mid;
                }
                pointLengths.push(bestLength);
            }

            this.seriesLengths.set(sIdx, {
                totalLength,
                pointLengths
            });

            // Configurar stroke-dasharray inicial
            pathEl.style.strokeDasharray = `${totalLength} ${totalLength}`;
            pathEl.style.strokeDashoffset = `${totalLength}`;
        });
    }

    animateGrowthTo(series, activeCount, maxPointsCount, isNewChart) {
        if (this.activeAnimationRaf) {
            cancelAnimationFrame(this.activeAnimationRaf);
            this.activeAnimationRaf = null;
        }

        const startDelay = isNewChart ? 750 : 0; // Espera a grade e eixos se construírem com calma
        const duration = isNewChart ? 1400 : 1100;
        const startTime = performance.now();
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3.2);

        const targetPointIdx = Math.max(0, activeCount - 1);
        const prevPointIdx = isNewChart ? 0 : Math.max(0, this.prevActiveCount - 1);

        const frame = (now) => {
            const elapsed = now - startTime;

            // Se ainda estiver na fase de construção do grid de fundo, manter linhas no início
            if (elapsed < startDelay) {
                series.forEach((s, sIdx) => {
                    const pathEl = document.getElementById(`chart-path-${sIdx}`);
                    const meta = this.seriesLengths.get(sIdx);
                    if (pathEl && meta) {
                        pathEl.style.strokeDashoffset = `${meta.totalLength}`;
                    }
                });
                this.activeAnimationRaf = requestAnimationFrame(frame);
                return;
            }

            const growElapsed = elapsed - startDelay;
            const progress = Math.min(1, growElapsed / duration);
            const ease = easeOutCubic(progress);

            // Atualizar cada série com interpolação precisa do comprimento e contadores em tempo real
            series.forEach((s, sIdx) => {
                const pathEl = document.getElementById(`chart-path-${sIdx}`);
                const meta = this.seriesLengths.get(sIdx);

                if (!pathEl || !meta) return;

                const startLen = isNewChart ? 0 : (meta.pointLengths[prevPointIdx] || 0);
                const endLen = meta.pointLengths[targetPointIdx] || meta.totalLength;
                const curLength = startLen + (endLen - startLen) * ease;

                // Aplicar stroke-dashoffset exato
                pathEl.style.strokeDashoffset = `${meta.totalLength - curLength}`;

                // Atualizar contador de valor da legenda em tempo real sincronizado com a linha
                const points = s.points || [];
                const startVal = (points[prevPointIdx] !== undefined) ? points[prevPointIdx] : 0;
                const endVal = (points[targetPointIdx] !== undefined) ? points[targetPointIdx] : 0;
                const curVal = (progress >= 1) ? endVal : (isNewChart ? Math.round(endVal * ease) : Math.round(startVal + (endVal - startVal) * ease));
                const legendValEl = document.getElementById(`chart-legend-val-${sIdx}`);
                if (legendValEl) {
                    legendValEl.textContent = curVal;
                }

                // Atualizar estado de todos os pontos de dados sem duplicatas ou piscadas
                points.forEach((val, pIdx) => {
                    const pointEl = document.getElementById(`chart-point-${sIdx}-${pIdx}`);
                    const pointHalo = document.getElementById(`chart-point-halo-${sIdx}-${pIdx}`);
                    const pointCore = document.getElementById(`chart-point-core-${sIdx}-${pIdx}`);
                    if (!pointEl) return;

                    const pointLength = meta.pointLengths[pIdx] !== undefined ? meta.pointLengths[pIdx] : 0;

                    if (pIdx < activeCount && curLength >= (pointLength - 2)) {
                        pointEl.classList.remove('chart-point-hidden');
                        pointEl.classList.add('chart-point-active');

                        // O ponto na ponta ativa (fronteira) ganha o halo luminoso concêntrico e núcleo branco
                        if (pIdx === targetPointIdx) {
                            if (pointHalo) pointHalo.setAttribute('opacity', '0.85');
                            if (pointCore) pointCore.setAttribute('fill', '#ffffff');
                        } else {
                            if (pointHalo) pointHalo.setAttribute('opacity', '0');
                            if (pointCore) pointCore.setAttribute('fill', '#0f172a');
                        }
                    } else {
                        pointEl.classList.add('chart-point-hidden');
                        pointEl.classList.remove('chart-point-active');
                        if (pointHalo) pointHalo.setAttribute('opacity', '0');
                    }
                });
            });

            // Atualizar rótulos do eixo X
            for (let i = 0; i < maxPointsCount; i++) {
                const labelEl = document.getElementById(`chart-xlabel-${i}`);
                if (labelEl) {
                    if (i < activeCount) {
                        labelEl.setAttribute('fill', '#38bdf8');
                        labelEl.setAttribute('font-weight', 'bold');
                    } else {
                        labelEl.setAttribute('fill', 'rgba(148, 163, 184, 0.7)');
                        labelEl.setAttribute('font-weight', '600');
                    }
                }
            }

            if (progress < 1) {
                this.activeAnimationRaf = requestAnimationFrame(frame);
            } else {
                this.activeAnimationRaf = null;
            }
        };

        this.activeAnimationRaf = requestAnimationFrame(frame);
    }

    generateSmoothPath(points) {
        if (points.length === 0) return '';
        if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

        let d = `M ${points[0].x} ${points[0].y}`;

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = (i > 0) ? points[i - 1] : points[i];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = (i != points.length - 2) ? points[i + 2] : p2;

            const tension = 0.25;

            const cp1x = p1.x + (p2.x - p0.x) * tension;
            const cp1y = p1.y + (p2.y - p0.y) * tension;

            const cp2x = p2.x - (p3.x - p1.x) * tension;
            const cp2y = p2.y - (p3.y - p1.y) * tension;

            d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
        }

        return d;
    }

    getDefaultColor(index) {
        const palette = ['#00f0ff', '#a855f7', '#38bdf8', '#10b981', '#f59e0b', '#ec4899'];
        return palette[index % palette.length];
    }
}
