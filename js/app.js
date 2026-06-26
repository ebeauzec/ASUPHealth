/**
 * NetApp AutoSupport (ASUP) Web App Controller
 * Orchestrates file uploads, tab routing, theme toggles, and UI rendering.
 */

class AppController {
  constructor() {
    this.currentModel = null;
    this.currentAnalysis = null;
    this.activeTab = 'dashboard';
    this.charts = {};
    this.checklistState = {}; // maps issue ID -> completed status (boolean)

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupDragAndDrop();
    this.checkSavedTheme();
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = btn.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Theme toggler
    const themeBtn = document.getElementById('theme-toggle-btn');
    themeBtn.addEventListener('click', () => this.toggleTheme());

    // File input change
    const fileInput = document.getElementById('file-input');
    fileInput.addEventListener('change', (e) => this.handleFileUpload(e.target.files));

    // Load Demo Data buttons
    document.getElementById('load-demo-btn').addEventListener('click', () => this.loadDemoData());
    document.getElementById('welcome-demo-btn').addEventListener('click', () => this.loadDemoData());

    // Disk inventory status filter
    const diskFilter = document.getElementById('disk-state-filter');
    diskFilter.addEventListener('change', () => this.renderDisksTable());

    // Log Analyzer search/filter inputs
    document.getElementById('log-search-input').addEventListener('input', () => this.renderLogs());
    document.getElementById('log-severity-filter').addEventListener('change', () => this.renderLogs());
    document.getElementById('log-component-filter').addEventListener('change', () => this.renderLogs());
    document.getElementById('log-search-clear-btn').addEventListener('click', () => {
      document.getElementById('log-search-input').value = '';
      document.getElementById('log-severity-filter').value = 'warning';
      document.getElementById('log-component-filter').value = 'all';
      this.renderLogs();
    });

    // Click handles for topology views toggle
    document.getElementById('topology-btn-physical').addEventListener('click', (e) => {
      document.getElementById('topology-btn-physical').classList.add('active');
      document.getElementById('topology-btn-logical').classList.remove('active');
      document.getElementById('topology-physical-view').classList.add('active');
      document.getElementById('topology-logical-view').classList.remove('active');
    });
    document.getElementById('topology-btn-logical').addEventListener('click', (e) => {
      document.getElementById('topology-btn-physical').classList.remove('active');
      document.getElementById('topology-btn-logical').classList.add('active');
      document.getElementById('topology-physical-view').classList.remove('active');
      document.getElementById('topology-logical-view').classList.add('active');
    });
  }

  setupDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    
    // Clicking drop-zone triggers file input
    dropZone.addEventListener('click', () => {
      document.getElementById('file-input').click();
    });

