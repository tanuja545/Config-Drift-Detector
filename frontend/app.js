// Config Drift Detector - Frontend Controller

// Application State
let appState = {
    currentView: 'dashboard-view',
    history: [],
    currentAnalysisResult: null,
    charts: {
        severityPie: null,
        historyBar: null
    }
};

// DOM Elements & Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();
    
    // API Key setup from LocalStorage
    initApiKey();

    // Setup Navigation Handlers
    initNavigation();
    
    // Setup Drag and Drop Uploads
    initDragAndDrop();

    // Load history data and render charts
    refreshData();
});

// 1. Navigation
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            switchView(target);
        });
    });
}

function switchView(viewId) {
    // Hide all views
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.remove('active');
    });
    // Remove active class from nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-target') === viewId) {
            btn.classList.add('active');
        }
    });
    
    // Show selected view
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.add('active');
    }
    
    // Update header title based on view
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    
    if (viewId === 'dashboard-view') {
        pageTitle.innerText = "Dashboard";
        pageSubtitle.innerText = "Overview of system configuration integrity";
        refreshData(); // Refresh history data on return to dashboard
    } else if (viewId === 'analysis-view') {
        pageTitle.innerText = "Drift Analysis";
        pageSubtitle.innerText = "Compare configuration files and evaluate impact";
    } else if (viewId === 'reports-view') {
        pageTitle.innerText = "Reports";
        pageSubtitle.innerText = "Access generated audits and exports";
        refreshData();
    } else if (viewId === 'settings-view') {
        pageTitle.innerText = "Settings";
        pageSubtitle.innerText = "Configure connection parameters and preferences";
    }
    
    appState.currentView = viewId;
}

// 2. Drag & Drop File Uploads
function initDragAndDrop() {
    setupDropZone('drop-zone-intended', 'file-input-intended', 'file-name-intended', 'text-intended');
    setupDropZone('drop-zone-actual', 'file-input-actual', 'file-name-actual', 'text-actual');
}

function setupDropZone(zoneId, inputId, labelId, textId) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);
    const textarea = document.getElementById(textId);
    
    // Click triggers file dialog
    zone.addEventListener('click', () => input.click());
    
    // File change handler
    input.addEventListener('change', (e) => {
        handleFile(e.target.files[0], label, textarea);
    });
    
    // Dragover effects
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
    });
    
    zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
    });
    
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            input.files = e.dataTransfer.files;
            handleFile(e.dataTransfer.files[0], label, textarea);
        }
    });
}

function handleFile(file, labelElement, textareaElement) {
    if (!file) return;
    
    labelElement.innerText = file.name;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        textareaElement.value = e.target.result;
        showToast(`Successfully read ${file.name}`);
    };
    reader.onerror = () => {
        showToast("Error reading file", true);
    };
    reader.readAsText(file);
}

function clearEditor(type) {
    document.getElementById(`text-${type}`).value = "";
    document.getElementById(`file-name-${type}`).innerText = "No file selected";
    document.getElementById(`file-input-${type}`).value = "";
    showToast(`Cleared ${type} config input`);
}

// 3. Settings & Credentials
function initApiKey() {
    const savedKey = localStorage.getItem('gemini_api_key');
    const badge = document.getElementById('api-status-badge');
    const input = document.getElementById('settings-api-key');
    
    if (savedKey) {
        input.value = savedKey;
        badge.innerHTML = `
            <span class="status-indicator online"></span>
            <span class="status-label">Gemini: AI Connected</span>
        `;
    } else {
        badge.innerHTML = `
            <span class="status-indicator offline"></span>
            <span class="status-label">Gemini: Offline Fallback</span>
        `;
    }
}

function toggleApiKeyVisibility() {
    const input = document.getElementById('settings-api-key');
    const icon = document.getElementById('api-key-eye-icon');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.setAttribute('data-lucide', 'eye-off');
    } else {
        input.type = 'password';
        icon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
}

