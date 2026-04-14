/* ═══════════════════════════════════════════
   REPORTS MODULE
   ═══════════════════════════════════════════ */
const Reports = {
    async load() {
        const container = document.getElementById('reports-content');
        container.innerHTML = '<div class="text-center"><div class="spinner-lg"></div></div>';

        let salesData = [];
        try {
            const res = await API.get('/api/sales');
            salesData = res.data || [];
        } catch { }

        if (salesData.length === 0) {
            container.innerHTML = '<div class="alert alert-warning">⚠️ No data available for reports. Upload data first.</div>';
            return;
        }

        let html = '';

        // Report type selector
        html += `<div class="glass-card" style="margin-bottom:1.5rem;">
            <h3>Select Report Type</h3>
            <div class="analysis-selector" style="margin-top:1rem;">
                <button class="analysis-tab active" data-report="summary" onclick="Reports.showReport('summary')">📋 Summary</button>
                <button class="analysis-tab" data-report="detailed" onclick="Reports.showReport('detailed')">🔍 Detailed Analysis</button>
                <button class="analysis-tab" data-report="executive" onclick="Reports.showReport('executive')">🎯 Executive Dashboard</button>
            </div>
        </div>
        <div id="report-output"></div>`;

        // Export Section
        html += `<div class="section-divider"></div>
        <h2 style="margin-bottom:1rem;">📥 Export Options</h2>
        <div class="grid grid-3">
            <a href="/api/export/csv" class="btn btn-primary" style="text-decoration:none;text-align:center;">📥 Download CSV</a>
            <a href="/api/export/excel" class="btn btn-success" style="text-decoration:none;text-align:center;">📥 Download Excel</a>
            <a href="/api/export/pdf" class="btn btn-danger" style="text-decoration:none;text-align:center;">📄 Download PDF</a>
        </div>`;

        container.innerHTML = html;

        // Store data for report rendering
        this._data = salesData;
        this.showReport('summary');
    },

    showReport(type) {
        // Update active tab
        document.querySelectorAll('#reports-content .analysis-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.report === type);
        });

        const output = document.getElementById('report-output');
        const data = this._data || [];

        switch (type) {
            case 'summary':   this.renderSummary(output, data); break;
            case 'detailed':  this.renderDetailed(output, data); break;
            case 'executive': this.renderExecutive(output, data); break;
        }
    },

    renderSummary(output, data) {
        const totalRevenue = data.reduce((s, r) => s + (r.revenue || 0), 0);
        const totalProfit = data.reduce((s, r) => s + (r.profit || 0), 0);
        const totalCost = data.reduce((s, r) => s + (r.cost_price * r.quantity || 0), 0);
        const categories = new Set(data.map(r => r.category));
        const products = new Set(data.map(r => r.product_name));
        const dates = data.map(r => r.transaction_date).filter(Boolean);
        const dateRange = dates.length > 0 ? `${dates[dates.length - 1]} to ${dates[0]}` : 'N/A';

        let html = `
        <div class="grid grid-2" style="margin-bottom:1.5rem;">
            <div class="glass-card">
                <h3>📊 Dataset Overview</h3>
                <ul style="list-style:none;padding:0;margin-top:1rem;color:var(--text-secondary);line-height:2;">
                    <li><strong>Total Records:</strong> ${formatNumber(data.length)}</li>
                    <li><strong>Date Range:</strong> ${dateRange}</li>
                    <li><strong>Products:</strong> ${products.size}</li>
                    <li><strong>Categories:</strong> ${categories.size}</li>
                </ul>
            </div>
            <div class="glass-card">
                <h3>💰 Financial Summary</h3>
                <ul style="list-style:none;padding:0;margin-top:1rem;color:var(--text-secondary);line-height:2;">
                    <li><strong>Total Revenue:</strong> ${formatCurrency(totalRevenue)}</li>
                    <li><strong>Total Cost:</strong> ${formatCurrency(totalCost)}</li>
                    <li><strong>Total Profit:</strong> ${formatCurrency(totalProfit)}</li>
                    <li><strong>Profit Margin:</strong> ${totalRevenue > 0 ? (totalProfit / totalRevenue * 100).toFixed(1) : 0}%</li>
                </ul>
            </div>
        </div>`;

        // Top categories
        const catMap = {};
        data.forEach(r => {
            if (!catMap[r.category]) catMap[r.category] = 0;
            catMap[r.category] += r.revenue || 0;
        });
        const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
        html += `<div class="glass-card"><h3>🏆 Top Categories by Revenue</h3>
        ${buildTable(['Category', 'Revenue'], topCats.map(([c, v]) => [c, formatCurrency(v)]))}</div>`;

        output.innerHTML = html;
    },

    renderDetailed(output, data) {
        const revenues = data.map(r => r.revenue || 0).filter(v => !isNaN(v));
        const profits = data.map(r => r.profit || 0).filter(v => !isNaN(v));

        const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
        const std = arr => { const m = mean(arr); return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length); };
        const sorted = arr => [...arr].sort((a, b) => a - b);
        const percentile = (arr, p) => { const s = sorted(arr); const i = (p / 100) * (s.length - 1); const f = Math.floor(i); return s[f] + (s[f + 1] - s[f]) * (i - f); };

        let html = `
        <div class="grid grid-2" style="margin-bottom:1.5rem;">
            <div class="glass-card">
                <h3>Revenue Statistics</h3>
                <ul style="list-style:none;padding:0;margin-top:1rem;color:var(--text-secondary);line-height:2;">
                    <li><strong>Mean:</strong> ${formatCurrency(mean(revenues))}</li>
                    <li><strong>Std Dev:</strong> ${formatCurrency(std(revenues))}</li>
                    <li><strong>Median:</strong> ${formatCurrency(percentile(revenues, 50))}</li>
                    <li><strong>90th Percentile:</strong> ${formatCurrency(percentile(revenues, 90))}</li>
                    <li><strong>Range:</strong> ${formatCurrency(Math.min(...revenues))} – ${formatCurrency(Math.max(...revenues))}</li>
                </ul>
            </div>
            <div class="glass-card">
                <h3>Profit Statistics</h3>
                <ul style="list-style:none;padding:0;margin-top:1rem;color:var(--text-secondary);line-height:2;">
                    <li><strong>Mean:</strong> ${formatCurrency(mean(profits))}</li>
                    <li><strong>Std Dev:</strong> ${formatCurrency(std(profits))}</li>
                    <li><strong>Median:</strong> ${formatCurrency(percentile(profits, 50))}</li>
                    <li><strong>90th Percentile:</strong> ${formatCurrency(percentile(profits, 90))}</li>
                    <li><strong>Range:</strong> ${formatCurrency(Math.min(...profits))} – ${formatCurrency(Math.max(...profits))}</li>
                </ul>
            </div>
        </div>`;

        html += `<div class="chart-container"><div class="chart-title">Revenue Distribution</div><div id="rpt-hist" class="chart-plot"></div></div>`;
        output.innerHTML = html;

        requestAnimationFrame(() => {
            Plotly.newPlot('rpt-hist', [
                { x: revenues, type: 'histogram', nbinsx: 40, name: 'Revenue', marker: { color: COLORS.blue, opacity: 0.7 } },
            ], plotlyLayout({ height: 350 }), PLOT_CONFIG);
        });
    },

    renderExecutive(output, data) {
        const totalRevenue = data.reduce((s, r) => s + (r.revenue || 0), 0);
        const totalProfit = data.reduce((s, r) => s + (r.profit || 0), 0);
        const avgTxn = totalRevenue / data.length;

        let html = `
        <div class="grid grid-3" style="margin-bottom:2rem;">
            ${kpiCard('📊 Total Records', formatNumber(data.length), 'kpi-neutral')}
            ${kpiCard('💰 Total Revenue', formatCurrency(totalRevenue), 'kpi-revenue')}
            ${kpiCard('📈 Avg Transaction', formatCurrency(avgTxn), 'kpi-profit')}
        </div>
        <div class="insight-box">💰 <strong>Highest Value:</strong> ${formatCurrency(Math.max(...data.map(r => r.revenue || 0)))}</div>
        <div class="insight-box">📈 <strong>Growth Potential:</strong> Top 10% values start at ${formatCurrency(
            [...data.map(r => r.revenue || 0)].sort((a, b) => a - b)[Math.floor(data.length * 0.9)] || 0
        )}</div>`;

        if (data.length > 1000) {
            html += `<div class="insight-box">📊 <strong>Large Dataset:</strong> ${formatNumber(data.length)} records — statistically significant results</div>`;
        }

        output.innerHTML = html;
    },
};
