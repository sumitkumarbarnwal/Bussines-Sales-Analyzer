/* ═══════════════════════════════════════════
   UTILITIES – Shared helper functions
   ═══════════════════════════════════════════ */

const API = {
    async request(url, options = {}) {
        const defaults = {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
        };
        const merged = { ...defaults, ...options };
        if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
            merged.body = JSON.stringify(options.body);
        }
        if (options.body instanceof FormData) {
            delete merged.headers['Content-Type'];
        }
        try {
            const res = await fetch(url, merged);
            let data;
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                data = await res.json();
            } else {
                const text = await res.text();
                // Try to parse as JSON anyway
                try { data = JSON.parse(text); } catch { data = { error: text || `HTTP ${res.status}` }; }
            }
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            return data;
        } catch (err) {
            throw err;
        }
    },
    get(url)          { return this.request(url); },
    post(url, body)   { return this.request(url, { method: 'POST', body }); },
    put(url, body)    { return this.request(url, { method: 'PUT', body }); },
    del(url)          { return this.request(url, { method: 'DELETE' }); },
    upload(url, formData) {
        return this.request(url, { method: 'POST', body: formData });
    },
};

/* ── Toast ── */
function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container') || document.getElementById('toast');
    if (!container) return;

    // Login page toast (simple)
    if (container.id === 'toast') {
        container.textContent = message;
        container.className = `toast show ${type}`;
        setTimeout(() => container.classList.remove('show'), duration);
        return;
    }

    const item = document.createElement('div');
    item.className = `toast-item toast-${type}`;
    item.textContent = message;
    container.appendChild(item);

    setTimeout(() => {
        item.classList.add('removing');
        setTimeout(() => item.remove(), 300);
    }, duration);
}

/* ── Currency Formatting ── */
function formatCurrency(value, symbol = '$') {
    if (value == null || isNaN(value)) return `${symbol}0`;
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);
    if (abs >= 1e9)  return `${sign}${symbol}${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6)  return `${sign}${symbol}${(abs / 1e6).toFixed(2)}M`;
    if (abs >= 1e5)  return `${sign}${symbol}${(abs / 1e5).toFixed(2)}L`;
    if (abs >= 1e3)  return `${sign}${symbol}${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    return `${sign}${symbol}${abs.toFixed(2)}`;
}

/* ── Number Formatting ── */
function formatNumber(n, decimals = 0) {
    if (n == null || isNaN(n)) return '0';
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: decimals });
}

/* ── Date Formatting ── */
function formatDate(str) {
    if (!str) return 'N/A';
    const d = new Date(str);
    return isNaN(d) ? str : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ── Plotly Dark Layout ── */
const PLOT_LAYOUT = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Inter, sans-serif', color: '#8b8baf', size: 12 },
    margin: { l: 50, r: 30, t: 45, b: 40 },
    xaxis: { gridcolor: 'rgba(255,255,255,0.04)', zerolinecolor: 'rgba(255,255,255,0.06)' },
    yaxis: { gridcolor: 'rgba(255,255,255,0.04)', zerolinecolor: 'rgba(255,255,255,0.06)' },
    legend: { font: { color: '#8b8baf' } },
    hoverlabel: { bgcolor: '#1e1e3e', font: { color: '#f0f0ff' } },
};

function plotlyLayout(overrides = {}) {
    return { ...PLOT_LAYOUT, ...overrides };
}

const PLOT_CONFIG = { responsive: true, displayModeBar: true, displaylogo: false };

/* ── Color Palettes ── */
const COLORS = {
    blue: '#4facfe',
    green: '#38ef7d',
    pink: '#f5576c',
    purple: '#667eea',
    orange: '#fa709a',
    teal: '#11998e',
    gold: '#fee140',
    cyan: '#00f2fe',
    palette: ['#4facfe','#38ef7d','#f5576c','#667eea','#fa709a','#11998e','#fee140','#00f2fe','#764ba2','#f093fb'],
};

/* ── HTML Helpers ── */
function el(tag, attrs = {}, children = '') {
    const pairs = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${tag} ${pairs}>${children}</${tag}>`;
}

function kpiCard(label, value, cssClass = 'kpi-neutral') {
    return `<div class="kpi-card ${cssClass}">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value">${value}</div>
    </div>`;
}

function buildTable(columns, rows, id = '') {
    let html = `<div class="table-wrapper" ${id ? `id="${id}"` : ''}><table class="data-table">`;
    html += '<thead><tr>' + columns.map(c => `<th>${c}</th>`).join('') + '</tr></thead>';
    html += '<tbody>';
    for (const row of rows) {
        html += '<tr>' + row.map(v => `<td>${v ?? ''}</td>`).join('') + '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
}

/* ── Debounce ── */
function debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}