function saveSettings() {
    const key = document.getElementById('settings-api-key').value.trim();
    if (key) {
        localStorage.setItem('gemini_api_key', key);
        showToast("Gemini API key saved successfully!");
    } else {
        localStorage.removeItem('gemini_api_key');
        showToast("Gemini API key removed. Using rule fallback.");
    }
    initApiKey();
}

async function testApiKey() {
    const key = document.getElementById('settings-api-key').value.trim();
    if (!key) {
        showToast("Please enter an API key to test.", true);
        return;
    }
    
    showToast("Testing API Key connection...");
    
    // We run a small test by sending dummy files to analyze endpoint
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                intended_content: '{"test": 1}',
                actual_content: '{"test": 2}',
                intended_name: "test.json",
                actual_name: "test.json",
                file_format: "json",
                api_key: key
            })
        });
        
        if (response.ok) {
            showToast("Gemini API connection verified!");
        } else {
            showToast("API Key validation failed. Please check the key.", true);
        }
    } catch (err) {
        showToast("Connection failed. Server might be down.", true);
    }
}

// 4. Drift Analysis Engine Execution
async function startAnalysis() {
    const intendedContent = document.getElementById('text-intended').value.trim();
    const actualContent = document.getElementById('text-actual').value.trim();
    const format = document.getElementById('format-select').value;
    
    if (!intendedContent || !actualContent) {
        showToast("Please provide both intended and actual configurations.", true);
        return;
    }
    
    // Extract file names
    const intendedName = document.getElementById('file-name-intended').innerText;
    const actualName = document.getElementById('file-name-actual').innerText;
    
    const apiKey = localStorage.getItem('gemini_api_key') || null;
    
    // Show Loading Overlay
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = 'flex';
    
    // Reset steps
    resetLoadingSteps();
    
    try {
        // Step 1: Read Files (simulated UI delay for high-fidelity experience)
        await setStepStatus('step-read', 'active');
        await delay(500);
        await setStepStatus('step-read', 'completed');
        
        // Step 2: Compare configs
        await setStepStatus('step-compare', 'active');
        await delay(500);
        
        // Prepare request body
        const requestData = {
            intended_content: intendedContent,
            actual_content: actualContent,
            intended_name: intendedName === "No file selected" ? "intended_config.json" : intendedName,
            actual_name: actualName === "No file selected" ? "actual_config.json" : actualName,
            file_format: format,
            api_key: apiKey
        };
        
        await setStepStatus('step-compare', 'completed');
        
        // Step 3: Run AI analysis
        await setStepStatus('step-ai', 'active');
        
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            const errDetails = await response.json();
            throw new Error(errDetails.detail || "Server error occurred during comparison.");
        }
        
        const result = await response.json();
        appState.currentAnalysisResult = result;
        
        await delay(500);
        await setStepStatus('step-ai', 'completed');
        
        // Step 4: Generate reports
        await setStepStatus('step-report', 'active');
        await delay(400);
        await setStepStatus('step-report', 'completed');
        await delay(200);
        
        // Hide loading and show results
        overlay.style.display = 'none';
        showAnalysisResult(result);
        showToast("Analysis completed successfully!");
        
    } catch (error) {
        overlay.style.display = 'none';
        showToast(error.message, true);
        console.error(error);
    }
}

function resetLoadingSteps() {
    const steps = ['step-read', 'step-compare', 'step-ai', 'step-report'];
    steps.forEach(id => {
        const el = document.getElementById(id);
        el.className = 'loading-step';
    });
}

function setStepStatus(stepId, status) {
    return new Promise(resolve => {
        const el = document.getElementById(stepId);
        el.className = `loading-step ${status}`;
        resolve();
    });
}

// 5. Results Display
function showAnalysisResult(result) {
    const resultsWrapper = document.getElementById('results-wrapper');
    resultsWrapper.style.display = 'block';
    
    // Set counters
    document.getElementById('res-count-breaking').innerText = result.breaking_count;
    document.getElementById('res-count-functional').innerText = result.functional_count;
    document.getElementById('res-count-cosmetic').innerText = result.cosmetic_count;
    
    // Render Risk Score Gauge
    renderGauge(result.risk_score);
    
    // Populate drifts card list
    renderDriftsList(result.drifts);
    
    // Scroll down to results
    resultsWrapper.scrollIntoView({ behavior: 'smooth' });
}

