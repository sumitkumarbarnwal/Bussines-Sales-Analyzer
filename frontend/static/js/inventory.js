/* ═══════════════════════════════════════════
   INVENTORY MODULE
   ═══════════════════════════════════════════ */
const Inventory = {
    async load(tab = 'add') {
        const container = document.getElementById('inventory-content');
        switch (tab) {
            case 'add':    this.renderAdd(container); break;
            case 'stock':  await this.renderStock(container); break;
            case 'alerts': await this.renderAlerts(container); break;
        }
    },

    renderAdd(container) {
        container.innerHTML = `
        <div class="glass-card">
            <h3>Add / Update Product</h3>
            <div class="form-grid" style="margin-top:1rem;">
                <div class="form-group-dash"><label>Product Name</label><input type="text" id="inv-name" class="input" placeholder="Product name"></div>
                <div class="form-group-dash"><label>Category</label>
                    <select id="inv-cat" class="input">
                        <option>Electronics</option><option>Clothing</option><option>Food</option>
                        <option>Furniture</option><option>Accessories</option><option>Books</option><option>Other</option>
                    </select>
                </div>
                <div class="form-group-dash"><label>Cost Price ($)</label><input type="number" id="inv-cost" class="input" min="0" step="0.01" placeholder="0.00"></div>
                <div class="form-group-dash"><label>Selling Price ($)</label><input type="number" id="inv-sell" class="input" min="0" step="0.01" placeholder="0.00"></div>
                <div class="form-group-dash"><label>Stock Quantity</label><input type="number" id="inv-qty" class="input" min="0" step="1" placeholder="0"></div>
            </div>
            <button class="btn btn-success" id="inv-save" style="margin-top:1rem;">Save Product</button>
        </div>`;

        document.getElementById('inv-save').addEventListener('click', async () => {
            const data = {
                product_name: document.getElementById('inv-name').value.trim(),
                category: document.getElementById('inv-cat').value,
                cost_price: parseFloat(document.getElementById('inv-cost').value) || 0,
                selling_price: parseFloat(document.getElementById('inv-sell').value) || 0,
                stock_quantity: parseInt(document.getElementById('inv-qty').value) || 0,
            };
            if (!data.product_name) { showToast('Enter a product name', 'warning'); return; }
            try {
                await API.post('/api/products', data);
                showToast('Product saved!', 'success');
                ['inv-name', 'inv-cost', 'inv-sell', 'inv-qty'].forEach(id => document.getElementById(id).value = '');
            } catch (err) { showToast(err.message, 'error'); }
        });
    },

    async renderStock(container) {
        container.innerHTML = '<div class="text-center"><div class="spinner-lg"></div></div>';
        try {
            const res = await API.get('/api/products');
            const data = res.data || [];
            if (data.length === 0) { container.innerHTML = '<div class="alert alert-info">No products in inventory.</div>'; return; }

            const cols = ['ID', 'Product', 'Category', 'Cost ($)', 'Sell ($)', 'Stock', 'Margin %', 'Action'];
            const rows = data.map(p => {
                const margin = p.selling_price > 0 ? ((p.selling_price - p.cost_price) / p.selling_price * 100).toFixed(1) : '0';
                return [
                    p.id, p.product_name, p.category,
                    formatCurrency(p.cost_price), formatCurrency(p.selling_price),
                    p.stock_quantity,
                    `<span class="badge ${parseFloat(margin) > 0 ? 'badge-profit' : 'badge-loss'}">${margin}%</span>`,
                    `<button class="btn btn-danger btn-sm" onclick="Inventory.delete(${p.id})">Delete</button>`,
                ];
            });

            container.innerHTML = buildTable(cols, rows);
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    async renderAlerts(container) {
        container.innerHTML = `
        <div class="glass-card" style="margin-bottom:1.5rem;">
            <h3>Low Stock Alert Settings</h3>
            <div class="form-grid" style="margin-top:1rem;">
                <div class="form-group-dash"><label>Threshold</label><input type="number" id="inv-threshold" value="10" class="input" min="1" max="100"></div>
                <div class="form-group-dash" style="display:flex;align-items:flex-end;"><button class="btn btn-primary" id="inv-check" style="width:100%;">Check Stock</button></div>
            </div>
        </div>
        <div id="inv-alerts"></div>`;

        document.getElementById('inv-check').addEventListener('click', async () => {
            const threshold = parseInt(document.getElementById('inv-threshold').value) || 10;
            const alerts = document.getElementById('inv-alerts');
            alerts.innerHTML = '<div class="text-center"><div class="spinner-lg"></div></div>';

            try {
                const res = await API.get(`/api/products/low-stock?threshold=${threshold}`);
                const data = res.data || [];
                if (data.length === 0) {
                    alerts.innerHTML = '<div class="alert alert-success">✅ All products have sufficient stock!</div>';
                    return;
                }

                let html = `<div class="alert alert-warning">⚠️ ${data.length} products below threshold of ${threshold}!</div>`;
                data.forEach(p => {
                    html += `<div class="insight-box" style="border-left-color:${COLORS.pink};">
                        <strong>${p.product_name}</strong> — Only <strong>${p.stock_quantity}</strong> units left!
                        <span class="badge badge-loss" style="margin-left:.5rem;">Low Stock</span>
                    </div>`;
                });

                const cols = ['Product', 'Category', 'Stock', 'Selling Price'];
                const rows = data.map(p => [p.product_name, p.category, p.stock_quantity, formatCurrency(p.selling_price)]);
                html += buildTable(cols, rows);

                alerts.innerHTML = html;
            } catch (err) {
                alerts.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
            }
        });
    },

    async delete(id) {
        if (!confirm('Delete this product?')) return;
        try {
            await API.del(`/api/products/${id}`);
            showToast('Product deleted', 'success');
            this.renderStock(document.getElementById('inventory-content'));
        } catch (err) { showToast(err.message, 'error'); }
    },
};
