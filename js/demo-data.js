/**
 * NetApp AutoSupport (ASUP) Simulation Demo Dataset
 * FAS8200 HA Pair running ONTAP 9.8P2 with multiple issues.
 */

const DEMO_ASUP_DATA = {
  // System Metadata
  version: "NetApp Release 9.8P2: Tue Jan 12 18:24:11 UTC 2021",
  
  sysconfig_a: `
NetApp Release 9.8P2: Tue Jan 12 18:24:11 UTC 2021
System ID: 1234567890 (node1); Partner ID: 1234567891 (node2)
System Serial Number: 701601000100 (node1); Partner Serial Number: 701601000101 (node2)
System Model: FAS8200
Number of Controllers: 2

========================================================================
Node: node1
System ID: 1234567890
Serial Number: 701601000100
Model: FAS8200
Processors: 16 (Intel Xeon CPU E5-2620 v4 @ 2.10GHz)
Memory Size: 65536 MB (64 GB)
System NVRAM: 8192 MB

Slot: 0 (Motherboard)
    SAS Adapter: 0a (SAS3, Dual-Port, Link Up)
    SAS Adapter: 0b (SAS3, Dual-Port, Link Up)
    Ethernet Port: e0a (10G, Link Up)
    Ethernet Port: e0b (10G, Link Up)
    Ethernet Port: e0c (10G, Link Up)
    Ethernet Port: e0d (10G, Link Down)
    Ethernet Port: e0M (1G Mgmt, Link Up)

Slot: 1 (HBA)
    Fibre Channel Adapter: 1a (16Gb FC, Target, Link Down)
    Fibre Channel Adapter: 1b (16Gb FC, Target, Link Down)

========================================================================
Node: node2
System ID: 1234567891
Serial Number: 701601000101
Model: FAS8200
Processors: 16 (Intel Xeon CPU E5-2620 v4 @ 2.10GHz)
Memory Size: 65536 MB (64 GB)
System NVRAM: 8192 MB

Slot: 0 (Motherboard)
    SAS Adapter: 0a (SAS3, Dual-Port, Link Up)
    SAS Adapter: 0b (SAS3, Dual-Port, Link Up)
    Ethernet Port: e0a (10G, Link Up)
    Ethernet Port: e0b (10G, Link Up)
    Ethernet Port: e0c (10G, Link Up)
    Ethernet Port: e0d (10G, Link Up)
    Ethernet Port: e0M (1G Mgmt, Link Up)

Slot: 1 (HBA)
    Fibre Channel Adapter: 1a (16Gb FC, Target, Link Down)
    Fibre Channel Adapter: 1b (16Gb FC, Target, Link Down)
  `,

  sysconfig_r: `
Aggregate: aggr0_node1 (online, raid_dp) (block-level-checksum)
    Size: 950 GB, Used: 430 GB, Free: 520 GB (45% used)
    State: online, Status: healthy
    RAID Group: rg0 (3 disks, RAID-DP)
        0.0.0 (data, healthy, SSD, 960 GB, Model: X356_SSDLE800A10, FW: NA02, Serial: S102A1)
        0.0.1 (data, healthy, SSD, 960 GB, Model: X356_SSDLE800A10, FW: NA02, Serial: S102A2)
        0.0.2 (parity, healthy, SSD, 960 GB, Model: X356_SSDLE800A10, FW: NA02, Serial: S102A3)

Aggregate: aggr1_node1 (online, raid_dp) (block-level-checksum)
    Size: 21800 GB (21.8 TB), Used: 20274 GB (20.3 TB), Free: 1526 GB (1.5 TB) (93% used)
    State: online, Status: healthy
    RAID Group: rg0 (12 disks, RAID-DP)
        1.1.0 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12B0)
        1.1.1 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12B1)
        1.1.2 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12B2)
        1.1.3 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12B3)
        1.1.4 (failed, broken, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12BC)
        1.1.5 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12B5)
        1.1.6 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12B6)
        1.1.7 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12B7)
        1.1.8 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12B8)
        1.1.9 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12B9)
        1.1.10 (parity, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12BA)
        1.1.11 (dparity, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12BB)
    RAID Group: rg1 (12 disks, RAID-DP)
        1.1.12 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12BD)
        1.1.13 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12BE)
        1.1.14 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12BF)
        1.1.15 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12C0)
        1.1.16 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12C1)
        1.1.17 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12C2)
        1.1.18 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12C3)
        1.1.19 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12C4)
        1.1.20 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12C5)
        1.1.21 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12C6)
        1.1.22 (parity, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12C7)
        1.1.23 (dparity, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12C8)

Aggregate: aggr0_node2 (online, raid_dp) (block-level-checksum)
    Size: 950 GB, Used: 390 GB, Free: 560 GB (41% used)
    State: online, Status: healthy
    RAID Group: rg0 (3 disks, RAID-DP)
        0.0.3 (data, healthy, SSD, 960 GB, Model: X356_SSDLE800A10, FW: NA02, Serial: S102A4)
        0.0.4 (data, healthy, SSD, 960 GB, Model: X356_SSDLE800A10, FW: NA02, Serial: S102A5)
        0.0.5 (parity, healthy, SSD, 960 GB, Model: X356_SSDLE800A10, FW: NA02, Serial: S102A6)

Aggregate: aggr1_node2 (online, raid_dp) (block-level-checksum)
    Size: 21800 GB (21.8 TB), Used: 11990 GB (12.0 TB), Free: 9810 GB (9.8 TB) (55% used)
    State: online, Status: healthy
    RAID Group: rg0 (24 disks, RAID-DP)
        2.2.0 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22B0)
        2.2.1 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22B1)
        2.2.2 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22B2)
        2.2.3 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22B3)
        2.2.4 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22B4)
        2.2.5 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22B5)
        2.2.6 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22B6)
        2.2.7 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22B7)
        2.2.8 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22B8)
        2.2.9 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22B9)
        2.2.10 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22BA)
        2.2.11 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22BB)
        2.2.12 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22BC)
        2.2.13 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22BD)
        2.2.14 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22BE)
        2.2.15 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22BF)
        2.2.16 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22C0)
        2.2.17 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22C1)
        2.2.18 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22C2)
        2.2.19 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22C3)
        2.2.20 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22C4)
        2.2.21 (data, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22C5)
        2.2.22 (parity, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22C6)
        2.2.23 (dparity, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA04, Serial: W30A22C7)

========================================================================
Spare Disks:
    0.0.6 (spare, healthy, SSD, 960 GB, Model: X356_SSDLE800A10, FW: NA02, Serial: S102AS)
    0.0.7 (spare, healthy, SSD, 960 GB, Model: X356_SSDLE800A10, FW: NA02, Serial: S102AT)
    1.1.24 (spare, healthy, SAS, 1.2 TB, Model: X425_TA12E12A10Y, FW: NA01, Serial: W30A12BS)
  `,

  df: `
Filesystem               kbytes       used      avail capacity  Mounted on
/vol/vol_root_n1/     104857600   47185920   57671680      45%  /vol/vol_root_n1/
/vol/vol_nfs_data1/  15728640000 15099494400  629145600      96%  /vol/vol_nfs_data1/
/vol/vol_cifs_shares/ 5242880000  4613734400  629145600      88%  /vol/vol_cifs_shares/
/vol/vol_root_n2/     104857600   43009024   61848576      41%  /vol/vol_root_n2/
/vol/vol_iscsi_luns/ 10485760000  6291456000 4194304000      60%  /vol/vol_iscsi_luns/
  `,

  network_interface: `
  Logical       Status     Network           Current   Current  Is
  Interface     Admin/Oper Address/Mask      Node      Port     Home
  ------------- ---------- ----------------- --------- -------- ----
  clus1         up/up      169.254.10.1/24   node1     e0a      true
  clus2         up/up      169.254.10.2/24   node1     e0b      true
  clus3         up/up      169.254.10.3/24   node2     e0a      true
  clus4         up/up      169.254.10.4/24   node2     e0b      true
  node1_mgmt    up/up      192.168.1.11/24   node1     e0M      true
  node2_mgmt    up/up      192.168.1.12/24   node2     e0M      true
  lif_nfs_1     up/up      192.168.10.10/24  node1     e0c      true
  lif_cifs_1    up/up      192.168.10.11/24  node1     e0c      true
  lif_iscsi_1   up/down    192.168.20.10/24  node1     e0d      true
  lif_iscsi_2   up/up      192.168.20.11/24  node2     e0d      true
  `,

  ifconfig: `
node1:
e0a: flags=8843<UP,BROADCAST,RUNNING,SIMPLEX,MULTICAST> mtu 9000
    ether 00:a0:98:e1:a2:10
    speed 10000M duplex full
e0b: flags=8843<UP,BROADCAST,RUNNING,SIMPLEX,MULTICAST> mtu 9000
    ether 00:a0:98:e1:a2:11
    speed 10000M duplex full
e0c: flags=8843<UP,BROADCAST,RUNNING,SIMPLEX,MULTICAST> mtu 1500
    ether 00:a0:98:e1:a2:12
    speed 10000M duplex full
e0d: flags=8802<DOWN,BROADCAST,SIMPLEX,MULTICAST> mtu 1500
    ether 00:a0:98:e1:a2:13
    speed 0M duplex auto
e0M: flags=8843<UP,BROADCAST,RUNNING,SIMPLEX,MULTICAST> mtu 1500
    ether 00:a0:98:e1:a2:14
    speed 1000M duplex full

node2:
e0a: flags=8843<UP,BROADCAST,RUNNING,SIMPLEX,MULTICAST> mtu 9000
    ether 00:a0:98:e1:b2:10
    speed 10000M duplex full
e0b: flags=8843<UP,BROADCAST,RUNNING,SIMPLEX,MULTICAST> mtu 9000
    ether 00:a0:98:e1:b2:11
    speed 10000M duplex full
e0c: flags=8843<UP,BROADCAST,RUNNING,SIMPLEX,MULTICAST> mtu 1500
    ether 00:a0:98:e1:b2:12
    speed 10000M duplex full
e0d: flags=8843<UP,BROADCAST,RUNNING,SIMPLEX,MULTICAST> mtu 1500
    ether 00:a0:98:e1:b2:13
    speed 10000M duplex full
e0M: flags=8843<UP,BROADCAST,RUNNING,SIMPLEX,MULTICAST> mtu 1500
    ether 00:a0:98:e1:b2:14
    speed 1000M duplex full
  `,

  storage_shelf: `
Shelf 1:
    Shelf ID: 1
    Shelf Model: DS2246
    Serial Number: SSN1000200
    Firmware Version (IOM6): 0100 (Outdated)
    SAS Paths: Controller A (0a) -> Loop Active; Controller B (0a) -> Loop Active
    Power Supplies: PSU 1 -> OK; PSU 2 -> OK
    Fans: Fan 1 -> OK (5200 RPM); Fan 2 -> OK (5100 RPM)
    Temperature: 38 C
    Disks Count: 24 disks

Shelf 2:
    Shelf ID: 2
    Shelf Model: DS2246
    Serial Number: SSN1000201
    Firmware Version (IOM6): 0098 (Outdated & Mismatched)
    SAS Paths: Controller A (0b) -> Loop Active; Controller B (0b) -> Loop Mismatch (Degraded Link)
    Power Supplies: PSU 1 -> OK; PSU 2 -> OK
    Fans: Fan 1 -> OK (5200 RPM); Fan 2 -> OK (5100 RPM)
    Temperature: 39 C
    Disks Count: 24 disks

Controller Environmental Sensors:
    node1:
        PSU1: OK
        PSU2: OK
        Chassis Temperature: 36 C (OK)
        CPU Temp: 58 C (OK)
        Battery Status: OK (100%)
    node2:
        PSU1: OK
        PSU2: Faulty (Power supply failure detected!)
        Chassis Temperature: 45 C (Warning: Higher than usual)
        CPU Temp: 68 C (Warning: elevated)
        Battery Status: OK (98%)
  `,

  license: `
Feature                 Serial Number   License Key                     Type            Expiry
----------------------- --------------- ------------------------------- --------------- ---------
Base                    701601000100    A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5  site            -
NFS                     701601000100    Z1Y2X3W4V5U6T7S8R9Q0P1O2N3M4L5  site            -
CIFS                    701601000100    CIFSEXPIREDLICENSEKEYPLEASEMOD  demo            Expired (10 days ago)
iSCSI                   701601000100    D1E2F3G4H5I6J7K8L9M0N1O2P3Q4R5  site            -
SnapMirror              701601000100    S1M2R3O4P5Q6R7S8T9U0V1W2X3Y4Z5  site            -
  `,

  messages: `
2026-06-25T12:04:11+04:00 [node1: Wafl_worker: wafl.vol.full:warning]: Volume vol_nfs_data1@vserver:vs1 is nearly full (96% used).
2026-06-25T14:32:00+04:00 [node2: env_monitor: psu.failed:critical]: Power supply 2 in controller chassis has failed or lost AC power.
2026-06-25T14:32:05+04:00 [node2: env_monitor: env.temp.elevated:warning]: Chassis temperature sensor (Sensor 2) is reporting elevated temperature of 45 C.
2026-06-25T16:11:54+04:00 [node1: config_thread: cifs.license.expired:error]: The CIFS/SMB protocol license has expired. SMB connections will be rejected.
2026-06-25T18:00:22+04:00 [node1: disk_monitor: disk.failed:error]: Disk 1.1.4 (S/N: W30A12BC) has failed. RAID group aggr1_node1/rg0 is degraded.
2026-06-25T18:00:24+04:00 [node1: storage_mon: storage.aggregate.degraded:warning]: Aggregate aggr1_node1 is now running in degraded mode due to failed disk 1.1.4.
2026-06-25T19:40:11+04:00 [node1: vifmgr: netif.linkDown:error]: Ethernet link on port e0d is down. Checking failover targets.
2026-06-25T19:40:12+04:00 [node1: vifmgr: lif.down:error]: Logical Interface lif_iscsi_1 on port e0d has gone down because failover is not permitted for SAN LIFs.
2026-06-25T21:10:45+04:00 [node2: storage_mon: sas.path.degraded:warning]: SAS path redundancy lost on Loop 0b. Path from HBA port 0b to shelf 2 IOM B is degraded.
2026-06-26T02:15:30+04:00 [node1: wafl_worker: wafl.aggr.space.low:warning]: Aggregate aggr1_node1 is running out of space (93% used).
2026-06-26T12:00:00+04:00 [node1: period_check: sysconfig.fw.outdated:info]: Shelf 1 and Shelf 2 are running outdated IOM6 firmware (0100, 0098). Recommended version is 0120.
2026-06-26T15:20:00+04:00 [node1: disk_monitor: disk.fw.outdated:warning]: 24 disks on Shelf 1 are running outdated firmware NA01. Latest available is NA04.
  `
};
