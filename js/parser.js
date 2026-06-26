/**
 * NetApp AutoSupport (ASUP) Parsing Engine
 * Parses raw text sections and zip files into structured system models.
 */

window.asupParser = {
  /**
   * Main entry point to parse a raw text file or object containing text files.
   * @param {Object|string} data - Plain string containing all sections, or object mapping filenames to contents
   * @returns {Object} Structured parsed data model
   */
  parse(data) {
    let sections = {};

    if (typeof data === 'string') {
      // It's a single combined text file, try to split it into sections by headers
      sections = this.splitCombinedText(data);
    } else if (typeof data === 'object') {
      // It's a map of file names to content (e.g., from ZIP extraction)
      sections = data;
    }

    // Normalizing keys to standard sections
    const getSectionContent = (possibleKeys) => {
      for (let key of possibleKeys) {
        // Try exact match or match containing the key
        const foundKey = Object.keys(sections).find(k => 
          k.toLowerCase() === key.toLowerCase() || 
          k.toLowerCase().includes(key.toLowerCase())
        );
        if (foundKey && sections[foundKey]) {
          return sections[foundKey];
        }
      }
      return "";
    };

    const rawVersion = getSectionContent(['version', 'sysconfig-v']);
    const rawSysconfigA = getSectionContent(['sysconfig-a', 'sysconfig_a', 'sysconfig']);
    const rawSysconfigR = getSectionContent(['sysconfig-r', 'sysconfig_r', 'raid-status']);
    const rawDf = getSectionContent(['df', 'df-h', 'df_h', 'df_a']);
    const rawNetInterface = getSectionContent(['network-interface', 'network_interface', 'lif-show']);
    const rawIfconfig = getSectionContent(['ifconfig', 'ifconfig-a', 'ifconfig_a']);
    const rawStorageShelf = getSectionContent(['storage-shelf', 'storage_shelf', 'shelf-show', 'shelf']);
    const rawLicense = getSectionContent(['license', 'licenses', 'license-show']);
    const rawMessages = getSectionContent(['messages', 'syslog', 'messages.log']);

    // Call sub-parsers
    const model = {
      system: this.parseVersion(rawVersion),
      nodes: {},
      aggregates: [],
      volumes: [],
      lifs: [],
      ports: [],
      ifgrps: [],
      shelves: [],
      disks: [],
      licenses: [],
      protocols: {},
      logs: [],
      parsedSections: []
    };

    // Track which sections were parsed successfully
    if (rawVersion) model.parsedSections.push('version');
    if (rawSysconfigA) model.parsedSections.push('sysconfig-a');
    if (rawSysconfigR) model.parsedSections.push('sysconfig-r');
    if (rawDf) model.parsedSections.push('df');
    if (rawNetInterface) model.parsedSections.push('network-interface');
    if (rawIfconfig) model.parsedSections.push('ifconfig');
    if (rawStorageShelf) model.parsedSections.push('storage-shelf');
    if (rawLicense) model.parsedSections.push('license');
    if (rawMessages) model.parsedSections.push('messages');

    // Parse version and sysconfig details
    this.parseSysconfigA(rawSysconfigA, model);
    this.parseSysconfigR(rawSysconfigR, model);
    this.parseDf(rawDf, model);
    this.parseNetworkInterface(rawNetInterface, model);
    this.parseIfconfig(rawIfconfig, model);
    this.parseStorageShelf(rawStorageShelf, model);
    this.parseLicense(rawLicense, model);
    this.parseMessages(rawMessages, model);

    // post-process references & status
    this.postProcess(model);

    return model;
  },

  /**
   * Splits a single large text file containing multiple AutoSupport sections
   */
  splitCombinedText(text) {
    const sections = {};
    const lines = text.split(/\r?\n/);
    let currentSectionName = "body.txt";
    let currentContent = [];

    const sectionHeaderRegexes = [
      /^(?:={3,})\s+SECTION:\s+([A-Za-z0-9_\-\.]+)\s+(?:={3,})/i,
      /^(?:={3,})\s+([A-Za-z0-9_\-\.\s]+)\s+(?:={3,})/i,
      /^INPUT-FILE:\s*([A-Za-z0-9_\-\.]+)/i,
      /^FILE:\s*([A-Za-z0-9_\-\.]+)/i,
      /^\*\*\*\s+([A-Za-z0-9_\-\.]+)\s+\*\*\*/i
    ];

    for (let line of lines) {
      let isHeader = false;
      for (let regex of sectionHeaderRegexes) {
        const match = line.match(regex);
        if (match) {
          // Save previous section
          if (currentContent.length > 0) {
            sections[currentSectionName] = currentContent.join("\n");
          }
          currentSectionName = match[1].trim().replace(/\s+/g, '_');
          currentContent = [];
          isHeader = true;
          break;
        }
      }
      if (!isHeader) {
        currentContent.push(line);
      }
    }

    // Save the last section
    if (currentContent.length > 0) {
      sections[currentSectionName] = currentContent.join("\n");
    }

    // If no sections found, treat the whole file as sysconfig-a or messages based on content keywords
    if (Object.keys(sections).length <= 1 && sections["body.txt"]) {
      const content = sections["body.txt"];
      if (content.includes("System Model") || content.includes("System ID")) {
        sections["sysconfig-a"] = content;
      } else if (content.includes("kbytes") && content.includes("Mounted on")) {
        sections["df"] = content;
      } else if (content.includes("failed") || content.includes("warning") || content.includes("error")) {
        sections["messages"] = content;
      }
    }

    return sections;
  },

  /**
   * Parses ONTAP version section
   */
  parseVersion(str) {
    const info = {
      release: "Unknown ONTAP Release",
      versionStr: "Unknown",
      major: 9,
      minor: 0,
      patch: "P0",
      date: ""
    };
    if (!str) return info;

    const line = str.split("\n").find(l => l.includes("NetApp Release") || l.includes("ONTAP Release"));
    if (line) {
      info.release = line.trim();
      const verMatch = line.match(/Release\s+([0-9\.]+)(P[0-9]+|RC[0-9]+)?/i);
      if (verMatch) {
        info.versionStr = verMatch[1] + (verMatch[2] || "");
        const parts = verMatch[1].split(".");
        info.major = parseInt(parts[0], 10) || 9;
        info.minor = parseInt(parts[1], 10) || 0;
        info.patch = verMatch[2] || "";
      }
      const dateMatch = line.match(/:\s*(.*)$/);
      if (dateMatch) {
        info.date = dateMatch[1].trim();
      }
    }
    return info;
  },

  /**
   * Parses sysconfig -a details
   */
  parseSysconfigA(str, model) {
    if (!str) return;

    // Split by node sections
    const nodeBlocks = str.split(/Node:\s+([A-Za-z0-9_\-]+)/i);
    
    // Check if it's formatted without node headings (single controller or old system)
    if (nodeBlocks.length <= 1) {
      // Try parsing global values
      const lines = str.split("\n");
      let nodeName = "node1";
      model.nodes[nodeName] = {
        name: nodeName,
        systemId: "",
        serialNumber: "",
        model: "",
        memoryGb: 0,
        cpus: 16,
        slots: []
      };

      lines.forEach(line => {
        const sysIdMatch = line.match(/System ID:\s*([0-9]+)/i);
        if (sysIdMatch) model.nodes[nodeName].systemId = sysIdMatch[1];

        const serialMatch = line.match(/System Serial Number:\s*([0-9]+)/i);
        if (serialMatch) model.nodes[nodeName].serialNumber = serialMatch[1];

        const modelMatch = line.match(/System Model:\s*([A-Za-z0-9_\-]+)/i);
        if (modelMatch) {
          model.nodes[nodeName].model = modelMatch[1];
          model.system.model = modelMatch[1];
        }

        const memMatch = line.match(/Memory Size:\s*([0-9]+)\s*MB/i);
        if (memMatch) model.nodes[nodeName].memoryGb = Math.round(parseInt(memMatch[1], 10) / 1024);
      });
      return;
    }

    // HA pair split
    for (let i = 1; i < nodeBlocks.length; i += 2) {
      const nodeName = nodeBlocks[i].trim();
      const nodeContent = nodeBlocks[i + 1] || "";
      
      const nodeInfo = {
        name: nodeName,
        systemId: "",
        serialNumber: "",
        model: "",
        memoryGb: 0,
        cpus: 16,
        slots: []
      };

      const lines = nodeContent.split("\n");
      let currentSlot = null;

      lines.forEach(line => {
        const sysIdMatch = line.match(/System ID:\s*([0-9]+)/i);
        if (sysIdMatch) nodeInfo.systemId = sysIdMatch[1];

        const serialMatch = line.match(/Serial Number:\s*([0-9a-zA-Z]+)/i);
        if (serialMatch) nodeInfo.serialNumber = serialMatch[1];

        const modelMatch = line.match(/Model:\s*([A-Za-z0-9_\-]+)/i);
        if (modelMatch) {
          nodeInfo.model = modelMatch[1];
          if (!model.system.model) model.system.model = modelMatch[1];
        }

        const memMatch = line.match(/Memory Size:\s*([0-9]+)\s*MB/i);
        if (memMatch) nodeInfo.memoryGb = Math.round(parseInt(memMatch[1], 10) / 1024);

        const cpuMatch = line.match(/Processors:\s*([0-9]+)/i);
        if (cpuMatch) nodeInfo.cpus = parseInt(cpuMatch[1], 10);

        // Parsing slots / adapters
        const slotMatch = line.match(/Slot:\s*([0-9a-zA-Z\s\(\)]+)/i);
        if (slotMatch) {
          currentSlot = {
            id: slotMatch[1].trim(),
            adapters: []
          };
          nodeInfo.slots.push(currentSlot);
        }

        if (currentSlot) {
          const adapterMatch = line.match(/^\s+([a-zA-Z0-9\s]+?)\s*Adapter:\s*([a-zA-Z0-9\-]+)\s*\((.*)\)/i);
          const portMatch = line.match(/^\s+Ethernet Port:\s*([a-zA-Z0-9\-]+)\s*\((.*)\)/i);
          
          if (adapterMatch) {
            currentSlot.adapters.push({
              type: adapterMatch[1].trim(),
              name: adapterMatch[2].trim(),
              details: adapterMatch[3].trim()
            });
          } else if (portMatch) {
            currentSlot.adapters.push({
              type: "Ethernet Port",
              name: portMatch[1].trim(),
              details: portMatch[2].trim()
            });
          }
        }
      });

      model.nodes[nodeName] = nodeInfo;
    }
  },

  /**
   * Parses sysconfig -r details (aggregates, RAID structures, disk mappings)
   */
  parseSysconfigR(str, model) {
    if (!str) return;

    // Split by aggregates
    const blocks = str.split(/Aggregate:\s*([a-zA-Z0-9_]+)/i);
    let sparesBlock = null;

    // Check for spares section at the end
    const lastBlockIndex = blocks.length - 1;
    if (lastBlockIndex > 0) {
      const sparesSplit = blocks[lastBlockIndex].split(/Spare Disks:/i);
      blocks[lastBlockIndex] = sparesSplit[0];
      if (sparesSplit[1]) {
        sparesBlock = sparesSplit[1];
      }
    }

    // Parse aggregates (indices 1, 3, 5...)
    for (let i = 1; i < blocks.length; i += 2) {
      const aggrName = blocks[i].trim();
      const aggrContent = blocks[i + 1] || "";
      
      const aggr = {
        name: aggrName,
        node: "unknown",
        raidType: "raid_dp",
        state: "online",
        status: "healthy",
        sizeBytes: 0,
        usedBytes: 0,
        freeBytes: 0,
        usedPercent: 0,
        diskCount: 0,
        raidGroups: []
      };

      // Heuristically detect node owner from name (e.g. aggr1_node1 -> node1)
      const ownerMatch = aggrName.match(/_([a-zA-Z0-9\-]+)$/);
      if (ownerMatch && model.nodes[ownerMatch[1]]) {
        aggr.node = ownerMatch[1];
      } else {
        // Look in content for Node owner or default to node1
        const nodeLineMatch = aggrContent.match(/Node:\s*([a-zA-Z0-9_\-]+)/i);
        aggr.node = nodeLineMatch ? nodeLineMatch[1].trim() : Object.keys(model.nodes)[0] || "node1";
      }

      // Size parsing
      const sizeMatch = aggrContent.match(/Size:\s*([0-9\.]+)\s*(GB|TB|MB)/i);
      if (sizeMatch) {
        let size = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2].toUpperCase();
        if (unit === 'TB') size *= 1024 * 1024 * 1024 * 1024;
        else if (unit === 'GB') size *= 1024 * 1024 * 1024;
        else if (unit === 'MB') size *= 1024 * 1024;
        aggr.sizeBytes = size;
      }

      const usedMatch = aggrContent.match(/Used:\s*([0-9\.]+)\s*(GB|TB|MB)/i);
      if (usedMatch) {
        let size = parseFloat(usedMatch[1]);
        const unit = usedMatch[2].toUpperCase();
        if (unit === 'TB') size *= 1024 * 1024 * 1024 * 1024;
        else if (unit === 'GB') size *= 1024 * 1024 * 1024;
        else if (unit === 'MB') size *= 1024 * 1024;
        aggr.usedBytes = size;
      }

      const freeMatch = aggrContent.match(/Free:\s*([0-9\.]+)\s*(GB|TB|MB)/i);
      if (freeMatch) {
        let size = parseFloat(freeMatch[1]);
        const unit = freeMatch[2].toUpperCase();
        if (unit === 'TB') size *= 1024 * 1024 * 1024 * 1024;
        else if (unit === 'GB') size *= 1024 * 1024 * 1024;
        else if (unit === 'MB') size *= 1024 * 1024;
        aggr.freeBytes = size;
      }

      if (aggr.sizeBytes > 0) {
        aggr.usedPercent = Math.round((aggr.usedBytes / aggr.sizeBytes) * 100);
      }

      // RAID details
      const raidTypeMatch = aggrContent.match(/raid_type|raid[0-9dp_]+/i);
      if (raidTypeMatch) aggr.raidType = raidTypeMatch[0].toLowerCase();
      
      const stateMatch = aggrContent.match(/State:\s*([a-zA-Z0-9_]+)/i);
      if (stateMatch) aggr.state = stateMatch[1].toLowerCase();

      const statusMatch = aggrContent.match(/Status:\s*([a-zA-Z0-9_]+)/i);
      if (statusMatch) aggr.status = statusMatch[1].toLowerCase();

      // Parse RAID Groups and Disks inside
      const rgBlocks = aggrContent.split(/RAID Group:\s*([a-zA-Z0-9_]+)/i);
      for (let j = 1; j < rgBlocks.length; j += 2) {
        const rgName = rgBlocks[j].trim();
        const rgContent = rgBlocks[j + 1] || "";
        
        const rg = {
          name: rgName,
          disks: []
        };

        // Regex to parse a disk line in rgContent
        // e.g. "1.1.0 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12B0)"
        const lines = rgContent.split("\n");
        lines.forEach(line => {
          const diskMatch = line.match(/^\s*([0-9\.]+)\s+\(([^)]+)\)/);
          if (diskMatch) {
            const diskId = diskMatch[1];
            const metaParts = diskMatch[2].split(",").map(s => s.trim());
            
            const diskState = metaParts[0] || "unknown"; // data, parity, dparity, failed, rebuilding
            const diskStatus = metaParts[1] || "unknown"; // healthy, broken, reconstructing
            const diskType = metaParts[2] || "unknown"; // SAS, SSD, SATA, ATA
            const diskCapacity = metaParts[3] || "";
            
            // Extract model, firmware, serial
            const modelVal = (line.match(/Model:\s*([a-zA-Z0-9_\-]+)/i) || [])[1] || "";
            const fwVal = (line.match(/FW:\s*([a-zA-Z0-9_\-]+)/i) || [])[1] || (line.match(/Firmware:\s*([a-zA-Z0-9_\-]+)/i) || [])[1] || "";
            const serialVal = (line.match(/Serial:\s*([a-zA-Z0-9_\-]+)/i) || [])[1] || "";

            const disk = {
              id: diskId,
              aggregate: aggrName,
              raidGroup: rgName,
              state: diskState,
              status: diskStatus,
              type: diskType,
              capacityStr: diskCapacity,
              model: modelVal,
              firmware: fwVal,
              serial: serialVal,
              node: aggr.node,
              shelf: diskId.split(".")[0] || "1",
              slot: diskId.split(".")[1] || "0"
            };

            rg.disks.push(disk);
            model.disks.push(disk);
            aggr.diskCount++;
          }
        });

        aggr.raidGroups.push(rg);
      }

      model.aggregates.push(aggr);
    }

    // Parse spares
    if (sparesBlock) {
      const lines = sparesBlock.split("\n");
      lines.forEach(line => {
        const diskMatch = line.match(/^\s*([0-9\.]+)\s+\(([^)]+)\)/);
        if (diskMatch) {
          const diskId = diskMatch[1];
          const metaParts = diskMatch[2].split(",").map(s => s.trim());
          
          const diskState = metaParts[0] || "spare";
          const diskStatus = metaParts[1] || "healthy";
          const diskType = metaParts[2] || "unknown";
          const diskCapacity = metaParts[3] || "";
          
          const modelVal = (line.match(/Model:\s*([a-zA-Z0-9_\-]+)/i) || [])[1] || "";
          const fwVal = (line.match(/FW:\s*([a-zA-Z0-9_\-]+)/i) || [])[1] || "";
          const serialVal = (line.match(/Serial:\s*([a-zA-Z0-9_\-]+)/i) || [])[1] || "";

          // Heuristic owner based on disk prefix
          // e.g. 1.1.24 -> node1, 2.2.x -> node2
          const firstOctet = diskId.split(".")[0];
          const nodeName = firstOctet === '2' ? "node2" : "node1";

          const disk = {
            id: diskId,
            aggregate: "spare",
            raidGroup: "spare",
            state: diskState,
            status: diskStatus,
            type: diskType,
            capacityStr: diskCapacity,
            model: modelVal,
            firmware: fwVal,
            serial: serialVal,
            node: nodeName,
            shelf: firstOctet,
            slot: diskId.split(".")[1] || "0"
          };

          model.disks.push(disk);
        }
      });
    }
  },

  /**
   * Parses df -h (logical volumes capacities)
   */
  parseDf(str, model) {
    if (!str) return;

    const lines = str.split("\n");
    lines.forEach(line => {
      // Normalizing layout: e.g. "/vol/vol_nfs_data1/  15728640000 15099494400  629145600      96%  /vol/vol_nfs_data1/"
      // or "/vol/vol_root_n1/     104857600   47185920   57671680      45%  /vol/vol_root_n1/"
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5 && parts[0].startsWith('/vol/')) {
        const rawVolName = parts[0].replace('/vol/', '').replace('/', '');
        const totalKb = parseInt(parts[1], 10);
        const usedKb = parseInt(parts[2], 10);
        const availKb = parseInt(parts[3], 10);
        const capPctStr = parts[4];
        
        let volName = rawVolName;
        let vserver = "vs1";
        if (rawVolName.includes('@')) {
          const split = rawVolName.split('@');
          volName = split[0];
          vserver = split[1];
        }

        // Determine node owner by aggregate or naming
        let nodeOwner = "node1";
        if (volName.includes("n2") || volName.includes("node2")) {
          nodeOwner = "node2";
        } else {
          // Check if parent aggregate is owned by node2
          const aggrMatch = model.aggregates.find(a => volName.includes(a.name) || (a.node === "node2" && volName.includes("n2")));
          if (aggrMatch) nodeOwner = aggrMatch.node;
        }

        // Parent aggregate mapping guess
        let parentAggr = "aggr1_node1";
        if (nodeOwner === "node2") {
          parentAggr = volName.includes("root") ? "aggr0_node2" : "aggr1_node2";
        } else {
          parentAggr = volName.includes("root") ? "aggr0_node1" : "aggr1_node1";
        }

        model.volumes.push({
          name: volName,
          vserver: vserver,
          node: nodeOwner,
          aggregate: parentAggr,
          totalBytes: totalKb * 1024,
          usedBytes: usedKb * 1024,
          availBytes: availKb * 1024,
          usedPercent: parseInt(capPctStr.replace('%', ''), 10) || 0,
          thinProvisioned: !volName.includes("root"), // Guessed heuristic
          snapshotReservePercent: 5 // Default
        });
      }
    });
  },

  /**
   * Parses network interfaces (LIFs)
   */
  parseNetworkInterface(str, model) {
    if (!str) return;

    const lines = str.split("\n");
    lines.forEach(line => {
      // Format: "lif_nfs_1     up/up      192.168.10.10/24  node1     e0c      true"
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 6 && !parts[0].startsWith('Logical') && !parts[0].startsWith('---')) {
        const lifName = parts[0];
        const statusStr = parts[1]; // up/up or up/down
        const ip = parts[2];
        const node = parts[3];
        const port = parts[4];
        const isHome = parts[5] === 'true';

        const [adminStatus, operStatus] = statusStr.split('/');

        model.lifs.push({
          name: lifName,
          node: node,
          ip: ip,
          port: port,
          homePort: port, // Simplified default
          isHome: isHome,
          adminStatus: adminStatus || "up",
          operStatus: operStatus || "up",
          failoverPolicy: lifName.includes("mgmt") ? "broadcast-domain-wide" : "disabled",
          firewallPolicy: lifName.includes("mgmt") ? "mgmt" : "data"
        });
      }
    });
  },

  /**
   * Parses ifconfig (physical network ports and states)
   */
  parseIfconfig(str, model) {
    if (!str) return;

    const nodeBlocks = str.split(/([a-zA-Z0-9_\-]+):/);
    if (nodeBlocks.length <= 1) return;

    for (let i = 1; i < nodeBlocks.length; i += 2) {
      const nodeName = nodeBlocks[i].trim();
      const nodeContent = nodeBlocks[i + 1] || "";
      
      const lines = nodeContent.split("\n");
      let currentPort = null;

      lines.forEach(line => {
        const portMatch = line.match(/^([a-zA-Z0-9\-]+):\s+flags=([0-9a-fA-F<>,]+)\s+mtu\s+([0-9]+)/);
        if (portMatch) {
          const portName = portMatch[1];
          const flags = portMatch[2];
          const mtu = parseInt(portMatch[3], 10);
          
          currentPort = {
            name: portName,
            node: nodeName,
            status: flags.toLowerCase().includes("up") ? "up" : "down",
            speed: 0,
            duplex: "auto",
            mtu: mtu,
            type: portName.startsWith("e0M") ? "Management" : (portName.startsWith("e0a") || portName.startsWith("e0b") ? "Cluster" : "Data")
          };
          model.ports.push(currentPort);
        }

        if (currentPort) {
          const speedMatch = line.match(/speed\s+([0-9]+)M\s+duplex\s+([a-zA-Z0-9]+)/i);
          if (speedMatch) {
            currentPort.speed = parseInt(speedMatch[1], 10);
            currentPort.duplex = speedMatch[2].toLowerCase();
          }
        }
      });
    }
  },

  /**
   * Parses storage shelves and sensors
   */
  parseStorageShelf(str, model) {
    if (!str) return;

    // Parse shelves
    const shelfBlocks = str.split(/Shelf\s+([0-9]+):/i);
    for (let i = 1; i < shelfBlocks.length; i += 2) {
      const shelfId = shelfBlocks[i].trim();
      const content = shelfBlocks[i + 1] || "";
      
      const shelf = {
        id: shelfId,
        model: "DS2246",
        serial: "SSN" + Math.floor(Math.random() * 100000),
        firmware: "0100",
        paths: "Active / Active",
        diskCount: 24,
        psuStatus: "OK",
        fanStatus: "OK",
        temp: 38
      };

      const lines = content.split("\n");
      lines.forEach(line => {
        const modelMatch = line.match(/Shelf Model:\s*(.*)/i);
        if (modelMatch) shelf.model = modelMatch[1].trim();

        const snMatch = line.match(/Serial Number:\s*(.*)/i);
        if (snMatch) shelf.serial = snMatch[1].trim();

        const fwMatch = line.match(/Firmware Version\s*\(([^)]+)\):\s*([0-9a-zA-Z]+)/i);
        if (fwMatch) shelf.firmware = fwMatch[2].trim();

        const pathMatch = line.match(/SAS Paths:\s*(.*)/i);
        if (pathMatch) shelf.paths = pathMatch[1].trim();

        const countMatch = line.match(/Disks Count:\s*([0-9]+)/i);
        if (countMatch) shelf.diskCount = parseInt(countMatch[1], 10);

        const psuMatch = line.match(/Power Supplies:\s*(.*)/i);
        if (psuMatch) shelf.psuStatus = psuMatch[1].includes("Fault") ? "Faulty" : "OK";

        const fanMatch = line.match(/Fans:\s*(.*)/i);
        if (fanMatch) shelf.fanStatus = fanMatch[1].includes("Fault") ? "Faulty" : "OK";

        const tempMatch = line.match(/Temperature:\s*([0-9]+)\s*C/i);
        if (tempMatch) shelf.temp = parseInt(tempMatch[1], 10);
      });

      model.shelves.push(shelf);
    }

    // Parse chassis environmental sensors if present
    const sensorMatch = str.match(/Controller Environmental Sensors:([\s\S]*)/i);
    if (sensorMatch) {
      const sensorContent = sensorMatch[1];
      const nodeBlocks = sensorContent.split(/([a-zA-Z0-9_\-]+):/);
      
      for (let j = 1; j < nodeBlocks.length; j += 2) {
        const nodeName = nodeBlocks[j].trim();
        const content = nodeBlocks[j + 1] || "";
        
        if (model.nodes[nodeName]) {
          model.nodes[nodeName].sensors = [];
          
          const lines = content.split("\n");
          lines.forEach(line => {
            const match = line.match(/^\s*([^:]+):\s*(.*)/);
            if (match) {
              const label = match[1].trim();
              const val = match[2].trim();
              
              if (!label.startsWith("Controller Environmental") && label.length > 0) {
                model.nodes[nodeName].sensors.push({
                  label: label,
                  value: val,
                  status: val.toLowerCase().includes("fault") || val.toLowerCase().includes("failed") ? "failed" : "ok"
                });
              }
            }
          });
        }
      }
    }
  },

  /**
   * Parses licenses
   */
  parseLicense(str, model) {
    if (!str) return;

    const lines = str.split("\n");
    lines.forEach(line => {
      // Feature                 Serial Number   License Key                     Type            Expiry
      // ----------------------- --------------- ------------------------------- --------------- ---------
      // Base                    701601000100    A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5  site            -
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4 && !parts[0].startsWith('Feature') && !parts[0].startsWith('---')) {
        const feature = parts[0];
        const serial = parts[1];
        const key = parts[2];
        const type = parts[3];
        const expiry = parts.slice(4).join(" ") || "-";

        let status = "active";
        if (expiry.toLowerCase().includes("expired")) {
          status = "expired";
        }

        model.licenses.push({
          feature: feature,
          serial: serial,
          key: key,
          type: type,
          expiry: expiry,
          status: status
        });
      }
    });
  },

  /**
   * Parses log messages
   */
  parseMessages(str, model) {
    if (!str) return;

    const lines = str.split("\n");
    lines.forEach(line => {
      // Typical ONTAP syslog formats:
      // "2026-06-25T12:04:11+04:00 [node1: Wafl_worker: wafl.vol.full:warning]: Volume vol_nfs_data1@vserver:vs1 is nearly full (96% used)."
      const formatMatch = line.match(/^([0-9\-T:\+\.]+)\s+\[([^:]+):\s*([^:]+):\s*([^\]\s]+)\]:\s*(.*)$/);
      if (formatMatch) {
        const timestamp = formatMatch[1];
        const node = formatMatch[2];
        const component = formatMatch[3];
        const alertTag = formatMatch[4]; // e.g. "wafl.vol.full:warning"
        const messageText = formatMatch[5];

        let severity = "info";
        if (alertTag.includes(":critical") || alertTag.includes(":alert") || alertTag.includes(":emergency") || alertTag.includes(":panic")) {
          severity = "critical";
        } else if (alertTag.includes(":error")) {
          severity = "error";
        } else if (alertTag.includes(":warning")) {
          severity = "warning";
        }

        model.logs.push({
          timestamp: timestamp,
          node: node,
          component: component,
          alertTag: alertTag,
          severity: severity,
          text: messageText,
          raw: line
        });
      } else {
        // Fallback for generic log formats
        if (line.trim().length > 0) {
          let severity = "info";
          if (line.toLowerCase().includes("fail") || line.toLowerCase().includes("crit") || line.toLowerCase().includes("panic")) {
            severity = "critical";
          } else if (line.toLowerCase().includes("error")) {
            severity = "error";
          } else if (line.toLowerCase().includes("warn")) {
            severity = "warning";
          }

          model.logs.push({
            timestamp: new Date().toISOString(),
            node: "node1",
            component: "syslog",
            alertTag: "system.generic:info",
            severity: severity,
            text: line.trim(),
            raw: line
          });
        }
      }
    });
  },

  /**
   * Post-processing to fill in gaps and link components
   */
  postProcess(model) {
    // If no network ports parsed but we have LIFs, build dummy ports
    if (model.ports.length === 0 && model.lifs.length > 0) {
      const distinctPorts = [...new Set(model.lifs.map(l => l.port))];
      distinctPorts.forEach(port => {
        model.ports.push({
          name: port,
          node: "node1",
          status: "up",
          speed: 10000,
          duplex: "full",
          mtu: 9000,
          type: port.startsWith("e0M") ? "Management" : "Data"
        });
      });
    }

    // Set cluster status metadata
    if (Object.keys(model.nodes).length >= 2) {
      model.system.haState = "HA Configured (Enabled)";
      model.system.nodesCount = Object.keys(model.nodes).length;
    } else {
      model.system.haState = "Single Node (Non-HA)";
      model.system.nodesCount = 1;
    }

    // Map active protocols based on licenses & network interface configurations
    const configuredProtocols = {
      NFS: model.licenses.some(l => l.feature === "NFS" && l.status === "active") && model.lifs.some(l => l.name.includes("nfs")),
      CIFS: model.licenses.some(l => l.feature === "CIFS" && l.status === "active") && model.lifs.some(l => l.name.includes("cifs")),
      iSCSI: model.licenses.some(l => l.feature === "iSCSI" && l.status === "active") && model.lifs.some(l => l.name.includes("iscsi")),
      FC: model.licenses.some(l => l.feature === "FCP" && l.status === "active")
    };
    model.protocols = configuredProtocols;
  }
};
