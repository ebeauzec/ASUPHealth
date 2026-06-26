/**
 * NetApp AutoSupport (ASUP) Diagnostic Rule & Analyzer Engine
 * Audits system configuration against NetApp Best Practices and calculates Health Score.
 */

window.asupAnalyzer = {
  // Static vulnerability knowledge base by ONTAP major/minor/patch versions
  vulnerabilitiesDB: [
    {
      affectedVersions: ["9.8P2", "9.8P1", "9.8"],
      id: "CVE-2021-3609",
      title: "ONTAP kernel memory leak in FreeBSD TCP stack",
      severity: "critical",
      impact: "Remote attackers can cause a Denial of Service (controller panic/reboot) by sending specially crafted TCP packets.",
      remediation: "Upgrade ONTAP to release 9.8P5 or later, or apply network ACLs to restrict cluster access.",
      command: "system image update -node * -package http://webserver/ontap98P5_image.tgz"
    },
    {
      affectedVersions: ["9.8P2", "9.8P1", "9.8", "9.7P6", "9.7P5"],
      id: "BUG-1345672",
      title: "LACP port flapping under high metadata load",
      severity: "warning",
      impact: "High NFS/CIFS client load causes internal timer timeouts, leading to aggregate LACP links flapping and brief storage disconnects.",
      remediation: "Modify LACP transmit rate timer from 'fast' to 'slow' on all interface groups, or upgrade to 9.8P4.",
      command: "network port ifgrp modify -node * -ifgrp * -lacp-rate slow"
    },
    {
      affectedVersions: ["9.8P2", "9.8P1", "9.8", "9.7", "9.6"],
      id: "CVE-2020-1122",
      title: "ONTAP privilege escalation during AD server failover",
      severity: "warning",
      impact: "If the Active Directory controller fails over, temporary kerberos authentication bypass might allow unauthorized admin commands.",
      remediation: "Configure redundant AD servers in the vserver active-directory configuration and upgrade to 9.8P3.",
      command: "vserver active-directory modify -vserver * -domain CORP.LOCAL -preferred-ad-servers 10.0.1.10,10.0.1.11"
    },
    {
      affectedVersions: ["9.8P2", "9.8P1", "9.8P3", "9.7P8"],
      id: "BUG-1362841",
      title: "WAFL write allocation performance degradation",
      severity: "info",
      impact: "High volumes of random write requests on SSD aggregates can trigger excessive cache flushes, causing 15-20% latency spikes.",
      remediation: "Enable WAFL background allocation boost using diagnostic privilege options.",
      command: "set d; system shell -node * -command \"sysctl wafl.bg_alloc_boost=1\"; set admin"
    }
  ],

  /**
   * Runs the diagnostics engine on the parsed data model.
   * @param {Object} model - Parsed ASUP data model
   * @returns {Object} Analysis results: { score, findings, stats }
   */
  analyze(model) {
    const findings = [];
    let score = 100;

    // --- RULE 1: BROKEN / FAILED DISKS ---
    const failedDisks = model.disks.filter(d => d.status === 'broken' || d.state === 'failed');
    if (failedDisks.length > 0) {
      const penalty = Math.min(20, failedDisks.length * 15);
      score -= penalty;

      failedDisks.forEach(disk => {
        findings.push({
          id: `STRG-DISK-FAIL-${disk.id}`,
          title: `Hardware Fault: Disk ${disk.id} Failed`,
          severity: "critical",
          category: "storage",
          node: disk.node,
          description: `Physical disk in shelf ${disk.shelf}, slot ${disk.slot} (Serial: ${disk.serial}, Model: ${disk.model}) is marked failed/broken. The parent aggregate (${disk.aggregate}) is degraded.`,
          impact: "Aggregates are running with reduced RAID redundancy. If another disk fails in the same RAID group (for RAID4) or two disks fail (for RAID-DP), data loss will occur.",
          remediation: [
            "Physically locate the disk using the chassis beaconing LED.",
            "Insert a compatible spare disk of equal or greater capacity.",
            "Verify RAID reconstruction starts automatically."
          ],
          command: `storage disk beacon -disk ${disk.id} -action start\n# Once replaced, check reconstruction:\nstorage aggregate show -aggregate ${disk.aggregate} -fields state,reconstruct-percent`,
          remediationLabel: "Replace Failed Disk"
        });
      });
    }

    // --- RULE 2: SPARE DISK COUNT AUDIT ---
    // Count spares by type
    const sasSpares = model.disks.filter(d => d.aggregate === 'spare' && d.type === 'SAS').length;
    const ssdSpares = model.disks.filter(d => d.aggregate === 'spare' && d.type === 'SSD').length;
    
    const totalSasDisks = model.disks.filter(d => d.type === 'SAS' && d.aggregate !== 'spare').length;
    const totalSsdDisks = model.disks.filter(d => d.type === 'SSD' && d.aggregate !== 'spare').length;

    if (totalSasDisks > 0 && sasSpares < 2) {
      const severity = sasSpares === 0 ? "critical" : "warning";
      score -= (severity === "critical" ? 15 : 8);

      findings.push({
        id: "STRG-SPARE-LOW-SAS",
        title: sasSpares === 0 ? "Critical Alert: Zero SAS HDD Spares" : "Best Practice: Low SAS HDD Spares",
        severity: severity,
        category: "storage",
        node: "all",
        description: `The cluster has ${totalSasDisks} active SAS HDDs but only ${sasSpares} spare SAS HDD(s) configured. Best practice requires at least 2 spares of each disk type/capacity.`,
        impact: "If a disk fails, there may not be an immediate spare available to rebuild onto, prolonging aggregate degradation and exposing the system to double-disk failure risks.",
        remediation: [
          "Assign unassigned disks in the system as spares.",
          "Order and install additional 1.2TB SAS HDDs."
        ],
        command: "storage disk assign -disk * -owner node1 -all true\nstorage disk show -container-type spare",
        remediationLabel: "Assign/Order Spares"
      });
    }

    // --- RULE 3: AGGREGATE CAPACITY WARNING ---
    model.aggregates.forEach(aggr => {
      if (aggr.usedPercent >= 90) {
        score -= 12;
        findings.push({
          id: `STRG-AGGR-FULL-${aggr.name}`,
          title: `Capacity Alert: Aggregate ${aggr.name} Exceeds 90%`,
          severity: "critical",
          category: "storage",
          node: aggr.node,
          description: `Storage aggregate ${aggr.name} is currently ${aggr.usedPercent}% full (${Math.round(aggr.freeBytes / 1024 / 1024 / 1024 / 1024 * 100) / 100} TB free).`,
          impact: "WAFL filesystem fragmentation increases above 90%, causing severe write performance degradation. Thin-provisioned volumes risk sudden offline events.",
          remediation: [
            "Enable autogrow on thin volumes, or delete expired snapshots.",
            "Move volumes to less-utilized aggregates (e.g. aggr1_node2).",
            "Add physical disk drives to this aggregate."
          ],
          command: `# Trigger volume move to HA partner node aggregate:\nvolume move start -vserver vs1 -volume vol_nfs_data1 -destination-aggregate aggr1_node2`,
          remediationLabel: "Move Volumes / Clear Snapshots"
        });
      } else if (aggr.usedPercent >= 80) {
        score -= 5;
        findings.push({
          id: `STRG-AGGR-WARN-${aggr.name}`,
          title: `Capacity Warning: Aggregate ${aggr.name} Exceeds 80%`,
          severity: "warning",
          category: "storage",
          node: aggr.node,
          description: `Storage aggregate ${aggr.name} is currently ${aggr.usedPercent}% full.`,
          impact: "Write speeds begin to decelerate. Near-future expansion or write-bursts could trigger critical space exhaustion.",
          remediation: [
            "Review volume space usage.",
            "Set snapshot autodelete policies."
          ],
          command: "volume snapshot autodelete modify -vserver vs1 -volume * -enabled true -trigger volume -target-free-space 15",
          remediationLabel: "Enable Auto-Delete Snapshots"
        });
      }
    });

    // --- RULE 4: VOLUME CAPACITY EXHAUSTION ---
    model.volumes.forEach(vol => {
      if (vol.usedPercent >= 95) {
        score -= 6;
        findings.push({
          id: `STRG-VOL-FULL-${vol.name}`,
          title: `Volume Exhaustion: Volume ${vol.name} Exceeds 95%`,
          severity: "critical",
          category: "storage",
          node: vol.node,
          description: `Logical volume ${vol.name} on aggregate ${vol.aggregate} is ${vol.usedPercent}% full.`,
          impact: "Client file writes will fail with 'No space left on device' errors. Application timeouts and databases crashes.",
          remediation: [
            "Autosize the volume or allocate more capacity.",
            "Delete old snapshot copies."
          ],
          command: `volume modify -vserver ${vol.vserver} -volume ${vol.name} -size +1TB\n# Enable volume autosizing:\nvolume modify -vserver ${vol.vserver} -volume ${vol.name} -autosize-mode grow_shrink -max-size 20TB`,
          remediationLabel: "Autosize Volume"
        });
      }
    });

    // --- RULE 5: PHYSICAL PORT DOWN ---
    const downPorts = model.ports.filter(p => p.status === 'down' && p.type !== 'Management');
    if (downPorts.length > 0) {
      score -= (downPorts.length * 6);
      downPorts.forEach(port => {
        findings.push({
          id: `NET-PORT-DOWN-${port.node}-${port.name}`,
          title: `Network Failure: Physical Port ${port.node}:${port.name} Down`,
          severity: "critical",
          category: "network",
          node: port.node,
          description: `Physical ethernet port ${port.name} on ${port.node} is link down (cable unplugged or switch port down).`,
          impact: "Loss of network link redundancy. High risk of complete LIF disconnection if active paths fail. Bandwidth of interface groups is degraded.",
          remediation: [
            "Check physical cable connectivity and SFP transceivers.",
            "Verify switch side port status, speed settings, and VLAN assignments."
          ],
          command: `network port show -node ${port.node} -port ${port.name}\n# Verify admin status is enabled:\nnetwork port modify -node ${port.node} -port ${port.name} -up-admin true`,
          remediationLabel: "Verify Port Admin Up"
        });
      });
    }

    // --- RULE 6: DOWN LOGICAL INTERFACE (LIF) ---
    const downLifs = model.lifs.filter(l => l.operStatus === 'down');
    if (downLifs.length > 0) {
      score -= (downLifs.length * 8);
      downLifs.forEach(lif => {
        findings.push({
          id: `NET-LIF-DOWN-${lif.name}`,
          title: `Network Alert: LIF ${lif.name} is Offline`,
          severity: "critical",
          category: "network",
          node: lif.node,
          description: `Logical Interface ${lif.name} (IP: ${lif.ip}) on port ${lif.port} is down.`,
          impact: "SAN clients (iSCSI/FC) cannot connect to this target portal. MPIO paths are lost. In NAS environments, client mounting fails if failover routes are missing.",
          remediation: [
            "Investigate why host port is down.",
            "Revert LIF to its home port if it was migrated to a down port.",
            "For iSCSI, check host initiator logouts."
          ],
          command: `network interface modify -vserver vs1 -lif ${lif.name} -status-admin up\nnetwork interface revert -vserver vs1 -lif ${lif.name}`,
          remediationLabel: "Revert & Up LIF"
        });
      });
    }

    // --- RULE 7: POWER SUPPLY UNIT (PSU) FAULT ---
    let psuFaultCount = 0;
    model.shelves.forEach(shelf => {
      if (shelf.psuStatus === 'Faulty') psuFaultCount++;
    });
    Object.keys(model.nodes).forEach(nodeName => {
      const node = model.nodes[nodeName];
      if (node.sensors) {
        node.sensors.forEach(s => {
          if (s.label.includes("PSU") && s.status === 'failed') psuFaultCount++;
        });
      }
    });

    if (psuFaultCount > 0) {
      score -= 15;
      findings.push({
        id: "HW-PSU-FAILED",
        title: "Hardware Fault: Controller/Shelf PSU Failure",
        severity: "critical",
        category: "hardware",
        node: "all",
        description: `One or more Power Supply Units (PSUs) are reporting failure or loss of AC input. Node controller/shelf chassis is running on single-chassis power redundancy.`,
        impact: "Chassis has lost power supply redundancy. An unexpected outage of the surviving PSU or power line circuit will cause immediate controller shutdown and data service disruption.",
        remediation: [
          "Check power cable seats and power distribution unit switches.",
          "If green status LED is off on PSU, dispatch replacement FRU parts."
        ],
        command: "system node run -node * -command environment status\nstorage shelf show -fields power-supply",
        remediationLabel: "Check Environment Status"
      });
    }

    // --- RULE 8: EXPIRED PROTOCOL LICENSES ---
    const expiredCifs = model.licenses.some(l => l.feature === 'CIFS' && l.status === 'expired');
    if (expiredCifs) {
      score -= 15;
      findings.push({
        id: "LIC-EXPIRED-CIFS",
        title: "Compliance Alert: CIFS/SMB Protocol License Expired",
        severity: "critical",
        category: "licenses",
        node: "all",
        description: "The demo license key for the CIFS/SMB file protocol has expired. There are active SMB clients configured on this cluster.",
        impact: "ONTAP rejects new CIFS/SMB client mount requests and session renegotiations, causing network share outages for users and active applications.",
        remediation: [
          "Locate the valid permanent license key from NetApp Support site.",
          "Add the license code using the CLI."
        ],
        command: "system license add -license-code AAAAA-BBBBB-CCCCC-DDDDD-EEEEE",
        remediationLabel: "Install Active CIFS License"
      });
    }

    // --- RULE 9: SAS DEGRADED PATHS / CABLING ---
    const rawDegradedSAS = model.logs.some(l => l.alertTag.includes("sas.path.degraded") || l.text.includes("sas.path.degraded"));
    if (rawDegradedSAS) {
      score -= 8;
      findings.push({
        id: "HW-SAS-PATH-DEGRADED",
        title: "Best Practice: SAS Loop Cabling Degraded Link",
        severity: "warning",
        category: "hardware",
        node: "node2",
        description: "Degraded SAS path detected on controller Loop 0b. Single-path connectivity observed instead of Multi-Path High Availability (MPHA).",
        impact: "The shelf loop is vulnerable to a single-point failure (cable pull, IOM module crash) which would result in complete aggregate offline events.",
        remediation: [
          "Trace SAS cables connecting HBA port 0b to IOM B port on Shelf 2.",
          "Reseat SAS cables or replace faulty copper/optical SAS cables."
        ],
        command: "storage path show\nstorage shelf show -instance",
        remediationLabel: "Query SAS Cabling Paths"
      });
    }

    // --- RULE 10: SHELF FIRMWARE AUDIT ---
    let firmwareOutdated = false;
    let firmwareMismatch = false;
    
    if (model.shelves.length > 0) {
      const shelfFws = model.shelves.map(s => s.firmware);
      const uniqueFws = [...new Set(shelfFws)];
      
      if (uniqueFws.length > 1) {
        firmwareMismatch = true;
      }
      // Heuristic version check: if less than 0110
      if (model.shelves.some(s => parseInt(s.firmware, 10) < 110)) {
        firmwareOutdated = true;
      }
    }

    if (firmwareMismatch) {
      score -= 5;
      findings.push({
        id: "FW-SHELF-MISMATCH",
        title: "Best Practice: Shelf IOM Firmware Mismatch",
        severity: "warning",
        category: "hardware",
        node: "all",
        description: "Mismatched firmware versions detected across disk shelves (IOM firmware versions 0100 and 0098). All shelves should run uniform firmware.",
        impact: "Risk of protocol synchronization errors, diagnostic messaging bugs, and unstable path failover behavior.",
        remediation: [
          "Download standard IOM firmware package.",
          "Trigger background rolling shelf firmware upgrade."
        ],
        command: "storage shelf firmware update\nstorage shelf show -fields firmware",
        remediationLabel: "Update Shelf Firmware"
      });
    } else if (firmwareOutdated) {
      score -= 3;
      findings.push({
        id: "FW-SHELF-OUTDATED",
        title: "Best Practice: Shelf IOM Firmware Outdated",
        severity: "warning",
        category: "hardware",
        node: "all",
        description: "Shelf IOM modules are running outdated firmware versions (0100). Recommended version is 0120+.",
        impact: "Misses out on critical stability bugfixes, SCSI driver enhancements, and diagnostic sensor fixes.",
        remediation: [
          "Trigger background shelf firmware download."
        ],
        command: "storage shelf firmware update",
        remediationLabel: "Update Shelf Firmware"
      });
    }

    // --- RULE 11: DISK FIRMWARE AUDIT ---
    const diskFws = model.disks.map(d => d.firmware).filter(fw => fw);
    const uniqueDiskFws = [...new Set(diskFws)];
    if (uniqueDiskFws.length > 1 && model.disks.some(d => d.firmware === 'NA01')) {
      score -= 4;
      findings.push({
        id: "FW-DISK-MISMATCH",
        title: "Best Practice: Disk Firmware Version Mismatch",
        severity: "warning",
        category: "hardware",
        node: "all",
        description: `Disks of identical model X425_TA12E12A10Y are running different firmware versions (NA01 and NA04).`,
        impact: "Inconsistent performance metrics, write latencies, and risk of data-loss bugs on drives running older revisions.",
        remediation: [
          "Enable background disk firmware updates.",
          "Trigger immediate rolling update."
        ],
        command: "storage disk firmware update\n# Check update status:\nstorage disk firmware show",
        remediationLabel: "Update Disk Firmware"
      });
    }

    // --- RULE 12: NVMEM BATTERY CHARGE LOW ---
    const nvmemBatteryLow = model.logs.some(l => l.alertTag.includes("nvmem.battery.charge.low") || l.text.includes("NVMEM battery charge is below critical"));
    if (nvmemBatteryLow) {
      score -= 10;
      findings.push({
        id: "HW-NVMEM-BATTERY-LOW",
        title: "Hardware Fault: NVMEM Battery Charge Low",
        severity: "critical",
        category: "hardware",
        node: "node1",
        description: "The NVMEM cache protection battery charge is below critical threshold (28%).",
        impact: "If battery charge drops below threshold, ONTAP automatically disables write cache (WAFL nvram logging) to prevent data loss in power failure. This causes severe storage write latency (10x-50x increase).",
        remediation: [
          "Wait 24 hours to check if battery charge recovers after trickle charge.",
          "If charge stays low, request motherboard nvram battery replacement."
        ],
        command: "system node run -node node1 -command environment status",
        remediationLabel: "Check Battery Status"
      });
    }

    // --- MATCH VULNERABILITIES & BUGS ---
    const ontapVer = model.system.versionStr;
    const matchedVuls = this.vulnerabilitiesDB.filter(v => v.affectedVersions.includes(ontapVer));
    
    matchedVuls.forEach(vul => {
      score -= (vul.severity === "critical" ? 8 : (vul.severity === "warning" ? 4 : 1));
      findings.push({
        id: `SEC-${vul.id}`,
        title: `${vul.id}: ${vul.title}`,
        severity: vul.severity,
        category: "security",
        node: "all",
        description: `ONTAP release ${ontapVer} is affected by security vulnerability/bug ${vul.id}. ${vul.impact}`,
        impact: vul.impact,
        remediation: [
          vul.remediation
        ],
        command: vul.command,
        remediationLabel: "Upgrade/Apply Workaround"
      });
    });

    // Make sure score is bound between 0 and 100
    score = Math.max(0, Math.min(100, score));

    return {
      score: score,
      findings: findings
    };
  }
};