function renderGauge(score) {
    const ring = document.getElementById('gauge-ring');
    const valueEl = document.getElementById('gauge-risk-value');
    const descEl = document.getElementById('gauge-risk-desc');
    
    valueEl.innerText = score;
    
    // Define color based on score
    let color = 'var(--green)';
    let desc = 'Low Operational Risk';
    
    if (score >= 75) {
        color = 'var(--red)';
        desc = 'Critical Severity Risk';
    } else if (score >= 40) {
        color = 'var(--orange)';
        desc = 'Medium Operational Risk';
    }
    
    descEl.innerText = desc;
    descEl.className = `gauge-desc text-center ${score >= 75 ? 'text-red' : score >= 40 ? 'text-orange' : 'text-green'}`;
    
    // Set conic gradient degree for rotation
    const degrees = (score / 100) * 360;
    ring.style.background = `conic-gradient(${color} 0deg, ${color} ${degrees}deg, rgba(255,255,255,0.05) ${degrees}deg, rgba(255,255,255,0.05) 360deg)`;
}

function renderDriftsList(drifts) {
    const listContainer = document.getElementById('drifts-cards-list');
    listContainer.innerHTML = "";
    
    if (!drifts || drifts.length === 0) {
        listContainer.innerHTML = `
            <div class="card text-center py-4">
                <i data-lucide="shield-check" class="text-green" style="width: 48px; height: 48px; margin: 0 auto 12px;"></i>
                <h4>Zero Drifts Detected!</h4>
                <p class="text-muted" style="font-size: 13px;">The active configuration is identical to the baseline reference.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    drifts.forEach(d => {
        const card = document.createElement('div');
        
        let borderClass = 'border-left-green';
        let badgeClass = 'badge-green';
        if (d.severity === 'Breaking') {
            borderClass = 'border-left-red';
            badgeClass = 'badge-red';
        } else if (d.severity === 'Functional') {
            borderClass = 'border-left-orange';
            badgeClass = 'badge-orange';
        }
        
        card.className = `card drift-card ${borderClass}`;
        
        // Handle value displays
        const oldValStr = d.old_value === null ? "None (Added)" : (typeof d.old_value === 'object' ? JSON.stringify(d.old_value) : String(d.old_value));
        const newValStr = d.new_value === null ? "None (Removed)" : (typeof d.new_value === 'object' ? JSON.stringify(d.new_value) : String(d.new_value));
        
        const oldClass = d.old_value === null ? 'text-green' : '';
        const newClass = d.new_value === null ? 'text-removed-glow' : (d.old_value === null ? 'text-added-glow' : '');
        
        // Handle risk tag class
        const riskLower = String(d.risk_level).toLowerCase();
        let riskClass = 'risk-low';
        if (riskLower === 'critical') riskClass = 'risk-critical';
        else if (riskLower === 'high') riskClass = 'risk-high';
        else if (riskLower === 'medium') riskClass = 'risk-medium';
        
        card.innerHTML = `
            <div class="drift-card-header">
                <span class="drift-title-path">${d.key}</span>
                <div class="drift-badges">
                    <span class="badge ${badgeClass}">${d.severity}</span>
                    <span class="badge badge-info">${d.type}</span>
                </div>
            </div>
            
            <div class="drift-value-flow">
                <div class="diff-value-pill old-val-pill">
                    <span class="label">Intended Value</span>
                    <span class="val ${oldClass}">${escapeHtml(oldValStr)}</span>
                </div>
                <div class="diff-arrow-icon">
                    <i data-lucide="arrow-right"></i>
                </div>
                <div class="diff-value-pill new-val-pill">
                    <span class="label">Actual Value</span>
                    <span class="val ${newClass}">${escapeHtml(newValStr)}</span>
                </div>
            </div>
            
            <div class="drift-ai-assessment">
                <div class="ai-header">
                    <i data-lucide="sparkles"></i>
                    <span>AI Analysis</span>
                    <span class="risk-tag ${riskClass}" style="margin-left: auto;">Risk: ${d.risk_level || 'Medium'}</span>
                </div>
                <div class="ai-content">
                    <p><strong>Explanation:</strong> ${d.explanation || 'No explanation provided.'}</p>
                    <p><strong>Operational Impact:</strong> ${d.impact || 'No impact evaluated.'}</p>
                    <p><strong>Recommendation:</strong> ${d.recommendation || 'No recommendation provided.'}</p>
                </div>
            </div>
        `;
        
        listContainer.appendChild(card);
    });
    
    lucide.createIcons();
}

// Search, Filter and Sort Logic
function filterDrifts() {
    if (!appState.currentAnalysisResult) return;
    
    const query = document.getElementById('drift-search-input').value.toLowerCase();
    const severityFilter = document.getElementById('drift-severity-filter').value;
    const sortVal = document.getElementById('drift-sort-select').value;
    
    // Copy the original list to filter
    let filtered = [...appState.currentAnalysisResult.drifts];
    
    // 1. Filter by search query
    if (query) {
        filtered = filtered.filter(d => d.key.toLowerCase().includes(query));
    }
    
    // 2. Filter by severity
    if (severityFilter !== 'all') {
        filtered = filtered.filter(d => d.severity === severityFilter);
    }
    
    // 3. Sort
    filtered.sort((a, b) => {
        if (sortVal === 'key-asc') {
            return a.key.localeCompare(b.key);
        } else if (sortVal === 'key-desc') {
            return b.key.localeCompare(a.key);
        } else if (sortVal === 'severity-desc') {
            const weights = { 'Breaking': 3, 'Functional': 2, 'Cosmetic': 1 };
            return (weights[b.severity] || 0) - (weights[a.severity] || 0);
        }
        return 0;
    });
    
    renderDriftsList(filtered);
}

// 6. Report Generation Exports
async function exportReport(format) {
    if (!appState.currentAnalysisResult) {
        showToast("No analysis results available to export.", true);
        return;
    }
    
    const data = {
        intended_file: appState.currentAnalysisResult.intended_file,
        actual_file: appState.currentAnalysisResult.actual_file,
        risk_score: appState.currentAnalysisResult.risk_score,
        drifts: appState.currentAnalysisResult.drifts
    };
    
    showToast(`Generating ${format.toUpperCase()} report...`);
    
    try {
        if (format === 'pdf') {
            const response = await fetch('/api/export/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) throw new Error("Failed to export PDF.");
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            // Extract filename from header if possible
            const disposition = response.headers.get('content-disposition');
            let filename = `drift_report_${new Date().toISOString().slice(0,10)}.pdf`;
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showToast("PDF report downloaded!");
            
        } else if (format === 'markdown') {
            const response = await fetch('/api/export/markdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) throw new Error("Failed to export Markdown.");
            
            const result = await response.json();
            
            // Download as file
            const blob = new Blob([result.markdown], { type: 'text/markdown' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `drift_report_${new Date().toISOString().slice(0,10)}.md`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showToast("Markdown report downloaded!");
        }
    } catch (err) {
        showToast(err.message, true);
        console.error(err);
    }
}

// Load a specific historical run into the Drift Analysis tab
function loadHistoryRun(runId) {
    const run = appState.history.find(h => h.id === runId);
    if (!run) {
        showToast("Report run not found.", true);
        return;
    }
    
    // Store in state as active
    appState.currentAnalysisResult = run;
    
    // Switch view
    switchView('analysis-view');
    
    // Display results
    showAnalysisResult(run);
}

// 7. Dashboard Stats & Chart Controllers
async function refreshData() {
    try {
        const response = await fetch('/api/history');
        if (!response.ok) throw new Error("Failed to load history");
        
        const history = await response.json();
        appState.history = history;
        
        // 1. Update general stats
        updateDashboardStats(history);
        
        // 2. Render recent history table (in Dashboard & Reports views)
        renderHistoryTables(history);
        
        // 3. Render Dashboard charts
        renderCharts(history);
        
    } catch (err) {
        console.error("Failed to load dashboard data: ", err);
    }
}

function updateDashboardStats(history) {
    const totalRuns = history.length;
    let totalDrifts = 0;
    let breaking = 0;
    let functional = 0;
    let cosmetic = 0;
    let avgRisk = 0;
    
    if (totalRuns > 0) {
        history.forEach(run => {
            totalDrifts += run.total_drifts;
            breaking += run.breaking_count;
            functional += run.functional_count;
            cosmetic += run.cosmetic_count;
            avgRisk += run.risk_score;
        });
        avgRisk = Math.round(avgRisk / totalRuns);
    }
    
    document.getElementById('stat-total-analyzed').innerText = totalRuns;
    document.getElementById('stat-total-drifts').innerText = totalDrifts;
    document.getElementById('stat-breaking-count').innerText = breaking;
    document.getElementById('stat-functional-count').innerText = functional;
    document.getElementById('stat-cosmetic-count').innerText = cosmetic;
    document.getElementById('stat-avg-risk').innerText = `${avgRisk}%`;
    document.getElementById('stat-avg-risk-fill').style.width = `${avgRisk}%`;
}

function renderHistoryTables(history) {
    const recentRows = document.getElementById('recent-history-rows');
    const reportsRows = document.getElementById('reports-history-rows');
    
    recentRows.innerHTML = "";
    reportsRows.innerHTML = "";
    
    if (history.length === 0) {
        const emptyRow = `<tr><td colspan="6" class="text-center text-muted py-4">No analysis runs recorded. Start by running an analysis.</td></tr>`;
        recentRows.innerHTML = emptyRow;
        reportsRows.innerHTML = emptyRow;
        return;
    }
    
    // Build rows (limit dashboard to 5 rows, reports to all)
    history.forEach((run, index) => {
        const dateStr = new Date(run.timestamp).toLocaleString();
        
        let riskColor = 'text-green';
        if (run.risk_score >= 75) riskColor = 'text-red';
        else if (run.risk_score >= 40) riskColor = 'text-orange';
        
        const rowHtml = `
            <tr>
                <td>${dateStr}</td>
                <td><code style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">${escapeHtml(run.intended_file)}</code></td>
                <td><code style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">${escapeHtml(run.actual_file)}</code></td>
                <td><strong class="text-glow-purple">${run.total_drifts}</strong> drifts</td>
                <td><span class="${riskColor}"><b>${run.risk_score}%</b></span></td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="loadHistoryRun('${run.id}')" title="Open Analysis">
                            <i data-lucide="eye" style="width: 14px; height: 14px;"></i> View
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="downloadPdfFromHistory('${run.id}')" title="Download PDF">
                            <i data-lucide="download" style="width: 14px; height: 14px;"></i>
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="deleteHistoryRun('${run.id}')" title="Delete Run" style="color: #ff4d4f; border-color: rgba(255, 77, 79, 0.3);">
                            <i data-lucide="x" style="width: 14px; height: 14px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        
        if (index < 5) {
            recentRows.insertAdjacentHTML('beforeend', rowHtml);
        }
        reportsRows.insertAdjacentHTML('beforeend', rowHtml);
    });
    
    lucide.createIcons();
}

