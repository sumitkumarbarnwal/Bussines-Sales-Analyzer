/* ═══════════════════════════════════════════
   APP CONTROLLER – Main entry point
   ═══════════════════════════════════════════ */
(function () {
    // Check if we're on the dashboard
    if (!document.getElementById('sidebar')) return;

    let currentUser = null;

    /* ── Init ── */
    async function init() {
        try {
            currentUser = await API.get('/api/me');
        } catch {
            window.location.href = '/';
            return;
        }

        // Update sidebar user
        document.getElementById('user-avatar').textContent = currentUser.username.charAt(0).toUpperCase();
        document.getElementById('user-name').textContent = currentUser.username;
        document.getElementById('user-role').textContent = currentUser.role;

        // Show admin nav if owner
        if (currentUser.role === 'Owner') {
            document.getElementById('nav-admin').style.display = 'flex';
        }

        // Initialize modules
        Upload.init();
        bindNavigation();
        bindSidebar();
    }

    /* ── Navigation ── */
    function bindNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                navigateTo(page);
            });
        });

        // Tab bars (expenses, inventory, data viewer, admin)
        bindTabBar('data-expense-tab', (tab) => Expenses.load(tab));
        bindTabBar('data-inv-tab', (tab) => Inventory.load(tab));
        bindTabBar('data-dv-tab', (tab) => DataViewer.load(tab));
        bindTabBar('data-admin-tab', (tab) => Admin.load(tab));

        // Analysis tabs (advanced)
        document.querySelectorAll('.analysis-tab[data-analysis]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.analysis-tab[data-analysis]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                Advanced.load(btn.dataset.analysis);
            });
        });
    }

    function bindTabBar(attrName, callback) {
        document.querySelectorAll(`[${attrName}]`).forEach(btn => {
            btn.addEventListener('click', () => {
                btn.parentElement.querySelectorAll(`[${attrName}]`).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                callback(btn.getAttribute(attrName));
            });
        });
    }

    function navigateTo(page) {
        // Update nav
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (activeNav) activeNav.classList.add('active');

        // Show page
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const activePage = document.getElementById(`page-${page}`);
        if (activePage) activePage.classList.add('active');

        // Load page data
        switch (page) {
            case 'analytics':    Analytics.load(); break;
            case 'advanced':     Advanced.load('forecast'); break;
            case 'expenses':     Expenses.load('add'); break;
            case 'inventory':    Inventory.load('add'); break;
            case 'profit':       Profit.load(); break;
            case 'data-viewer':  DataViewer.load('view'); break;
            case 'reports':      Reports.load(); break;
            case 'admin':        Admin.load('users'); break;
            case 'settings':     Settings.load(); break;
        }

        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
    }

    /* ── Sidebar mobile ── */
    function bindSidebar() {
        const toggle = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        if (toggle) {
            toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
        }

        // Logout
        document.getElementById('btn-logout').addEventListener('click', async () => {
            try {
                await API.post('/api/logout');
            } catch { }
            window.location.href = '/';
        });
    }

    // Start
    init();
})();
