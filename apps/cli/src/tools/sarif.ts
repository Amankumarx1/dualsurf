import * as fs from 'fs';
import * as path from 'path';
import type { FullSecurityAuditResult, PentestFinding } from '@dualsurf/shared-types';

/**
 * Maps CVSS score or Finding Severity to SARIF level and GitHub security-severity score.
 */
function getSarifLevel(severity: PentestFinding['severity']): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'CRITICAL':
    case 'HIGH':
      return 'error';
    case 'MEDIUM':
      return 'warning';
    case 'LOW':
    case 'INFORMATIONAL':
    default:
      return 'note';
  }
}

function getSecuritySeverityScore(finding: PentestFinding): string {
  if (finding.cvssScore) {
    return finding.cvssScore.toFixed(1);
  }
  switch (finding.severity) {
    case 'CRITICAL':
      return '9.5';
    case 'HIGH':
      return '8.0';
    case 'MEDIUM':
      return '5.5';
    case 'LOW':
      return '3.0';
    case 'INFORMATIONAL':
    default:
      return '1.0';
  }
}

/**
 * Generate standard OASIS SARIF v2.1.0 document from FullSecurityAuditResult.
 * Fully compatible with GitHub Code Scanning (upload-sarif) and GitLab Security Dashboard.
 */
export function generateSarifReport(audit: FullSecurityAuditResult): object {
  const rules = audit.findings.map((f) => {
    const cweTag = f.cweId ? `external/cwe/${f.cweId.toLowerCase()}` : 'security';
    return {
      id: f.id,
      name: f.title.replace(/[^a-zA-Z0-9]/g, ''),
      shortDescription: {
        text: f.title,
      },
      fullDescription: {
        text: f.description,
      },
      helpUri: f.remediation ? undefined : 'https://owasp.org',
      help: {
        text: `${f.description}\n\nRemediation:\n${f.remediation || 'Apply defense-in-depth security best practices.'}`,
        markdown: `### ${f.title}\n\n**Severity:** ${f.severity} (CVSS ${f.cvssScore || 'N/A'})\n\n${f.description}\n\n#### Remediation Advice:\n${f.remediation || 'Apply defense-in-depth security best practices.'}`,
      },
      defaultConfiguration: {
        level: getSarifLevel(f.severity),
      },
      properties: {
        tags: ['security', cweTag],
        'security-severity': getSecuritySeverityScore(f),
        precision: 'high',
        problem: {
          severity: f.severity.toLowerCase(),
        },
      },
    };
  });

  const results = audit.findings.map((f) => {
    return {
      ruleId: f.id,
      level: getSarifLevel(f.severity),
      message: {
        text: `${f.title}: ${f.description}`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: audit.targetUrl || audit.host,
            },
            region: {
              startLine: 1,
            },
          },
        },
      ],
    };
  });

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'DualSurf Security Assessment Engine',
            semanticVersion: '1.0.0',
            informationUri: 'https://github.com/dualsurf',
            rules,
          },
        },
        results,
      },
    ],
  };
}

/**
 * Export SARIF to disk.
 */
export function exportSarifToDisk(audit: FullSecurityAuditResult, customPath?: string): string {
  const filePath = customPath || path.resolve(process.cwd(), `security-audit-${audit.host.replace(/[^a-zA-Z0-9.-]/g, '_')}.sarif`);
  const sarifData = generateSarifReport(audit);
  fs.writeFileSync(filePath, JSON.stringify(sarifData, null, 2), 'utf8');
  return filePath;
}

/**
 * Send rich security notification card to Slack, Discord, Microsoft Teams, or Webhook endpoint.
 */
export async function sendSecurityWebhook(
  webhookUrl: string,
  audit: FullSecurityAuditResult
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const criticalCount = audit.findings.filter((f) => f.severity === 'CRITICAL').length;
    const highCount = audit.findings.filter((f) => f.severity === 'HIGH').length;
    const mediumCount = audit.findings.filter((f) => f.severity === 'MEDIUM').length;

    // Discord / Slack color mapping: Red for critical/high, Yellow for medium, Green for clean
    const colorHex = criticalCount > 0 ? 0xff0033 : highCount > 0 ? 0xff6600 : mediumCount > 0 ? 0xffcc00 : 0x00cc66;

    const payload = {
      username: 'DualSurf Security Sentinel',
      content: `🔒 **DualSurf Security Assessment Complete** for **${audit.host}**`,
      embeds: [
        {
          title: `Security Assessment Report: ${audit.host}`,
          url: audit.targetUrl,
          color: colorHex,
          description: `Security Grade: **${audit.grade}** (${audit.securityScore}/100) — Status: **${audit.riskRating}**\nDuration: ${audit.durationMs}ms`,
          fields: [
            {
              name: 'Vulnerability Summary',
              value: `🔴 Critical: **${criticalCount}**\n🟠 High: **${highCount}**\n🟡 Medium: **${mediumCount}**\nTotal Findings: **${audit.findings.length}**`,
              inline: true,
            },
            {
              name: 'Perimeter Exposure',
              value: `🌐 Assets: **${audit.attackSurfaceRegister?.length || 1}**\n🔌 Open Ports: **${audit.openPorts?.length || 0}**\n📧 DMARC: **${(audit.emailSecurity?.dmarcPolicy || 'none').toUpperCase()}**`,
              inline: true,
            },
            {
              name: 'Top Critical & High Findings',
              value:
                audit.findings
                  .filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')
                  .slice(0, 4)
                  .map((f) => `• [${f.severity}] **${f.title}** (CVSS ${f.cvssScore || 'N/A'})`)
                  .join('\n') || 'None detected. Perimeter and application hygiene verified.',
            },
          ],
          footer: {
            text: `DualSurf Autonomous Security Audit • ${new Date().toISOString()}`,
          },
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000),
    });

    return { success: res.ok, statusCode: res.status };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