async function downloadPdfFromHistory(runId) {
    const run = appState.history.find(h => h.id === runId);
    if (!run) return;
    
    showToast("Generating PDF report...");
    try {
        const response = await fetch('/api/export/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                intended_file: run.intended_file,
                actual_file: run.actual_file,
                risk_score: run.risk_score,
                drifts: run.drifts
            })
        });
        if (!response.ok) throw new Error("Failed to download PDF");
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `drift_report_${run.intended_file}_${run.actual_file}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        showToast("PDF report downloaded!");
    } catch (err) {
        showToast(err.message, true);
    }
}

async function deleteHistoryRun(runId) {
    if (!confirm("Are you sure you want to delete this analysis run?")) return;
    try {
        const response = await fetch(`/api/history/${runId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error("Failed to delete analysis run");
        showToast("Analysis run deleted.");
        refreshData();
    } catch (err) {
        showToast(err.message, true);
    }
}

async function clearHistory() {
    if (!confirm("Are you sure you want to clear all history? This will delete all saved audits.")) {
        return;
    }
    
    try {
        const response = await fetch('/api/history/clear', { method: 'POST' });
        if (response.ok) {
            showToast("Analysis history cleared.");
            refreshData();
        } else {
            showToast("Failed to clear history.", true);
        }
    } catch (err) {
        showToast("Error connecting to server.", true);
    }
}

