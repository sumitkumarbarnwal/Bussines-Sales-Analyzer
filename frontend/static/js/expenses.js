/* ═══════════════════════════════════════════
   EXPENSES MODULE
   ═══════════════════════════════════════════ */
const Expenses = {
    async load(tab = 'add') {
        const container = document.getElementById('expenses-content');
        switch (tab) {
            case 'add':      this.renderAdd(container); break;
            case 'view':     await this.renderView(container); break;
            case 'analysis': await this.renderAnalysis(container); break;
        }
    },

    renderAdd(container) {
        container.innerHTML = `
        <div class="glass-card">
            <h3>Add New Expense</h3>
            <div class="form-grid" style="margin-top:1rem;">
                <div class="form-group-dash"><label>Date</label><input type="date" id="exp-date" class="input" value="${new Date().toISOString().split('T')[0]}"></div>
                <div class="form-group-dash"><label>Category</label>
                    <select id="exp-cat" class="input">
                        <option>Rent</option><option>Utilities</option><option>Supplies</option>
                        <option>Salaries</option><option>Marketing</option><option>Transportation</option>
                        <option>Equipment</option><option>Other</option>
                    </select>
                </div>
                <div class="form-group-dash"><label>Amount ($)</label><input type="number" id="exp-amount" class="input" min="0" step="0.01" placeholder="0.00"></div>
                <div class="form-group-dash"><label>Description</label><input type="text" id="exp-desc" class="input" placeholder="Brief description..."></div>
            </div>
            <button class="btn btn-success" id="exp-save" style="margin-top:1rem;">Add Expense</button>
        </div>`;

        document.getElementById('exp-save').addEventListener('click', async () => {
            const data = {
                expense_date: document.getElementById('exp-date').value,
                category: document.getElementById('exp-cat').value,
                amount: parseFloat(document.getElementById('exp-amount').value) || 0,
                description: document.getElementById('exp-desc').value,
            };
            if (!data.amount) { showToast('Enter an amount', 'warning'); return; }
            try {
                await API.post('/api/expenses', data);
                showToast('Expense added!', 'success');
                document.getElementById('exp-amount').value = '';
                document.getElementById('exp-desc').value = '';
            } catch (err) { showToast(err.message, 'error'); }
        });
    },

    async renderView(container) {
        container.innerHTML = '<div class="text-center"><div class="spinner-lg"></div></div>';
        try {
            const res = await API.get('/api/expenses');
            const data = res.data || [];
            if (data.length === 0) {
                container.innerHTML = '<div class="alert alert-info">No expenses recorded yet.</div>';
                return;
            }

            const total = data.reduce((s, e) => s + e.amount, 0);
            const now = new Date();
            const thisMonth = data.filter(e => { const d = new Date(e.expense_date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
            const monthTotal = thisMonth.reduce((s, e) => s + e.amount, 0);
            const categories = new Set(data.map(e => e.category));

            let html = `
            <div class="grid grid-3" style="margin-bottom:1.5rem;">
                ${kpiCard('Total Expenses', formatCurrency(total), 'kpi-cost')}
                ${kpiCard('This Month', formatCurrency(monthTotal), 'kpi-margin')}
                ${kpiCard('Categories', categories.size, 'kpi-neutral')}
            </div>`;

            const cols = ['ID', 'Date', 'Category', 'Amount', 'Description', 'Action'];
            const rows = data.map(e => [
                e.id, formatDate(e.expense_date), e.category, formatCurrency(e.amount), e.description || '-',
                `<button class="btn btn-danger btn-sm" onclick="Expenses.delete(${e.id})">Delete</button>`
            ]);
            html += buildTable(cols, rows);
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    async renderAnalysis(container) {
        container.innerHTML = '<div class="text-center"><div class="spinner-lg"></div></div>';
        try {
            const res = await API.get('/api/expenses');
            const data = res.data || [];
            if (data.length === 0) { container.innerHTML = '<div class="alert alert-info">No data for analysis.</div>'; return; }

            const catMap = {};
            data.forEach(e => {
                if (!catMap[e.category]) catMap[e.category] = { total: 0, count: 0 };
                catMap[e.category].total += e.amount;
                catMap[e.category].count++;
            });

            const cats = Object.entries(catMap).sort((a, b) => b[1].total - a[1].total);
            let html = `
            <div class="grid grid-2">
                <div class="chart-container"><div class="chart-title">Expenses by Category</div><div id="exp-pie" class="chart-plot"></div></div>
                <div class="glass-card">
                    <h3>Category Breakdown</h3>
                    ${buildTable(['Category', 'Total', 'Count', 'Average'], cats.map(([c, v]) => [c, formatCurrency(v.total), v.count, formatCurrency(v.total / v.count)]))}
                </div>
            </div>`;
            container.innerHTML = html;

            requestAnimationFrame(() => {
                Plotly.newPlot('exp-pie', [{
                    values: cats.map(([, v]) => v.total),
                    labels: cats.map(([c]) => c),
                    type: 'pie',
                    marker: { colors: COLORS.palette },
                    textinfo: 'label+percent',
                }], plotlyLayout({ height: 400 }), PLOT_CONFIG);
            });
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    async delete(id) {
        if (!confirm('Delete this expense?')) return;
        try {
            await API.del(`/api/expenses/${id}`);
            showToast('Expense deleted', 'success');
            this.renderView(document.getElementById('expenses-content'));
        } catch (err) { showToast(err.message, 'error'); }
    },
};
