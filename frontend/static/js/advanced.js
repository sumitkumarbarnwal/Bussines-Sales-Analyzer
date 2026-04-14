/* ═══════════════════════════════════════════
   ADVANCED ANALYTICS MODULE (ML)
   ═══════════════════════════════════════════ */
const Advanced = {
    salesData: null,

    async ensureData() {
        if (this.salesData) return;
        try {
            const res = await API.get('/api/sales');
            this.salesData = res.data;
        } catch { this.salesData = []; }
    },

    async load(analysisType = 'forecast') {
        await this.ensureData();
        const container = document.getElementById('advanced-content');
        if (!this.salesData || this.salesData.length === 0) {
            container.innerHTML = '<div class="alert alert-warning">⚠️ No data available. Upload data first.</div>';
            return;
        }
        switch (analysisType) {
            case 'forecast':  this.renderForecast(container); break;
            case 'cluster':   this.renderCluster(container); break;
            case 'outliers':  this.renderOutliers(container); break;
            case 'decompose': this.renderDecompose(container); break;
            case 'stats':     this.renderStats(container); break;
        }
    },

    /* ── Forecasting ── */
    renderForecast(container) {
        const numCols = ['revenue', 'profit', 'quantity', 'unit_price', 'cost_price'];
        const available = numCols.filter(c => this.salesData[0]?.[c] !== undefined);
        container.innerHTML = `
        <div class="glass-card" style="margin-bottom:1.5rem;">
            <h3>🔮 AI-Assisted Predictive Analytics</h3>
            <div class="form-grid" style="margin-top:1rem;">
                <div class="form-group-dash">
                    <label>Metric to Forecast</label>
                    <select id="fc-metric" class="input">${available.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
                </div>
                <div class="form-group-dash">
                    <label>Model Type</label>
                    <select id="fc-model" class="input">
                        <option value="linear">Linear Regression</option>
                        <option value="poly2">Polynomial (Degree 2)</option>
                        <option value="poly3">Polynomial (Degree 3)</option>
                        <option value="moving_avg">Moving Average</option>
                        <option value="exp_smooth">Exponential Smoothing</option>
                        <option value="seasonal">Seasonal (Best for Monthly)</option>
                    </select>
                </div>
                <div class="form-group-dash">
                    <label>Forecast Periods</label>
                    <input type="range" id="fc-periods" min="3" max="30" value="7" class="input" oninput="document.getElementById('fc-periods-val').textContent=this.value">
                    <span id="fc-periods-val" style="color:var(--text-secondary);font-size:0.85rem;">7</span>
                </div>
                <div class="form-group-dash" style="display:flex;align-items:flex-end;">
                    <button class="btn btn-primary btn-lg" id="fc-run" style="width:100%;">Run Forecast</button>
                </div>
            </div>
        </div>

        <div class="glass-card" style="margin-bottom:1.5rem;">
            <h3>💰 Monthly Revenue Breakdown</h3>
            <button class="btn btn-secondary" id="monthly-revenue-btn" style="margin-bottom:1rem;">📊 View Monthly Revenue Forecast</button>
            <div id="monthly-revenue-results"></div>
        </div>

        <div id="fc-results"></div>`;

        document.getElementById('fc-run').addEventListener('click', () => this.runForecast());
        document.getElementById('monthly-revenue-btn').addEventListener('click', () => this.showMonthlyRevenue());
    },

    async showMonthlyRevenue() {
        const resultsDiv = document.getElementById('monthly-revenue-results');
        resultsDiv.innerHTML = '<div class="spinner"></div><p>Loading monthly revenue forecast...</p>';

        try {
            // Aggregate revenue by month
            const monthlyData = {};
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            this.salesData.forEach(r => {
                if (r.transaction_date && r.revenue) {
                    const date = new Date(r.transaction_date);
                    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    monthlyData[yearMonth] = (monthlyData[yearMonth] || 0) + r.revenue;
                }
            });

            const sortedMonths = Object.keys(monthlyData).sort();
            const monthlyRevenue = sortedMonths.map(m => ({ month: m, revenue: monthlyData[m] }));

            // Forecast future months
            const revenueValues = monthlyRevenue.map(m => m.revenue);
            
            if (revenueValues.length < 3) {
                resultsDiv.innerHTML = '<div class="alert alert-warning">Need at least 3 months of data for monthly forecasting</div>';
                return;
            }

            // Get forecast for next 6 months
            const forecastData = await API.post('/api/ml/forecast', { 
                values: revenueValues, 
                periods: 6, 
                model_type: 'seasonal'
            });

            // Generate future month labels
            const lastDate = new Date(sortedMonths[sortedMonths.length - 1]);
            const futureMonths = [];
            for (let i = 1; i <= 6; i++) {
                lastDate.setMonth(lastDate.getMonth() + 1);
                const yearMonth = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;
                const monthName = monthNames[lastDate.getMonth()];
                futureMonths.push({ month: yearMonth, label: `${monthName} '${String(lastDate.getFullYear()).slice(-2)}` });
            }

            // Build dropdown and table
            let html = `<select id="monthly-dropdown" class="input" style="margin-bottom:1rem;">
                <option value="all">-- Historical & Forecasted Revenue --</option>`;
            
            // Historical months
            monthlyRevenue.forEach(m => {
                const date = new Date(m.month + '-01');
                const monthName = monthNames[date.getMonth()];
                const year = date.getFullYear();
                html += `<option value="hist_${m.month}">Historical: ${monthName} ${year} - ${formatCurrency(m.revenue)}</option>`;
            });

            // Forecasted months
            forecastData.forecast.forEach((revenue, idx) => {
                html += `<option value="fore_${idx}">Forecast: ${futureMonths[idx].label} - ${formatCurrency(revenue)}</option>`;
            });

            html += `</select>`;

            // Summary table
            html += `<table class="data-table" style="margin-top:1rem;">
                <thead>
                    <tr>
                        <th>Month</th>
                        <th>Revenue</th>
                        <th>Type</th>
                        <th>Change vs Prev</th>
                    </tr>
                </thead>
                <tbody>`;

            // Historical rows
            monthlyRevenue.forEach((m, idx) => {
                const date = new Date(m.month + '-01');
                const monthName = monthNames[date.getMonth()];
                const prevRevenue = idx > 0 ? monthlyRevenue[idx - 1].revenue : m.revenue;
                const change = ((m.revenue - prevRevenue) / prevRevenue * 100).toFixed(1);
                const changeColor = change >= 0 ? '#38ef7d' : '#f5576c';
                html += `<tr>
                    <td>${monthName} ${date.getFullYear()}</td>
                    <td>${formatCurrency(m.revenue)}</td>
                    <td><span style="background:#667eea;color:white;padding:0.25rem 0.75rem;border-radius:4px;font-size:0.75rem;">ACTUAL</span></td>
                    <td><span style="color:${changeColor};">${change > 0 ? '+' : ''}${change}%</span></td>
                </tr>`;
            });

            // Forecasted rows
            forecastData.forecast.forEach((revenue, idx) => {
                const prevRevenue = idx === 0 ? revenueValues[revenueValues.length - 1] : forecastData.forecast[idx - 1];
                const change = ((revenue - prevRevenue) / prevRevenue * 100).toFixed(1);
                const changeColor = change >= 0 ? '#38ef7d' : '#f5576c';
                html += `<tr>
                    <td>${futureMonths[idx].label}</td>
                    <td>${formatCurrency(revenue)}</td>
                    <td><span style="background:#38ef7d;color:white;padding:0.25rem 0.75rem;border-radius:4px;font-size:0.75rem;">FORECAST</span></td>
                    <td><span style="color:${changeColor};">${change > 0 ? '+' : ''}${change}%</span></td>
                </tr>`;
            });

            html += `</tbody></table>`;

            resultsDiv.innerHTML = html;

        } catch (err) {
            resultsDiv.innerHTML = `<div class="alert alert-danger">Error loading monthly revenue: ${err.message}</div>`;
        }
    },

    async runForecast() {
        const metric = document.getElementById('fc-metric').value;
        const model = document.getElementById('fc-model').value;
        const periods = parseInt(document.getElementById('fc-periods').value);
        const results = document.getElementById('fc-results');
        results.innerHTML = '<div class="text-center"><div class="spinner-lg"></div><p style="margin-top:1rem;color:var(--text-muted)">Running ML model...</p></div>';

        // Aggregate by date
        const byDate = {};
        this.salesData.forEach(r => {
            const d = r.transaction_date;
            if (!byDate[d]) byDate[d] = 0;
            byDate[d] += (r[metric] || 0);
        });
        const dates = Object.keys(byDate).sort();
        const values = dates.map(d => byDate[d]);

        if (values.length < 6) {
            results.innerHTML = '<div class="alert alert-warning">Need at least 6 data points for forecasting.</div>';
            return;
        }

        try {
            const data = await API.post('/api/ml/forecast', { values, periods, model_type: model, dates });

            // Generate future dates
            const lastDate = new Date(dates[dates.length - 1]);
            const futureDates = [];
            for (let i = 1; i <= periods; i++) {
                const nd = new Date(lastDate);
                nd.setDate(nd.getDate() + i);
                futureDates.push(nd.toISOString().split('T')[0]);
            }

            let html = `<div class="chart-container"><div class="chart-title">📈 ${metric} Forecast using ${model}</div><div id="fc-chart" class="chart-plot"></div></div>`;

            html += `<div class="grid grid-2">
                <div class="glass-card">
                    <h3>📊 Forecast Values</h3>
                    ${buildTable(['Date', 'Forecast', 'Lower (95%)', 'Upper (95%)'],
                        futureDates.map((d, i) => [d, data.forecast[i]?.toFixed(2), data.lower_bound[i]?.toFixed(2), data.upper_bound[i]?.toFixed(2)])
                    )}
                </div>
                <div class="glass-card">
                    <h3>📈 Model Performance</h3>
                    <div class="grid grid-2" style="margin-top:1rem;">
                        ${kpiCard('R² Score', data.r2?.toFixed(3), 'kpi-revenue')}
                        ${kpiCard('MAE', data.mae?.toFixed(2), 'kpi-cost')}
                        ${kpiCard('RMSE', data.rmse?.toFixed(2), 'kpi-margin')}
                        ${kpiCard('Trend', (data.trend_direction === 'up' ? '📈 Up' : '📉 Down') + ` (${data.trend_change_pct}%)`, data.trend_direction === 'up' ? 'kpi-profit' : 'kpi-loss')}
                    </div>
                </div>
            </div>`;

            // AI Insights
            html += `<h2 style="margin:2rem 0 1rem;">🤖 AI-Generated Insights</h2>`;
            const avgForecast = data.forecast.reduce((a, b) => a + b, 0) / data.forecast.length;
            const avgHistorical = values.reduce((a, b) => a + b, 0) / values.length;

            if (avgForecast > avgHistorical * 1.1) {
                html += `<div class="insight-box">📈 <strong>Strong Growth Expected:</strong> Forecast shows ${((avgForecast / avgHistorical - 1) * 100).toFixed(1)}% increase over historical average</div>`;
            } else if (avgForecast < avgHistorical * 0.9) {
                html += `<div class="insight-box">📉 <strong>Declining Trend:</strong> Forecast shows ${((1 - avgForecast / avgHistorical) * 100).toFixed(1)}% decrease — consider intervention</div>`;
            } else {
                html += `<div class="insight-box">➡️ <strong>Stable Trend:</strong> Forecast remains within 10% of historical average</div>`;
            }
            if (data.r2 > 0.8) html += `<div class="insight-box">✅ <strong>High Confidence:</strong> Model explains ${(data.r2 * 100).toFixed(1)}% of variance</div>`;
            else html += `<div class="insight-box">⚠️ <strong>Moderate/Low Confidence:</strong> Use forecast with caution (R²=${data.r2?.toFixed(3)})</div>`;

            results.innerHTML = html;

            // Render chart
            requestAnimationFrame(() => {
                Plotly.newPlot('fc-chart', [
                    { x: dates, y: values, name: 'Historical', type: 'scatter', mode: 'lines+markers', line: { color: COLORS.blue, width: 3 }, marker: { size: 6 } },
                    { x: dates, y: data.fitted, name: 'Model Fit', type: 'scatter', line: { color: COLORS.pink, width: 2, dash: 'dot' } },
                    { x: futureDates, y: data.forecast, name: 'Forecast', type: 'scatter', mode: 'lines+markers', line: { color: COLORS.green, width: 3, dash: 'dash' }, marker: { size: 8, symbol: 'star' } },
                    { x: futureDates, y: data.upper_bound, name: 'Upper 95%', type: 'scatter', line: { width: 0 }, showlegend: false },
                    { x: futureDates, y: data.lower_bound, name: '95% Confidence', type: 'scatter', fill: 'tonexty', fillcolor: 'rgba(56,239,125,0.15)', line: { width: 0 } },
                ], plotlyLayout({ height: 480, hovermode: 'x unified', legend: { orientation: 'h', y: 1.08 } }), PLOT_CONFIG);
            });
        } catch (err) {
            results.innerHTML = `<div class="alert alert-danger">❌ ${err.message}</div>`;
        }
    },

    /* ── Clustering ── */
    renderCluster(container) {
        const numCols = ['revenue', 'profit', 'quantity', 'unit_price', 'cost_price'];
        const available = numCols.filter(c => this.salesData[0]?.[c] !== undefined);
        
        // Calculate max clusters intelligently: min(2*sqrt(n), 30) where n = data points
        const dataPoints = this.salesData.length;
        const maxClusters = Math.min(Math.max(8, Math.floor(2 * Math.sqrt(dataPoints))), 30);
        
        container.innerHTML = `
        <div class="glass-card" style="margin-bottom:1.5rem;">
            <h3>🎯 Customer / Data Clustering (KMeans ML)</h3>
            <div class="form-grid" style="margin-top:1rem;">
                <div class="form-group-dash">
                    <label>Features (select 2-3)</label>
                    <select id="cl-features" class="input" multiple size="4">${available.map(c => `<option value="${c}" selected>${c}</option>`).join('')}</select>
                </div>
                <div class="form-group-dash">
                    <label>Number of Clusters (${dataPoints} data points)</label>
                    <input type="range" id="cl-k" min="2" max="${maxClusters}" value="3" class="input" oninput="document.getElementById('cl-k-val').textContent=this.value">
                    <span id="cl-k-val" style="color:var(--text-secondary);">3</span>
                </div>
            </div>
            <button class="btn btn-primary" id="cl-run" style="margin-top:1rem;">Run Clustering</button>
        </div>
        <div id="cl-results"></div>`;
        document.getElementById('cl-run').addEventListener('click', () => this.runCluster());
    },

    async runCluster() {
        const features = Array.from(document.getElementById('cl-features').selectedOptions).map(o => o.value);
        const k = parseInt(document.getElementById('cl-k').value);
        const results = document.getElementById('cl-results');

        if (features.length < 2) { showToast('Select at least 2 features', 'error'); return; }

        results.innerHTML = '<div class="text-center"><div class="spinner-lg"></div></div>';
        const matrix = this.salesData.map(r => features.map(f => r[f] || 0));

        try {
            const data = await API.post('/api/ml/cluster', { matrix, n_clusters: k, feature_names: features });
            let html = `<div class="grid grid-2">
                <div class="chart-container"><div class="chart-title">Cluster Scatter</div><div id="cl-scatter" class="chart-plot"></div></div>
                <div class="chart-container"><div class="chart-title">Cluster Distribution</div><div id="cl-pie" class="chart-plot"></div></div>
            </div>`;

            html += `<div class="glass-card"><h3 style="margin-bottom:1rem;">📊 Cluster Statistics</h3>`;
            const cols = ['Cluster', 'Size', ...features.map(f => `Avg ${f}`)];
            const rows = data.cluster_stats.map(s => [s.cluster, s.size, ...s.means.map(m => m.toFixed(2))]);
            html += buildTable(cols, rows) + '</div>';

            results.innerHTML = html;

            requestAnimationFrame(() => {
                const traces = [];
                for (let i = 0; i < k; i++) {
                    const pts = data.scatter_points.filter(p => p.cluster === i);
                    traces.push({
                        x: pts.map(p => p[features[0]]),
                        y: pts.map(p => p[features[1]]),
                        name: `Cluster ${i}`,
                        mode: 'markers',
                        type: 'scatter',
                        marker: { size: 8, color: COLORS.palette[i], opacity: 0.7 },
                    });
                }
                Plotly.newPlot('cl-scatter', traces, plotlyLayout({ height: 400, xaxis: { title: features[0] }, yaxis: { title: features[1] } }), PLOT_CONFIG);
                Plotly.newPlot('cl-pie', [{ values: data.cluster_sizes, labels: data.cluster_sizes.map((_, i) => `Cluster ${i}`), type: 'pie', marker: { colors: COLORS.palette } }], plotlyLayout({ height: 400 }), PLOT_CONFIG);
            });
        } catch (err) {
            results.innerHTML = `<div class="alert alert-danger">❌ ${err.message}</div>`;
        }
    },

    /* ── Outlier Detection ── */
    renderOutliers(container) {
        const numCols = ['revenue', 'profit', 'quantity', 'unit_price', 'cost_price'];
        const available = numCols.filter(c => this.salesData[0]?.[c] !== undefined);
        container.innerHTML = `
        <div class="glass-card" style="margin-bottom:1.5rem;">
            <h3>🚨 Statistical Outlier Detection (IQR Method)</h3>
            <div class="form-grid" style="margin-top:1rem;">
                <div class="form-group-dash">
                    <label>Metric</label>
                    <select id="ol-metric" class="input">${available.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
                </div>
                <div class="form-group-dash" style="display:flex;align-items:flex-end;">
                    <button class="btn btn-primary" id="ol-run" style="width:100%;">Detect Outliers</button>
                </div>
            </div>
        </div>
        <div id="ol-results"></div>`;
        document.getElementById('ol-run').addEventListener('click', () => this.runOutliers());
    },

    async runOutliers() {
        const metric = document.getElementById('ol-metric').value;
        const values = this.salesData.map(r => r[metric] || 0);
        const results = document.getElementById('ol-results');
        results.innerHTML = '<div class="text-center"><div class="spinner-lg"></div></div>';

        try {
            const data = await API.post('/api/ml/outliers', { values });
            let html = `
            <div class="grid grid-3" style="margin-bottom:1.5rem;">
                ${kpiCard('Total Outliers', data.outlier_count, 'kpi-loss')}
                ${kpiCard('Outlier %', data.outlier_pct + '%', 'kpi-cost')}
                ${kpiCard('IQR Range', data.iqr?.toFixed(2), 'kpi-neutral')}
            </div>
            <div class="grid grid-2" style="margin-bottom:1.5rem;">
                ${kpiCard('Lower Bound', data.lower_bound, 'kpi-revenue')}
                ${kpiCard('Upper Bound', data.upper_bound, 'kpi-profit')}
            </div>
            <div class="chart-container"><div class="chart-title">Box Plot — ${metric}</div><div id="ol-box" class="chart-plot"></div></div>
            <div class="chart-container"><div class="chart-title">Distribution with Outlier Bounds</div><div id="ol-hist" class="chart-plot"></div></div>`;

            if (data.outlier_count > 0) {
                html += `<div class="glass-card"><h3>Outlier Values</h3><p style="color:var(--text-muted);margin:.5rem 0">${data.outlier_values.slice(0, 50).map(v => v.toFixed(2)).join(', ')}${data.outlier_count > 50 ? '...' : ''}</p></div>`;
            } else {
                html += `<div class="alert alert-success">✅ No outliers detected!</div>`;
            }

            results.innerHTML = html;

            requestAnimationFrame(() => {
                Plotly.newPlot('ol-box', [{ y: values, type: 'box', name: metric, marker: { color: COLORS.blue }, boxpoints: 'all', jitter: 0.3 }], plotlyLayout({ height: 350 }), PLOT_CONFIG);
                Plotly.newPlot('ol-hist', [{
                    x: values, type: 'histogram', nbinsx: 40, marker: { color: COLORS.blue, opacity: 0.7 },
                }], plotlyLayout({
                    height: 350,
                    shapes: [
                        { type: 'line', x0: data.lower_bound, x1: data.lower_bound, y0: 0, y1: 1, yref: 'paper', line: { color: COLORS.pink, width: 2, dash: 'dash' } },
                        { type: 'line', x0: data.upper_bound, x1: data.upper_bound, y0: 0, y1: 1, yref: 'paper', line: { color: COLORS.pink, width: 2, dash: 'dash' } },
                    ]
                }), PLOT_CONFIG);
            });
        } catch (err) {
            results.innerHTML = `<div class="alert alert-danger">❌ ${err.message}</div>`;
        }
    },

    /* ── Trend Decomposition ── */
    renderDecompose(container) {
        const numCols = ['revenue', 'profit', 'quantity', 'unit_price'];
        const available = numCols.filter(c => this.salesData[0]?.[c] !== undefined);
        container.innerHTML = `
        <div class="glass-card" style="margin-bottom:1.5rem;">
            <h3>📈 Trend Decomposition & Seasonality</h3>
            <div class="form-grid" style="margin-top:1rem;">
                <div class="form-group-dash"><label>Metric</label><select id="dc-metric" class="input">${available.map(c => `<option value="${c}">${c}</option>`).join('')}</select></div>
                <div class="form-group-dash"><label>Window Size</label><input type="range" id="dc-window" min="3" max="30" value="7" class="input" oninput="document.getElementById('dc-w-val').textContent=this.value"><span id="dc-w-val" style="color:var(--text-secondary)">7</span></div>
                <div class="form-group-dash"><label>Type</label><select id="dc-type" class="input"><option value="additive">Additive</option><option value="multiplicative">Multiplicative</option></select></div>
                <div class="form-group-dash" style="display:flex;align-items:flex-end;"><button class="btn btn-primary" id="dc-run" style="width:100%;">Decompose</button></div>
            </div>
        </div>
        <div id="dc-results"></div>`;
        document.getElementById('dc-run').addEventListener('click', () => this.runDecompose());
    },

    async runDecompose() {
        const metric = document.getElementById('dc-metric').value;
        const window = parseInt(document.getElementById('dc-window').value);
        const type = document.getElementById('dc-type').value;
        const results = document.getElementById('dc-results');
        results.innerHTML = '<div class="text-center"><div class="spinner-lg"></div></div>';

        const byDate = {};
        this.salesData.forEach(r => { const d = r.transaction_date; if (!byDate[d]) byDate[d] = 0; byDate[d] += (r[metric] || 0); });
        const dates = Object.keys(byDate).sort();
        const values = dates.map(d => byDate[d]);

        try {
            const data = await API.post('/api/ml/decompose', { values, window, decomp_type: type });
            let html = `
            <div class="grid grid-2" style="margin-bottom:1.5rem;">
                ${kpiCard('Trend Direction', data.trend_direction === 'up' ? '📈 Upward' : (data.trend_direction === 'down' ? '📉 Downward' : '➡️ Flat'), data.trend_direction === 'up' ? 'kpi-profit' : 'kpi-loss')}
                ${kpiCard('Seasonal Strength', (data.seasonal_strength * 100).toFixed(1) + '%', data.seasonal_strength > 0.3 ? 'kpi-cost' : 'kpi-revenue')}
                ${kpiCard('Lag-1 Autocorrelation', data.lag1_autocorrelation, 'kpi-neutral')}
                ${kpiCard('Trend Slope', data.trend_slope, 'kpi-margin')}
            </div>
            <div class="chart-container"><div class="chart-title">Time Series Decomposition</div><div id="dc-chart" class="chart-plot"></div></div>`;
            results.innerHTML = html;

            requestAnimationFrame(() => {
                const idx = Array.from({ length: dates.length }, (_, i) => i);
                const traces = [
                    { x: idx, y: data.original, name: 'Original', type: 'scatter', line: { color: COLORS.blue, width: 2 } },
                    { x: idx, y: data.trend.map(v => v ?? undefined), name: 'Trend', type: 'scatter', line: { color: COLORS.pink, width: 2 }, yaxis: 'y2' },
                    { x: idx, y: data.seasonal.map(v => v ?? undefined), name: 'Seasonal', type: 'scatter', line: { color: COLORS.green, width: 1 }, yaxis: 'y3' },
                    { x: idx, y: data.residual.map(v => v ?? undefined), name: 'Residual', type: 'scatter', line: { color: COLORS.orange, width: 1 }, yaxis: 'y4' },
                ];
                const layout = plotlyLayout({
                    height: 700,
                    grid: { rows: 4, columns: 1, subplots: [['xy'], ['xy2'], ['xy3'], ['xy4']] },
                    yaxis: { title: 'Original', domain: [0.78, 1] },
                    yaxis2: { title: 'Trend', domain: [0.53, 0.73] },
                    yaxis3: { title: 'Seasonal', domain: [0.28, 0.48] },
                    yaxis4: { title: 'Residual', domain: [0, 0.23] },
                    showlegend: false,
                });
                Plotly.newPlot('dc-chart', traces, layout, PLOT_CONFIG);
            });
        } catch (err) {
            results.innerHTML = `<div class="alert alert-danger">❌ ${err.message}</div>`;
        }
    },

    /* ── Statistical Deep Dive ── */
    renderStats(container) {
        const numCols = ['revenue', 'profit', 'quantity', 'unit_price', 'cost_price'];
        const available = numCols.filter(c => this.salesData[0]?.[c] !== undefined);
        container.innerHTML = `
        <div class="glass-card" style="margin-bottom:1.5rem;">
            <h3>📊 Statistical Deep Dive</h3>
            <div class="form-grid" style="margin-top:1rem;">
                <div class="form-group-dash"><label>Select Metric</label><select id="st-metric" class="input">${available.map(c => `<option value="${c}">${c}</option>`).join('')}</select></div>
                <div class="form-group-dash" style="display:flex;align-items:flex-end;"><button class="btn btn-primary" id="st-run" style="width:100%;">Analyze</button></div>
            </div>
        </div>
        <div id="st-results"></div>`;
        document.getElementById('st-run').addEventListener('click', () => this.runStats());
    },

    async runStats() {
        const metric = document.getElementById('st-metric').value;
        const values = this.salesData.map(r => r[metric] || 0);
        const results = document.getElementById('st-results');
        results.innerHTML = '<div class="text-center"><div class="spinner-lg"></div></div>';

        try {
            const data = await API.post('/api/ml/stats', { values });
            let html = `
            <div class="grid grid-4" style="margin-bottom:1.5rem;">
                ${kpiCard('Mean', data.mean, 'kpi-revenue')}
                ${kpiCard('Median', data.median, 'kpi-profit')}
                ${kpiCard('Std Dev', data.std, 'kpi-cost')}
                ${kpiCard('Variance', data.variance, 'kpi-margin')}
            </div>
            <div class="grid grid-4" style="margin-bottom:1.5rem;">
                ${kpiCard('Skewness', data.skewness, 'kpi-neutral')}
                ${kpiCard('Kurtosis', data.kurtosis, 'kpi-neutral')}
                ${kpiCard('Min', data.min, 'kpi-neutral')}
                ${kpiCard('Max', data.max, 'kpi-neutral')}
            </div>
            <div class="grid grid-2" style="margin-bottom:1.5rem;">
                <div class="glass-card">
                    <h3>95% Confidence Interval</h3>
                    <p style="color:var(--text-secondary);margin-top:.5rem;">Lower: ${data.ci_95_lower} &nbsp;|&nbsp; Upper: ${data.ci_95_upper}</p>
                </div>
                <div class="glass-card">
                    <h3>Normality Test</h3>
                    <p style="color:var(--text-secondary);margin-top:.5rem;">Statistic: ${data.normality_stat} &nbsp;|&nbsp; P-value: ${data.normality_pvalue}</p>
                    <p style="margin-top:.5rem;">${data.is_normal ? '<span class="badge badge-profit">✅ Normal Distribution</span>' : '<span class="badge badge-loss">⚠️ Not Normal</span>'}</p>
                </div>
            </div>
            <div class="chart-container"><div class="chart-title">Distribution of ${metric}</div><div id="st-hist" class="chart-plot"></div></div>`;

            // Percentile table
            if (data.percentiles) {
                const cols = Object.keys(data.percentiles);
                const vals = Object.values(data.percentiles);
                html += `<div class="glass-card"><h3>Percentiles</h3>${buildTable(cols, [vals])}</div>`;
            }

            results.innerHTML = html;
            requestAnimationFrame(() => {
                Plotly.newPlot('st-hist', [{ x: values, type: 'histogram', nbinsx: 40, marker: { color: COLORS.purple, opacity: 0.7 } }], plotlyLayout({ height: 350 }), PLOT_CONFIG);
            });
        } catch (err) {
            results.innerHTML = `<div class="alert alert-danger">❌ ${err.message}</div>`;
        }
    },
};
