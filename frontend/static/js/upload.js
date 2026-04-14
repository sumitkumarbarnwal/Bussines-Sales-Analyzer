/* ═══════════════════════════════════════════
   UPLOAD MODULE
   ═══════════════════════════════════════════ */
const Upload = {
    init() {
        const zone = document.getElementById('upload-zone');
        const fileInput = document.getElementById('file-input');
        const browseBtn = document.getElementById('btn-browse');
        if (!zone || !fileInput) return;

        browseBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
        zone.addEventListener('click', () => fileInput.click());
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files.length) this.handleFile(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) this.handleFile(fileInput.files[0]);
        });
    },

    async handleFile(file) {
        const allowed = ['.csv', '.xlsx', '.xls'];
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!allowed.includes(ext)) {
            showToast('Unsupported file type. Use CSV or Excel.', 'error');
            return;
        }

        const progress = document.getElementById('upload-progress');
        const fill = document.getElementById('progress-fill');
        const text = document.getElementById('progress-text');
        progress.classList.remove('hidden');
        fill.style.width = '0%';
        text.textContent = `Uploading ${file.name}…`;

        // Simulate progress
        let pct = 0;
        const interval = setInterval(() => {
            pct = Math.min(pct + Math.random() * 15, 90);
            fill.style.width = pct + '%';
        }, 200);

        try {
            const fd = new FormData();
            fd.append('file', file);
            
            // Check if "replace existing data" checkbox is checked
            const replaceCheckbox = document.getElementById('replace-mode-checkbox');
            const replaceMode = replaceCheckbox ? replaceCheckbox.checked : false;
            fd.append('replace', replaceMode.toString());
            
            const data = await API.upload('/api/upload', fd);

            clearInterval(interval);
            fill.style.width = '100%';
            text.textContent = 'Upload complete!';

            // Store metadata globally
            window.APP_DATA = data;
            showToast('File uploaded and saved!', 'success');

            // Update sidebar stats
            document.getElementById('sidebar-stats').style.display = 'block';
            document.getElementById('stat-rows').textContent = `${formatNumber(data.rows)} rows`;
            document.getElementById('stat-cols').textContent = `${data.columns} columns`;

            this.renderResults(data);

        } catch (err) {
            clearInterval(interval);
            fill.style.width = '0%';
            text.textContent = 'Upload failed';
            showToast(err.message || 'Upload failed', 'error');
        }
    },

    renderResults(data) {
        const container = document.getElementById('upload-results');
        container.classList.remove('hidden');

        let html = `
        <div class="section-divider"></div>
        <h2 style="margin-bottom:1rem;">Dataset Overview</h2>
        <div class="result-grid grid grid-4">
            ${kpiCard('Total Rows', formatNumber(data.rows), 'kpi-revenue')}
            ${kpiCard('Columns', data.columns, 'kpi-profit')}
            ${kpiCard('Memory', data.memory_mb + ' MB', 'kpi-margin')}
            ${kpiCard('Missing Values', formatNumber(data.missing), 'kpi-cost')}
        </div>

        <div class="section-divider"></div>
        <h2 style="margin-bottom:1rem;">Data Preview</h2>`;

        // Preview table
        if (data.preview && data.preview.length > 0) {
            const cols = Object.keys(data.preview[0]);
            const rows = data.preview.map(r => cols.map(c => r[c]));
            html += buildTable(cols, rows);
        }

        // Column info
        html += `<div class="section-divider"></div>
        <h2 style="margin-bottom:1rem;">Column Information</h2>`;

        if (data.col_info) {
            const cols = ['Name', 'Type', 'Non-Null', 'Null %', 'Unique', 'Sample'];
            const rows = data.col_info.map(c => [c.name, c.dtype, c.non_null, c.null_pct + '%', c.unique, c.sample]);
            html += buildTable(cols, rows);
        }

        // Auto-detected types
        html += `<div class="section-divider"></div>
        <h2 style="margin-bottom:1rem;">Auto-Detected Column Types</h2>
        <div class="info-row">
            <div class="info-chip blue"><strong>Date:</strong> ${data.date_cols?.join(', ') || 'None'}</div>
            <div class="info-chip green"><strong>Numeric:</strong> ${data.numeric_cols?.slice(0,5).join(', ') || 'None'}</div>
            <div class="info-chip orange"><strong>Categorical:</strong> ${data.categorical_cols?.slice(0,5).join(', ') || 'None'}</div>
        </div>`;

        container.innerHTML = html;
    }
};
