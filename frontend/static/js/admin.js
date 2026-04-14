/* ═══════════════════════════════════════════
   ADMIN MODULE
   ═══════════════════════════════════════════ */
const Admin = {
    async load(tab = 'users') {
        const container = document.getElementById('admin-content');
        switch (tab) {
            case 'users':   await this.renderUsers(container); break;
            case 'reports': await this.renderReports(container); break;
            case 'system':  await this.renderSystem(container); break;
        }
    },

    async renderUsers(container) {
        container.innerHTML = '<div class="text-center"><div class="spinner-lg"></div></div>';
        try {
            const res = await API.get('/api/admin/users');
            const users = res.users || [];

            let html = `<div class="glass-card" style="margin-bottom:1.5rem;">
                <h3>👥 All Users</h3>
                ${buildTable(
                    ['ID', 'Username', 'Email', 'Role', 'Business', 'Created', 'Actions'],
                    users.map(u => [
                        u.id, u.username, u.email || '-', 
                        `<span class="badge ${u.role === 'Owner' ? 'badge-profit' : 'badge-neutral'}">${u.role}</span>`,
                        u.business_name || '-', formatDate(u.created_at),
                        u.username !== 'admin' ? `<button class="btn btn-danger btn-sm" onclick="Admin.deleteUser(${u.id})">Delete</button>` : '-'
                    ])
                )}
            </div>`;

            // Edit user form
            html += `<div class="glass-card">
                <h3>✏️ Edit User</h3>
                <div class="form-grid" style="margin-top:1rem;">
                    <div class="form-group-dash"><label>Select User</label>
                        <select id="admin-user-select" class="input">
                            ${users.map(u => `<option value="${u.id}" data-email="${u.email||''}" data-role="${u.role}" data-biz="${u.business_name||''}">${u.username}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group-dash"><label>Email</label><input type="email" id="admin-email" class="input"></div>
                    <div class="form-group-dash"><label>Role</label>
                        <select id="admin-role" class="input">
                            <option value="Owner">Owner</option>
                            <option value="Accountant">Accountant</option>
                            <option value="Staff">Staff</option>
                        </select>
                    </div>
                    <div class="form-group-dash"><label>Business Name</label><input type="text" id="admin-biz" class="input"></div>
                    <div class="form-group-dash"><label>New Password (blank = keep)</label><input type="password" id="admin-pass" class="input"></div>
                </div>
                <button class="btn btn-primary" id="admin-save" style="margin-top:1rem;">💾 Save Changes</button>
            </div>`;

            container.innerHTML = html;

            // Pre-fill on select change
            const select = document.getElementById('admin-user-select');
            const fillUser = () => {
                const opt = select.selectedOptions[0];
                document.getElementById('admin-email').value = opt.dataset.email || '';
                document.getElementById('admin-role').value = opt.dataset.role || 'Staff';
                document.getElementById('admin-biz').value = opt.dataset.biz || '';
                document.getElementById('admin-pass').value = '';
            };
            select.addEventListener('change', fillUser);
            fillUser();

            document.getElementById('admin-save').addEventListener('click', async () => {
                const uid = select.value;
                const data = {
                    email: document.getElementById('admin-email').value,
                    role: document.getElementById('admin-role').value,
                    business_name: document.getElementById('admin-biz').value,
                };
                const pass = document.getElementById('admin-pass').value;
                if (pass) data.password = pass;

                try {
                    await API.put(`/api/admin/users/${uid}`, data);
                    showToast('User updated!', 'success');
                    this.renderUsers(container);
                } catch (err) { showToast(err.message, 'error'); }
            });
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    async renderReports(container) {
        container.innerHTML = '<div class="text-center"><div class="spinner-lg"></div></div>';
        try {
            const stats = await API.get('/api/admin/stats');

            let html = `<div class="grid grid-4" style="margin-bottom:2rem;">
                ${kpiCard('Total Transactions', formatNumber(stats.sales), 'kpi-neutral')}
                ${kpiCard('Total Revenue', formatCurrency(stats.revenue), 'kpi-revenue')}
                ${kpiCard('Total Profit', formatCurrency(stats.profit), 'kpi-profit')}
                ${kpiCard('Total Expenses', formatCurrency(stats.expenses_total), 'kpi-cost')}
            </div>`;

            // Net position
            const net = (stats.profit || 0) - (stats.expenses_total || 0);
            html += `<div class="insight-box">💰 <strong>Net Position (Profit – Expenses):</strong> ${formatCurrency(net)}
                <span class="badge ${net >= 0 ? 'badge-profit' : 'badge-loss'}" style="margin-left:.5rem;">${net >= 0 ? 'Positive' : 'Negative'}</span></div>`;

            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    async renderSystem(container) {
        container.innerHTML = '<div class="text-center"><div class="spinner-lg"></div></div>';
        try {
            const stats = await API.get('/api/admin/stats');

            let html = `<div class="grid grid-4" style="margin-bottom:2rem;">
                ${kpiCard('👤 Users', stats.users, 'kpi-neutral')}
                ${kpiCard('🧾 Sales Records', formatNumber(stats.sales), 'kpi-revenue')}
                ${kpiCard('💸 Expense Records', formatNumber(stats.expense_records), 'kpi-cost')}
                ${kpiCard('📦 Products', stats.products, 'kpi-margin')}
            </div>
            <div class="alert alert-success">✅ System is operating normally. Database connected (SQLite).</div>
            <div class="glass-card">
                <h3>ℹ️ App Info</h3>
                <div class="grid grid-2" style="margin-top:1rem;">
                    <div><p style="color:var(--text-secondary)"><strong>Backend:</strong> Python Flask + SQLite</p></div>
                    <div><p style="color:var(--text-secondary)"><strong>ML Engine:</strong> scikit-learn + scipy</p></div>
                    <div><p style="color:var(--text-secondary)"><strong>Charts:</strong> Plotly.js</p></div>
                    <div><p style="color:var(--text-secondary)"><strong>Version:</strong> 2.0.0 (Web Edition)</p></div>
                </div>
            </div>`;

            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    async deleteUser(uid) {
        if (!confirm('Delete this user? This cannot be undone.')) return;
        try {
            await API.del(`/api/admin/users/${uid}`);
            showToast('User deleted', 'success');
            this.renderUsers(document.getElementById('admin-content'));
        } catch (err) { showToast(err.message, 'error'); }
    },
};
