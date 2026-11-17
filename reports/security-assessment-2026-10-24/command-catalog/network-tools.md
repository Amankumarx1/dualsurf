# Comprehensive Command Reference: Network Reconnaissance Module

This document provides a complete, verified command catalog for the 6 network reconnaissance tools integrated into DualSurf: **Nmap, Wireshark, TShark, Netcat, Ncat, and Masscan**.

---

## 1. Nmap (Network Mapper)

- **Purpose:** Host discovery, TCP/UDP port scanning, service version detection, OS fingerprinting, and scriptable network vulnerability auditing via NSE.
- **Binary Name:** `nmap` / `nmap.exe`
- **Detected Host Status:** NOT INSTALLED on host PATH
- **Documentation URL:** [https://nmap.org/docs.html](https://nmap.org/docs.html)
- **Required Permissions:** Non-root for TCP Connect (`-sT`); Administrator/root (`CAP_NET_RAW` / Npcap) for SYN stealth (`-sS`), UDP (`-sU`), and OS detection (`-O`).

### Complete Option Set & Syntax Reference
```bash
# General Syntax
nmap [Scan Type...] [Options] {target specification}

# Target Specification
nmap 192.168.1.1                 # Single IP
nmap scanme.nmap.org             # Single FQDN
nmap 192.168.1.0/24              # CIDR Subnet
nmap 192.168.1.1-100             # Range
nmap -iL targets.txt             # Target list input from file
nmap --exclude 192.168.1.5       # Exclude specific IPs

# Scan Techniques
nmap -sT <target>                # TCP Connect scan (unprivileged fallback)
nmap -sS <target>                # TCP SYN stealth scan (requires raw socket / admin)
nmap -sU <target>                # UDP port scan
nmap -sA <target>                # TCP ACK scan (maps firewall rulesets)
nmap -sN / -sF / -sX <target>    # TCP Null, FIN, Xmas scans (RFC 793 state testing)
nmap -sn <target>                # Ping scan (host discovery only, disable port scan)
nmap -Pn <target>                # Treat all hosts as online (skip host discovery)

# Port Selection & Order
nmap -p 80,443 <target>          # Specific ports
nmap -p 1-1000 <target>          # Port range
nmap -p- <target>                # All 65,535 ports
nmap -F <target>                 # Fast mode (top 100 ports)
nmap --top-ports 20 <target>     # Top N common ports
nmap -r <target>                 # Sequential scan (do not randomize)

# Service Version & OS Detection
nmap -sV <target>                # Probe open ports to determine service/version info
nmap -sV --version-intensity 5   # Maximum version probing intensity (0-9)
nmap -O <target>                 # Enable OS detection (requires raw socket)
nmap -A <target>                 # Aggressive mode (enables -sV, -O, -sC, traceroute)

# Timing & Performance
nmap -T0 <target>                # Paranoid (slowest, IDS evasion)
nmap -T1 <target>                # Sneaky
nmap -T2 <target>                # Polite (throttled, low bandwidth)
nmap -T3 <target>                # Normal (default timing)
nmap -T4 <target>                # Aggressive (fast, assumes reliable local network)
nmap -T5 <target>                # Insane (fastest, sacrifices accuracy)
nmap --max-rate 50 <target>      # Throttle maximum packets per second
nmap --host-timeout 60s <target> # Give up on slow targets after duration

# Output Formatting
nmap -oN scan.txt <target>       # Standard human-readable output
nmap -oX scan.xml <target>       # XML output for tool parsing
nmap -oG scan.gnmap <target>     # Grepable output
nmap -oA scan_all <target>       # Export all formats simultaneously
nmap --reason <target>           # Display the exact reason for port state determination
```

### Categorized Command Workflows
| Category | Command | Applicability / Scope Status |
| :--- | :--- | :--- |
| **Diagnostic & Help** | `nmap --version`<br>`nmap --help` | Safe diagnostic. Supported when binary is installed. |
| **Applicable to Website** | `nmap -sT -T2 --reason -p 80,443 --max-retries 1 --host-timeout 60s www.amankumarx1.xyz` | Conservative TCP Connect probe against approved hostname. (Status: `Documented but not executed — tool not installed on host`). |
| **Local Lab Only** | `nmap -sS -sV -O -p- -T4 127.0.0.1`<br>`nmap --script vuln 192.168.1.0/24` | Intensive scanning, raw socket OS detection, and vulnerability exploitation scripts are strictly reserved for isolated lab environments. |
| **Not Applicable / Prohibited** | `nmap -p- -T5 76.76.21.164`<br>`nmap -sU -T4 76.76.21.0/24` | Prohibited on shared Vercel Anycast edge IPs. |

---

## 2. Wireshark & TShark

- **Purpose:** Interactive graphical packet analyzer (Wireshark) and command-line packet capture and dissection utility (TShark).
- **Binary Names:** `wireshark` / `wireshark.exe`, `tshark` / `tshark.exe`
- **Detected Host Status:** NOT INSTALLED on host PATH
- **Documentation URL:** [https://www.wireshark.org/docs/wsug_html/](https://www.wireshark.org/docs/wsug_html/) | [TShark Man Page](https://www.wireshark.org/docs/man-pages/tshark.html)
- **Required Permissions:** Local Administrator / `sudo` / `wireshark` capture group membership with Npcap / libpcap installed.

### Complete Option Set & Syntax Reference
```bash
# Interface Discovery
tshark -D                        # List all available network capture interfaces
tshark -L                        # List link-layer header types for interface

# Capture Execution
tshark -i 1                      # Capture on interface index 1
tshark -i eth0 -w capture.pcapng # Save raw packets to file
tshark -i 1 -c 100               # Capture exactly 100 packets and stop
tshark -i 1 -a duration:30       # Capture for 30 seconds autostop
tshark -i 1 -b filesize:10000    # Ring buffer with 10MB split files

# Capture Filters (libpcap BPF syntax, applied before packet is buffered)
tshark -i 1 -f "tcp port 443"    # Capture only HTTPS traffic
tshark -i 1 -f "host 76.76.21.164 and port 443"
tshark -i 1 -f "not broadcast and not multicast"

# Reading & Dissecting Capture Files
tshark -r capture.pcapng         # Read and print summary lines
tshark -r capture.pcapng -Y "http" # Apply display filter for HTTP
tshark -r capture.pcapng -Y "tls.handshake.type == 1" # Filter TLS Client Hello
tshark -r capture.pcapng -T json # Export dissected packets as JSON
tshark -r capture.pcapng -T fields -e ip.src -e ip.dst -e tcp.dstport

# Common Display Filters (applied on dissected packets)
dns                              # Show DNS queries and responses
tcp.port == 443                  # Traffic on port 443
http                             # Unencrypted HTTP requests/responses
http.response.code >= 400        # Client/Server HTTP errors
tls.handshake.ciphersuite        # Inspect TLS cipher suites
tcp.flags.reset == 1             # Filter TCP RST packets (abrupt terminations)
```

### Categorized Command Workflows
| Category | Command | Applicability / Scope Status |
| :--- | :--- | :--- |
| **Diagnostic & Help** | `tshark -v`<br>`tshark -h`<br>`tshark -D` | Safe interface discovery. |
| **Applicable to Website** | `tshark -i 1 -f "host 76.76.21.164 and port 443" -a duration:15 -w vercel_traffic.pcapng` | Passive diagnostic capture of local test traffic during website evaluation. (Status: `Documented but not executed — Npcap/TShark not present`). |
| **Local Lab Only** | `tshark -r malformed.pcap -V`<br>`tshark -i loopback -Y "http.request"` | Local protocol dissection and loopback traffic verification. |
| **Not Applicable** | Promiscuous unauthenticated sniffing of external network segments. | Prohibited by policy and technical impossibility. |

---

## 3. Netcat (`nc`) & Ncat

- **Purpose:** Raw TCP/UDP socket read/write, port connectivity checks, and basic protocol inspection.
- **Binary Names:** `nc` / `nc.exe`, `ncat` / `ncat.exe`
- **Detected Host Status:** NOT INSTALLED on host PATH
- **Documentation URL:** [https://nmap.org/ncat/guide/](https://nmap.org/ncat/guide/)
- **Required Permissions:** Non-root for outbound client connections to unprivileged ports (>1024) or standard remote ports (80/443). Root/Administrator required to bind local listeners on ports < 1024.

### Complete Option Set & Syntax Reference
```bash
# Ncat Client Connection
ncat <host> <port>               # Open raw TCP connection
ncat -v <host> <port>            # Verbose connection output
ncat -vz <host> <port>           # Zero-I/O mode (port check without sending payload)
ncat -u <host> <port>            # UDP mode
ncat -w 5 <host> <port>          # Set connection timeout to 5 seconds
ncat --ssl <host> 443            # Connect using SSL/TLS encryption
ncat --ssl-verify <host> 443     # Verify target SSL certificate

# Ncat Listener (Server Mode)
ncat -l 8080                     # Listen on TCP port 8080
ncat -l -p 8080 -k               # Keep listening across multiple clients
ncat -l 8080 --ssl               # Create encrypted SSL/TLS listener
ncat -l 8080 -e cmd.exe          # (Dangerous/Lab only) Bind shell to port

# Netcat (Traditional nc)
nc -vz 127.0.0.1 80-85           # Check port range
nc -w 3 -v 127.0.0.1 80          # Single port check with 3-second timeout
```

### Categorized Command Workflows
| Category | Command | Applicability / Scope Status |
| :--- | :--- | :--- |
| **Diagnostic & Help** | `ncat --version`<br>`ncat --help` | Safe diagnostic. |
| **Applicable to Website** | `ncat -vz -w 5 www.amankumarx1.xyz 443`<br>`ncat --ssl -v www.amankumarx1.xyz 443` | Non-destructive TLS connectivity check. (Status: `Documented — replaced with verified native curl.exe ALPN check`). |
| **Local Lab Only** | `ncat -l 9999` (terminal 1) & `ncat 127.0.0.1 9999` (terminal 2) | Loopback client-server data exchange verification. |
| **Not Applicable** | Port listener binding on public remote hosts. | Not applicable. |

---

## 4. Masscan (High-Speed Port Scanner)

- **Purpose:** Asynchronous, high-volume TCP/UDP port discovery using a custom TCP/IP network stack.
- **Binary Name:** `masscan` / `masscan.exe`
- **Detected Host Status:** NOT INSTALLED on host PATH
- **Documentation URL:** [https://github.com/robertdavidgraham/masscan](https://github.com/robertdavidgraham/masscan)
- **Required Permissions:** Administrator / root (`CAP_NET_RAW` / custom packet driver).

### Complete Option Set & Syntax Reference
```bash
# General Syntax
masscan <ip/range> -p <ports> --rate <packets-per-second>

# Common Options
masscan 10.0.0.0/8 -p80           # Scan class A network for port 80
masscan 192.168.1.1 -p1-65535    # Full port range scan on single host
masscan --rate 100 <target>      # Limit transmission rate to 100 packets/sec
masscan --rate 100000 <target>   # Extreme high speed (100,000 pps - Lab only!)
masscan -p80,443 <target> -oL out.txt # Output in simple list format
masscan -p80 <target> -oJ out.json    # JSON output
masscan --banners -p80 <target>  # Banner grabbing mode
masscan --exclude 255.255.255.255 # Exclude specific IP
```

### Categorized Command Workflows
| Category | Command | Applicability / Scope Status |
| :--- | :--- | :--- |
| **Diagnostic & Help** | `masscan --version` | Safe diagnostic. |
| **Applicable to Website** | **NOT RUN** | **EXPLICITLY EXCLUDED BY POLICY**: Masscan transmits raw asynchronous packets at high volume. Running it against shared multi-tenant Vercel infrastructure (`76.76.21.164`) is dangerous, unethical, and prohibited without separate data center infrastructure authorization. |
| **Local Lab Only** | `masscan 127.0.0.1 -p80,443,8080 --rate 50` | Strictly bounded loopback rate-limited testing. |
