/* ═══════════════════════════════════════════
   PROFIT INSIGHTS MODULE
   ═══════════════════════════════════════════ */
const Profit = {
    async load() {
        const container = document.getElementById('profit-content');
        container.innerHTML = '<div class="text-center"><div class="spinner-lg"></div><p style="margin-top:1rem;color:var(--text-muted);">Analyzing profit data...</p></div>';

        try {
            const data = await API.get('/api/profit-insights');
            this.render(container, data);
        } catch (err) {
            container.innerHTML = `<div class="alert alert-warning">⚠️ ${err.message}. Upload data first.</div>`;
        }
    },

    render(container, d) {
        let html = '';

        // KPI Cards
        html += `<h2 style="margin-bottom:1rem;">🎯 Profit Performance Summary</h2>
        <div class="grid grid-5" style="margin-bottom:2rem;">
            ${kpiCard('💵 Revenue', formatCurrency(d.total_revenue), 'kpi-revenue')}
            ${kpiCard('💸 Cost', formatCurrency(d.total_cost), 'kpi-cost')}
            ${kpiCard('💰 Net Profit', formatCurrency(d.total_profit), d.total_profit >= 0 ? 'kpi-profit' : 'kpi-loss')}
            ${kpiCard('📊 Avg Margin', d.avg_margin + '%', 'kpi-margin')}
            ${kpiCard('📈 Avg ROI', d.avg_roi + '%', 'kpi-roi')}
        </div>`;

        // Profit Distribution
        html += `<h2 style="margin:2rem 0 1rem;">📊 Profit Distribution</h2>
        <div class="grid grid-2">
            <div class="chart-container"><div class="chart-title">Profit Distribution</div><div id="pi-hist" class="chart-plot"></div></div>
            <div class="chart-container"><div class="chart-title">Profit Margin Distribution</div><div id="pi-margin" class="chart-plot"></div></div>
        </div>`;

        // Winners vs Losers
        const profPct = d.total_count > 0 ? (d.profitable_count / d.total_count * 100).toFixed(1) : 0;
        const lossPct = d.total_count > 0 ? (d.unprofitable_count / d.total_count * 100).toFixed(1) : 0;
        const bePct = d.total_count > 0 ? (d.breakeven_count / d.total_count * 100).toFixed(1) : 0;

        html += `<h2 style="margin:2rem 0 1rem;">🏆 Winners vs ⚠️ Losers</h2>
        <div class="grid grid-3" style="margin-bottom:2rem;">
            <div class="kpi-card kpi-profit">
                <div class="kpi-label">🏆 Profitable</div>
                <div class="kpi-value">${formatNumber(d.profitable_count)}</div>
                <div class="kpi-sub">${profPct}% of total | Profit: ${formatCurrency(d.profitable_profit)}</div>
            </div>
            <div class="kpi-card kpi-loss">
                <div class="kpi-label">⚠️ Unprofitable</div>
                <div class="kpi-value">${formatNumber(d.unprofitable_count)}</div>
                <div class="kpi-sub">${lossPct}% of total | Loss: ${formatCurrency(d.unprofitable_loss)}</div>
            </div>
            <div class="kpi-card kpi-roi">
                <div class="kpi-label">⚖️ Break-even</div>
                <div class="kpi-value">${formatNumber(d.breakeven_count)}</div>
                <div class="kpi-sub">${bePct}% of total</div>
            </div>
        </div>`;

        // Category profitability
        if (d.category_profit && d.category_profit.length > 0) {
            html += `<h2 style="margin:2rem 0 1rem;">🏷️ Category Profitability</h2>
            <div class="grid grid-2">
                <div class="chart-container"><div class="chart-title">Top Profitable Categories</div><div id="pi-cat-top" class="chart-plot"></div></div>
                <div class="chart-container"><div class="chart-title">Loss-making Categories</div><div id="pi-cat-bot" class="chart-plot"></div></div>
            </div>`;

            // Table
            const cols = ['Category', 'Revenue', 'Cost', 'Profit', 'Margin %', 'ROI %'];
            const rows = d.category_profit.map(c => [
                c.category, formatCurrency(c.revenue), formatCurrency(c.cost),
                `<span class="${c.profit >= 0 ? 'badge badge-profit' : 'badge badge-loss'}">${formatCurrency(c.profit)}</span>`,
                c.profit_margin?.toFixed(1) + '%', c.roi?.toFixed(1) + '%',
            ]);
            html += `<div class="glass-card" style="margin-top:1rem;"><h3>Detailed Table</h3>${buildTable(cols, rows)}</div>`;
        }

        // Actionable Insights
        html += `<h2 style="margin:2rem 0 1rem;">💡 Actionable Insights</h2>`;

        if (d.avg_margin > 30)
            html += `<div class="insight-box">✅ <strong>Excellent Performance:</strong> Average margin of ${d.avg_margin}% is outstanding!</div>`;
        else if (d.avg_margin > 15)
            html += `<div class="insight-box">👍 <strong>Good Performance:</strong> Average margin of ${d.avg_margin}% is healthy.</div>`;
        else
            html += `<div class="insight-box">⚠️ <strong>Action Needed:</strong> Margin of ${d.avg_margin}% is below optimal. Consider cost optimization.</div>`;

        if (d.unprofitable_count > d.total_count * 0.3)
            html += `<div class="insight-box">🔴 <strong>High Loss Rate:</strong> ${lossPct}% of transactions are unprofitable.</div>`;

        if (d.total_profit > 0)
            html += `<div class="insight-box">💰 <strong>Overall Profitability:</strong> Generated ${formatCurrency(d.total_profit)} in profit. Focus on scaling.</div>`;
        else
            html += `<div class="insight-box">🚨 <strong>Critical:</strong> Overall loss of ${formatCurrency(Math.abs(d.total_profit))}. Immediate action required.</div>`;

        if (d.category_profit && d.category_profit.length > 0) {
            const top = d.category_profit[0];
            html += `<div class="insight-box">🏆 <strong>Top Performer:</strong> "${top.category}" is most profitable with ${formatCurrency(top.profit)} profit.</div>`;
            const bot = d.category_profit[d.category_profit.length - 1];
            if (bot.profit < 0)
                html += `<div class="insight-box">⚠️ <strong>Loss Leader:</strong> "${bot.category}" causes ${formatCurrency(Math.abs(bot.profit))} in losses.</div>`;
        }

        container.innerHTML = html;

        // Render charts
        requestAnimationFrame(() => this.renderCharts(d));
    },

    renderCharts(d) {
        // Profit histogram
        if (d.profit_distribution && document.getElementById('pi-hist')) {
            Plotly.newPlot('pi-hist', [{
                x: d.profit_distribution, type: 'histogram', nbinsx: 40,
                marker: { color: COLORS.teal, opacity: 0.7 },
            }], plotlyLayout({
                height: 350,
                shapes: [{ type: 'line', x0: 0, x1: 0, y0: 0, y1: 1, yref: 'paper', line: { color: COLORS.pink, width: 2, dash: 'dash' } }],
            }), PLOT_CONFIG);
        }

        // Margin box plot
        if (d.margin_distribution && document.getElementById('pi-margin')) {
            Plotly.newPlot('pi-margin', [{
                y: d.margin_distribution, type: 'box', name: 'Profit Margin %',
                marker: { color: COLORS.purple }, boxmean: true,
            }], plotlyLayout({ height: 350 }), PLOT_CONFIG);
        }

        // Category top
        if (d.category_profit && document.getElementById('pi-cat-top')) {
            const top10 = d.category_profit.filter(c => c.profit > 0).slice(0, 10);
            Plotly.newPlot('pi-cat-top', [{
                x: top10.map(c => c.profit), y: top10.map(c => c.category),
                type: 'bar', orientation: 'h',
                marker: { color: top10.map(c => c.profit_margin || 0), colorscale: 'RdYlGn', cmin: 0, cmax: 100 },
            }], plotlyLayout({ height: 400, yaxis: { autorange: 'reversed' } }), PLOT_CONFIG);
        }

        // Category bottom
        if (d.category_profit && document.getElementById('pi-cat-bot')) {
            const bottom = d.category_profit.filter(c => c.profit <= 0).slice(-10);
            if (bottom.length > 0) {
                Plotly.newPlot('pi-cat-bot', [{
                    x: bottom.map(c => c.profit), y: bottom.map(c => c.category),
                    type: 'bar', orientation: 'h',
                    marker: { color: COLORS.pink },
                }], plotlyLayout({ height: 400, yaxis: { autorange: 'reversed' } }), PLOT_CONFIG);
            }
        }
    },
};
