/**
 * NetApp AutoSupport (ASUP) Topology Visualization Engine
 * Generates dynamic, interactive SVG diagrams for physical cabling and logical networks.
 */

window.asupTopology = {
  /**
   * Generates the physical SAS loop and shelf disk layout SVG
   */
  drawPhysical(model, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const nodesCount = Object.keys(model.nodes).length || 1;
    const shelvesCount = model.shelves.length || 0;

    // SVG Canvas Dimensions
    const width = 1000;
    const height = 150 + (shelvesCount * 170) + 100;
    
    let svgHtml = `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background-color: transparent;">
        <!-- Defs for gradients & filters -->
        <defs>
          <linearGradient id="controller-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1f2937" />
            <stop offset="100%" stop-color="#111827" />
          </linearGradient>
          <linearGradient id="shelf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#0f172a" />
          </linearGradient>
          <linearGradient id="disk-healthy-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#10b981" />
            <stop offset="100%" stop-color="#047857" />
          </linearGradient>
          <linearGradient id="disk-spare-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#3b82f6" />
            <stop offset="100%" stop-color="#1d4ed8" />
          </linearGradient>
          <linearGradient id="disk-failed-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ef4444" />
            <stop offset="100%" stop-color="#b91c1c" />
          </linearGradient>
          <filter id="glow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#3b82f6" flood-opacity="0.5"/>
          </filter>
        </defs>
    `;

    // --- DRAW CONTROLLERS (FAS8200 HA PAIR) ---
    const nodeNames = Object.keys(model.nodes);
    const controllerWidth = 320;
    const controllerHeight = 100;
    const controllers = [];

    nodeNames.forEach((nodeName, idx) => {
      const x = idx === 0 ? 150 : 530;
      const y = 30;
      controllers.push({ name: nodeName, x, y });

      const nodeInfo = model.nodes[nodeName];
      const hasFailedPSU = nodeInfo.sensors && nodeInfo.sensors.some(s => s.label.includes("PSU") && s.status === 'failed');
      const borderStroke = hasFailedPSU ? '#ef4444' : '#374151';
      const borderGlow = hasFailedPSU ? 'filter="drop-shadow(0 0 4px #ef4444)"' : '';

      // Controller Chassis Box
      svgHtml += `
        <g class="topo-node" onclick="window.asupTopology.showControllerDetails('${nodeName}')">
          <rect x="${x}" y="${y}" width="${controllerWidth}" height="${controllerHeight}" rx="6" 
                fill="url(#controller-grad)" stroke="${borderStroke}" stroke-width="2" ${borderGlow} />
          <!-- Chassis ears -->
          <rect x="${x - 10}" y="${y + 10}" width="10" height="80" rx="2" fill="#4b5563" />
          <rect x="${x + controllerWidth}" y="${y + 10}" width="10" height="80" rx="2" fill="#4b5563" />
          
          <!-- Title text -->
          <text x="${x + 15}" y="${y + 25}" fill="#f3f4f6" font-family="Outfit" font-size="12" font-weight="700">${nodeName.toUpperCase()}</text>
          <text x="${x + 15}" y="${y + 40}" fill="#9ca3af" font-family="Outfit" font-size="10">Model: ${nodeInfo.model || 'FAS8200'}</text>
          <text x="${x + 15}" y="${y + 55}" fill="#9ca3af" font-family="Outfit" font-size="9">ID: ${nodeInfo.systemId || '-'}</text>
          <text x="${x + 15}" y="${y + 70}" fill="#9ca3af" font-family="Outfit" font-size="9">MEM: ${nodeInfo.memoryGb || '64'} GB</text>

          <!-- Ports layout mock on backend of controller -->
          <!-- SAS Port 0a -->
          <rect x="${x + 180}" y="${y + 35}" width="24" height="18" rx="2" fill="#1f2937" stroke="#10b981" stroke-width="1.5" id="port-rect-${nodeName}-0a" />
          <text x="${x + 192}" y="${y + 47}" fill="#f3f4f6" font-family="JetBrains Mono" font-size="8" font-weight="700" text-anchor="middle">0a</text>
          
          <!-- SAS Port 0b -->
          <rect x="${x + 215}" y="${y + 35}" width="24" height="18" rx="2" fill="#1f2937" stroke="#10b981" stroke-width="1.5" id="port-rect-${nodeName}-0b" />
          <text x="${x + 227}" y="${y + 47}" fill="#f3f4f6" font-family="JetBrains Mono" font-size="8" font-weight="700" text-anchor="middle">0b</text>

          <!-- Ethernet Port e0c -->
          <rect x="${x + 250}" y="${y + 35}" width="24" height="18" rx="2" fill="#1f2937" stroke="#10b981" stroke-width="1" />
          <text x="${x + 262}" y="${y + 47}" fill="#9ca3af" font-family="JetBrains Mono" font-size="7" text-anchor="middle">e0c</text>

          <!-- Ethernet Port e0d -->
          <rect x="${x + 280}" y="${y + 35}" width="24" height="18" rx="2" fill="#1f2937" stroke="${nodeName === 'node1' ? '#ef4444' : '#10b981'}" stroke-width="${nodeName === 'node1' ? '1.5' : '1'}" />
          <text x="${x + 292}" y="${y + 47}" fill="${nodeName === 'node1' ? '#ef4444' : '#9ca3af'}" font-family="JetBrains Mono" font-size="7" text-anchor="middle">e0d</text>
          
          <!-- Power Supply Status indicators -->
          <circle cx="${x + controllerWidth - 25}" cy="${y + 80}" r="5" fill="${hasFailedPSU ? '#ef4444' : '#10b981'}" />
          <circle cx="${x + controllerWidth - 12}" cy="${y + 80}" r="5" fill="#10b981" />
          <text x="${x + controllerWidth - 38}" y="${y + 83}" fill="#9ca3af" font-family="Outfit" font-size="8" text-anchor="end">PSUs</text>
        </g>
      `;
    });

    // --- DRAW SHELVES & CABLING ---
    const shelfWidth = 700;
    const shelfHeight = 110;
    const shelfX = 150;

    model.shelves.forEach((shelf, sIdx) => {
      const shelfY = 200 + (sIdx * 170);
      
      const hasFirmwareWarning = shelf.firmware === '0098' || shelf.paths.includes("Mismatch");
      const borderStroke = hasFirmwareWarning ? '#f59e0b' : '#374151';
      const borderGlow = hasFirmwareWarning ? 'filter="drop-shadow(0 0 3px #f59e0b)"' : '';

      svgHtml += `
        <!-- Shelf ${shelf.id} Chassis -->
        <g class="topo-node" onclick="window.asupTopology.showShelfDetails(${shelf.id})">
          <rect x="${shelfX}" y="${shelfY}" width="${shelfWidth}" height="${shelfHeight}" rx="8" 
                fill="url(#shelf-grad)" stroke="${borderStroke}" stroke-width="2" ${borderGlow} />
          <!-- Front grill handles -->
          <rect x="${shelfX - 8}" y="${shelfY + 15}" width="8" height="80" rx="2" fill="#4b5563" />
          <rect x="${shelfX + shelfWidth}" y="${shelfY + 15}" width="8" height="80" rx="2" fill="#4b5563" />

          <!-- Shelf Details overlay -->
          <text x="${shelfX + 15}" y="${shelfY + 22}" fill="#f3f4f6" font-family="Outfit" font-size="11" font-weight="700">SHELF ${shelf.id} (${shelf.model})</text>
          <text x="${shelfX + 15}" y="${shelfY + 36}" fill="#9ca3af" font-family="Outfit" font-size="9">IOM FW: ${shelf.firmware}</text>
          <text x="${shelfX + 15}" y="${shelfY + 48}" fill="#9ca3af" font-family="Outfit" font-size="9">Temp: ${shelf.temp} C</text>
          <text x="${shelfX + 15}" y="${shelfY + 60}" fill="#9ca3af" font-family="Outfit" font-size="9">Paths: MPHA</text>

          <!-- Drawer Power supplies -->
          <rect x="${shelfX + 15}" y="${shelfY + 75}" width="16" height="12" rx="1" fill="#111827" stroke="#10b981" />
          <rect x="${shelfX + 35}" y="${shelfY + 75}" width="16" height="12" rx="1" fill="#111827" stroke="#10b981" />
          <text x="${shelfX + 58}" y="${shelfY + 84}" fill="#9ca3af" font-family="Outfit" font-size="8">PSUs</text>
          
          <!-- IOM Modules Backend details representation -->
          <g transform="translate(${shelfX + 620}, ${shelfY + 12})">
            <!-- IOM A -->
            <rect x="0" y="0" width="30" height="35" rx="2" fill="#1e293b" stroke="#374151" />
            <text x="15" y="12" fill="#e2e8f0" font-family="Outfit" font-size="8" font-weight="700" text-anchor="middle">IOM A</text>
            <rect x="5" y="18" width="20" height="12" rx="1" fill="#0f172a" stroke="#10b981" stroke-width="1.5" id="iom-a-port-${shelf.id}" />
            <text x="15" y="27" fill="#10b981" font-family="JetBrains Mono" font-size="7" font-weight="700" text-anchor="middle">IN</text>
            
            <!-- IOM B -->
            <rect x="38" y="0" width="30" height="35" rx="2" fill="#1e293b" stroke="#374151" />
            <text x="53" y="12" fill="#e2e8f0" font-family="Outfit" font-size="8" font-weight="700" text-anchor="middle">IOM B</text>
            <rect x="43" y="18" width="20" height="12" rx="1" fill="#0f172a" stroke="${shelf.id === '2' ? '#f59e0b' : '#10b981'}" stroke-width="1.5" id="iom-b-port-${shelf.id}" />
            <text x="53" y="27" fill="${shelf.id === '2' ? '#f59e0b' : '#10b981'}" font-family="JetBrains Mono" font-size="7" font-weight="700" text-anchor="middle">IN</text>
          </g>
        </g>
      `;

      // --- DRAW DISKS INSIDE THIS SHELF ---
      // We will render a 24-slot horizontal disk layout
      const diskContainerX = shelfX + 110;
      const diskContainerY = shelfY + 12;
      const diskWidth = 18;
      const diskHeight = 85;
      const gap = 3;

      for (let slot = 0; slot < 24; slot++) {
        const dx = diskContainerX + (slot * (diskWidth + gap));
        const dy = diskContainerY;
        
        // Find disk in parsed model
        const diskId = `${shelf.id}.1.${slot}`; // sysconfig -r lists aggregate disks
        const spareDiskId = `${shelf.id}.${shelf.id === '2' ? '2' : '1'}.${slot}`; // spare layout matching
        
        const disk = model.disks.find(d => d.id === diskId || d.id === spareDiskId || (d.shelf === shelf.id && parseInt(d.slot, 10) === slot));
        
        let strokeColor = '#475569';
        let fillColor = 'url(#disk-healthy-grad)';
        let statusText = "Active Data Disk";
        let isFailed = false;

        if (disk) {
          if (disk.status === 'broken' || disk.state === 'failed') {
            fillColor = 'url(#disk-failed-grad)';
            strokeColor = '#ef4444';
            statusText = "FAILED DRIVE";
            isFailed = true;
          } else if (disk.state === 'spare') {
            fillColor = 'url(#disk-spare-grad)';
            strokeColor = '#3b82f6';
            statusText = "Spare Disk";
          }
        } else {
          // If no disk parsed, show as empty slot or healthy data disk mock
          fillColor = '#1e293b';
          strokeColor = '#334155';
          statusText = "Empty Slot";
        }

        const animateTag = isFailed ? '<animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite" />' : '';

        svgHtml += `
          <g class="topo-node" onclick="event.stopPropagation(); window.asupTopology.showDiskDetails('${disk ? disk.id : shelf.id + '.1.' + slot}')">
            <rect x="${dx}" y="${dy}" width="${diskWidth}" height="${diskHeight}" rx="2" 
                  fill="${fillColor}" stroke="${strokeColor}" stroke-width="1" />
            <!-- Disk pull tab handle -->
            <rect x="${dx + 4}" y="${dy + diskHeight - 8}" width="10" height="6" rx="1" fill="#475569" />
            <!-- LED indicator -->
            <circle cx="${dx + 9}" cy="${dy + 6}" r="2" fill="${isFailed ? '#ef4444' : (disk ? '#10b981' : '#334155')}" />
            ${animateTag}
          </g>
        `;
      }

      // --- DRAW SAS CABLING (DAISY CHAIN) ---
      // Draw cabling connection lines from Controller to Shelves
      // Shelf 1 Loop cabling
      if (sIdx === 0) {
        // Controller 1 Port 0a (150 + 180 = 330, 30 + 35 = 65) -> Shelf 1 IOM A (150 + 620 + 15 = 785, 200 + 12 + 18 = 230)
        svgHtml += `
          <!-- Path C1-0a to S1-IOMA -->
          <path d="M 342 65 C 342 120, 775 120, 775 230" fill="none" stroke="#10b981" stroke-width="2.5" class="topo-cable" />
          
          <!-- Path C2-0a to S1-IOMB -->
          <!-- Controller 2 Port 0a (530 + 180 = 710, 65) -> Shelf 1 IOM B (150 + 620 + 38 + 15 = 823, 230) -->
          <path d="M 722 65 C 722 120, 813 120, 813 230" fill="none" stroke="#10b981" stroke-width="2.5" class="topo-cable" />
        `;
      }

      // Shelf 2 Loop cabling (Outdated/mismatch warning)
      if (sIdx === 1) {
        // Controller 1 Port 0b (367, 65) -> Shelf 2 IOM A (775, 400)
        svgHtml += `
          <!-- Path C1-0b to S2-IOMA -->
          <path d="M 367 65 C 367 180, 765 180, 775 400" fill="none" stroke="#10b981" stroke-width="2.5" class="topo-cable" />
          
          <!-- Path C2-0b to S2-IOMB (Degraded/Mismatch cable) -->
          <!-- Controller 2 Port 0b (747, 65) -> Shelf 2 IOM B (813, 400) -->
          <path d="M 747 65 C 747 180, 805 180, 813 400" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="5,5" class="topo-cable down" />
        `;
      }
    });

    svgHtml += `</svg>`;
    container.innerHTML = svgHtml;

    // Cache model for callbacks
    this.currentModel = model;
  },

  /**
   * Generates the logical cluster network LIF diagram SVG
   */
  drawLogical(model, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Dimensions
    const width = 1000;
    const height = 500;

    let svgHtml = `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background-color: transparent;">
        <defs>
          <linearGradient id="logical-node-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1f2937" />
            <stop offset="100%" stop-color="#111827" />
          </linearGradient>
        </defs>
    `;

    // Draw Central Cluster Switch cloud representation
    svgHtml += `
      <!-- Switch cloud -->
      <g transform="translate(500, 240)">
        <ellipse cx="0" cy="0" rx="140" ry="40" fill="#1e293b" stroke="#374151" stroke-width="2" />
        <text x="0" y="5" fill="#e2e8f0" font-family="Outfit" font-size="12" font-weight="700" text-anchor="middle">LACP CLUSTER SWITCH STACK</text>
        <text x="0" y="20" fill="#6b7280" font-family="Outfit" font-size="9" text-anchor="middle">VLAN 10, VLAN 20, MTU 9000</text>
      </g>
    `;

    // Draw Controller nodes
    const nodeNames = Object.keys(model.nodes);
    const nodeY = 80;

    nodeNames.forEach((nodeName, idx) => {
      const nodeX = idx === 0 ? 250 : 750;
      
      svgHtml += `
        <!-- Node Box -->
        <g class="topo-node" onclick="window.asupTopology.showControllerDetails('${nodeName}')">
          <rect x="${nodeX - 100}" y="${nodeY}" width="200" height="70" rx="6" fill="url(#logical-node-grad)" stroke="#374151" stroke-width="2" />
          <text x="${nodeX}" y="${nodeY + 28}" fill="#f3f4f6" font-family="Outfit" font-size="14" font-weight="700" text-anchor="middle">${nodeName.toUpperCase()}</text>
          <text x="${nodeX}" y="${nodeY + 45}" fill="#9ca3af" font-family="Outfit" font-size="9" text-anchor="middle">HA Interconnect Status: UP</text>
        </g>
      `;

      // Draw LIFs and Port squares below
      const nodeLifs = model.lifs.filter(l => l.node === nodeName);
      const nodePorts = model.ports.filter(p => p.node === nodeName && p.type !== 'Management');

      // Draw Physical Ports (Squares)
      const portY = 220;
      nodePorts.forEach((port, pIdx) => {
        const portX = (nodeX - 60) + (pIdx * 45);
        const isDown = port.status === 'down';
        const portColor = isDown ? '#ef4444' : '#10b981';

        svgHtml += `
          <g class="topo-node" onclick="event.stopPropagation(); window.asupTopology.showPortDetails('${nodeName}', '${port.name}')">
            <rect x="${portX - 18}" y="${portY - 12}" width="36" height="24" rx="3" fill="#111827" stroke="${portColor}" stroke-width="2" />
            <text x="${portX}" y="${portY + 4}" fill="#f3f4f6" font-family="JetBrains Mono" font-size="8" font-weight="700" text-anchor="middle">${port.name}</text>
            
            <!-- Connection to Cluster Switch -->
            <path d="M ${portX} ${portY + 12} L ${idx === 0 ? 400 : 600} 220" fill="none" stroke="${portColor}" stroke-width="1.5" stroke-dasharray="${isDown ? 'none' : '3,3'}" />
          </g>
        `;

        // Draw Logical Interfaces (LIFs) mapped to this port (Circles above port)
        const portLifs = nodeLifs.filter(l => l.port === port.name);
        portLifs.forEach((lif, lIdx) => {
          const lifX = portX;
          const lifY = 160 - (lIdx * 30);
          
          let lifColor = '#06b6d4'; // mgmt
          if (lif.operStatus === 'down') lifColor = '#ef4444';
          else if (lif.name.includes("nfs")) lifColor = '#a855f7';
          else if (lif.name.includes("cifs")) lifColor = '#3b82f6';
          else if (lif.name.includes("iscsi")) lifColor = '#f97316';

          svgHtml += `
            <g class="topo-node" onclick="event.stopPropagation(); window.asupTopology.showLifDetails('${lif.name}')">
              <circle cx="${lifX}" cy="${lifY}" r="11" fill="#111827" stroke="${lifColor}" stroke-width="2" />
              <text x="${lifX}" y="${lifY + 3}" fill="#f3f4f6" font-family="Outfit" font-size="8" font-weight="700" text-anchor="middle">L</text>
              <text x="${lifX - 15}" y="${lifY + 2}" fill="#9ca3af" font-family="Outfit" font-size="7" text-anchor="end">${lif.name}</text>
              
              <!-- Cable connecting LIF to Port -->
              <line x1="${lifX}" y1="${lifY + 11}" x2="${portX}" y2="${portY - 12}" stroke="#4b5563" stroke-width="1" />
            </g>
          `;
        });
      });
    });

    // Draw HA Interconnect Link Cable between controllers
    svgHtml += `
      <!-- HA Interconnect -->
      <path d="M 350 115 L 650 115" fill="none" stroke="#06b6d4" stroke-width="3" stroke-dasharray="10, 5" class="topo-cable" />
      <text x="500" y="105" fill="#06b6d4" font-family="Outfit" font-size="9" font-weight="700" text-anchor="middle">HA CLUSTER INTERCONNECT (100GbE)</text>
    `;

    svgHtml += `</svg>`;
    container.innerHTML = svgHtml;
  },

  // Interactive Detail Drawer Helpers
  showControllerDetails(nodeName) {
    const node = this.currentModel.nodes[nodeName];
    const detailsDiv = document.getElementById('topology-item-details');
    const contentDiv = document.getElementById('topo-detail-content');
    const titleDiv = document.getElementById('topo-detail-title');

    titleDiv.innerText = `Controller Node: ${nodeName.toUpperCase()}`;
    
    let sensorsHtml = '';
    if (node.sensors) {
      sensorsHtml = '<h5>Sensors Status</h5><ul>';
      node.sensors.forEach(s => {
        const color = s.status === 'failed' ? 'text-danger' : 'text-success';
        sensorsHtml += `<li>${s.label}: <strong class="${color}">${s.value}</strong></li>`;
      });
      sensorsHtml += '</ul>';
    }

    contentDiv.innerHTML = `
      <div class="info-grid">
        <div class="info-item"><span class="info-label">System Serial</span><span class="info-value font-mono">${node.serialNumber || '-'}</span></div>
        <div class="info-item"><span class="info-label">System ID</span><span class="info-value font-mono">${node.systemId || '-'}</span></div>
        <div class="info-item"><span class="info-label">Processor</span><span class="info-value">${node.cpus} cores (Xeon E5)</span></div>
        <div class="info-item"><span class="info-label">Memory</span><span class="info-value">${node.memoryGb} GB ECC</span></div>
      </div>
      <br/>
      ${sensorsHtml}
    `;

    detailsDiv.style.display = 'block';
  },

  showShelfDetails(shelfId) {
    const shelf = this.currentModel.shelves.find(s => s.id == shelfId);
    const detailsDiv = document.getElementById('topology-item-details');
    const contentDiv = document.getElementById('topo-detail-content');
    const titleDiv = document.getElementById('topo-detail-title');

    titleDiv.innerText = `Disk Shelf: ID ${shelfId} (${shelf.model})`;

    const fwColor = shelf.firmware === '0098' ? 'text-warning' : 'text-success';

    contentDiv.innerHTML = `
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Shelf Model</span><span class="info-value">${shelf.model}</span></div>
        <div class="info-item"><span class="info-label">Serial Number</span><span class="info-value font-mono">${shelf.serial}</span></div>
        <div class="info-item"><span class="info-label">IOM Firmware</span><span class="info-value ${fwColor} font-mono">${shelf.firmware}</span></div>
        <div class="info-item"><span class="info-label">SAS Link Speed</span><span class="info-value">6.0 Gbps (SATA/SAS)</span></div>
        <div class="info-item"><span class="info-label">Cabling Redundancy</span><span class="info-value">${shelfId === '2' ? '<strong class="text-warning">Degraded (Single Path)</strong>' : 'MPHA (Dual Path)'}</span></div>
        <div class="info-item"><span class="info-label">Chassis Temperature</span><span class="info-value">${shelf.temp} C</span></div>
        <div class="info-item"><span class="info-label">Power supplies</span><span class="info-value text-success">${shelf.psuStatus}</span></div>
        <div class="info-item"><span class="info-label">Fans Status</span><span class="info-value text-success">${shelf.fanStatus}</span></div>
      </div>
    `;

    detailsDiv.style.display = 'block';
  },

  showDiskDetails(diskId) {
    const disk = this.currentModel.disks.find(d => d.id === diskId);
    const detailsDiv = document.getElementById('topology-item-details');
    const contentDiv = document.getElementById('topo-detail-content');
    const titleDiv = document.getElementById('topo-detail-title');

    if (!disk) {
      titleDiv.innerText = `Disk Slot: ${diskId}`;
      contentDiv.innerHTML = `<p class="text-muted">No physical disk detected in this slot (Empty).</p>`;
      detailsDiv.style.display = 'block';
      return;
    }

    titleDiv.innerText = `Disk Drive: ${disk.id}`;

    let statusPill = `<span class="table-status-pill healthy">Data Disk</span>`;
    if (disk.status === 'broken' || disk.state === 'failed') {
      statusPill = `<span class="table-status-pill critical">Failed</span>`;
    } else if (disk.state === 'spare') {
      statusPill = `<span class="table-status-pill info">Spare</span>`;
    }

    contentDiv.innerHTML = `
      <div style="margin-bottom:15px;">${statusPill}</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Disk Model</span><span class="info-value font-mono">${disk.model}</span></div>
        <div class="info-item"><span class="info-label">Serial Number</span><span class="info-value font-mono">${disk.serial}</span></div>
        <div class="info-item"><span class="info-label">Interface Type</span><span class="info-value">${disk.type}</span></div>
        <div class="info-item"><span class="info-label">Capacity</span><span class="info-value font-mono">${disk.capacityStr}</span></div>
        <div class="info-item"><span class="info-label">Firmware</span><span class="info-value font-mono">${disk.firmware}</span></div>
        <div class="info-item"><span class="info-label">Aggregate Assigned</span><span class="info-value font-mono">${disk.aggregate}</span></div>
        <div class="info-item"><span class="info-label">Shelf / Slot Position</span><span class="info-value">Shelf ${disk.shelf}, Slot ${disk.slot}</span></div>
      </div>
    `;

    detailsDiv.style.display = 'block';
  },

  showPortDetails(node, portName) {
    const port = this.currentModel.ports.find(p => p.node === node && p.name === portName);
    const detailsDiv = document.getElementById('topology-item-details');
    const contentDiv = document.getElementById('topo-detail-content');
    const titleDiv = document.getElementById('topo-detail-title');

    titleDiv.innerText = `Physical Interface: ${node.toUpperCase()}:${portName}`;

    let statusPill = port.status === 'up' 
      ? `<span class="table-status-pill healthy">UP</span>` 
      : `<span class="table-status-pill critical">LINK DOWN</span>`;

    contentDiv.innerHTML = `
      <div style="margin-bottom:15px;">${statusPill}</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Port Speed</span><span class="info-value font-mono">${port.speed ? port.speed / 1000 + ' Gbps' : 'Auto'}</span></div>
        <div class="info-item"><span class="info-label">Duplex</span><span class="info-value font-mono">${port.duplex}</span></div>
        <div class="info-item"><span class="info-label">MTU</span><span class="info-value font-mono">${port.mtu}</span></div>
        <div class="info-item"><span class="info-label">Role / Type</span><span class="info-value">${port.type} Port</span></div>
      </div>
    `;

    detailsDiv.style.display = 'block';
  },

  showLifDetails(lifName) {
    const lif = this.currentModel.lifs.find(l => l.name === lifName);
    const detailsDiv = document.getElementById('topology-item-details');
    const contentDiv = document.getElementById('topo-detail-content');
    const titleDiv = document.getElementById('topo-detail-title');

    titleDiv.innerText = `Logical Interface (LIF): ${lif.name}`;

    let statusPill = lif.operStatus === 'up' 
      ? `<span class="table-status-pill healthy">ONLINE</span>` 
      : `<span class="table-status-pill critical">OFFLINE</span>`;

    contentDiv.innerHTML = `
      <div style="margin-bottom:15px;">${statusPill}</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">IP Address</span><span class="info-value font-mono">${lif.ip}</span></div>
        <div class="info-item"><span class="info-label">Operational Port</span><span class="info-value font-mono">${lif.node}:${lif.port}</span></div>
        <div class="info-item"><span class="info-label">Home Port</span><span class="info-value font-mono">${lif.node}:${lif.homePort}</span></div>
        <div class="info-item"><span class="info-label">Is on Home Port?</span><span class="info-value">${lif.isHome ? 'Yes' : '<strong class="text-warning">No (Migrated)</strong>'}</span></div>
        <div class="info-item"><span class="info-label">Failover Policy</span><span class="info-value font-mono">${lif.failoverPolicy}</span></div>
        <div class="info-item"><span class="info-label">Routing Firewall Policy</span><span class="info-value font-mono">${lif.firewallPolicy}</span></div>
      </div>
    `;

    detailsDiv.style.display = 'block';
  }
};