// Chart.js Setup
function renderCharts(history) {
    // 1. Severity Doughnut/Pie Chart
    let breaking = 0, functional = 0, cosmetic = 0;
    
    history.forEach(run => {
        breaking += run.breaking_count;
        functional += run.functional_count;
        cosmetic += run.cosmetic_count;
    });
    
    const totalDrifts = breaking + functional + cosmetic;
    
    const pieCtx = document.getElementById('severityPieChart').getContext('2d');
    
    if (appState.charts.severityPie) {
        appState.charts.severityPie.destroy();
    }
    
    if (totalDrifts === 0) {
        // Show empty placeholder or dummy data
        appState.charts.severityPie = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: ['No Drifts'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['rgba(255,255,255,0.05)'],
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    } else {
        appState.charts.severityPie = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: ['Breaking', 'Functional', 'Cosmetic'],
                datasets: [{
                    data: [breaking, functional, cosmetic],
                    backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
                    hoverOffset: 4,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#e5e7eb',
                            font: { family: 'Outfit', size: 12 }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }
    
    // 2. History Bar Chart
    const barCtx = document.getElementById('historyBarChart').getContext('2d');
    
    if (appState.charts.historyBar) {
        appState.charts.historyBar.destroy();
    }
    
    // Extract last 7 runs (reverse to show chronological order left-to-right)
    const recentRuns = [...history].slice(0, 7).reverse();
    
    const labels = recentRuns.map((run, i) => {
        const d = new Date(run.timestamp);
        return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    });
    
    const dataBreaking = recentRuns.map(run => run.breaking_count);
    const dataFunctional = recentRuns.map(run => run.functional_count);
    const dataCosmetic = recentRuns.map(run => run.cosmetic_count);
    
    appState.charts.historyBar = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: labels.length > 0 ? labels : ['No Data'],
            datasets: [
                {
                    label: 'Breaking',
                    data: dataBreaking.length > 0 ? dataBreaking : [0],
                    backgroundColor: '#ef4444'
                },
                {
                    label: 'Functional',
                    data: dataFunctional.length > 0 ? dataFunctional : [0],
                    backgroundColor: '#f59e0b'
                },
                {
                    label: 'Cosmetic',
                    data: dataCosmetic.length > 0 ? dataCosmetic : [0],
                    backgroundColor: '#10b981'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#9ca3af', font: { family: 'Outfit', size: 10 } }
                },
                y: {
                    stacked: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#9ca3af', font: { family: 'Outfit', size: 10 } }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#e5e7eb',
                        font: { family: 'Outfit', size: 11 }
                    }
                }
            }
        }
    });
}

// 8. Toast Helper
let toastTimeout;
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    
    if (isError) {
        toast.style.borderColor = 'var(--red)';
        toast.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 20px rgba(239, 68, 68, 0.2)';
    } else {
        toast.style.borderColor = 'var(--border-hover)';
        toast.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4), var(--grad-glow)';
    }
    
    toast.classList.add('show');
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

// Helpers
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Switch Input Tab (Upload vs Code Editor)
function switchInputTab(btn, showId, hideId) {
    const parent = btn.parentElement;
    parent.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));
    btn.classList.add('active');
    
    document.getElementById(showId).classList.add('active');
    document.getElementById(hideId).classList.remove('active');
}