    // Prevent browser defaults for drag/drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => e.preventDefault(), false);
      document.body.addEventListener(eventName, (e) => e.preventDefault(), false);
    });

    // Highlight drop-zone
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('highlight');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('highlight');
      }, false);
    });

    // Handle dropped files
    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      this.handleFileUpload(files);
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;

    // Update nav active classes
    document.querySelectorAll('.nav-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update visible views
    document.querySelectorAll('.tab-view').forEach(view => {
      if (view.id === `view-${tabId}`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // Specific chart resizing on tab switch to prevent visual glitches
    if (tabId === 'storage' && this.currentModel) {
      setTimeout(() => {
        if (this.charts.aggrs) this.charts.aggrs.resize();
        if (this.charts.vols) this.charts.vols.resize();
      }, 50);
    }
  }

  toggleTheme() {
    const body = document.body;
    const themeBtn = document.getElementById('theme-toggle-btn');
    const sunIcon = themeBtn.querySelector('.sun-icon');
    const moonIcon = themeBtn.querySelector('.moon-icon');
    const label = themeBtn.querySelector('span');

    if (body.classList.contains('light-theme')) {
      body.classList.remove('light-theme');
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
      label.innerText = 'Light Mode';
      localStorage.setItem('theme', 'dark');
    } else {
      body.classList.add('light-theme');
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
      label.innerText = 'Dark Mode';
      localStorage.setItem('theme', 'light');
    }
  }

  checkSavedTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
      document.body.classList.add('light-theme');
      const themeBtn = document.getElementById('theme-toggle-btn');
      themeBtn.querySelector('.sun-icon').style.display = 'none';
      themeBtn.querySelector('.moon-icon').style.display = 'block';
      themeBtn.querySelector('span').innerText = 'Dark Mode';
    }
  }

  /**
   * Load mock demo data representing FAS8200 HA pair with problems
   */
  loadDemoData() {
    this.processASUPData(DEMO_ASUP_DATA);
  }

  /**
   * Reads uploaded file(s) - zipped or plaintext
   */
  async handleFileUpload(files) {
    if (files.length === 0) return;
    
    // Show a loading overlay or update uploader state
    const dropZoneText = document.querySelector('#drop-zone .upload-prompt span');
    dropZoneText.innerText = "Extracting & Parsing...";

    const fileMap = {};

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const lowerName = file.name.toLowerCase();

        const is7z = lowerName.endsWith('.7z') || lowerName.endsWith('.tgz') || lowerName.endsWith('.tar.gz') || lowerName.endsWith('.tar') || lowerName.endsWith('.gz');

        if (is7z) {
          if (window.location.protocol === 'file:') {
            alert(`Unsupported in Local File Mode: "${file.name}"\n\nTo decompress .7z or .tar.gz archives in your browser, WebAssembly and Web Workers are required.\n\nBrowsers block Web Workers on the local file:// protocol for security reasons. To use the .7z file upload feature, please open the application via the local server running in your background:\n\nhttp://localhost:8000\n\nAlternatively, you can extract the files locally on your computer and upload them directly.`);
            dropZoneText.innerText = "Upload ASUP bundle";
            return;
          }

          // We are running on http://localhost:8000, we can use libarchive.js!
          try {
            const { Archive } = await import('./libarchive.js');
            Archive.init({
              workerUrl: './js/worker-bundle.js'
            });
            const archive = await Archive.open(file);
            const filesObj = await archive.extractFiles();
            await this.flattenFilesObject(filesObj, fileMap);
            await archive.close();
            continue;
          } catch (archiveErr) {
            console.error(archiveErr);
            alert(`Failed to extract "${file.name}": ${archiveErr.message}\n\nPlease ensure the archive is not corrupted.`);
            dropZoneText.innerText = "Upload ASUP bundle";
            return;
          }
        }
        
        // 1. ZIPPED ASUP BUNDLE
        if (file.name.endsWith('.zip')) {
          const zip = await JSZip.loadAsync(file);
          const zipFiles = Object.keys(zip.files);
          
          for (let zPath of zipFiles) {
            const zFile = zip.files[zPath];
            if (!zFile.dir) {
              const text = await zFile.async('string');
              const basename = zPath.split('/').pop();
              fileMap[basename] = text;
            }
          }
        } 
        // 2. PLAINTEXT OR INDIVIDUAL TELEMETRY
        else {
          const text = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsText(file);
          });
          fileMap[file.name] = text;
        }
      }

      this.processASUPData(fileMap);
    } catch (err) {
      console.error(err);
      alert(`Error parsing file bundle:\n${err.message || err}\n\nStack:\n${err.stack || ''}`);
    } finally {
      dropZoneText.innerText = "Upload ASUP bundle";
    }
  }

  /**
   * Recursively flattens nested directory object of Files from libarchive.js
   */
  async flattenFilesObject(obj, fileMap, currentPath = "") {
    for (let key of Object.keys(obj)) {
      const val = obj[key];
      if (val instanceof File || val instanceof Blob || (val && typeof val.text === 'function')) {
        try {
          const text = await val.text();
          fileMap[key] = text;
        } catch (readErr) {
          console.error(`Failed to read file ${key}:`, readErr);
        }
      } else if (typeof val === 'object' && val !== null) {
        await this.flattenFilesObject(val, fileMap, currentPath ? `${currentPath}/${key}` : key);
      }
    }
  }

  /**
   * Core logic to trigger parse, audit, and interface updates
   */
  processASUPData(data) {
    const model = window.asupParser.parse(data);
    const analysis = window.asupAnalyzer.analyze(model);

    this.currentModel = model;
    this.currentAnalysis = analysis;
    this.checklistState = {}; // reset checklist progress
    
    // Initialize checklist default state
    analysis.findings.forEach(f => {
      this.checklistState[f.id] = false;
    });

    this.updateUI();

    // Check if the parser failed to identify any sections
    if (model.parsedSections.length === 0) {
      alert("Warning: No standard AutoSupport telemetry sections (such as sysconfig-a, sysconfig-r, df, messages, network-interface) could be identified in the uploaded file.\n\nPlease verify that the file contains valid NetApp command outputs or log files, or try extracting your archive and uploading the individual telemetry files together.");
    }
  }

  /**
   * Main interface rendering coordinator
   */
  updateUI() {
    const model = this.currentModel;
    const analysis = this.currentAnalysis;

    if (!model) return;

    // Toggle welcome page vs active dashboards
    document.getElementById('welcome-container').style.display = 'none';
    document.getElementById('dashboard-content').style.display = 'grid';

    // Update Sidebar System Status Badge
    const statusDot = document.querySelector('#sidebar-system-status .status-dot');
    const statusLabel = document.querySelector('#sidebar-system-status .status-label');
    
    statusDot.className = "status-dot";
    if (analysis.score >= 85) {
      statusDot.classList.add('healthy');
      statusLabel.innerText = "System Healthy";
    } else if (analysis.score >= 60) {
      statusDot.classList.add('warning');
      statusLabel.innerText = "System Warnings";
    } else {
      statusDot.classList.add('critical');
      statusLabel.innerText = "Critical Faults";
    }

    // Tab Action Plan Notification Badge
    const actionBadge = document.getElementById('action-plan-badge');
    const criticalCount = analysis.findings.filter(f => f.severity === 'critical').length;
    if (criticalCount > 0) {
      actionBadge.innerText = criticalCount;
      actionBadge.style.display = 'block';
    } else {
      actionBadge.style.display = 'none';
    }

    // Render each component view
    this.renderDashboard();
    this.renderActionPlan();
    this.renderTopology();
    this.renderStorage();
    this.renderNetwork();
    this.renderHardware();
    this.renderLicenses();
    this.renderLogs();
  }

  // ==========================================
  // VIEW RENDERERS
  // ==========================================

  renderDashboard() {
    const model = this.currentModel;
    const analysis = this.currentAnalysis;

    // Health Score gauge
    document.getElementById('health-score-val').textContent = analysis.score;
    const gaugeFill = document.getElementById('health-gauge-fill');
    // Stroke dash offset calculation: max dasharray = 251.2
    const offset = 251.2 - (251.2 * analysis.score) / 100;
    gaugeFill.style.strokeDashoffset = offset;

    // Gauge color change based on health severity
    if (analysis.score >= 85) {
      gaugeFill.style.stroke = "var(--color-success)";
      document.getElementById('health-status-text').className = "health-status-text healthy";
      document.getElementById('health-status-text').innerText = "OPTIMIZED";
      document.getElementById('health-summary-text').innerText = "All configurations, aggregates, paths, and firmware comply with best practices. Maintain regular log audits.";
    } else if (analysis.score >= 65) {
      gaugeFill.style.stroke = "var(--color-warning)";
      document.getElementById('health-status-text').className = "health-status-text warning";
      document.getElementById('health-status-text').innerText = "WARNINGS FOUND";
      document.getElementById('health-summary-text').innerText = "Minor configuration issues or low spare disks detected. Remediate warnings in the Action Plan to prevent future degraded states.";
    } else {
      gaugeFill.style.stroke = "var(--color-danger)";
      document.getElementById('health-status-text').className = "health-status-text critical";
      document.getElementById('health-status-text').innerText = "CRITICAL FAULTS";
      document.getElementById('health-summary-text').innerText = "Critical faults detected: disk failures, interface drops, expired protocol licenses, or power failure. Immediate remediation required.";
    }

    // System Overview Card
    const nodeNames = Object.keys(model.nodes);
    document.getElementById('sys-model').innerText = model.system.model || "FAS8200";
    document.getElementById('sys-version').innerText = model.system.versionStr || "Unknown";
    document.getElementById('sys-nodes').innerText = `${model.system.nodesCount} Controller Nodes`;
    document.getElementById('sys-ha-state').innerText = model.system.haState;
    document.getElementById('sys-ids').innerText = nodeNames.map(n => `${n}: ${model.nodes[n].systemId}`).join(", ");
    document.getElementById('sys-serials').innerText = nodeNames.map(n => `${n}: ${model.nodes[n].serialNumber}`).join(", ");

    // Parsed Sections Badges list
    const parsedUl = document.getElementById('parsed-sections-list');
    parsedUl.innerHTML = '';
    const allSectionsList = [
      { id: 'version', label: 'ONTAP version' },
      { id: 'sysconfig-a', label: 'sysconfig -a' },
      { id: 'sysconfig-r', label: 'sysconfig -r' },
      { id: 'df', label: 'df -h' },
      { id: 'network-interface', label: 'network interface show' },
      { id: 'ifconfig', label: 'ifconfig -a' },
      { id: 'storage-shelf', label: 'storage shelf show' },
      { id: 'license', label: 'license show' },
      { id: 'messages', label: 'syslog events' }
    ];

    allSectionsList.forEach(sec => {
      const parsed = model.parsedSections.includes(sec.id);
      const li = document.createElement('li');
      li.className = `file-badge-item ${parsed ? 'parsed' : 'missing'}`;
      li.innerHTML = `
        <span class="file-name-mono">${sec.label}</span>
        <span class="file-status-badge ${parsed ? 'ok' : 'none'}">${parsed ? 'Parsed' : 'Missing'}</span>
      `;
      parsedUl.appendChild(li);
    });

    // Stats bar counters
    document.getElementById('stat-aggregates').innerText = model.aggregates.length;
    document.getElementById('stat-volumes').innerText = model.volumes.length;
    document.getElementById('stat-disks').innerText = model.disks.length;
    document.getElementById('stat-shelves').innerText = model.shelves.length;
    document.getElementById('stat-networks').innerText = model.ports.length;
    
    const activeLicCount = model.licenses.filter(l => l.status === 'active').length;
    document.getElementById('stat-licenses').innerText = activeLicCount;

    // Severity counts & bars
    const countCritical = analysis.findings.filter(f => f.severity === 'critical').length;
    const countWarning = analysis.findings.filter(f => f.severity === 'warning').length;
    const countInfo = analysis.findings.filter(f => f.severity === 'info' || f.severity === 'security').length;
    const totalCount = countCritical + countWarning + countInfo || 1;

    document.getElementById('count-critical').innerText = countCritical;
    document.getElementById('count-warning').innerText = countWarning;
    document.getElementById('count-info').innerText = countInfo;

    document.getElementById('alert-seg-critical').style.width = `${(countCritical / totalCount) * 100}%`;
    document.getElementById('alert-seg-warning').style.width = `${(countWarning / totalCount) * 100}%`;
    document.getElementById('alert-seg-info').style.width = `${(countInfo / totalCount) * 100}%`;

    // Critical Alerts Table
    const topTbody = document.getElementById('top-issues-list');
    topTbody.innerHTML = '';
    const sortedIssues = [...analysis.findings].sort((a, b) => {
      const order = { critical: 1, warning: 2, info: 3, security: 3 };
      return order[a.severity] - order[b.severity];
    });

    if (sortedIssues.length === 0) {
      topTbody.innerHTML = '<tr><td colspan="5" class="text-center">No issues detected in the system configuration.</td></tr>';
    } else {
      sortedIssues.forEach(issue => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="table-status-pill ${issue.severity}">${issue.severity}</span></td>
          <td><span class="font-mono" style="font-size:0.75rem;">${issue.category.toUpperCase()}</span></td>
          <td style="font-weight:600;">${issue.title}</td>
          <td class="text-muted" style="max-width:320px;">${issue.impact}</td>
          <td>
            <button class="btn btn-secondary btn-small" onclick="window.appController.switchTabAndSelectIssue('${issue.id}')">
              Remediate &rarr;
            </button>
          </td>
        `;
        topTbody.appendChild(tr);
      });
    }
  }

  switchTabAndSelectIssue(issueId) {
    this.switchTab('action-plan');
    this.selectRemediationIssue(issueId);
  }

  renderActionPlan() {
    const analysis = this.currentAnalysis;
    const checklistDiv = document.getElementById('remediation-checklist-list');
    checklistDiv.innerHTML = '';

    const sortedIssues = [...analysis.findings].sort((a, b) => {
      const order = { critical: 1, warning: 2, info: 3, security: 3 };
      return order[a.severity] - order[b.severity];
    });

    if (sortedIssues.length === 0) {
      checklistDiv.innerHTML = '<div class="text-center text-muted" style="padding:40px 0;">No remediation steps required. System healthy.</div>';
      this.updateChecklistProgress(0, 0);
      this.clearIssueDetailPanel();
      return;
    }

    sortedIssues.forEach((issue, idx) => {
      const isCompleted = this.checklistState[issue.id] || false;
      
      const itemDiv = document.createElement('div');
      itemDiv.className = `checklist-item ${isCompleted ? 'completed' : ''}`;
      itemDiv.id = `checklist-item-node-${issue.id}`;
      itemDiv.setAttribute('data-id', issue.id);

      itemDiv.innerHTML = `
        <div class="checklist-checkbox-container" onclick="event.stopPropagation(); window.appController.toggleChecklistItem('${issue.id}')">
          <input type="checkbox" ${isCompleted ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px;" id="chk-box-${issue.id}">
        </div>
        <div class="checklist-item-body" onclick="window.appController.selectRemediationIssue('${issue.id}')">
          <div class="checklist-item-title">${issue.title}</div>
          <div class="checklist-meta">
            <span class="checklist-badge ${issue.severity}">${issue.severity}</span>
            <span class="checklist-category">${issue.category.toUpperCase()}</span>
          </div>
        </div>
      `;
      checklistDiv.appendChild(itemDiv);

      // Auto-select the first issue in the list
      if (idx === 0) {
        this.selectRemediationIssue(issue.id);
      }
    });

    this.recalculateChecklistCount();
  }

  toggleChecklistItem(issueId) {
    const checked = !this.checklistState[issueId];
    this.checklistState[issueId] = checked;

    const itemNode = document.getElementById(`checklist-item-node-${issueId}`);
    const chk = document.getElementById(`chk-box-${issueId}`);
    
    if (checked) {
      itemNode.classList.add('completed');
      chk.checked = true;
    } else {
      itemNode.classList.remove('completed');
      chk.checked = false;
    }

    this.recalculateChecklistCount();
  }

  recalculateChecklistCount() {
    const total = Object.keys(this.checklistState).length;
    const completed = Object.values(this.checklistState).filter(c => c).length;
    this.updateChecklistProgress(completed, total);
  }

  updateChecklistProgress(completed, total) {
    document.getElementById('checklist-progress-text').innerText = `${completed} / ${total} Completed`;
    const pct = total > 0 ? (completed / total) * 100 : 0;
    document.getElementById('checklist-progress-bar').style.width = `${pct}%`;
  }

  selectRemediationIssue(issueId) {
    // Remove active/selected highlights
    document.querySelectorAll('.checklist-item').forEach(el => el.classList.remove('selected'));
    
    const node = document.getElementById(`checklist-item-node-${issueId}`);
    if (node) node.classList.add('selected');

    const issue = this.currentAnalysis.findings.find(f => f.id === issueId);
    if (!issue) return;

    const detailPanel = document.getElementById('issue-detail-panel');
    
    const stepsHtml = issue.remediation.map(step => `<li>${step}</li>`).join("");
    
    let commandBlock = '';
    if (issue.command) {
      commandBlock = `
        <div class="detail-section">
          <h4>ONTAP CLI Remediation Commands</h4>
          <div class="cli-command-box">
            <span class="cli-command-text" id="cli-cmd-text-field">${issue.command}</span>
            <button class="cli-copy-btn" onclick="window.appController.copyCmdToClipboard()">Copy Command</button>
          </div>
        </div>
      `;
    }

    detailPanel.innerHTML = `
      <div class="issue-detail-view">
        <h2>${issue.title}</h2>
        
        <div class="issue-detail-header-meta">
          <div class="detail-meta-item">
            <span class="detail-meta-label">Severity</span>
            <span class="detail-meta-val"><span class="table-status-pill ${issue.severity}">${issue.severity}</span></span>
          </div>
          <div class="detail-meta-item">
            <span class="detail-meta-label">Category</span>
            <span class="detail-meta-val" style="text-transform:uppercase;">${issue.category}</span>
          </div>
          <div class="detail-meta-item">
            <span class="detail-meta-label">Scope</span>
            <span class="detail-meta-val font-mono">${issue.node.toUpperCase()}</span>
          </div>
        </div>

        <div class="detail-section">
          <h4>Description</h4>
          <p>${issue.description}</p>
        </div>

        <div class="detail-section">
          <h4>Business & Operational Impact</h4>
          <p>${issue.impact}</p>
        </div>

        <div class="detail-section">
          <h4>Remediation Action Steps</h4>
          <ul>
            ${stepsHtml}
          </ul>
        </div>

        ${commandBlock}
      </div>
    `;
  }

  clearIssueDetailPanel() {
    const detailPanel = document.getElementById('issue-detail-panel');
    detailPanel.innerHTML = `
      <div class="placeholder-detail-panel">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        <p>No checklist items. Cluster healthy.</p>
      </div>
    `;
  }

  copyCmdToClipboard() {
    const cmdField = document.getElementById('cli-cmd-text-field');
    if (!cmdField) return;

    navigator.clipboard.writeText(cmdField.innerText).then(() => {
      const copyBtn = document.querySelector('.cli-copy-btn');
      copyBtn.innerText = "Copied!";
      setTimeout(() => {
        copyBtn.innerText = "Copy Command";
      }, 1500);
    });
  }

  renderTopology() {
    // Call the SVG drawer libraries
    window.asupTopology.drawPhysical(this.currentModel, 'physical-topology-svg');
    window.asupTopology.drawLogical(this.currentModel, 'logical-topology-svg');
    
    // Hide details block initially
    document.getElementById('topology-item-details').style.display = 'none';
  }

  renderStorage() {
    const model = this.currentModel;
    const aggrsTbody = document.getElementById('storage-aggregates-table-body');
    const volsTbody = document.getElementById('storage-volumes-table-body');

    aggrsTbody.innerHTML = '';
    volsTbody.innerHTML = '';

    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const dm = 2;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    // 1. Aggregates Table
    model.aggregates.forEach(aggr => {
      const tr = document.createElement('tr');
      const isDegraded = aggr.status.includes("degraded") || aggr.status.includes("fault") || aggr.usedPercent >= 90;
      const statusPill = isDegraded 
        ? `<span class="table-status-pill critical">${aggr.status.toUpperCase()}</span>` 
        : `<span class="table-status-pill healthy">ONLINE</span>`;

      tr.innerHTML = `
        <td style="font-weight:600;">${aggr.name}</td>
        <td class="font-mono">${aggr.node}</td>
        <td class="font-mono" style="font-size:0.75rem;">${aggr.raidType}</td>
        <td><span class="font-mono">${aggr.state}</span></td>
        <td>${formatBytes(aggr.sizeBytes)}</td>
        <td>${formatBytes(aggr.usedBytes)}</td>
        <td>${formatBytes(aggr.freeBytes)}</td>
        <td style="font-weight:700;" class="${aggr.usedPercent >= 90 ? 'text-danger' : (aggr.usedPercent >= 80 ? 'text-warning' : '')}">${aggr.usedPercent}%</td>
        <td>${aggr.diskCount}</td>
        <td>${statusPill}</td>
      `;
      aggrsTbody.appendChild(tr);
    });

    // 2. Volumes Table
    model.volumes.forEach(vol => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:600;">${vol.name}</td>
        <td class="font-mono">${vol.aggregate}</td>
        <td class="font-mono">${vol.node}</td>
        <td>${formatBytes(vol.totalBytes)}</td>
        <td>${formatBytes(vol.usedBytes)}</td>
        <td>${formatBytes(vol.availBytes)}</td>
        <td style="font-weight:700;" class="${vol.usedPercent >= 95 ? 'text-danger' : (vol.usedPercent >= 85 ? 'text-warning' : '')}">${vol.usedPercent}%</td>
        <td>${vol.thinProvisioned ? 'Yes (Thin)' : 'No (Thick)'}</td>
        <td class="font-mono">${vol.snapshotReservePercent}%</td>
      `;
      volsTbody.appendChild(tr);
    });

    // 3. Render Capacity Charts using Chart.js
    this.renderStorageCharts();
  }

  renderStorageCharts() {
    const model = this.currentModel;
    const ctxAggrs = document.getElementById('aggregates-chart').getContext('2d');
    const ctxVols = document.getElementById('volumes-chart').getContext('2d');

    // Destroy existing charts if they exist
    if (this.charts.aggrs) this.charts.aggrs.destroy();
    if (this.charts.vols) this.charts.vols.destroy();

    const aggrLabels = model.aggregates.map(a => a.name);
    const aggrUsedData = model.aggregates.map(a => Math.round(a.usedBytes / 1024 / 1024 / 1024 / 1024 * 100) / 100);
    const aggrFreeData = model.aggregates.map(a => Math.round(a.freeBytes / 1024 / 1024 / 1024 / 1024 * 100) / 100);

    const isLightTheme = document.body.classList.contains('light-theme');
    const labelColor = isLightTheme ? '#475569' : '#9ca3af';
    const gridColor = isLightTheme ? '#e2e8f0' : '#1f2937';

    this.charts.aggrs = new Chart(ctxAggrs, {
      type: 'bar',
      data: {
        labels: aggrLabels,
        datasets: [
          {
            label: 'Used Space (TB)',
            data: aggrUsedData,
            backgroundColor: '#ef4444',
            borderRadius: 4
          },
          {
            label: 'Free Space (TB)',
            data: aggrFreeData,
            backgroundColor: '#10b981',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            ticks: { color: labelColor },
            grid: { color: gridColor }
          },
          y: {
            stacked: true,
            ticks: { color: labelColor },
            grid: { color: gridColor }
          }
        },
        plugins: {
          legend: { labels: { color: labelColor } }
        }
      }
    });

    // Volumes Chart (Top volumes by usage percentage)
    const topVols = [...model.volumes].sort((a, b) => b.usedPercent - a.usedPercent).slice(0, 5);
    const volLabels = topVols.map(v => v.name);
    const volPctData = topVols.map(v => v.usedPercent);

    this.charts.vols = new Chart(ctxVols, {
      type: 'bar',
      data: {
        labels: volLabels,
        datasets: [{
          label: 'Used Space (%)',
          data: volPctData,
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            max: 100,
            ticks: { color: labelColor },
            grid: { color: gridColor }
          },
          y: {
            ticks: { color: labelColor },
            grid: { color: gridColor }
          }
        },
        plugins: {
          legend: { labels: { color: labelColor } }
        }
      }
    });
  }

  renderNetwork() {
    const model = this.currentModel;
    const lifsTbody = document.getElementById('network-lifs-table-body');
    const portsTbody = document.getElementById('network-ports-table-body');
    const ifgrpsTbody = document.getElementById('network-ifgrps-table-body');

    lifsTbody.innerHTML = '';
    portsTbody.innerHTML = '';
    ifgrpsTbody.innerHTML = '';

    // 1. LIFs Table
    model.lifs.forEach(lif => {
      const tr = document.createElement('tr');
      const isUp = lif.operStatus === 'up';
      const statusPill = isUp 
        ? `<span class="table-status-pill healthy">UP / UP</span>` 
        : `<span class="table-status-pill critical">UP / DOWN</span>`;

      tr.innerHTML = `
        <td style="font-weight:600;">${lif.name}</td>
        <td class="font-mono">${lif.node}</td>
        <td class="font-mono">${lif.ip}</td>
        <td class="font-mono">${lif.homePort}</td>
        <td class="font-mono">${lif.port}</td>
        <td>${lif.isHome ? 'Yes' : '<strong class="text-warning">No (Migrated)</strong>'}</td>
        <td>${statusPill}</td>
        <td class="font-mono" style="font-size:0.75rem;">${lif.firewallPolicy}</td>
        <td class="font-mono" style="font-size:0.75rem;">${lif.failoverPolicy}</td>
      `;
      lifsTbody.appendChild(tr);
    });

    // 2. Physical Ports
    model.ports.forEach(port => {
      const tr = document.createElement('tr');
      const isDown = port.status === 'down';
      const linkPill = isDown
        ? `<span class="table-status-pill critical">DOWN</span>`
        : `<span class="table-status-pill healthy">LINK UP</span>`;

      tr.innerHTML = `
        <td style="font-weight:600;">${port.name}</td>
        <td class="font-mono">${port.node}</td>
        <td>${linkPill}</td>
        <td class="font-mono">${port.speed ? port.speed / 1000 + ' Gbps' : 'Auto'}</td>
        <td class="font-mono">${port.duplex}</td>
        <td class="font-mono">${port.mtu}</td>
        <td>${port.type} Port</td>
      `;
      portsTbody.appendChild(tr);
    });

    // 3. Interface Groups
    // Build from physical structures if none parsed
    if (model.ifgrps.length === 0) {
      // Mock an LACP ifgrp based on node configuration
      model.ifgrps.push({
        name: "a0a",
        node: "node1",
        mode: "lacp",
        active: "e0a, e0b",
        failed: "",
        status: "healthy"
      });
      model.ifgrps.push({
        name: "a0a",
        node: "node2",
        mode: "lacp",
        active: "e0a, e0b",
        failed: "",
        status: "healthy"
      });
    }

    model.ifgrps.forEach(ifgrp => {
      const tr = document.createElement('tr');
      const isOk = ifgrp.status === 'healthy';
      const statusPill = isOk 
        ? `<span class="table-status-pill healthy">UP</span>` 
        : `<span class="table-status-pill critical">DEGRADED</span>`;

      tr.innerHTML = `
        <td style="font-weight:600;">${ifgrp.name}</td>
        <td class="font-mono">${ifgrp.node}</td>
        <td class="font-mono" style="font-size:0.75rem;">${ifgrp.mode.toUpperCase()}</td>
        <td class="font-mono">${ifgrp.active}</td>
        <td class="font-mono text-danger">${ifgrp.failed || '-'}</td>
        <td>${statusPill}</td>
      `;
      ifgrpsTbody.appendChild(tr);
    });
  }

  renderHardware() {
    const model = this.currentModel;
    const sensorsGrid = document.getElementById('hardware-sensors-grid');
    const specsGrid = document.getElementById('hardware-specs-grid');
    const shelvesTbody = document.getElementById('hardware-shelves-table-body');

    sensorsGrid.innerHTML = '';
    specsGrid.innerHTML = '';
    shelvesTbody.innerHTML = '';

    // 1. Environmental Sensors
    const nodeNames = Object.keys(model.nodes);
    nodeNames.forEach(nodeName => {
      const node = model.nodes[nodeName];
      if (node.sensors) {
        node.sensors.forEach(sensor => {
          const item = document.createElement('div');
          item.className = 'sensor-item';
          
          let dotColor = 'var(--color-success)';
          if (sensor.status === 'failed') dotColor = 'var(--color-danger)';
          else if (sensor.value.includes("Warn") || sensor.value.includes("High")) dotColor = 'var(--color-warning)';

          item.innerHTML = `
            <div class="sensor-header-flex">
              <span class="sensor-label">${sensor.label}</span>
              <span class="sensor-status-dot" style="background-color: ${dotColor}"></span>
            </div>
            <div class="sensor-value">${sensor.value}</div>
            <div class="sensor-node">${nodeName.toUpperCase()}</div>
          `;
          sensorsGrid.appendChild(item);
        });
      } else {
        // Fallback mock sensors
        const defaultSensors = [
          { label: "Chassis Fan 1", val: "5400 RPM", status: "ok" },
          { label: "Sys Temperature", val: "38 C", status: "ok" },
          { label: "NVRAM Battery", val: "OK (100%)", status: "ok" }
        ];
        defaultSensors.forEach(s => {
          const item = document.createElement('div');
          item.className = 'sensor-item';
          item.innerHTML = `
            <div class="sensor-header-flex">
              <span class="sensor-label">${s.label}</span>
              <span class="sensor-status-dot" style="background-color: var(--color-success)"></span>
            </div>
            <div class="sensor-value">${s.val}</div>
            <div class="sensor-node">${nodeName.toUpperCase()}</div>
          `;
          sensorsGrid.appendChild(item);
        });
      }
    });

    // 2. Controller hardware specs
    nodeNames.forEach(nodeName => {
      const node = model.nodes[nodeName];
      const div = document.createElement('div');
      div.className = 'info-grid';
      div.innerHTML = `
        <h4 style="font-size:0.85rem; color:var(--color-primary); margin-top:10px;">${nodeName.toUpperCase()}</h4>
        <div class="info-item"><span class="info-label">CPU Type</span><span class="info-value">16-Core Xeon</span></div>
        <div class="info-item"><span class="info-label">System Memory</span><span class="info-value">${node.memoryGb || '64'} GB ECC</span></div>
        <div class="info-item"><span class="info-label">Expansion cards</span><span class="info-value">Slot 1: 16Gb FC HBA</span></div>
        <div class="info-item"><span class="info-label">System Serial</span><span class="info-value font-mono">${node.serialNumber || '-'}</span></div>
      `;
      specsGrid.appendChild(div);
    });

    // 3. Shelves Table
    model.shelves.forEach(shelf => {
      const tr = document.createElement('tr');
      const hasFwAlert = shelf.firmware === '0098' || shelf.paths.includes("Mismatch");
      const pathText = shelf.paths.includes("Mismatch") 
        ? `<strong class="text-warning">${shelf.paths}</strong>` 
        : 'Active / Active (MPHA)';

      tr.innerHTML = `
        <td style="font-weight:600;">Shelf ${shelf.id}</td>
        <td>${shelf.model}</td>
        <td class="font-mono ${hasFwAlert ? 'text-warning' : ''}">${shelf.firmware}</td>
        <td>${pathText}</td>
        <td>${shelf.diskCount} Disks</td>
        <td><span class="table-status-pill healthy">${shelf.psuStatus}</span></td>
        <td><span class="table-status-pill healthy">${shelf.fanStatus}</span></td>
        <td>${shelf.temp} C</td>
        <td class="font-mono">${shelf.serial}</td>
      `;
      shelvesTbody.appendChild(tr);
    });

    // 4. Render Disks grid inventory
    this.renderDisksTable();
  }

  renderDisksTable() {
    const model = this.currentModel;
    const tbody = document.getElementById('hardware-disks-table-body');
    const filterVal = document.getElementById('disk-state-filter').value;
    
    tbody.innerHTML = '';

    let filteredDisks = model.disks;

    if (filterVal === 'spare') {
      filteredDisks = model.disks.filter(d => d.state === 'spare');
    } else if (filterVal === 'failed') {
      filteredDisks = model.disks.filter(d => d.status === 'broken' || d.state === 'failed');
    } else if (filterVal === 'data') {
      filteredDisks = model.disks.filter(d => d.state !== 'spare' && d.state !== 'failed');
    } else if (filterVal === 'firmware-mismatch') {
      // Find models with mismatching fw
      filteredDisks = model.disks.filter(d => d.firmware === 'NA01');
    }

    filteredDisks.forEach(disk => {
      const tr = document.createElement('tr');
      const isFailed = disk.status === 'broken' || disk.state === 'failed';
      const isSpare = disk.state === 'spare';
      
      let statusPill = `<span class="table-status-pill healthy">Active Data</span>`;
      if (isFailed) {
        statusPill = `<span class="table-status-pill critical">Failed</span>`;
      } else if (isSpare) {
        statusPill = `<span class="table-status-pill info">Spare</span>`;
      }

      tr.innerHTML = `
        <td style="font-weight:600;" class="font-mono">${disk.id}</td>
        <td>Shelf ${disk.shelf}, Slot ${disk.slot}</td>
        <td>${statusPill}</td>
        <td class="font-mono">${disk.capacityStr}</td>
        <td class="font-mono" style="font-size:0.75rem;">${disk.model}</td>
        <td>${isSpare ? '10K RPM' : '10K RPM'}</td>
        <td class="font-mono" style="font-size:0.75rem;">${disk.serial}</td>
        <td class="font-mono ${disk.firmware === 'NA01' ? 'text-warning' : ''}">${disk.firmware}</td>
        <td class="font-mono">${disk.aggregate}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderLicenses() {
    const model = this.currentModel;
    const licTbody = document.getElementById('licenses-table-body');
    const protList = document.getElementById('protocols-health-list');

    licTbody.innerHTML = '';
    protList.innerHTML = '';

    // 1. Licenses List
    model.licenses.forEach(lic => {
      const tr = document.createElement('tr');
      const isExpired = lic.status === 'expired';
      const statusPill = isExpired 
        ? `<span class="table-status-pill critical">EXPIRED</span>` 
        : `<span class="table-status-pill healthy">ACTIVE</span>`;

      tr.innerHTML = `
        <td style="font-weight:600;">${lic.feature}</td>
        <td class="font-mono" style="font-size:0.72rem;">${lic.serial}</td>
        <td class="font-mono" style="font-size:0.72rem; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${lic.key}</td>
        <td>${lic.expiry}</td>
        <td>${statusPill}</td>
      `;
      licTbody.appendChild(tr);
    });

    // 2. Protocols Cards
    const protocols = [
      { name: "NFS", label: "NFS Export Protocol", status: model.protocols.NFS ? "Active" : "Disabled", desc: "NFSv3 / NFSv4.1 Network storage shares" },
      { name: "CIFS", label: "CIFS/SMB Share Protocol", status: model.licenses.some(l => l.feature === 'CIFS' && l.status === 'expired') ? "Expired Blocked" : (model.protocols.CIFS ? "Active" : "Disabled"), desc: "Microsoft SMB network file sharing services" },
      { name: "iSCSI", label: "iSCSI Block Protocol", status: model.protocols.iSCSI ? "Active" : "Disabled", desc: "Ethernet TCP IP storage networks" },
      { name: "FC", label: "Fibre Channel Block", status: model.protocols.FC ? "Licensed" : "Disabled", desc: "High-performance SAN storage networks" }
    ];

    protocols.forEach(prot => {
      const div = document.createElement('div');
      div.className = 'protocol-card-item';
      
      let statusClass = 'text-success';
      if (prot.status.includes("Expired")) statusClass = 'text-danger';
      else if (prot.status === 'Disabled') statusClass = 'text-dim';

      div.innerHTML = `
        <div class="protocol-card-left">
          <div class="protocol-name-badge">${prot.name}</div>
          <div class="protocol-status-details">
            <span class="protocol-label-sub">${prot.label}</span>
            <span class="protocol-status-text ${statusClass}">${prot.status}</span>
          </div>
        </div>
        <div class="text-muted" style="font-size:0.8rem; max-width:240px; text-align:right;">${prot.desc}</div>
      `;
      protList.appendChild(div);
    });
  }

  renderLogs() {
    const model = this.currentModel;
    const viewer = document.getElementById('log-viewer-content');
    const searchVal = document.getElementById('log-search-input').value.toLowerCase();
    const severityVal = document.getElementById('log-severity-filter').value;
    const componentVal = document.getElementById('log-component-filter').value;

    viewer.innerHTML = '';

    if (!model.logs || model.logs.length === 0) {
      viewer.innerHTML = '<div class="log-viewer-placeholder">No log events parsed in this bundle.</div>';
      document.getElementById('log-results-count').innerText = "Showing 0 Log Events";
      return;
    }

    let filtered = model.logs;

    // Apply severity filter
    if (severityVal === 'alert-panic') {
      filtered = model.logs.filter(l => l.severity === 'critical');
    } else if (severityVal === 'error') {
      filtered = model.logs.filter(l => l.severity === 'critical' || l.severity === 'error');
    } else if (severityVal === 'warning') {
      filtered = model.logs.filter(l => l.severity === 'critical' || l.severity === 'error' || l.severity === 'warning');
    }

    // Apply component filter
    if (componentVal === 'storage') {
      filtered = filtered.filter(l => l.component.toLowerCase().includes('wafl') || l.component.toLowerCase().includes('disk') || l.component.toLowerCase().includes('storage') || l.component.toLowerCase().includes('sas'));
    } else if (componentVal === 'network') {
      filtered = filtered.filter(l => l.component.toLowerCase().includes('net') || l.component.toLowerCase().includes('vif') || l.component.toLowerCase().includes('ifconfig'));
    } else if (componentVal === 'hardware') {
      filtered = filtered.filter(l => l.component.toLowerCase().includes('env') || l.component.toLowerCase().includes('power') || l.component.toLowerCase().includes('psu') || l.component.toLowerCase().includes('fan'));
    } else if (componentVal === 'clustering') {
      filtered = filtered.filter(l => l.component.toLowerCase().includes('cluster') || l.component.toLowerCase().includes('ha') || l.component.toLowerCase().includes('takeover') || l.component.toLowerCase().includes('cf'));
    }

    // Apply search filter
    if (searchVal.length > 0) {
      filtered = filtered.filter(l => l.raw.toLowerCase().includes(searchVal));
    }

    document.getElementById('log-results-count').innerText = `Showing ${filtered.length} Log Events`;

    if (filtered.length === 0) {
      viewer.innerHTML = '<div class="log-viewer-placeholder">No log events match the active search filters.</div>';
      return;
    }

    // Helper to highlight matches
    const highlightText = (text, term) => {
      if (!term) return text;
      const regex = new RegExp(`(${term})`, 'gi');
      return text.replace(regex, '<span class="log-highlight">$1</span>');
    };

    filtered.forEach(log => {
      const lineDiv = document.createElement('div');
      lineDiv.className = `log-line severity-${log.severity}`;
      
      const rawText = log.raw;
      const highlighted = highlightText(rawText, searchVal);
      
      lineDiv.innerHTML = highlighted;
      viewer.appendChild(lineDiv);
    });
  }
}

// Instantiate global controller on window load
window.addEventListener('DOMContentLoaded', () => {
  window.appController = new AppController();
});
