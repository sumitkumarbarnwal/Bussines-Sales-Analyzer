/* ═══════════════════════════════════════════
   ANALYTICS MODULE
   ═══════════════════════════════════════════ */
const Analytics = {
    data: null,

    async load() {
        const container = document.getElementById('analytics-content');
        const loading = document.getElementById('analytics-loading');
        container.innerHTML = '';
        loading.classList.remove('hidden');

        try {
            this.data = await API.get('/api/analytics');
            loading.classList.add('hidden');
            this.render(container);
        } catch (err) {
            loading.classList.add('hidden');
            container.innerHTML = `<div class="alert alert-warning">⚠️ ${err.message}. Please upload data first.</div>`;
        }
    },

    render(container) {
        const d = this.data;
        if (!d || !d.kpi) return;

        let html = '';

        // KPI Cards
        html += `<h2 style="margin-bottom:1rem;">Key Performance Indicators</h2>
        <div class="grid grid-5" style="margin-bottom:2rem;">
            ${kpiCard('💵 Total Revenue', formatCurrency(d.kpi.total_revenue), 'kpi-revenue')}
            ${kpiCard('💸 Total Cost', formatCurrency(d.kpi.total_cost), 'kpi-cost')}
            ${kpiCard('💰 Total Profit', formatCurrency(d.kpi.total_profit), d.kpi.total_profit >= 0 ? 'kpi-profit' : 'kpi-loss')}
            ${kpiCard('📊 Profit Margin', d.kpi.profit_margin + '%', 'kpi-margin')}
            ${kpiCard('📈 ROI', d.kpi.roi + '%', 'kpi-roi')}
        </div>`;

        // Time Series Chart
        if (d.time_series && d.time_series.length > 0) {
            html += `<div class="chart-container"><div class="chart-title">📈 Revenue, Cost & Profit Over Time</div><div id="chart-timeseries" class="chart-plot"></div></div>`;
        }

        // Monthly & Day of Week (side by side)
        if (d.monthly || d.day_of_week) {
            html += `<div class="grid grid-2">`;
            if (d.monthly) html += `<div class="chart-container"><div class="chart-title">Monthly Revenue & Profit</div><div id="chart-monthly" class="chart-plot"></div></div>`;
            if (d.day_of_week) html += `<div class="chart-container"><div class="chart-title">Avg Revenue by Day of Week</div><div id="chart-dow" class="chart-plot"></div></div>`;
            html += `</div>`;
        }

        // Category Analysis
        if (d.category_analysis && d.category_analysis.length > 0) {
            html += `<h2 style="margin:2rem 0 1rem;">🏆 Category Profitability</h2>
            <div class="grid grid-2">
                <div class="chart-container"><div class="chart-title">Top Categories by Profit</div><div id="chart-cat-profit" class="chart-plot"></div></div>
                <div class="chart-container"><div class="chart-title">Profit Margin by Category</div><div id="chart-cat-margin" class="chart-plot"></div></div>
            </div>`;
        }

        // Correlation
        if (d.correlation) {
            html += `<div class="chart-container"><div class="chart-title">Correlation Heatmap</div><div id="chart-correlation" class="chart-plot"></div></div>`;
        }

        // Insights
        if (d.insights && d.insights.length > 0) {
            html += `<h2 style="margin:2rem 0 1rem;">💡 AI-Driven Insights</h2>`;
            d.insights.forEach(i => { html += `<div class="insight-box">${i}</div>`; });
        }

        container.innerHTML = html;

        // Render charts after DOM update
        requestAnimationFrame(() => this.renderCharts(d));
    },

    renderCharts(d) {
        // Time series
        if (d.time_series && d.time_series.length > 0) {
            const dates = d.time_series.map(r => r.transaction_date);
            Plotly.newPlot('chart-timeseries', [
                { x: dates, y: d.time_series.map(r => r.revenue), name: 'Revenue', type: 'scatter', line: { color: COLORS.blue, width: 3 }, fill: 'tozeroy', fillcolor: 'rgba(79,172,254,0.1)' },
                { x: dates, y: d.time_series.map(r => r.cost), name: 'Cost', type: 'scatter', line: { color: COLORS.pink, width: 2 } },
                { x: dates, y: d.time_series.map(r => r.profit), name: 'Profit', type: 'bar', marker: { color: COLORS.green, opacity: 0.5 } },
            ], plotlyLayout({ hovermode: 'x unified', height: 420, title: '' }), PLOT_CONFIG);
        }

        // Monthly
        if (d.monthly && document.getElementById('chart-monthly')) {
            Plotly.newPlot('chart-monthly', [
                { x: d.monthly.map(r => r.month), y: d.monthly.map(r => r.revenue), name: 'Revenue', type: 'bar', marker: { color: COLORS.blue } },
                { x: d.monthly.map(r => r.month), y: d.monthly.map(r => r.profit), name: 'Profit', type: 'bar', marker: { color: COLORS.green } },
            ], plotlyLayout({ barmode: 'group', height: 350, title: '' }), PLOT_CONFIG);
        }

        // Day of week
        if (d.day_of_week && document.getElementById('chart-dow')) {
            Plotly.newPlot('chart-dow', [{
                x: d.day_of_week.map(r => r.dow),
                y: d.day_of_week.map(r => r.revenue),
                type: 'bar',
                marker: { color: d.day_of_week.map(r => r.revenue), colorscale: 'Viridis' },
            }], plotlyLayout({ height: 350, title: '' }), PLOT_CONFIG);
        }

        // Category profit
        if (d.category_analysis && document.getElementById('chart-cat-profit')) {
            const top10 = d.category_analysis.slice(0, 10);
            Plotly.newPlot('chart-cat-profit', [{
                x: top10.map(r => r.profit),
                y: top10.map(r => r.category),
                type: 'bar',
                orientation: 'h',
                marker: { color: top10.map(r => r.profit_margin), colorscale: 'RdYlGn', cmin: 0, cmax: 100 },
            }], plotlyLayout({ height: 400, title: '', yaxis: { autorange: 'reversed' } }), PLOT_CONFIG);
        }

        // Category margin
        if (d.category_analysis && document.getElementById('chart-cat-margin')) {
            const top10 = d.category_analysis.slice(0, 10);
            Plotly.newPlot('chart-cat-margin', [{
                x: top10.map(r => r.profit_margin),
                y: top10.map(r => r.category),
                type: 'bar',
                orientation: 'h',
                marker: { color: top10.map(r => r.profit_margin), colorscale: 'Turbo' },
            }], plotlyLayout({ height: 400, title: '', yaxis: { autorange: 'reversed' } }), PLOT_CONFIG);
        }

        // Correlation heatmap
        if (d.correlation && document.getElementById('chart-correlation')) {
            const corrData = d.correlation;
            if (corrData.matrix && corrData.matrix.length > 0) {
                // Create hover text with formatted correlation values
                const hoverText = corrData.matrix.map(row => 
                    row.map(v => v.toFixed(3))
                );
                
                Plotly.newPlot('chart-correlation', [{
                    z: corrData.matrix,
                    x: corrData.columns,
                    y: corrData.columns,
                    type: 'heatmap',
                    colorscale: 'RdBu',
                    zmin: -1, 
                    zmax: 1,
                    text: hoverText,
                    hovertemplate: '%{y} vs %{x}: %{text}<extra></extra>',
                    texttemplate: '%{text}',
                    textfont: { size: 11 },
                    colorbar: { title: 'Correlation' }
                }], plotlyLayout({ 
                    height: 500, 
                    title: '',
                    xaxis: { side: 'bottom' }
                }), PLOT_CONFIG);
            }
        }
    }
};
