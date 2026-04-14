/* ═══════════════════════════════════════════
   DATA VIEWER MODULE
   ═══════════════════════════════════════════ */
const DataViewer = {
    salesData: null,
    currentPage: 1,
    pageSize: 25,

    async load(tab = 'view') {
        const container = document.getElementById('dataviewer-content');
        switch (tab) {
            case 'view':   await this.renderView(container); break;
            case 'edit':   await this.renderEdit(container); break;
            case 'delete': this.renderDelete(container); break;
        }
    },

    async fetchData() {
        try {
            const res = await API.get('/api/sales');
            this.salesData = res.data || [];
        } catch { this.salesData = []; }
    },

    async renderView(container) {
        container.innerHTML = '<div class="text-center"><div class="spinner-lg"></div></div>';
        await this.fetchData();

        if (this.salesData.length === 0) {
            container.innerHTML = '<div class="alert alert-info">No sales data found. Upload data first.</div>';
            return;
        }

        const total = this.salesData.length;
        const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        this.currentPage = Math.min(this.currentPage, totalPages);

        const start = (this.currentPage - 1) * this.pageSize;
        const end = Math.min(start + this.pageSize, total);
        const pageData = this.salesData.slice(start, end);

        // Data quality
        const complete = this.salesData.filter(r =>
            Object.values(r).every(v => v !== null && v !== '' && v !== undefined)
        ).length;

        let html = `
        <div class="grid grid-3" style="margin-bottom:1.5rem;">
            ${kpiCard('Total Records', formatNumber(total), 'kpi-revenue')}
            ${kpiCard('Complete Rows', formatNumber(complete), 'kpi-profit')}
            ${kpiCard('Page', this.currentPage + ' / ' + totalPages, 'kpi-neutral')}
        </div>

        <div class="glass-card" style="margin-bottom:1rem;">
            <div class="flex items-center justify-between" style="flex-wrap:wrap;gap:1rem;">
                <div class="flex items-center gap-2">
                    <label style="margin:0;">Rows per page:</label>
                    <select id="dv-pagesize" class="input" style="width:auto;">
                        ${[10,25,50,100].map(n => `<option value="${n}" ${n === this.pageSize ? 'selected' : ''}>${n}</option>`).join('')}
                    </select>
                </div>
                <div class="flex items-center gap-1">
                    <button class="btn btn-ghost btn-sm" onclick="DataViewer.goPage(1)" ${this.currentPage === 1 ? 'disabled' : ''}>First</button>
                    <button class="btn btn-ghost btn-sm" onclick="DataViewer.goPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}>← Prev</button>
                    <span class="page-info" style="padding:0 .5rem;">Page ${this.currentPage} of ${totalPages}</span>
                    <button class="btn btn-ghost btn-sm" onclick="DataViewer.goPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}>Next →</button>
                    <button class="btn btn-ghost btn-sm" onclick="DataViewer.goPage(${totalPages})" ${this.currentPage === totalPages ? 'disabled' : ''}>Last</button>
                </div>
            </div>
        </div>`;

        // Table
        const columns = ['ID', 'Date', 'Product', 'Category', 'Qty', 'Unit Price', 'Cost', 'Revenue', 'Profit'];
        const rows = pageData.map(r => [
            r.id,
            formatDate(r.transaction_date),
            r.product_name,
            r.category,
            r.quantity,
            formatCurrency(r.unit_price),
            formatCurrency(r.cost_price),
            formatCurrency(r.revenue),
            `<span class="${r.profit >= 0 ? 'badge badge-profit' : 'badge badge-loss'}">${formatCurrency(r.profit)}</span>`,
        ]);
        html += buildTable(columns, rows);

        // Export buttons
        html += `<div class="section-divider"></div>
        <h2 style="margin-bottom:1rem;">💾 Export Data</h2>
        <div class="grid grid-2">
            <a href="/api/export/csv" class="btn btn-primary" style="text-decoration:none;text-align:center;">📥 Download CSV</a>
            <a href="/api/export/excel" class="btn btn-success" style="text-decoration:none;text-align:center;">📥 Download Excel</a>
        </div>`;

        container.innerHTML = html;

        document.getElementById('dv-pagesize').addEventListener('change', (e) => {
            this.pageSize = parseInt(e.target.value);
            this.currentPage = 1;
            this.renderView(document.getElementById('dataviewer-content'));
        });
    },

    goPage(page) {
        this.currentPage = page;
        this.renderView(document.getElementById('dataviewer-content'));
    },

    async renderEdit(container) {
        await this.fetchData();
        if (this.salesData.length === 0) {
            container.innerHTML = '<div class="alert alert-info">No records to edit.</div>';
            return;
        }

        // Show recent records
        const recent = this.salesData.slice(0, 20);
        let html = `<div class="glass-card" style="margin-bottom:1.5rem;">
            <h3>Recent Transactions</h3>
            ${buildTable(
                ['ID', 'Date', 'Product', 'Qty', 'Unit Price', 'Cost Price'],
                recent.map(r => [r.id, formatDate(r.transaction_date), r.product_name, r.quantity, formatCurrency(r.unit_price), formatCurrency(r.cost_price)])
            )}
        </div>`;

        html += `<div class="glass-card">
            <h3>✏️ Edit Transaction</h3>
            <div class="form-grid" style="margin-top:1rem;">
                <div class="form-group-dash"><label>Transaction ID</label><input type="number" id="edit-id" class="input" min="1" placeholder="Enter ID"></div>
                <div class="form-group-dash" style="display:flex;align-items:flex-end;"><button class="btn btn-primary" id="edit-load" style="width:100%;">Load Record</button></div>
            </div>
            <div id="edit-form" class="hidden" style="margin-top:1.5rem;">
                <div class="form-grid">
                    <div class="form-group-dash"><label>Product Name</label><input type="text" id="edit-product" class="input"></div>
                    <div class="form-group-dash"><label>Category</label><input type="text" id="edit-category" class="input"></div>
                    <div class="form-group-dash"><label>Quantity</label><input type="number" id="edit-qty" class="input" min="0"></div>
                    <div class="form-group-dash"><label>Unit Price</label><input type="number" id="edit-price" class="input" min="0" step="0.01"></div>
                    <div class="form-group-dash"><label>Cost Price</label><input type="number" id="edit-cost" class="input" min="0" step="0.01"></div>
                </div>
                <button class="btn btn-success" id="edit-save" style="margin-top:1rem;">💾 Save Changes</button>
            </div>
        </div>`;

        container.innerHTML = html;

        document.getElementById('edit-load').addEventListener('click', () => {
            const id = parseInt(document.getElementById('edit-id').value);
            const record = this.salesData.find(r => r.id === id);
            if (!record) { showToast('Transaction not found', 'error'); return; }

            document.getElementById('edit-product').value = record.product_name || '';
            document.getElementById('edit-category').value = record.category || '';
            document.getElementById('edit-qty').value = record.quantity || 0;
            document.getElementById('edit-price').value = record.unit_price || 0;
            document.getElementById('edit-cost').value = record.cost_price || 0;
            document.getElementById('edit-form').classList.remove('hidden');
            showToast('Record loaded!', 'info');
        });

        document.getElementById('edit-save').addEventListener('click', async () => {
            const id = parseInt(document.getElementById('edit-id').value);
            const data = {
                product_name: document.getElementById('edit-product').value,
                category: document.getElementById('edit-category').value,
                quantity: parseInt(document.getElementById('edit-qty').value) || 0,
                unit_price: parseFloat(document.getElementById('edit-price').value) || 0,
                cost_price: parseFloat(document.getElementById('edit-cost').value) || 0,
            };
            try {
                await API.put(`/api/sales/${id}`, data);
                showToast('Transaction updated!', 'success');
                document.getElementById('edit-form').classList.add('hidden');
                this.salesData = null;
            } catch (err) { showToast(err.message, 'error'); }
        });
    },

    renderDelete(container) {
        container.innerHTML = `
        <div class="alert alert-warning">⚠️ <strong>Warning:</strong> Deletion is permanent and cannot be undone!</div>

        <div class="grid grid-2">
            <div class="glass-card">
                <h3>🗑️ Delete Single Transaction</h3>
                <div class="form-group-dash" style="margin-top:1rem;">
                    <label>Transaction ID</label>
                    <input type="number" id="del-id" class="input" min="1" placeholder="Enter ID">
                </div>
                <button class="btn btn-danger" id="del-single" style="margin-top:.5rem;">Delete Transaction</button>
            </div>
            <div class="glass-card">
                <h3>🗑️ Bulk Delete by Date Range</h3>
                <div class="form-grid" style="margin-top:1rem;">
                    <div class="form-group-dash"><label>Start Date</label><input type="date" id="del-start" class="input"></div>
                    <div class="form-group-dash"><label>End Date</label><input type="date" id="del-end" class="input"></div>
                </div>
                <button class="btn btn-danger" id="del-bulk" style="margin-top:.5rem;">Delete Range</button>
            </div>
        </div>`;

        document.getElementById('del-single').addEventListener('click', async () => {
            const id = parseInt(document.getElementById('del-id').value);
            if (!id) { showToast('Enter a valid ID', 'warning'); return; }
            if (!confirm(`Delete transaction #${id}?`)) return;
            try {
                await API.del(`/api/sales/${id}`);
                showToast('Transaction deleted', 'success');
                this.salesData = null;
            } catch (err) { showToast(err.message, 'error'); }
        });

        document.getElementById('del-bulk').addEventListener('click', async () => {
            const start = document.getElementById('del-start').value;
            const end = document.getElementById('del-end').value;
            if (!start || !end) { showToast('Select both dates', 'warning'); return; }
            if (!confirm(`Delete all records from ${start} to ${end}?`)) return;
            try {
                const res = await API.post('/api/sales/bulk-delete', { start_date: start, end_date: end });
                showToast(res.message, 'success');
                this.salesData = null;
            } catch (err) { showToast(err.message, 'error'); }
        });
    },
};
