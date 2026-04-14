/* ═══════════════════════════════════════════
   SETTINGS MODULE
   ═══════════════════════════════════════════ */
const Settings = {
    user: null,

    async load() {
        const container = document.getElementById('settings-content');
        container.innerHTML = '<div class="text-center"><div class="spinner-lg"></div></div>';

        try {
            this.user = await API.get('/api/me');
        } catch { this.user = { username: 'Unknown', role: 'Staff' }; }

        let html = '';

        // Profile
        html += `<div class="glass-card" style="margin-bottom:1.5rem;">
            <h3>👤 Profile</h3>
            <div class="form-grid" style="margin-top:1rem;">
                <div class="form-group-dash"><label>Username</label><input type="text" class="input" value="${this.user.username}" disabled></div>
                <div class="form-group-dash"><label>Role</label><input type="text" class="input" value="${this.user.role}" disabled></div>
                <div class="form-group-dash"><label>Business</label><input type="text" class="input" value="${this.user.business_name || ''}" disabled></div>
            </div>
        </div>`;

        // Data Management
        html += `<div class="glass-card" style="margin-bottom:1.5rem;">
            <h3>🗑️ Data Management</h3>
            <div class="grid grid-2" style="margin-top:1rem;">
                <button class="btn btn-danger" id="set-clear-data">Clear All Sales Data</button>
                <a href="/api/export/csv" class="btn btn-primary" style="text-decoration:none;text-align:center;">📥 Export All Data (CSV)</a>
            </div>
        </div>`;

        // Upload History
        html += `<div class="glass-card" style="margin-bottom:1.5rem;">
            <h3>📁 Upload History</h3>
            <div id="set-history" style="margin-top:1rem;">Loading...</div>
        </div>`;

        // System Info
        html += `<div class="glass-card">
            <h3>ℹ️ System Information</h3>
            <div class="grid grid-2" style="margin-top:1rem;">
                <div>
                    <p style="color:var(--text-secondary);line-height:2;">
                        <strong>Version:</strong> 2.0.0 (Web Edition)<br>
                        <strong>Backend:</strong> Python Flask<br>
                        <strong>Database:</strong> SQLite<br>
                        <strong>ML Engine:</strong> scikit-learn + scipy
                    </p>
                </div>
                <div>
                    <p style="color:var(--text-secondary);line-height:2;">
                        <strong>User:</strong> ${this.user.username}<br>
                        <strong>Role:</strong> ${this.user.role}<br>
                        <strong>Charts:</strong> Plotly.js
                    </p>
                </div>
            </div>
        </div>`;

        container.innerHTML = html;

        // Event listeners
        document.getElementById('set-clear-data').addEventListener('click', async () => {
            if (!confirm('Clear ALL your sales data? This cannot be undone!')) return;
            try {
                const res = await API.get('/api/sales');
                const ids = (res.data || []).map(r => r.id);
                for (const id of ids) {
                    await API.del(`/api/sales/${id}`);
                }
                showToast(`Cleared ${ids.length} records`, 'success');
                document.getElementById('sidebar-stats').style.display = 'none';
            } catch (err) { showToast(err.message, 'error'); }
        });

        // Load upload history
        try {
            const histRes = await API.get('/api/upload-history');
            const histData = histRes.data || [];
            if (histData.length > 0) {
                document.getElementById('set-history').innerHTML = buildTable(
                    ['Filename', 'Rows', 'Columns', 'Uploaded At'],
                    histData.map(h => [h.filename, formatNumber(h.rows), h.columns, formatDate(h.uploaded_at)])
                );
            } else {
                document.getElementById('set-history').innerHTML = '<p style="color:var(--text-muted)">No uploads yet.</p>';
            }
        } catch {
            document.getElementById('set-history').innerHTML = '<p style="color:var(--text-muted)">Could not load history.</p>';
        }
    },
};
