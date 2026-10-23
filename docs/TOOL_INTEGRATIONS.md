# DualSurf Red Team Tool Integrations Catalog

DualSurf integrates with 40+ leading offensive security tools across 6 operational categories.

## 1. Zero-Fabrication Contract

DualSurf does not fabricate scan output, synthetic ports, or invented vulnerabilities when a tool is not installed on the host system.

- **If Installed:** DualSurf executes the binary directly using safe argument arrays, streaming raw stdout/stderr, capturing exit codes, and hashing the raw output.
- **If Uninstalled:** DualSurf returns a truthful `NOT_INSTALLED` execution record (exit code 127) with the tool's category, documentation URL, and copy-pasteable installation instructions for Windows and Linux.

---

## 2. Integrated Tool Catalog

### A. Reconnaissance and OSINT
| Tool | Binary | Default Version Flag | Documentation URL |
|---|---|---|---|
| **Subfinder** | `subfinder` | `-version` | https://github.com/projectdiscovery/subfinder |
| **Amass** | `amass` | `-version` | https://github.com/owasp-amass/amass |
| **theHarvester** | `theHarvester` | `-h` | https://github.com/laramies/theHarvester |
| **dnsrecon** | `dnsrecon` | `-v` | https://github.com/darkoperator/dnsrecon |
| **httpx** | `httpx` | `-version` | https://github.com/projectdiscovery/httpx |
| **Katana** | `katana` | `-version` | https://github.com/projectdiscovery/katana |
| **ExifTool** | `exiftool` | `-ver` | https://exiftool.org |

### B. Network and Service Inventory
| Tool | Binary | Default Version Flag | Documentation URL |
|---|---|---|---|
| **Nmap** | `nmap` | `-V` | https://nmap.org |
| **Naabu** | `naabu` | `-version` | https://github.com/projectdiscovery/naabu |
| **RustScan** | `rustscan` | `-V` | https://github.com/RustScan/RustScan |
| **Masscan** | `masscan` | `-V` | https://github.com/robertdavidgraham/masscan |
| **Wireshark** | `wireshark` | `-v` | https://www.wireshark.org |
| **TShark** | `tshark` | `-v` | https://www.wireshark.org |
| **Netcat** | `nc` / `ncat` | `-h` | https://nmap.org/ncat/ |
| **tcpdump** | `tcpdump` | `--version` | https://www.tcpdump.org |

### C. Web Application & API Security
| Tool | Binary | Default Version Flag | Documentation URL |
|---|---|---|---|
| **OWASP ZAP** | `zap.sh` / `zap.bat` | `-version` | https://www.zaproxy.org |
| **Nuclei** | `nuclei` | `-version` | https://github.com/projectdiscovery/nuclei |
| **ffuf** | `ffuf` | `-V` | https://github.com/ffuf/ffuf |
| **feroxbuster** | `feroxbuster` | `-V` | https://github.com/epi052/feroxbuster |
| **Gobuster** | `gobuster` | `version` | https://github.com/OJ/gobuster |
| **Nikto** | `nikto` | `-Version` | https://github.com/sullo/nikto |
| **WhatWeb** | `whatweb` | `--version` | https://github.com/urbanadventurer/WhatWeb |
| **sqlmap** | `sqlmap` | `--version` | https://sqlmap.org |

### D. Identity & Directory Security
| Tool | Binary | Default Version Flag | Documentation URL |
|---|---|---|---|
| **BloodHound** | `bloodhound` | `--version` | https://github.com/SpecterOps/BloodHound |
| **NetExec** | `nxc` / `netexec` | `--version` | https://github.com/Pennywize/NetExec |
| **Impacket** | `impacket` / `GetNPUsers.py` | `-h` | https://github.com/fortra/impacket |
| **enum4linux-ng** | `enum4linux-ng` | `-h` | https://github.com/cddmp/enum4linux-ng |
| **Certipy** | `certipy` | `-v` | https://github.com/ly4k/Certipy |
| **Hashcat** | `hashcat` | `-V` | https://hashcat.net/hashcat/ |
| **John the Ripper** | `john` | `--version` | https://www.openwall.com/john/ |

### E. Cloud & Container Infrastructure
| Tool | Binary | Default Version Flag | Documentation URL |
|---|---|---|---|
| **Prowler** | `prowler` | `-v` | https://github.com/prowler-cloud/prowler |
| **ScoutSuite** | `scout` | `--version` | https://github.com/nccgroup/ScoutSuite |
| **Trivy** | `trivy` | `-v` | https://github.com/aquasecurity/trivy |
| **Checkov** | `checkov` | `-v` | https://www.checkov.io |
| **Grype** | `grype` | `version` | https://github.com/anchore/grype |
| **Syft** | `syft` | `version` | https://github.com/anchore/syft |
| **kube-bench** | `kube-bench` | `version` | https://github.com/aquasecurity/kube-bench |
| **Kubescape** | `kubescape` | `version` | https://github.com/kubescape/kubescape |

### F. Controlled Lab Validation
| Tool | Binary | Default Version Flag | Documentation URL |
|---|---|---|---|
| **Metasploit** | `msfconsole` | `--version` | https://www.metasploit.com |

> **IMPORTANT:** Metasploit Framework requires explicit confirmation and is strictly constrained to authorized lab environments.

---

## 3. Tool Discovery and Guidance Commands

```bash
# Audit the host system for all 40+ Red Team tools
dualsurf red tools check

# Inspect status, required privileges, and installation guidance for a tool
dualsurf red tools info nuclei
dualsurf red tools info nmap
dualsurf red tools info sqlmap
```
