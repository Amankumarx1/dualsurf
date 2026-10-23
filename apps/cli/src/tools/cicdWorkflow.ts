import * as fs from 'fs';
import * as path from 'path';

export interface WorkflowOptions {
  targetUrl?: string;
  workflowName?: string;
  cronSchedule?: string;
}

/**
 * Generate standard GitHub Actions YAML workflow for automated security regression gating.
 */
export function generateGitHubActionWorkflow(options: WorkflowOptions = {}): string {
  const target = options.targetUrl || 'https://example.com';
  const name = options.workflowName || 'DualSurf Continuous Security Audit';
  const cron = options.cronSchedule || '0 4 * * 1'; // Weekly Monday at 4am

  return `name: ${name}

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  schedule:
    - cron: '${cron}'
  workflow_dispatch:

jobs:
  dualsurf-security-gate:
    name: Attack Surface & Vulnerability Audit
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install DualSurf Autonomous Security Scanner
        run: npm install -g @dualsurf/cli

      - name: Execute Full Attack Surface & Vulnerability Assessment
        env:
          TARGET_URL: \${{ secrets.DUALSURF_TARGET_URL || '${target}' }}
        run: |
          mkdir -p reports
          echo "Starting DualSurf automated assessment for $TARGET_URL..."
          dualsurf assess "$TARGET_URL" reports/audit.md --all --sarif --profile common

      - name: Upload Security Results to GitHub Code Scanning (SARIF)
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: reports/audit.sarif

      - name: Archive Assessment Artifacts (HTML, Markdown, JSON)
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: dualsurf-security-reports
          path: reports/
`;
}

/**
 * Write GitHub Actions workflow file to .github/workflows/dualsurf-security-audit.yml in current workspace.
 */
export function writeGitHubActionWorkflow(
  customPath?: string,
  options: WorkflowOptions = {}
): string {
  const defaultDir = path.resolve(process.cwd(), '.github', 'workflows');
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  const filePath = customPath || path.join(defaultDir, 'dualsurf-security-audit.yml');
  const yamlContent = generateGitHubActionWorkflow(options);
  fs.writeFileSync(filePath, yamlContent, 'utf8');
  return filePath;
}
