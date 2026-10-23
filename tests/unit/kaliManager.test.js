import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  kaliRuntimeManager,
  kaliLabManager,
  kaliCopilotEngine,
  KALI_METAPACKAGES,
  formatKaliRuntimesReport,
  formatKaliMetapackagesReport,
  formatKaliLabsReport,
  formatCopilotProposal,
} from '../../apps/cli/dist/tools/kaliManager.js';

describe('Kali Linux Security Workstation & Manager', () => {
  describe('KaliRuntimeManager', () => {
    it('discovers execution runtimes and includes local host fallback', () => {
      const runtimes = kaliRuntimeManager.listRuntimes();
      assert.ok(Array.isArray(runtimes));
      assert.ok(runtimes.length >= 1, 'Should find at least host-local runtime');

      const hostLocal = runtimes.find((r) => r.type === 'host-local');
      assert.ok(hostLocal, 'Host-local runtime profile must be present');
      assert.equal(hostLocal.status, 'online');
    });

    it('retrieves active runtime profile with valid id and name', () => {
      const active = kaliRuntimeManager.getActiveRuntime();
      assert.ok(active, 'Active runtime profile must exist');
      assert.ok(active.id);
      assert.ok(active.name);
      assert.ok(active.type);
    });

    it('builds correct execution command prefix for local host', () => {
      const res = kaliRuntimeManager.buildExecutionCommand('whoami');
      assert.ok(res.command);
      assert.ok(res.envDesc);
    });
  });

  describe('Kali Metapackage Catalog (Zero Fabrication)', () => {
    it('contains all 13 official Kali Linux metapackages', () => {
      assert.ok(Array.isArray(KALI_METAPACKAGES));
      assert.equal(KALI_METAPACKAGES.length, 13);

      const pkgNames = KALI_METAPACKAGES.map((p) => p.name);
      assert.ok(pkgNames.includes('kali-linux-core'));
      assert.ok(pkgNames.includes('kali-linux-default'));
      assert.ok(pkgNames.includes('kali-linux-headless'));
      assert.ok(pkgNames.includes('kali-linux-everything'));
      assert.ok(pkgNames.includes('kali-tools-top10'));
      assert.ok(pkgNames.includes('kali-tools-web'));
      assert.ok(pkgNames.includes('kali-tools-forensics'));
      assert.ok(pkgNames.includes('kali-tools-reverse-engineering'));
      assert.ok(pkgNames.includes('kali-tools-wireless'));
    });

    it('ensures each metapackage has valid apt install instructions and package counts', () => {
      for (const pkg of KALI_METAPACKAGES) {
        assert.ok(pkg.installCommand.startsWith('sudo apt update && sudo apt install -y'));
        assert.ok(pkg.installCommand.includes(pkg.name));
        assert.ok(pkg.packageCount > 0);
        assert.ok(pkg.category.length > 0);
        assert.ok(Array.isArray(pkg.sampleTools));
        assert.ok(pkg.sampleTools.length > 0);
      }
    });

    it('formats a clean terminal report of metapackages', () => {
      const report = formatKaliMetapackagesReport(KALI_METAPACKAGES);
      assert.ok(report.includes('OFFICIAL KALI LINUX METAPACKAGES CATALOG'));
      assert.ok(report.includes('kali-tools-top10'));
      assert.ok(report.includes('kali-tools-web'));
    });
  });

  describe('KaliLabManager', () => {
    it('returns pre-seeded isolated lab profiles', () => {
      const labs = kaliLabManager.listLabs();
      assert.ok(Array.isArray(labs));
      assert.ok(labs.length >= 3);

      const ms3 = labs.find((l) => l.id === 'LAB-METASPLOITABLE-3');
      assert.ok(ms3);
      assert.ok(ms3.name.includes('Metasploitable 3'));
      assert.equal(ms3.snapshotSupported, true);
      assert.equal(ms3.linkedRoEScopeId, 'ROE-2026-001');

      const juiceShop = labs.find((l) => l.id === 'LAB-JUICE-SHOP-WEB');
      assert.ok(juiceShop);
      assert.equal(juiceShop.targetIpOrHost, '127.0.0.1:3000');
    });

    it('formats a clean terminal report of lab environments', () => {
      const labs = kaliLabManager.listLabs();
      const report = formatKaliLabsReport(labs);
      assert.ok(report.includes('ISOLATED KALI LABS & DISPOSABLE TEST TARGETS'));
      assert.ok(report.includes('Metasploitable 3'));
      assert.ok(report.includes('OWASP Juice Shop'));
    });
  });

  describe('KaliCopilotEngine', () => {
    it('proposes verified tshark command for PCAP DNS inspection', () => {
      const proposal = kaliCopilotEngine.proposeCommand(
        'Analyze this packet capture and identify unusual DNS queries',
        'traffic.pcap'
      );
      assert.ok(proposal);
      assert.equal(proposal.toolName, 'tshark');
      assert.ok(proposal.proposedCommand.includes('tshark'));
      assert.equal(proposal.riskLevel, 'LOW');
      assert.equal(proposal.requiresApproval, true);
    });

    it('proposes nuclei command for vulnerability detection on target', () => {
      const proposal = kaliCopilotEngine.proposeCommand(
        'Scan authorized lab target for web vulnerabilities and cve',
        '192.168.1.50'
      );
      assert.ok(proposal);
      assert.equal(proposal.toolName, 'nuclei');
      assert.ok(proposal.proposedCommand.includes('nuclei'));
      assert.equal(proposal.requiresApproval, true);
    });

    it('proposes privilege audit for Linux configuration', () => {
      const proposal = kaliCopilotEngine.proposeCommand(
        'Check current user sudo permissions on this Linux machine'
      );
      assert.ok(proposal);
      assert.equal(proposal.toolName, 'sudo');
      assert.ok(proposal.proposedCommand.includes('sudo -l'));
      assert.equal(proposal.requiredPrivileges, 'sudo');
    });

    it('formats human-readable proposal with approval gate', () => {
      const proposal = kaliCopilotEngine.proposeCommand('find listening sockets', 'local');
      const text = formatCopilotProposal(proposal);
      assert.ok(text.includes('DUALSURF AI COMMAND COPILOT: PREVIEW'));
      assert.ok(text.includes('Proposed Command:'));
      assert.ok(text.includes('AWAITING OPERATOR APPROVAL'));
    });
  });
});
