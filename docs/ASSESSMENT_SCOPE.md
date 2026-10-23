# DualSurf Rules of Engagement (RoE) Scope Enforcement

## 1. Zero-Bypass Backend Scope Policy

DualSurf implements a mandatory, backend **Default-Deny** scope enforcement architecture. Testing requests cannot bypass authorization simply because the operator typed a target into the terminal or clicked an action in the GUI.

Every command dispatched through `executeRedTeamTool()` or `dualsurf red exec` passes through `EngagementScopeStore.validateTargetScope()` before child process invocation.

---

## 2. Scope Evaluation Sequence

```
Target Request (URL / Domain / IP / CIDR)
   │
   ▼
1. Active Scope Status Check (Must be "Active" or "Approved")
   │
   ▼
2. Assessment Testing Window Check (Must fall within start/end dates)
   │
   ▼
3. Target Normalization (Strip protocols, ports, paths, query strings)
   │
   ▼
4. Explicit Exclusions Check [PRIORITY 1]
   └── If matched in scope.exclusions -> REJECT (OUT_OF_SCOPE)
   │
   ▼
5. Prohibited Techniques Check
   └── If tool matches scope.prohibitedTechniques -> REJECT (OUT_OF_SCOPE)
   │
   ▼
6. In-Scope Domain Check
   ├── Exact domain match -> ALLOW (VERIFIED)
   └── Subdomain match (if allowSubdomains: true) -> ALLOW (VERIFIED)
   │
   ▼
7. In-Scope IPv4 CIDR Subnet Check
   ├── Exact IP address match -> ALLOW (VERIFIED)
   ├── Bitwise CIDR subnet mask match -> ALLOW (VERIFIED)
   └── Localhost alias match (if 127.0.0.1 in scope) -> ALLOW (VERIFIED)
   │
   ▼
8. Default-Deny Fallback -> REJECT (OUT_OF_SCOPE)
```

---

## 3. Subnet Bitmask Verification

DualSurf implements bitwise 32-bit unsigned IPv4 subnet matching:

$$\text{Netmask} = (\sim 0 \ll (32 - \text{maskBits})) \ggg 0$$

$$\text{Match} = (\text{TargetInt} \ \& \ \text{Netmask}) == (\text{BaseInt} \ \& \ \text{Netmask})$$

This guarantees exact evaluation of CIDRs such as `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.1.0/24`.

---

## 4. Audit Logging and Evidence Recording

Every scope decision (permitted or rejected) is:
1. Recorded in the scope profile's persistent `auditTrail` with timestamp, actor, normalized target, and reason.
2. If rejected, an `OUT_OF_SCOPE` evidence record is saved to `~/.dualsurf/evidence.json` with execution duration, target, tool, and rejection details.

---

## 5. Scope Management Commands

```bash
# List all registered Rules of Engagement profiles
dualsurf red scope list

# Show detailed boundaries and exclusions for a specific scope
dualsurf red scope show ROE-2026-001

# Validate whether a target is permitted before launching scans
dualsurf red scope validate ROE-2026-001 192.168.1.50
dualsurf red scope validate ROE-2026-001 targetcorp.com
dualsurf red scope validate ROE-2026-001 excluded.targetcorp.com

# Create a new authorized scope profile
dualsurf red scope create "FinTech Client Engagement" \
  --domains "fintech.example.com,api.fintech.example.com" \
  --ips "10.200.0.0/24" \
  --exclusions "vault.fintech.example.com,10.200.0.1"
```
