# Assessment Scope & Rules of Engagement

**Assessment Reference:** `DUALSURF-SEC-2026-10-24`  
**Assessment Date:** 2026-10-24  
**Primary Target URL:** `https://www.amankumarx1.xyz/`  
**Primary Target Hostname:** `www.amankumarx1.xyz`  
**Apex Hostname:** `amankumarx1.xyz`  

---

## 1. Authorized Assessment Scope

The scope of this technical security audit is strictly restricted to:
- **FQDN:** `www.amankumarx1.xyz` (and associated apex `amankumarx1.xyz`).
- **Protocol:** HTTPS (port 443) and HTTP (port 80 redirect inspection).
- **Application Context:** Publicly accessible HTML, client-side JavaScript (`script.js`), stylesheets, and static visual assets.
- **Testing Type:** Passive HTTP header inspection, TLS configuration review, non-destructive web application behavior analysis, and DualSurf security-tool integration auditing.

---

## 2. Explicitly Excluded Infrastructure & Boundaries

In accordance with strict ethical testing guidelines and the assessment rules of engagement:
1. **Third-Party CDN Infrastructure:** The target resolves via CNAME to Vercel's global Anycast Edge network (`cname.vercel-dns.com`, IP addresses `76.76.21.164`, `66.33.60.34`, `76.76.21.21`). These IP addresses represent multi-tenant reverse proxy edge nodes serving third-party customers. **Broad IP-range port scanning, Masscan sweeps, and infrastructure-level stress testing are strictly forbidden and excluded.**
2. **Denial-of-Service (DoS) & Destructive Tests:** No volumetric flooding, high-rate fuzzing, memory exhaustion, or destructive payloads were deployed.
3. **Subdomain Enumeration & External Services:** Third-party services linked in portfolio badges (e.g., LinkedIn, GitHub, Instagram) are strictly out of scope.
4. **Active Directory & Domain Infrastructure:** The target website is a static web application hosted on an edge CDN. It does not run an Active Directory Domain Controller or LDAP directory service. Active Directory tools (BloodHound, SharpHound, Impacket, NetExec) are marked **NOT APPLICABLE** for live queries against this target.

---

## 3. Host DNS & Routing Record

| Target Name | Record Type | Resolved Target / IP | Hosting Provider / Notes |
| :--- | :--- | :--- | :--- |
| `www.amankumarx1.xyz` | CNAME | `cname.vercel-dns.com` | Vercel Edge Network |
| `cname.vercel-dns.com` | A | `76.76.21.164`, `66.33.60.34` | Vercel Anycast Edge Node (Mumbai `bom1`) |
| `amankumarx1.xyz` | A | `76.76.21.21` | Vercel Anycast Apex IP |

---

## 4. Testing Window & Rate Controls

- **Assessment Window:** 2026-10-24 19:30 IST – 2026-10-24 20:30 IST
- **Rate Limit:** Standard low-frequency single-request verification with conservative timeouts (10 seconds max).
- **Operator Identity:** DualSurf Security Research Agent / Authorized Assessor.
