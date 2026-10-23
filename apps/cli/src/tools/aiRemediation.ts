import type { FullSecurityAuditResult } from '@dualsurf/shared-types';
import { OllamaClient } from '../ollama/index.js';

/**
 * Generates deterministic, technology-tailored remediation code snippets based on findings and detected stack.
 */
export function generateDeterministicRemediationGuide(audit: FullSecurityAuditResult): string {
  const lines: string[] = [
    `### Automated Security Remediation Playbook for ${audit.host}`,
    `Generated on: ${new Date().toISOString()}`,
    `Detected Technologies: ${[
      ...audit.techProfile.servers,
      ...audit.techProfile.frameworks,
      ...audit.techProfile.cms,
      ...audit.techProfile.cdnWaf,
    ].join(', ') || 'Standard Web Stack'}`,
    '',
  ];

  const hasCsp = audit.findings.some((f) => f.title.toLowerCase().includes('content-security-policy'));
  const hasHsts = audit.findings.some((f) => f.title.toLowerCase().includes('strict-transport-security'));
  const hasDmarc = audit.findings.some((f) => f.title.toLowerCase().includes('dmarc'));
  const hasSpf = audit.findings.some((f) => f.title.toLowerCase().includes('spf'));
  const hasAdmin = audit.adminInterfaces && audit.adminInterfaces.some((a) => a.exposed);
  const hasDbPort = audit.openPorts && audit.openPorts.some((p) => p.service === 'MySQL' || p.service === 'PostgreSQL' || p.service === 'Redis' || p.service === 'MongoDB');
  const hasGraphql = audit.apiDiscovery?.graphQlIntrospectionEnabled;

  // 1. Web Server Hardening (Nginx / Apache / Express)
  if (hasCsp || hasHsts) {
    lines.push('#### 1. Web Server Security Headers Hardening');
    if (audit.techProfile.servers.some((s) => s.toLowerCase().includes('nginx'))) {
      lines.push('**Nginx Configuration (`/etc/nginx/conf.d/security.conf`):**');
      lines.push('```nginx');
      lines.push('add_header Content-Security-Policy "default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; font-src \'self\'; frame-ancestors \'none\';" always;');
      lines.push('add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;');
      lines.push('add_header X-Content-Type-Options "nosniff" always;');
      lines.push('add_header X-Frame-Options "DENY" always;');
      lines.push('add_header Referrer-Policy "strict-origin-when-cross-origin" always;');
      lines.push('add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;');
      lines.push('```');
    } else {
      lines.push('**Node.js / Express Security Middleware (`server.js`):**');
      lines.push('```javascript');
      lines.push('const helmet = require("helmet");');
      lines.push('app.use(helmet({');
      lines.push('  contentSecurityPolicy: {');
      lines.push('    directives: {');
      lines.push('      defaultSrc: ["\'self\'"],');
      lines.push('      scriptSrc: ["\'self\'"],');
      lines.push('      styleSrc: ["\'self\'", "\'unsafe-inline\'"],');
      lines.push('    },');
      lines.push('  },');
      lines.push('  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },');
      lines.push('}));');
      lines.push('```');
    }
    lines.push('');
  }

  // 2. DNS & Email Authentication Remediation
  if (hasDmarc || hasSpf) {
    lines.push('#### 2. Domain & Email Spoofing Defense (DNS Records)');
    if (hasSpf) {
      lines.push('**SPF TXT Record for `' + audit.host + '`:**');
      lines.push('```text');
      lines.push('v=spf1 include:_spf.google.com ~all');
      lines.push('```');
    }
    if (hasDmarc) {
      lines.push('**DMARC TXT Record for `_dmarc.' + audit.host + '`:**');
      lines.push('```text');
      lines.push('v=DMARC1; p=reject; sp=reject; rua=mailto:dmarc-reports@' + audit.host + '; pct=100');
      lines.push('```');
    }
    lines.push('');
  }

  // 3. Exposed Database Perimeter Remediation
  if (hasDbPort) {
    lines.push('#### 3. Database Perimeter Isolation');
    lines.push('Publicly listening databases should be bound strictly to localhost (`127.0.0.1`) or private VPC interfaces:');
    lines.push('```bash');
    lines.push('# MySQL (/etc/mysql/mysql.conf.d/mysqld.cnf):');
    lines.push('bind-address = 127.0.0.1');
    lines.push('');
    lines.push('# PostgreSQL (/etc/postgresql/15/main/postgresql.conf):');
    lines.push('listen_addresses = \'localhost\'');
    lines.push('');
    lines.push('# Restrict external firewall access with UFW:');
    lines.push('sudo ufw delete allow 3306/tcp');
    lines.push('sudo ufw delete allow 5432/tcp');
    lines.push('sudo ufw delete allow 6379/tcp');
    lines.push('```');
    lines.push('');
  }

  // 4. GraphQL Introspection Hardening
  if (hasGraphql) {
    lines.push('#### 4. GraphQL Introspection Hardening');
    lines.push('Disable GraphQL schema introspection in production environments:');
    lines.push('```javascript');
    lines.push('// Apollo Server (Node.js):');
    lines.push('const server = new ApolloServer({');
    lines.push('  typeDefs,');
    lines.push('  resolvers,');
    lines.push('  introspection: process.env.NODE_ENV !== "production",');
    lines.push('});');
    lines.push('```');
    lines.push('');
  }

  // 5. Admin Routes & Exposed Configuration
  if (hasAdmin) {
    lines.push('#### 5. Restrict Administrative & Debug Interfaces');
    lines.push('Block public access to `.env`, `.git`, and `/actuator` via reverse proxy:');
    lines.push('```nginx');
    lines.push('location ~ /\\.(env|git) {');
    lines.push('    deny all;');
    lines.push('    return 404;');
    lines.push('}');
    lines.push('');
    lines.push('location /actuator/ {');
    lines.push('    allow 10.0.0.0/8;');
    lines.push('    deny all;');
    lines.push('}');
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate AI-augmented remediation plan using local Ollama instance if available,
 * with seamless fallback to deterministic template.
 */
export async function generateAiRemediationPlan(
  audit: FullSecurityAuditResult,
  ollamaClient?: OllamaClient
): Promise<string> {
  const deterministicPlan = generateDeterministicRemediationGuide(audit);

  if (!ollamaClient) {
    return deterministicPlan;
  }

  try {
    const isOnline = await ollamaClient.isAvailable();
    if (!isOnline) {
      return deterministicPlan;
    }

    const criticalFindings = audit.findings
      .filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')
      .map((f) => `- [${f.severity}] ${f.title}: ${f.description}`)
      .join('\n');

    if (!criticalFindings) {
      return deterministicPlan;
    }

    const prompt = `You are a Principal Security Architect. Write a concise, actionable remediation guide for the following security audit findings on website "${audit.host}".
Technologies detected: ${audit.techProfile.servers.concat(audit.techProfile.frameworks).join(', ') || 'Nginx / Node.js'}.

Key findings:
${criticalFindings}

Provide exact, copy-pasteable configuration or code blocks to fix these issues immediately.`;

    const chatMsg = await ollamaClient.chat({
      messages: [
        {
          role: 'system',
          content: 'You are an expert DevSecOps and Application Security engineer. Be concise, technical, and provide production-ready code.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      timeoutMs: 15000,
    });
    const response = chatMsg?.content;

    if (response && response.trim().length > 50) {
      return `### AI-Synthesized Security Remediation Plan (via Local Ollama)\n\n${response.trim()}\n\n---\n\n${deterministicPlan}`;
    }
  } catch {
    // Fallback to deterministic plan
  }

  return deterministicPlan;
}
