import * as readline from 'readline';
import { IpcClient } from './IpcClient.js';
import {
  formatBanner,
  formatNumberedLinks,
  formatHeadings,
  formatPageHeader,
  formatPageText,
  formatTabsList,
  formatBookmarks,
  formatHistory,
  formatDownloads,
  formatFindResults,
  formatEndpoints,
  colors,
} from './formatters.js';
import { IPC_COMMANDS } from '@dualsurf/ipc-protocol';
import type { BrowserControllerState, PageMetadata } from '@dualsurf/shared-types';
import { OllamaClient } from './ollama/index.js';
import { AgentRunner } from './agent/index.js';
import { findBestMatchingLink, findBestMatchingTab, findTopMatchingLinks } from './semantic/index.js';

export async function runInteractiveSession(client: IpcClient): Promise<void> {
  const isOnline = await client.isControllerAvailable();
  if (!isOnline) {
    console.error(
      `${colors.red}Error: DualSurf browser controller is not running.${colors.reset}\n` +
      `Please start DualSurf first (run "dualsurf" to launch GUI or controller).`
    );
    process.exit(1);
  }

  const ollama = new OllamaClient();
  const agent = new AgentRunner(client, ollama);

  console.log(formatBanner());
  console.log(`${colors.green}Connected to live DualSurf browser session.${colors.reset}`);

  const isOllamaOnline = await ollama.isAvailable();
  if (isOllamaOnline) {
    const currentModel = await ollama.getOrSelectModel();
    console.log(
      `${colors.cyan}🤖 Ollama AI Assistant:${colors.reset} ${colors.green}Active${colors.reset} (Model: ${colors.bold}${currentModel}${colors.reset})`
    );
  } else {
    console.log(
      `${colors.dim}🤖 Ollama AI Assistant: Offline (Run "ollama run llama3.2:1b" to enable AI browsing)${colors.reset}`
    );
  }

  console.log(`${colors.dim}Type "help" for commands, or type any natural language goal to browse.${colors.reset}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.bold}${colors.cyan}dualsurf>${colors.reset} `,
    completer: (line: string) => {
      const completions = [
        'open',
        'text',
        'links',
        'endpoints',
        'click',
        'headings',
        'find',
        'tabs',
        'tab',
        'back',
        'forward',
        'reload',
        'stop',
        'page',
        'search',
        'ask',
        'summarize',
        'compare',
        'extract',
        'do',
        'agent',
        'model',
        'bookmarks',
        'history',
        'downloads',
        'gui',
        'tools',
        'offline',
        'assess',
        'ports',
        'port-scan',
        'attack-surface',
        'asm',
        'dns',
        'proxy',
        'repeater',
        'recon',
        'scan',
        'audit',
        'sec-audit',
        'vuln',
        'security',
        'cert',
        'ssl',
        'cors',
        'tech',
        'fingerprint',
        'secrets',
        'siem',
        'logs',
        'ioc',
        'ti',
        'case',
        'ir',
        'hash',
        'dfir',
        'soar',
        'mitre',
        'attack',
        'blue',
        'roadmap',
        'checklist',
        'sigma',
        'hunt',
        'yara',
        'red',
        'roe',
        'scope',
        'finding',
        'findings',
        'pentest',
        'purple',
        'emulation',
        'study',
        'headers',
        'cookies',
        'storage',
        'export',
        'report',
        'status',
        'context',
        'sh',
        'exec',
        'sudo',
        'su',
        'cd',
        'pwd',
        'ls',
        'dir',
        'whoami',
        'help',
        'quit',
        'exit',
      ];
      const hits = completions.filter((c) => c.startsWith(line.trim()));
      return [hits.length ? hits : completions, line];
    },
  });

  const updatePrompt = (urlOrTitle?: string) => {
    let contextStr = '';
    if (urlOrTitle && urlOrTitle !== 'about:blank') {
      try {
        const u = new URL(urlOrTitle);
        contextStr = ` ${colors.dim}[${u.hostname}]${colors.reset}`;
      } catch {
        const clean = urlOrTitle.substring(0, 22).replace(/\s+/g, ' ');
        contextStr = ` ${colors.dim}[${clean}]${colors.reset}`;
      }
    }
    rl.setPrompt(`${colors.bold}${colors.cyan}dualsurf${colors.reset}${contextStr}> `);
  };

  const sendCommand = async (command: string, params?: any): Promise<any> => {
    try {
      return await client.sendCommand(command, params);
    } catch (err: any) {
      if (err.message && err.message.includes('Browser controller unavailable')) {
        console.log(`${colors.cyan}[DualSurf]${colors.reset} Controller connection lost. Reconnecting...`);
        const { autoStartControllerIfOffline } = await import('./launcher.js');
        const reconnected = await autoStartControllerIfOffline(client);
        if (reconnected) {
          return await client.sendCommand(command, params);
        }
      }
      throw err;
    }
  };

  // Initial prompt setup
  sendCommand(IPC_COMMANDS.PAGE_GET_METADATA)
    .then((m) => {
      if (m && m.url) updatePrompt(m.url);
    })
    .catch(() => {});

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    const parts = input.split(' ');
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ').trim();

    // Built-in Shell Directory Navigation
    if (cmd === 'cd') {
      const targetDir = arg || process.env.HOME || process.env.USERPROFILE || '.';
      try {
        process.chdir(targetDir);
        console.log(`${colors.green}Directory:${colors.reset} ${process.cwd()}`);
      } catch (err: any) {
        console.log(`${colors.red}cd error:${colors.reset} ${err.message}`);
      }
      rl.prompt();
      return;
    }

    if (cmd === 'pwd') {
      console.log(process.cwd());
      rl.prompt();
      return;
    }

    // Direct Privileged & Host Shell Commands (sudo, sudo su, su, bash, cmd, nmap, curl, etc.)
    const isDirectSystemCmd =
      cmd === 'sudo' ||
      cmd === 'su' ||
      cmd === 'cmd' ||
      cmd === 'powershell' ||
      cmd === 'bash' ||
      cmd === 'zsh' ||
      /^(apt|apt-get|dpkg|pacman|dnf|systemctl|service|nmap|curl|wget|ping|traceroute|dig|whois|ifconfig|ip|netstat|ss|ps|top|htop|kill|killall|cat|type|ls|dir|whoami|id|uname|chmod|chown|mkdir|rm|cp|mv|grep|findstr|airmon-ng|airodump-ng|wireshark|tcpdump|nikto|sqlmap|gobuster|hydra|john|msfconsole)\b/i.test(cmd);

    if (isDirectSystemCmd) {
      console.log(`${colors.dim}[System execution: ${input}]${colors.reset}`);
      rl.pause();
      try {
        const { executeInteractiveShellCommand } = await import('./tools/index.js');
        await executeInteractiveShellCommand(input);
      } catch (err: any) {
        console.error(`${colors.red}Execution error: ${err.message}${colors.reset}`);
      } finally {
        rl.resume();
        rl.prompt();
      }
      return;
    }

    // Shell Escape (! <cmd>): Execute any arbitrary local tool/script
    if (input.startsWith('!')) {
      const shellCmd = input.substring(1).trim();
      if (!shellCmd) {
        console.log(`${colors.yellow}Usage: ! <system command> (e.g. "! nmap localhost", "! sudo su", "! curl -I ...", "! ping 127.0.0.1")${colors.reset}`);
      } else {
        console.log(`${colors.dim}[Executing: ${shellCmd}]${colors.reset}`);
        rl.pause();
        try {
          const { executeInteractiveShellCommand } = await import('./tools/index.js');
          await executeInteractiveShellCommand(shellCmd);
        } catch (err: any) {
          console.error(`${colors.red}Execution error: ${err.message}${colors.reset}`);
        } finally {
          rl.resume();
        }
      }
      rl.prompt();
      return;
    }

    try {
      switch (cmd) {
        case 'quit':
        case 'exit':
        case 'q': {
          console.log(`${colors.dim}Exiting interactive terminal mode.${colors.reset}`);
          rl.close();
          return;
        }

        case 'help':
        case 'h': {
          printReplHelp();
          break;
        }

        case 'tabs': {
          const state: BrowserControllerState = await sendCommand(IPC_COMMANDS.TABS_LIST);
          console.log(formatTabsList(state));
          break;
        }

        case 'tab': {
          if (!arg) {
            const state: BrowserControllerState = await sendCommand(IPC_COMMANDS.TABS_LIST);
            console.log(formatTabsList(state));
          } else if (arg.startsWith('new')) {
            const url = arg.substring(3).trim();
            const tab = await sendCommand(IPC_COMMANDS.TABS_CREATE, { url: url || undefined });
            console.log(`${colors.green}Opened new tab:${colors.reset} ${tab.id} (${tab.url})`);
          } else if (arg.startsWith('close')) {
            const indexStr = arg.substring(5).trim();
            const index = indexStr ? parseInt(indexStr, 10) : undefined;
            await sendCommand(IPC_COMMANDS.TABS_CLOSE, { index });
            console.log(`${colors.yellow}Closed tab.${colors.reset}`);
          } else {
            const index = parseInt(arg, 10);
            if (!isNaN(index)) {
              await sendCommand(IPC_COMMANDS.TABS_SWITCH, { index });
              console.log(`${colors.green}Switched to tab [${index}].${colors.reset}`);
            } else {
              // Semantic tab search by keyword/title
              const state: BrowserControllerState = await sendCommand(IPC_COMMANDS.TABS_LIST);
              const match = findBestMatchingTab(arg, state.tabs);
              if (match) {
                await sendCommand(IPC_COMMANDS.TABS_SWITCH, { tabId: match.tab.id });
                console.log(
                  `${colors.green}Switched to tab [${match.index}]:${colors.reset} "${match.tab.title}"`
                );
              } else {
                console.log(`${colors.yellow}No tab matching "${arg}" found.${colors.reset}`);
              }
            }
          }
          break;
        }

        case 'open':
        case 'goto': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: open <URL or domain>${colors.reset}`);
          } else {
            console.log(`${colors.dim}Navigating to: ${arg}...${colors.reset}`);
            await sendCommand(IPC_COMMANDS.PAGE_NAVIGATE, { url: arg });
            console.log(`${colors.green}Navigation initiated.${colors.reset}`);
          }
          break;
        }

        case 'search': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: search <query>${colors.reset}`);
          } else {
            console.log(`${colors.dim}Searching for: "${arg}"...${colors.reset}`);
            await sendCommand(IPC_COMMANDS.PAGE_NAVIGATE, { url: arg });
            console.log(`${colors.green}Search dispatched.${colors.reset}`);
          }
          break;
        }

        case 'page': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(formatPageHeader(meta));
          break;
        }

        case 'text': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(formatPageText(meta));
          break;
        }

        case 'links': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(formatNumberedLinks(meta.links));
          break;
        }

        case 'endpoints':
        case 'routes': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(formatEndpoints(meta.endpoints, arg));
          break;
        }

        case 'recon':
        case 'scan':
        case 'audit': {
          console.log(`${colors.dim}Running target reconnaissance on active page...${colors.reset}`);
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          const { analyzeSecurityHeaders, formatReconSummary } = await import('./tools/recon.js');
          let headers;
          try {
            headers = await analyzeSecurityHeaders(meta.url);
          } catch {
            // offline fallback
          }
          console.log(formatReconSummary(meta, headers));
          break;
        }

        case 'headers':
        case 'header': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          const targetUrl = arg || meta.url;
          console.log(`${colors.dim}Fetching security headers for: ${targetUrl}...${colors.reset}`);
          const { analyzeSecurityHeaders, formatSecurityHeaders } = await import('./tools/recon.js');
          const analysis = await analyzeSecurityHeaders(targetUrl);
          console.log(formatSecurityHeaders(analysis));
          break;
        }

        case 'cookies':
        case 'cookie': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          const { formatCookies } = await import('./tools/recon.js');
          console.log(formatCookies(meta));
          break;
        }

        case 'storage':
        case 'localstorage': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          const { formatStorage } = await import('./tools/recon.js');
          console.log(formatStorage(meta));
          break;
        }

        case 'export':
        case 'report': {
          const filename = arg || 'audit-report.md';
          console.log(`${colors.dim}Generating security & DOM audit report...${colors.reset}`);
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          const { analyzeSecurityHeaders, generateMarkdownReport, exportReportToFile } = await import('./tools/recon.js');
          let headers;
          try {
            headers = await analyzeSecurityHeaders(meta.url);
          } catch {
            // offline fallback
          }
          const report = generateMarkdownReport(meta, headers);
          const fullPath = exportReportToFile(filename, report);
          console.log(`${colors.green}✔ Audit report exported to:${colors.reset} ${colors.bold}${fullPath}${colors.reset} (${report.length} bytes)`);
          break;
        }

        case 'assess':
        case 'scan':
        case 'auto-audit': {
          const subArgs = (arg || '').trim().split(/\s+/).filter(Boolean);
          if (subArgs[0] === 'diff') {
            const prevFile = subArgs[1];
            const currFile = subArgs[2];
            if (!prevFile || !currFile) {
              console.log(`${colors.yellow}Usage: scan diff <prev.json> <curr.json>${colors.reset}`);
              break;
            }
            const fs = await import('fs');
            const path = await import('path');
            const pPath = path.isAbsolute(prevFile) ? prevFile : path.resolve(process.cwd(), prevFile);
            const cPath = path.isAbsolute(currFile) ? currFile : path.resolve(process.cwd(), currFile);
            if (!fs.existsSync(pPath) || !fs.existsSync(cPath)) {
              console.log(`${colors.red}Error: One or both audit JSON files not found.${colors.reset}`);
              break;
            }
            const prevJson = JSON.parse(fs.readFileSync(pPath, 'utf8'));
            const currJson = JSON.parse(fs.readFileSync(cPath, 'utf8'));
            const { compareAuditResults, formatAuditComparisonTerminal } = await import('./tools/autoAudit.js');
            const diff = compareAuditResults(prevJson, currJson);
            console.log(formatAuditComparisonTerminal(diff));
            break;
          }

          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          const exportHtml = subArgs.includes('--html') || subArgs.includes('--all');
          const exportJson = subArgs.includes('--json') || subArgs.includes('--all');
          const exportSarif = subArgs.includes('--sarif') || subArgs.includes('--all');
          const generateCiWorkflow = subArgs.includes('--ci-workflow') || subArgs.includes('--ci');
          const useAi = !subArgs.includes('--no-ai');

          const profileIdx = subArgs.indexOf('--profile');
          const portProfile = profileIdx !== -1 && subArgs[profileIdx + 1] ? (subArgs[profileIdx + 1].toLowerCase() as any) : 'web';
          const scanPortsFlag = !subArgs.includes('--no-ports');

          const cookieIdx = subArgs.indexOf('--cookie');
          const authCookie = cookieIdx !== -1 && subArgs[cookieIdx + 1] ? subArgs[cookieIdx + 1] : undefined;

          const tokenIdx = subArgs.indexOf('--token') !== -1 ? subArgs.indexOf('--token') : subArgs.indexOf('--auth');
          const bearerToken = tokenIdx !== -1 && subArgs[tokenIdx + 1] ? subArgs[tokenIdx + 1] : undefined;

          const webhookIdx = subArgs.indexOf('--webhook');
          const webhookUrl = webhookIdx !== -1 && subArgs[webhookIdx + 1] ? subArgs[webhookIdx + 1] : undefined;

          const cleaned = subArgs.filter((a, i) =>
            a !== '--html' && a !== '--json' && a !== '--all' && a !== '--no-ports' &&
            a !== '--sarif' && a !== '--ai' && a !== '--no-ai' &&
            a !== '--ci-workflow' && a !== '--ci' &&
            a !== '--profile' && subArgs[i - 1] !== '--profile' &&
            a !== '--cookie' && subArgs[i - 1] !== '--cookie' &&
            a !== '--token' && subArgs[i - 1] !== '--token' &&
            a !== '--auth' && subArgs[i - 1] !== '--auth' &&
            a !== '--webhook' && subArgs[i - 1] !== '--webhook'
          );

          const target = (cleaned[0] && !cleaned[0].endsWith('.md') && !cleaned[0].endsWith('.html') && !cleaned[0].endsWith('.json') && !cleaned[0].endsWith('.sarif'))
            ? cleaned[0]
            : (meta.url || 'about:blank');
          const outputFile = (cleaned[0]?.endsWith('.md') || cleaned[0]?.endsWith('.html') || cleaned[0]?.endsWith('.json') || cleaned[0]?.endsWith('.sarif'))
            ? cleaned[0]
            : cleaned[1];

          if (!target || target === 'about:blank') {
            console.log(`${colors.yellow}Usage: assess <url> [report.md] [--html] [--json] [--sarif] [--ci-workflow] [--profile <web|common|db|all>] [--cookie <str>] [--token <jwt>] [--webhook <url>]${colors.reset}`);
            break;
          }

          console.log(`\n${colors.cyan}Initiating complete end-to-end security assessment for:${colors.reset} ${colors.bold}${target}${colors.reset}...`);
          if (authCookie || bearerToken) {
            console.log(`  ${colors.magenta}🔒 Authenticated Audit Mode Active (Session headers injected)${colors.reset}`);
          }
          const { runAutomatedSecurityAudit, formatAutoAuditTerminal } = await import('./tools/autoAudit.js');
          const auditResult = await runAutomatedSecurityAudit(target, {
            outputPath: outputFile,
            autoExportReport: true,
            deepInspect: true,
            exportHtml: exportHtml || true,
            exportJson: exportJson,
            exportSarif: exportSarif,
            format: exportJson ? 'all' : 'html',
            scanPorts: scanPortsFlag,
            portProfile: portProfile,
            checkDns: true,
            checkEmailSecurity: true,
            checkAdminRoutes: true,
            deepAttackSurface: true,
            checkCloudBuckets: true,
            checkSubdomainTakeover: true,
            discoverApis: true,
            authCookie,
            bearerToken,
            webhookUrl,
            useAiRemediation: useAi,
            generateCiWorkflow,
          });
          console.log(formatAutoAuditTerminal(auditResult));
          break;
        }

        case 'init-ci': {
          const subArgs = (arg || '').trim().split(/\s+/).filter(Boolean);
          const { writeGitHubActionWorkflow } = await import('./tools/cicdWorkflow.js');
          const targetUrl = subArgs[0] || 'https://example.com';
          const createdPath = writeGitHubActionWorkflow(undefined, { targetUrl });
          console.log(`${colors.green}✔ Created GitHub Actions CI/CD security gate:${colors.reset} ${createdPath}`);
          break;
        }

        case 'ports':
        case 'port':
        case 'port-scan':
        case 'portscan': {
          const subArgs = (arg || '').trim().split(/\s+/).filter(Boolean);
          let profileArg: 'web' | 'common' | 'db' | 'top20' | 'all' = 'web';
          let customPortsArg: number[] | undefined = undefined;

          const profileIdx = subArgs.indexOf('--profile');
          if (profileIdx !== -1 && subArgs[profileIdx + 1]) {
            profileArg = subArgs[profileIdx + 1].toLowerCase() as any;
          }

          const portsIdx = subArgs.indexOf('--ports');
          if (portsIdx !== -1 && subArgs[portsIdx + 1]) {
            customPortsArg = subArgs[portsIdx + 1]
              .split(',')
              .map((p) => parseInt(p.trim(), 10))
              .filter((p) => !isNaN(p) && p > 0 && p <= 65535);
          }

          const candidates = subArgs.filter(
            (a, i) =>
              a !== 'scan' &&
              a !== '--profile' &&
              subArgs[i - 1] !== '--profile' &&
              a !== '--ports' &&
              subArgs[i - 1] !== '--ports'
          );

          let target = candidates[0];
          if (!target || target === 'about:blank') {
            try {
              const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
              target = meta?.url;
            } catch {}
          }

          if (!target || target === 'about:blank') {
            console.log(
              `${colors.yellow}Usage: ports [scan] <target> [--profile <web|common|db|top20|all>] [--ports 80,443,8080] (or navigate to a page first)${colors.reset}`
            );
            break;
          }

          console.log(`\n${colors.cyan}Initiating network port audit for:${colors.reset} ${colors.bold}${target}${colors.reset} (Profile: ${profileArg})...`);
          const { scanPorts, formatPortScanReport } = await import('./tools/portScan.js');
          const portReport = await scanPorts(target, {
            profile: profileArg,
            ports: customPortsArg,
          });
          console.log(formatPortScanReport(portReport));
          break;
        }

        case 'dns': {
          let target = (arg || '').trim();
          if (!target || target === 'about:blank') {
            try {
              const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
              target = meta?.url;
            } catch {}
          }
          if (!target || target === 'about:blank') {
            console.log(`${colors.yellow}Usage: dns <host/domain>${colors.reset}`);
            break;
          }
          const cleanHost = target
            .replace(/^https?:\/\//i, '')
            .split('/')[0]
            .split(':')[0]
            .trim()
            .toLowerCase();

          const { auditDnsAndEmail } = await import('./tools/attackSurface.js');
          const dnsInfo = await auditDnsAndEmail(cleanHost);

          console.log(`\n${colors.bold}${colors.cyan}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
          console.log(`${colors.bold}${colors.cyan}║       DUALSURF DNS & EMAIL AUTHENTICATION SECURITY AUDIT           ║${colors.reset}`);
          console.log(`${colors.bold}${colors.cyan}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
          console.log(`  Target Host:    ${colors.bold}${cleanHost}${colors.reset}`);
          console.log(`  IP Addresses:   ${dnsInfo.ipList.join(', ') || 'None resolved'}`);

          console.log(`\n  ${colors.bold}DNS Records Discovered (${dnsInfo.dnsRecords.length}):${colors.reset}`);
          dnsInfo.dnsRecords.forEach((r) => {
            console.log(`    • [${colors.yellow}${r.type.padEnd(5)}${colors.reset}] ${r.value}`);
          });

          const email = dnsInfo.emailSecurity;
          const policyStr = email.dmarcPolicy || 'missing';
          const dmarcColor = policyStr === 'reject' || policyStr === 'quarantine' ? colors.green : colors.red;
          console.log(`\n  ${colors.bold}Email & Domain Security Posture:${colors.reset}`);
          console.log(`    • SPF Record:   ${email.hasSpf ? colors.green + '✔ CONFIGURED' : colors.red + '✖ MISSING'}${colors.reset} ${email.spfRecord ? `(${email.spfRecord})` : ''}`);
          console.log(`    • DMARC Policy: ${dmarcColor}${policyStr.toUpperCase()}${colors.reset} ${email.dmarcRecord ? `(${email.dmarcRecord})` : colors.red + '(RFC 7489 Policy Missing)' + colors.reset}`);
          if (email.issues.length > 0) {
            console.log(`\n  ${colors.bold}${colors.red}Security Risks & Deficiencies:${colors.reset}`);
            email.issues.forEach((iss) => {
              console.log(`    ${colors.red}✖${colors.reset} ${iss}`);
            });
          } else {
            console.log(`\n  ${colors.green}✔ Domain authentication posture complies with email spoofing defenses.${colors.reset}`);
          }
          console.log('');
          break;
        }

        case 'attack-surface':
        case 'asm': {
          let target = (arg || '').trim();
          if (!target || target === 'about:blank') {
            try {
              const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
              target = meta?.url;
            } catch {}
          }
          if (!target || target === 'about:blank') {
            console.log(`${colors.yellow}Usage: attack-surface <domain/url>${colors.reset}`);
            break;
          }
          const cleanHost = target
            .replace(/^https?:\/\//i, '')
            .split('/')[0]
            .split(':')[0]
            .trim()
            .toLowerCase();
          const baseUrl = /^https?:\/\//i.test(target) ? target : `https://${cleanHost}`;

          console.log(`${colors.dim}Initiating passive external attack surface discovery for: ${cleanHost}...${colors.reset}`);
          const {
            auditDnsAndEmail,
            harvestCertificateTransparencySubdomains,
            probeAdminInterfaces,
            auditCloudStorageBuckets,
            auditSubdomainTakeovers,
            auditApiAndGraphQl,
            buildAttackSurfaceRegister,
            formatAttackSurfaceTerminal,
          } = await import('./tools/attackSurface.js');
          const { inspectTlsCertificate } = await import('./tools/securityAudit.js');

          const [dnsInfo, cert, ctSubs] = await Promise.all([
            auditDnsAndEmail(cleanHost),
            inspectTlsCertificate(cleanHost).catch(() => null),
            harvestCertificateTransparencySubdomains(cleanHost).catch(() => []),
          ]);

          const sanList = cert?.subjectAltNames || [];
          const allDiscoveredSubs = Array.from(new Set([cleanHost, ...sanList, ...ctSubs]));

          const [adminChecks, cloudBuckets, takeovers, apiDiscovery] = await Promise.all([
            probeAdminInterfaces(baseUrl).catch(() => []),
            auditCloudStorageBuckets(cleanHost).catch(() => []),
            auditSubdomainTakeovers(allDiscoveredSubs).catch(() => []),
            auditApiAndGraphQl(baseUrl).catch(() => undefined),
          ]);

          const assets = buildAttackSurfaceRegister(cleanHost, dnsInfo.ipList, sanList, [], ctSubs);

          console.log(
            formatAttackSurfaceTerminal(
              assets,
              dnsInfo.emailSecurity,
              adminChecks,
              cloudBuckets,
              takeovers,
              apiDiscovery
            )
          );
          break;
        }

        case 'proxy': {
          const subArgs = (arg || '').trim().split(/\s+/).filter(Boolean);
          const sub = subArgs[0]?.toLowerCase() || 'status';
          const action = subArgs[1]?.toLowerCase();

          if (sub === 'status') {
            let proxyStatus = {
              running: false,
              port: 8899,
              host: '127.0.0.1',
              totalRequestsHandled: 0,
              totalIntercepted: 0,
              activeBreakpoint: false,
            };
            try {
              proxyStatus = await sendCommand(IPC_COMMANDS.PROXY_GET_STATUS);
            } catch {}

            console.log(`\n${colors.bold}${colors.red}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
            console.log(`${colors.bold}${colors.red}║       DUALSURF HTTP INTERCEPTION PROXY & TRAFFIC ENGINE            ║${colors.reset}`);
            console.log(`${colors.bold}${colors.red}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
            console.log(`  Proxy Server:      ${proxyStatus.running ? colors.green + `RUNNING (http://${proxyStatus.host}:${proxyStatus.port})` : colors.yellow + `STOPPED (Configured: ${proxyStatus.host}:${proxyStatus.port})`}${colors.reset}`);
            console.log(`  Breakpoint Mode:   ${proxyStatus.activeBreakpoint ? colors.red + colors.bold + 'ACTIVE (Holding in-flight requests)' : colors.dim + 'INACTIVE (Traffic forwarding automatically)'}${colors.reset}`);
            console.log(`  Total Handled:     ${proxyStatus.totalRequestsHandled} requests`);
            console.log(`  Total Intercepted: ${proxyStatus.totalIntercepted} held requests\n`);
            console.log(`${colors.dim}Commands: "proxy start [port]", "proxy stop", "proxy intercept <on|off>", "proxy rules", "proxy queue"${colors.reset}\n`);
          } else if (sub === 'start') {
            const port = subArgs[1] ? parseInt(subArgs[1], 10) : 8899;
            const host = '127.0.0.1';
            try {
              const res = await sendCommand(IPC_COMMANDS.PROXY_START, { port, host });
              if (res?.success) {
                console.log(`${colors.green}✔ DualSurf HTTP proxy started on:${colors.reset} ${colors.bold}http://${host}:${port}${colors.reset}`);
              } else {
                console.log(`${colors.red}Error starting proxy:${colors.reset} ${res?.error || 'Failed'}`);
              }
            } catch (err: any) {
              console.error(`${colors.red}Error starting proxy: ${err.message}${colors.reset}`);
            }
          } else if (sub === 'stop') {
            try {
              await sendCommand(IPC_COMMANDS.PROXY_STOP);
              console.log(`${colors.yellow}DualSurf HTTP proxy stopped.${colors.reset}`);
            } catch (err: any) {
              console.error(`${colors.red}Error stopping proxy: ${err.message}${colors.reset}`);
            }
          } else if (sub === 'intercept' || sub === 'breakpoint') {
            const targetState = action === 'on' ? true : action === 'off' ? false : undefined;
            try {
              const res = await sendCommand(IPC_COMMANDS.PROXY_TOGGLE_BREAKPOINT, { active: targetState });
              const newState = res?.isBreakpointActive;
              console.log(`${colors.green}✔ Breakpoint holding mode:${colors.reset} ${newState ? colors.red + colors.bold + 'ENABLED (Holding in-flight requests)' : colors.dim + 'DISABLED'}${colors.reset}`);
            } catch (err: any) {
              console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
            }
          } else if (sub === 'rules') {
            try {
              const rules = await sendCommand(IPC_COMMANDS.PROXY_GET_RULES);
              console.log(`\n${colors.bold}${colors.red}DUALSURF PROXY INTERCEPTION & TAMPERING RULES (${rules?.length || 0}):${colors.reset}`);
              console.log(`${colors.gray}──────────────────────────────────────────────────────────────────────${colors.reset}`);
              (rules || []).forEach((r: any) => {
                const badge = r.enabled ? `${colors.green}[ENABLED] ${colors.reset}` : `${colors.dim}[DISABLED]${colors.reset}`;
                console.log(`  ${badge} ${colors.bold}${r.id}${colors.reset}: ${r.name} (${colors.cyan}${r.action}${colors.reset})`);
                if (r.modifications?.addHeaders) {
                  console.log(`      ${colors.dim}Add Headers:${colors.reset} ${JSON.stringify(r.modifications.addHeaders)}`);
                }
                if (r.modifications?.removeHeaders) {
                  console.log(`      ${colors.dim}Strip Headers:${colors.reset} ${r.modifications.removeHeaders.join(', ')}`);
                }
              });
              console.log('');
            } catch (err: any) {
              console.error(`${colors.red}Error fetching rules: ${err.message}${colors.reset}`);
            }
          } else if (sub === 'queue' || sub === 'pending') {
            try {
              const pending = await sendCommand(IPC_COMMANDS.PROXY_GET_PENDING);
              console.log(`\n${colors.bold}${colors.red}HELD IN-FLIGHT BREAKPOINT REQUESTS (${pending?.length || 0}):${colors.reset}`);
              console.log(`${colors.gray}──────────────────────────────────────────────────────────────────────${colors.reset}`);
              if (!pending || pending.length === 0) {
                console.log(`  ${colors.dim}No requests currently paused in breakpoint queue.${colors.reset}`);
              } else {
                pending.forEach((req: any) => {
                  console.log(`  • [${colors.bold}${req.id}${colors.reset}] ${colors.yellow}${req.method}${colors.reset} ${req.url}`);
                });
              }
              console.log(`\n${colors.dim}Commands: "proxy forward <id>", "proxy drop <id>"${colors.reset}\n`);
            } catch (err: any) {
              console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
            }
          } else if (sub === 'forward') {
            const id = subArgs[1];
            if (!id) {
              console.log(`${colors.yellow}Usage: proxy forward <request-id>${colors.reset}`);
              break;
            }
            try {
              const res = await sendCommand(IPC_COMMANDS.PROXY_FORWARD, { id });
              console.log(res?.forwarded ? `${colors.green}✔ Forwarded request ${id}.${colors.reset}` : `${colors.yellow}Request ${id} not found in queue.${colors.reset}`);
            } catch (err: any) {
              console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
            }
          } else if (sub === 'drop') {
            const id = subArgs[1];
            if (!id) {
              console.log(`${colors.yellow}Usage: proxy drop <request-id>${colors.reset}`);
              break;
            }
            try {
              const res = await sendCommand(IPC_COMMANDS.PROXY_DROP, { id });
              console.log(res?.dropped ? `${colors.red}✔ Dropped / aborted request ${id}.${colors.reset}` : `${colors.yellow}Request ${id} not found in queue.${colors.reset}`);
            } catch (err: any) {
              console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
            }
          } else {
            console.log(`${colors.yellow}Usage: proxy [status | start [port] | stop | intercept <on|off> | rules | queue | forward <id> | drop <id>]${colors.reset}`);
          }
          break;
        }

        case 'repeater': {
          const subArgs = (arg || '').trim().split(/\s+/).filter(Boolean);
          const sub = subArgs[0]?.toLowerCase();
          let targetUrl = subArgs[1] || '';
          if (sub !== 'send' && sub && !sub.startsWith('--')) {
            targetUrl = subArgs[0];
          }
          if (!targetUrl) {
            try {
              const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
              targetUrl = meta?.url;
            } catch {}
          }
          if (!targetUrl || targetUrl === 'about:blank') {
            console.log(`${colors.yellow}Usage: repeater send <url> [--method GET|POST|PUT|DELETE] [--header "Key: Value"] [--body "data"]${colors.reset}`);
            break;
          }

          const normalizedUrl = /^https?:\/\//i.test(targetUrl.trim()) ? targetUrl.trim() : `https://${targetUrl.trim()}`;
          const methodIdx = subArgs.indexOf('--method');
          const method = (methodIdx !== -1 && subArgs[methodIdx + 1] ? subArgs[methodIdx + 1] : 'GET').toUpperCase();

          const headers: Record<string, string> = {};
          for (let i = 0; i < subArgs.length; i++) {
            if (subArgs[i] === '--header' && subArgs[i + 1]) {
              const parts = subArgs[i + 1].split(':');
              if (parts.length >= 2) {
                headers[parts[0].trim()] = parts.slice(1).join(':').trim();
              }
            }
          }

          const bodyIdx = subArgs.indexOf('--body');
          const body = bodyIdx !== -1 && subArgs[bodyIdx + 1] ? subArgs[bodyIdx + 1] : undefined;

          let response: any;
          const startTime = Date.now();
          try {
            response = await sendCommand(IPC_COMMANDS.REPEATER_SEND, {
              url: normalizedUrl,
              method,
              headers,
              body,
            });
          } catch {}

          if (!response) {
            try {
              const resp = await fetch(normalizedUrl, {
                method,
                headers,
                body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
              });
              const latencyMs = Date.now() - startTime;
              const respHeaders: Record<string, string> = {};
              resp.headers.forEach((v, k) => {
                respHeaders[k] = v;
              });
              const bodyText = await resp.text();
              response = {
                success: true,
                status: resp.status,
                statusText: resp.statusText,
                headers: respHeaders,
                body: bodyText,
                latencyMs,
              };
            } catch (err: any) {
              response = {
                success: false,
                error: err.message,
                latencyMs: Date.now() - startTime,
              };
            }
          }

          console.log(`\n${colors.bold}${colors.cyan}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
          console.log(`${colors.bold}${colors.cyan}║                 DUALSURF RAW HTTP REPEATER RESPONSE                ║${colors.reset}`);
          console.log(`${colors.bold}${colors.cyan}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
          console.log(`  Target URL:    ${colors.bold}${normalizedUrl}${colors.reset}`);
          console.log(`  Method:        ${colors.yellow}${method}${colors.reset}`);
          if (response.success) {
            const statusColor = response.status < 300 ? colors.green : response.status < 400 ? colors.cyan : colors.red;
            console.log(`  Status:        ${statusColor}${response.status} ${response.statusText}${colors.reset} (Latency: ${response.latencyMs}ms)`);
            console.log(`  Body Size:     ${response.body ? Buffer.byteLength(response.body, 'utf8') : 0} bytes`);

            console.log(`\n  ${colors.bold}Response Headers:${colors.reset}`);
            for (const [k, v] of Object.entries(response.headers || {})) {
              console.log(`    ${colors.dim}${k}:${colors.reset} ${v}`);
            }

            console.log(`\n  ${colors.bold}Response Body Preview:${colors.reset}`);
            const preview = (response.body || '').slice(0, 800);
            console.log(`  ${colors.green}${preview}${response.body && response.body.length > 800 ? '\n  ... [truncated]' : ''}${colors.reset}`);
          } else {
            console.log(`  Status:        ${colors.red}FAILED${colors.reset}`);
            console.log(`  Error:         ${colors.red}${response.error}${colors.reset}`);
          }

          const headerArgs = Object.entries(headers).map(([k, v]) => `-H "${k}: ${v}"`).join(' ');
          const dataArg = body ? `--data '${body.replace(/'/g, "'\\''")}'` : '';
          console.log(`\n  ${colors.bold}Reproducible cURL Command:${colors.reset}`);
          console.log(`  ${colors.yellow}curl -i -s -k -X ${method} "${normalizedUrl}" ${headerArgs} ${dataArg}${colors.reset}\n`);
          break;
        }

        case 'report': {
          const subArgs = (arg || '').trim().split(/\s+/).filter(Boolean);
          const filePath = subArgs[0];
          if (!filePath) {
            console.log(`${colors.yellow}Usage: report <path_to_report.html|.md|.json>${colors.reset}`);
            break;
          }
          const fs = await import('fs');
          const path = await import('path');
          const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
          if (!fs.existsSync(resolvedPath)) {
            console.log(`${colors.red}File not found: ${resolvedPath}${colors.reset}`);
            break;
          }
          if (resolvedPath.endsWith('.html')) {
            console.log(`${colors.green}Opening interactive HTML report in DualSurf browser tab:${colors.reset} ${colors.cyan}${resolvedPath}${colors.reset}`);
            const fileUrl = `file:///${resolvedPath.replace(/\\/g, '/')}`;
            await sendCommand(IPC_COMMANDS.TABS_CREATE, { url: fileUrl });
          } else {
            const content = fs.readFileSync(resolvedPath, 'utf8');
            console.log('\n' + content + '\n');
          }
          break;
        }

        case 'sec-audit':
        case 'vuln':
        case 'security': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(`${colors.dim}Running passive security & DOM hygiene audit on: ${meta.url}...${colors.reset}`);
          const { analyzeSecurityHeaders } = await import('./tools/recon.js');
          const { auditPassiveSecurity, formatSecurityAudit } = await import('./tools/securityAudit.js');
          let headers;
          try {
            headers = await analyzeSecurityHeaders(meta.url);
          } catch {
            // offline
          }
          const report = auditPassiveSecurity(meta, headers);
          console.log(formatSecurityAudit(report));
          break;
        }

        case 'cert':
        case 'ssl': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          const targetUrl = arg || meta.url;
          console.log(`${colors.dim}Inspecting TLS / SSL certificate for: ${targetUrl}...${colors.reset}`);
          const { inspectTlsCertificate, formatTlsCertificate } = await import('./tools/securityAudit.js');
          const cert = await inspectTlsCertificate(targetUrl);
          console.log(formatTlsCertificate(cert));
          break;
        }

        case 'cors': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          const targetUrl = arg || meta.url;
          console.log(`${colors.dim}Auditing CORS policy & origin reflection for: ${targetUrl}...${colors.reset}`);
          const { analyzeCorsPolicy, formatCorsAnalysis } = await import('./tools/securityAudit.js');
          const cors = await analyzeCorsPolicy(targetUrl);
          console.log(formatCorsAnalysis(cors));
          break;
        }

        case 'tech':
        case 'fingerprint': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          const targetUrl = arg || meta.url;
          console.log(`${colors.dim}Fingerprinting web stack & infrastructure for: ${targetUrl}...${colors.reset}`);
          const { analyzeSecurityHeaders } = await import('./tools/recon.js');
          const { detectTechnologies, formatTechProfile } = await import('./tools/securityAudit.js');
          let headers;
          try {
            headers = await analyzeSecurityHeaders(targetUrl);
          } catch {
            // offline
          }
          const tech = detectTechnologies(targetUrl, meta.scripts, headers);
          console.log(formatTechProfile(tech));
          break;
        }

        case 'secrets': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(`${colors.dim}Scanning active DOM snippet and storage for secrets: ${meta.url}...${colors.reset}`);
          const { scanForSecrets } = await import('./tools/securityAudit.js');
          const combined = [
            meta.textSnippet || '',
            JSON.stringify(meta.storage || []),
            JSON.stringify(meta.cookies || []),
          ].join('\n');
          const findings = scanForSecrets(combined);
          if (findings.length > 0) {
            console.log(`\n${colors.bold}${colors.red}POTENTIALLY LEAKED SECRETS / CREDENTIALS (${findings.length} findings):${colors.reset}`);
            findings.forEach((f, idx) => {
              console.log(`  ${colors.red}[${idx + 1}] ${f.type}:${colors.reset} ${f.snippet}`);
            });
            console.log('');
          } else {
            console.log(`${colors.green}✔ No API keys, JWT tokens, AWS credentials, or private keys found in active DOM or storage.${colors.reset}`);
          }
          break;
        }

        case 'siem':
        case 'logs': {
          let content = '';
          const { analyzeSecurityLogs, formatSiemReport } = await import('./tools/blueTeam.js');
          if (arg) {
            const fs = await import('fs');
            if (fs.existsSync(arg)) {
              console.log(`${colors.dim}Reading and analyzing security logs from: ${arg}...${colors.reset}`);
              content = fs.readFileSync(arg, 'utf8');
            } else {
              content = arg;
            }
          } else {
            console.log(`${colors.dim}Auditing active page DOM content and security events in SIEM analyzer...${colors.reset}`);
            const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
            content = [meta.title, meta.url, meta.textSnippet || ''].join('\n');
          }
          const report = analyzeSecurityLogs(content);
          console.log(formatSiemReport(report));
          break;
        }

        case 'ioc':
        case 'ti': {
          const { extractIocs, formatIocFindings } = await import('./tools/blueTeam.js');
          let text = arg;
          if (!text) {
            console.log(`${colors.dim}Extracting and triaging IOCs from active page...${colors.reset}`);
            const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
            text = [meta.title, meta.url, meta.textSnippet || ''].join('\n');
          }
          const findings = extractIocs(text);
          console.log(formatIocFindings(findings));
          break;
        }

        case 'case':
        case 'ir': {
          const { incidentStore, formatIncidentCase } = await import('./tools/blueTeam.js');
          const subArgs = (arg || '').trim().split(/\s+/);
          const subCmd = subArgs[0]?.toLowerCase() || 'list';

          if (subCmd === 'new' || subCmd === 'create') {
            const title = subArgs.slice(1).join(' ') || 'Investigated Security Anomaly';
            const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
            const newCase = incidentStore.createCase(title, 'P2-HIGH', 'Web / Endpoint Incident', {
              affectedHosts: [meta.url],
              iocs: [meta.url],
            });
            console.log(`${colors.green}✔ Created Incident Case:${colors.reset} ${colors.bold}${newCase.id}${colors.reset}`);
            console.log(formatIncidentCase(newCase));
          } else if (subCmd === 'view' || subCmd === 'get') {
            const targetId = subArgs[1];
            if (!targetId) {
              console.log(`${colors.yellow}Usage: case view <case_id> (e.g. case view INC-2026-0001)${colors.reset}`);
              break;
            }
            const c = incidentStore.getCase(targetId);
            if (c) {
              console.log(formatIncidentCase(c));
            } else {
              console.log(`${colors.red}Case not found: ${targetId}${colors.reset}`);
            }
          } else if (subCmd === 'close') {
            const targetId = subArgs[1];
            if (!targetId) {
              console.log(`${colors.yellow}Usage: case close <case_id>${colors.reset}`);
              break;
            }
            const c = incidentStore.updateCaseStatus(targetId, 'Closed', 'Investigation completed and validated');
            if (c) {
              console.log(`${colors.green}✔ Case ${targetId} marked as Closed.${colors.reset}`);
            } else {
              console.log(`${colors.red}Case not found: ${targetId}${colors.reset}`);
            }
          } else if (subCmd === 'link') {
            const targetId = subArgs[1];
            const evidenceId = subArgs[2];
            if (!targetId || !evidenceId) {
              console.log(`${colors.yellow}Usage: case link <case_id> <evidence_id>${colors.reset}`);
              break;
            }
            const c = incidentStore.linkEvidence(targetId, evidenceId);
            if (c) console.log(`${colors.green}✔ Linked evidence ${evidenceId} to incident case ${targetId}.${colors.reset}`);
            else console.log(`${colors.red}Case not found: ${targetId}${colors.reset}`);
          } else if (subCmd === 'severity' || subCmd === 'sev') {
            const targetId = subArgs[1];
            const sev = (subArgs[2] || 'P2-HIGH').toUpperCase() as any;
            const note = subArgs.slice(3).join(' ');
            if (!targetId) {
              console.log(`${colors.yellow}Usage: case severity <case_id> <P1-CRITICAL|P2-HIGH|P3-MEDIUM|P4-LOW>${colors.reset}`);
              break;
            }
            const c = incidentStore.updateSeverity(targetId, sev, note);
            if (c) console.log(`${colors.green}✔ Updated case ${targetId} severity to ${sev}.${colors.reset}`);
            else console.log(`${colors.red}Case not found: ${targetId}${colors.reset}`);
          } else if (subCmd === 'assign') {
            const targetId = subArgs[1];
            const analyst = subArgs.slice(2).join(' ') || 'SOC Analyst Tier 1';
            if (!targetId) {
              console.log(`${colors.yellow}Usage: case assign <case_id> <analyst_name>${colors.reset}`);
              break;
            }
            const c = incidentStore.assignAnalyst(targetId, analyst);
            if (c) console.log(`${colors.green}✔ Reassigned case ${targetId} to "${analyst}".${colors.reset}`);
            else console.log(`${colors.red}Case not found: ${targetId}${colors.reset}`);
          } else if (subCmd === 'fp' || subCmd === 'false-positive') {
            const targetId = subArgs[1];
            const reason = subArgs.slice(2).join(' ') || 'Confirmed benign business traffic';
            if (!targetId) {
              console.log(`${colors.yellow}Usage: case fp <case_id> <reason>${colors.reset}`);
              break;
            }
            const c = incidentStore.markFalsePositive(targetId, reason);
            if (c) console.log(`${colors.green}✔ Case ${targetId} marked as FALSE POSITIVE: ${reason}${colors.reset}`);
            else console.log(`${colors.red}Case not found: ${targetId}${colors.reset}`);
          } else if (subCmd === 'note' || subCmd === 'add-note') {
            const targetId = subArgs[1];
            const noteText = subArgs.slice(2).join(' ');
            if (!targetId || !noteText) {
              console.log(`${colors.yellow}Usage: case note <case_id> <note_text>${colors.reset}`);
              break;
            }
            const c = incidentStore.addNote(targetId, noteText, 'SOC Analyst');
            if (c) console.log(`${colors.green}✔ Added analyst note to case ${targetId}.${colors.reset}`);
            else console.log(`${colors.red}Case not found: ${targetId}${colors.reset}`);
          } else if (subCmd === 'timeline') {
            const targetId = subArgs[1];
            if (!targetId) {
              console.log(`${colors.yellow}Usage: case timeline <case_id>${colors.reset}`);
              break;
            }
            const { buildCaseTimeline } = await import('./tools/blueTelemetry.js');
            try {
              const tl = buildCaseTimeline(targetId);
              console.log(`\n${colors.bold}${colors.cyan}INCIDENT TIMELINE FOR CASE ${targetId} (${tl.length} events):${colors.reset}`);
              tl.forEach((e) => {
                console.log(`  • [${colors.dim}${e.timestamp}${colors.reset}] ${colors.bold}${e.title}${colors.reset}`);
                console.log(`    ${e.description} ${e.evidenceId ? `(${colors.cyan}${e.evidenceId}${colors.reset})` : ''}`);
              });
              console.log('');
            } catch (err: any) {
              console.error(`${colors.red}${err.message}${colors.reset}`);
            }
          } else if (subCmd === 'report') {
            const targetId = subArgs[1];
            if (!targetId) {
              console.log(`${colors.yellow}Usage: case report <case_id>${colors.reset}`);
              break;
            }
            const { generateBlueTeamReport } = await import('./tools/blueTelemetry.js');
            try {
              const res = generateBlueTeamReport(targetId, 'markdown');
              console.log(`${colors.green}✔ Generated DFIR Report: ${res.filePath}${colors.reset}\n`);
              console.log(res.reportContent);
            } catch (err: any) {
              console.error(`${colors.red}${err.message}${colors.reset}`);
            }
          } else {
            const cases = incidentStore.listCases();
            console.log(`\n${colors.bold}${colors.magenta}ACTIVE INCIDENT RESPONSE CASES (${cases.length}):${colors.reset}`);
            cases.forEach((c) => {
              const sev = c.severity === 'P1-CRITICAL' ? colors.red : c.severity === 'P2-HIGH' ? colors.yellow : colors.cyan;
              const fpNotice = c.isFalsePositive ? ` ${colors.yellow}[FP]${colors.reset}` : '';
              console.log(`  • ${colors.bold}${c.id}${colors.reset} [${sev}${c.severity}${colors.reset}] (${c.status})${fpNotice} - ${c.title}`);
            });
            console.log(`\n${colors.dim}Commands: "case new <title>", "case view <id>", "case link <id> <evId>", "case fp <id> <reason>", "case timeline <id>", "case report <id>"${colors.reset}\n`);
          }
          break;
        }

        case 'edr': {
          const { executeBlueTeamTool } = await import('./tools/blueTeam.js');
          const subArgs = (arg || '').trim().split(/\s+/);
          const sub = subArgs[0] || 'all';
          const res = await executeBlueTeamTool('edr', sub, subArgs.slice(1));
          console.log(res.output);
          break;
        }

        case 'hash':
        case 'dfir': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: hash <file_path> (computes SHA-256, SHA-1, MD5 forensic hashes)${colors.reset}`);
            break;
          }
          const { computeForensicHash, formatForensicEvidence } = await import('./tools/blueTeam.js');
          try {
            const evidence = computeForensicHash(arg);
            console.log(formatForensicEvidence(evidence));
          } catch (err: any) {
            console.error(`${colors.red}Forensic hashing error: ${err.message}${colors.reset}`);
          }
          break;
        }

        case 'soar': {
          const { runSoarTriagePlaybook, formatSoarTriage, generateSoarPlaybook, formatSoarPlaybook } = await import('./tools/blueTeam.js');
          const subArgs = (arg || '').trim().split(/\s+/);
          const action = subArgs[0]?.toLowerCase();
          if (action === 'block' || action === 'isolate' || action === 'sinkhole') {
            let target = subArgs.slice(1).join(' ');
            if (!target) {
              const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
              target = meta.url;
            }
            const playbook = generateSoarPlaybook(action, target);
            console.log(formatSoarPlaybook(playbook));
            break;
          }

          let target = arg;
          if (!target) {
            const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
            target = meta.url;
          }
          console.log(`${colors.dim}Executing SOAR automated triage playbook for: ${target}...${colors.reset}`);
          const result = await runSoarTriagePlaybook(target);
          console.log(formatSoarTriage(result));
          break;
        }

        case 'mitre':
        case 'attack': {
          const { mapToMitreAttack } = await import('./tools/blueTeam.js');
          let text = arg;
          if (!text) {
            const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
            text = [meta.title, meta.url, meta.textSnippet || ''].join('\n');
          }
          const mappings = mapToMitreAttack(text);
          if (mappings.length > 0) {
            console.log(`\n${colors.bold}${colors.cyan}CORRELATED MITRE ATT&CK TECHNIQUES (${mappings.length}):${colors.reset}`);
            mappings.forEach((m) => {
              console.log(`  • ${colors.bold}${colors.yellow}${m.id}${colors.reset}: ${colors.bold}${m.technique}${colors.reset} (${m.tactic})`);
              console.log(`    ${colors.dim}${m.description}${colors.reset}`);
            });
            console.log('');
          } else {
            console.log(`${colors.green}✔ No suspicious activity matching MITRE ATT&CK patterns detected.${colors.reset}`);
          }
          break;
        }

        case 'blue':
        case 'roadmap': {
          const {
            formatBlueTeamDomainList,
            formatBlueTeamDomainDetail,
            getSpecializationGuide,
            checklistManager,
          } = await import('./tools/blueTeam.js');

          const subArgs = (arg || '').trim().split(/\s+/);
          const first = subArgs[0]?.toLowerCase();

          if (!arg || first === 'list') {
            console.log(formatBlueTeamDomainList());
          } else if (first === 'domain' || !isNaN(parseInt(first, 10))) {
            const domainId = first === 'domain' ? parseInt(subArgs[1], 10) : parseInt(first, 10);
            console.log(formatBlueTeamDomainDetail(domainId || 1));
          } else if (first === 'spec' || first === 'career') {
            const role = subArgs.slice(1).join(' ') || 'soc';
            console.log(getSpecializationGuide(role));
          } else if (first === 'checklist') {
            console.log(checklistManager.formatReport());
          } else {
            console.log(formatBlueTeamDomainList());
          }
          break;
        }

        case 'checklist': {
          const { checklistManager } = await import('./tools/blueTeam.js');
          const subArgs = (arg || '').trim().split(/\s+/);
          const sub = subArgs[0]?.toLowerCase();

          if (sub === 'check') {
            const id = parseInt(subArgs[1], 10);
            if (isNaN(id) || id < 1 || id > 30) {
              console.log(`${colors.yellow}Usage: checklist check <1-30> [optional note]${colors.reset}`);
              break;
            }
            const note = subArgs.slice(2).join(' ') || undefined;
            const updated = checklistManager.checkItem(id, note);
            console.log(`${colors.green}✔ Marked skill #${id} complete:${colors.reset} ${updated?.task}`);
            console.log(checklistManager.formatReport());
          } else if (sub === 'uncheck') {
            const id = parseInt(subArgs[1], 10);
            if (isNaN(id) || id < 1 || id > 30) {
              console.log(`${colors.yellow}Usage: checklist uncheck <1-30>${colors.reset}`);
              break;
            }
            const updated = checklistManager.uncheckItem(id);
            console.log(`${colors.yellow}Skill #${id} marked incomplete:${colors.reset} ${updated?.task}`);
            console.log(checklistManager.formatReport());
          } else if (sub === 'reset') {
            checklistManager.resetChecklist();
            console.log(`${colors.yellow}Blue team master checklist reset to 0/30.${colors.reset}`);
            console.log(checklistManager.formatReport());
          } else {
            console.log(checklistManager.formatReport());
          }
          break;
        }

        case 'sigma': {
          const { generateSigmaRule, formatSigmaYaml, formatSigmaTranspileReport } = await import('./tools/blueTeam.js');
          const subArgs = (arg || '').trim().split(/\s+/);
          if (subArgs[0]?.toLowerCase() === 'transpile') {
            const target = subArgs.slice(1).join(' ') || 'sqli';
            const rule = generateSigmaRule(target);
            console.log(formatSigmaTranspileReport(rule));
            break;
          }
          const target = arg || 'sqli';
          const rule = generateSigmaRule(target);
          console.log(`\n${colors.bold}${colors.cyan}GENERATED PRODUCTION SIGMA DETECTION RULE:${colors.reset}`);
          console.log(`${colors.gray}──────────────────────────────────────────────────────────────────────${colors.reset}`);
          console.log(colors.green + formatSigmaYaml(rule) + colors.reset + '\n');
          console.log(`${colors.dim}Run "sigma transpile ${target}" to convert into Splunk SPL, Elastic KQL, and Sentinel KQL.${colors.reset}\n`);
          break;
        }

        case 'hunt': {
          const { huntThreats, formatThreatHuntReport } = await import('./tools/blueTeam.js');
          let telemetry = arg;
          if (telemetry) {
            const fs = await import('fs');
            if (fs.existsSync(telemetry)) {
              console.log(`${colors.dim}Reading and hunting through telemetry file: ${telemetry}...${colors.reset}`);
              telemetry = fs.readFileSync(telemetry, 'utf8');
            }
          } else {
            console.log(`${colors.dim}Hunting for anomalies and threats across active page content...${colors.reset}`);
            const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
            telemetry = [meta.title, meta.url, meta.textSnippet || ''].join('\n');
          }
          const findings = huntThreats(telemetry);
          console.log(formatThreatHuntReport(findings));
          break;
        }

        case 'yara': {
          const { generateYaraRule } = await import('./tools/blueTeam.js');
          const subArgs = (arg || 'webshell').trim().split(/\s+/);
          const name = subArgs[0] || 'webshell';
          const patterns = subArgs.slice(1).length > 0 ? subArgs.slice(1) : ['c99.php', 'r57.php', 'eval(base64_decode'];
          const rule = generateYaraRule(name, patterns);
          console.log(`\n${colors.bold}${colors.cyan}GENERATED DEFENSIVE YARA RULE:${colors.reset}`);
          console.log(`${colors.gray}──────────────────────────────────────────────────────────────────────${colors.reset}`);
          console.log(colors.yellow + rule + colors.reset + '\n');
          break;
        }

        case 'red': {
          const {
            formatRedTeamDomainList,
            formatRedTeamDomainDetail,
            getRedSpecializationGuide,
            getRedTeamStudyPlan,
            redChecklistManager,
          } = await import('./tools/redTeam.js');

          const subArgs = (arg || '').trim().split(/\s+/);
          const first = subArgs[0]?.toLowerCase();

          if (!arg || first === 'list') {
            console.log(formatRedTeamDomainList());
          } else if (first === 'domain' || !isNaN(parseInt(first, 10))) {
            const domainId = first === 'domain' ? parseInt(subArgs[1], 10) : parseInt(first, 10);
            console.log(formatRedTeamDomainDetail(domainId || 1));
          } else if (first === 'spec' || first === 'career') {
            const role = subArgs.slice(1).join(' ') || 'web';
            console.log(getRedSpecializationGuide(role));
          } else if (first === 'study' || first === 'plan') {
            console.log(getRedTeamStudyPlan());
          } else if (first === 'checklist') {
            console.log(redChecklistManager.formatReport());
          } else if (first === 'check') {
            const id = parseInt(subArgs[1], 10);
            if (isNaN(id) || id < 1 || id > 25) {
              console.log(`${colors.yellow}Usage: red check <1-25> [optional notes]${colors.reset}`);
              break;
            }
            const note = subArgs.slice(2).join(' ') || undefined;
            const updated = redChecklistManager.checkItem(id, note);
            console.log(`${colors.green}✔ Marked skill #${id} complete:${colors.reset} ${updated?.task}`);
            console.log(redChecklistManager.formatReport());
          } else if (first === 'uncheck') {
            const id = parseInt(subArgs[1], 10);
            if (isNaN(id) || id < 1 || id > 25) {
              console.log(`${colors.yellow}Usage: red uncheck <1-25>${colors.reset}`);
              break;
            }
            const updated = redChecklistManager.uncheckItem(id);
            console.log(`${colors.yellow}Skill #${id} marked incomplete:${colors.reset} ${updated?.task}`);
            console.log(redChecklistManager.formatReport());
          } else if (first === 'reset') {
            redChecklistManager.resetChecklist();
            console.log(`${colors.yellow}Red team master checklist reset to 0/25.${colors.reset}`);
            console.log(redChecklistManager.formatReport());
          } else {
            console.log(formatRedTeamDomainList());
          }
          break;
        }

        case 'roe':
        case 'scope': {
          const { engagementStore, formatEngagementScope } = await import('./tools/redTeam.js');
          const subArgs = (arg || '').trim().split(/\s+/);
          const action = subArgs[0]?.toLowerCase();

          if (!arg || action === 'list') {
            const scopes = engagementStore.listScopes();
            console.log(`\n${colors.bold}${colors.red}RULES OF ENGAGEMENT (ROE) SCOPES (${scopes.length}):${colors.reset}`);
            scopes.forEach((s) => console.log(formatEngagementScope(s) + '\n'));
          } else if (action === 'view') {
            const id = subArgs[1] || 'ROE-2026-001';
            const s = engagementStore.getScope(id);
            if (!s) {
              console.log(`${colors.yellow}Engagement scope "${id}" not found.${colors.reset}`);
            } else {
              console.log(formatEngagementScope(s));
            }
          } else if (action === 'check') {
            const target = subArgs[1] || '';
            const scopeId = subArgs[2] || engagementStore.listScopes()[0]?.id || 'ROE-2026-001';
            if (!target) {
              console.log(`${colors.yellow}Usage: roe check <domain|ip> [scopeId]${colors.reset}`);
              break;
            }
            const res = engagementStore.isTargetInScope(scopeId, target);
            if (res.inScope) {
              console.log(`${colors.bold}${colors.green}✔ AUTHORIZED IN-SCOPE:${colors.reset} ${res.reason}`);
            } else {
              console.log(`${colors.bold}${colors.red}✖ UNAUTHORIZED / OUT OF SCOPE:${colors.reset} ${res.reason}`);
            }
          } else if (action === 'new') {
            const clientName = subArgs.slice(1).join(' ') || 'New Engagement';
            const newScope = engagementStore.createScope({ clientName });
            console.log(`${colors.green}✔ Created new scope [${newScope.id}]:${colors.reset}`);
            console.log(formatEngagementScope(newScope));
          } else {
            console.log(`${colors.yellow}Usage: roe [list | view <id> | check <target> [scopeId] | new <client>]${colors.reset}`);
          }
          break;
        }

        case 'finding':
        case 'findings':
        case 'pentest': {
          const { findingStore, formatPentestFinding, formatPentestReport } = await import('./tools/redTeam.js');
          const subArgs = (arg || '').trim().split(/\s+/);
          const action = subArgs[0]?.toLowerCase();

          if (!arg || action === 'list') {
            const findings = findingStore.listFindings();
            console.log(formatPentestReport(findings));
          } else if (action === 'view') {
            const id = subArgs[1] || '';
            const f = findingStore.getFinding(id);
            if (!f) {
              console.log(`${colors.yellow}Finding "${id}" not found.${colors.reset}`);
            } else {
              console.log(formatPentestFinding(f));
            }
          } else if (action === 'poc') {
            const id = subArgs[1] || '';
            const f = findingStore.getFinding(id);
            if (!f) {
              console.log(`${colors.yellow}Finding "${id}" not found. Type "finding list" to see active findings.${colors.reset}`);
            } else {
              const { formatFindingPoc } = await import('./tools/redTeam.js');
              console.log(formatFindingPoc(f));
            }
          } else if (action === 'new') {
            const title = subArgs.slice(1).join(' ') || 'SQL Injection in Authenticated API';
            const newF = findingStore.createFinding({
              title,
              affectedAsset: 'https://app.target.internal/api/v1/user',
              severity: 'HIGH',
            });
            console.log(`${colors.green}✔ Logged pentest finding [${newF.id}] (CVSS ${newF.cvssScore}):${colors.reset}`);
            console.log(formatPentestFinding(newF));
          } else if (action === 'status') {
            const id = subArgs[1] || '';
            const status = (subArgs[2] || 'Remediated') as any;
            const updated = findingStore.updateStatus(id, status);
            if (!updated) {
              console.log(`${colors.yellow}Finding "${id}" not found.${colors.reset}`);
            } else {
              console.log(`${colors.green}✔ Finding [${updated.id}] status updated to: ${updated.status}${colors.reset}`);
            }
          } else if (action === 'export') {
            const { generateRedTeamReport, exportBurpSuiteXml, exportOwaspZapJson } = await import('./tools/redTeam.js');
            const formatArg = (subArgs.find((r) => ['burp', 'zap', 'json', 'md', 'html', 'markdown', 'xml'].includes(r.toLowerCase())) || 'json').toLowerCase();
            const outIdx = subArgs.indexOf('--out');
            const outFile = outIdx !== -1 && subArgs[outIdx + 1] ? subArgs[outIdx + 1] : undefined;
            const findings = findingStore.listFindings();
            let output = '';
            if (formatArg === 'burp' || formatArg === 'xml') {
              output = exportBurpSuiteXml(findings);
            } else if (formatArg === 'zap') {
              output = exportOwaspZapJson(findings);
            } else {
              output = generateRedTeamReport(undefined, (formatArg === 'md' ? 'markdown' : formatArg) as any);
            }
            if (outFile) {
              const fs = await import('fs');
              const path = await import('path');
              const dest = path.isAbsolute(outFile) ? outFile : path.resolve(process.cwd(), outFile);
              fs.writeFileSync(dest, output, 'utf8');
              console.log(`${colors.green}✔ Exported ${findings.length} findings to (${formatArg.toUpperCase()}):${colors.reset} ${dest}`);
            } else {
              console.log(output);
            }
          } else {
            console.log(`${colors.yellow}Usage: finding [list | view <id> | poc <id> | new <title> | status <id> <status> | export [burp|zap|json|md] [--out file]]${colors.reset}`);
          }
          break;
        }

        case 'purple':
        case 'emulation': {
          const { purpleTeamStore, formatPurpleTeamMatrix, calculatePurpleTeamScorecard, formatPurpleScorecard } = await import('./tools/redTeam.js');
          const subArgs = (arg || '').trim().split(/\s+/);
          const action = subArgs[0]?.toLowerCase();

          if (action === 'score' || action === 'metrics' || action === 'scorecard') {
            const scorecard = calculatePurpleTeamScorecard();
            console.log(formatPurpleScorecard(scorecard));
          } else if (!arg || action === 'list' || action === 'matrix') {
            const tests = purpleTeamStore.listTestCases();
            console.log(formatPurpleTeamMatrix(tests));
          } else if (action === 'view') {
            const id = subArgs[1] || 'PT-01';
            const tc = purpleTeamStore.getTestCase(id);
            if (!tc) {
              console.log(`${colors.yellow}Test case "${id}" not found.${colors.reset}`);
            } else {
              console.log(`\n${colors.bold}${colors.magenta}PURPLE TEAM TEST CASE [${tc.id}]:${colors.reset}`);
              console.log(`  ${colors.bold}Technique:${colors.reset}   ${tc.techniqueId} - ${tc.techniqueName} (${tc.tactic})`);
              console.log(`  ${colors.bold}Behavior:${colors.reset}    ${tc.testBehavior}`);
              console.log(`  ${colors.bold}Telemetry:${colors.reset}   ${tc.expectedTelemetry.join(', ')}`);
              console.log(`  ${colors.bold}Status:${colors.reset}      ${tc.detectionStatus}`);
              console.log(`  ${colors.bold}Remediation:${colors.reset} ${tc.remediationNotes}\n`);
            }
          } else if (action === 'status') {
            const id = subArgs[1] || '';
            const status = (subArgs[2] || 'DETECTED').toUpperCase() as any;
            const notes = subArgs.slice(3).join(' ') || undefined;
            const updated = purpleTeamStore.updateDetectionStatus(id, status, notes);
            if (!updated) {
              console.log(`${colors.yellow}Test case "${id}" not found.${colors.reset}`);
            } else {
              console.log(`${colors.green}✔ Purple team test [${updated.id}] detection status updated to: ${updated.detectionStatus}${colors.reset}`);
            }
          } else {
            console.log(`${colors.yellow}Usage: purple [matrix | view <PT-XX> | status <PT-XX> <DETECTED|BLIND_SPOT|PARTIAL> [notes]]${colors.reset}`);
          }
          break;
        }

        case 'status':
        case 'context': {
          const state: BrowserControllerState = await sendCommand(IPC_COMMANDS.TABS_LIST);
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          const ollamaOk = await ollama.isAvailable();
          console.log(`\n${colors.bold}${colors.cyan}DUALSURF SESSION STATUS & CONTEXT:${colors.reset}`);
          console.log(`  ${colors.bold}Active Tab:${colors.reset}   [${state.activeTabId || '1'}] "${meta.title || '(No title)'}" (${colors.cyan}${meta.url || 'about:blank'}${colors.reset})`);
          console.log(`  ${colors.bold}Open Tabs:${colors.reset}    ${state.tabs.length} tabs open`);
          console.log(`  ${colors.bold}Endpoints:${colors.reset}    ${meta.endpoints?.length || 0} detected (${colors.green}API: ${meta.endpoints?.filter(e=>e.category==='api').length || 0}${colors.reset}, Auth: ${meta.endpoints?.filter(e=>e.category==='auth').length || 0})`);
          console.log(`  ${colors.bold}Directory:${colors.reset}    ${process.cwd()}`);
          console.log(`  ${colors.bold}Local AI:${colors.reset}     ${ollamaOk ? colors.green + '✓ Connected (127.0.0.1:11434)' : colors.yellow + '○ Offline (Start Ollama for AI)'}${colors.reset}`);
          console.log(`  ${colors.bold}Privileges:${colors.reset}   Host execution enabled (sudo, Kali tools, interactive TTY)\n`);
          break;
        }

        case 'click': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: click <link number or link text>${colors.reset}`);
            break;
          }

          const num = parseInt(arg, 10);
          if (!isNaN(num)) {
            // Numeric link ID
            console.log(`${colors.dim}Following link [${num}]...${colors.reset}`);
            await sendCommand(IPC_COMMANDS.PAGE_CLICK_LINK, { linkId: num });
            console.log(`${colors.green}Link [${num}] activated.${colors.reset}`);
          } else {
            // Semantic link matching by text / keywords
            console.log(`${colors.dim}Finding link matching "${arg}"...${colors.reset}`);
            const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
            const match = findBestMatchingLink(arg, meta.links || []);

            if (match) {
              console.log(
                `${colors.green}Matched link [${match.item.id}]:${colors.reset} "${colors.bold}${match.item.label}${colors.reset}"`
              );
              await sendCommand(IPC_COMMANDS.PAGE_CLICK_LINK, { linkId: match.item.id });
              console.log(`${colors.green}Link activated.${colors.reset}`);
            } else {
              const suggestions = findTopMatchingLinks(arg, meta.links || [], 3);
              if (suggestions.length > 0) {
                console.log(`${colors.yellow}Did you mean one of these?${colors.reset}`);
                suggestions.forEach((s) => {
                  console.log(`  ${colors.cyan}[${s.item.id}]${colors.reset} ${s.item.label}`);
                });
              } else {
                console.log(`${colors.red}No link matching "${arg}" found on this page.${colors.reset}`);
              }
            }
          }
          break;
        }

        case 'headings': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(formatHeadings(meta.headings));
          break;
        }

        case 'find': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: find <keyword>${colors.reset}`);
          } else {
            const result = await sendCommand(IPC_COMMANDS.PAGE_FIND, { query: arg });
            console.log(formatFindResults(result));
          }
          break;
        }

        case 'ask': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: ask <question about this page>${colors.reset}`);
            break;
          }

          if (!(await ollama.isAvailable())) {
            console.log(
              `${colors.red}Ollama is not running.${colors.reset} Start it via "ollama run llama3.2:1b" to use AI Q&A.`
            );
            break;
          }

          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(`\n${colors.cyan}🤖 [DualSurf Q&A] Thinking...${colors.reset}\n`);
          await ollama.askAboutPage(meta, arg, (token) => {
            process.stdout.write(token);
          });
          console.log('\n');
          break;
        }

        case 'summarize':
        case 'summary': {
          if (!(await ollama.isAvailable())) {
            console.log(
              `${colors.red}Ollama is not running.${colors.reset} Start it via "ollama run llama3.2:1b" to use AI summarization.`
            );
            break;
          }

          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(
            `\n${colors.cyan}🤖 [DualSurf Summary]:${colors.reset} ${colors.bold}${meta.title || meta.url}${colors.reset}\n`
          );
          await ollama.summarizePage(meta, {
            onToken: (token) => {
              process.stdout.write(token);
            },
          });
          console.log('\n');
          break;
        }

        case 'do':
        case 'agent': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: do <natural language browsing goal>${colors.reset}`);
            break;
          }
          await agent.runGoal(arg);
          break;
        }

        case 'compare': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: compare <tab index or keyword>${colors.reset}`);
            break;
          }

          if (!(await ollama.isAvailable())) {
            console.log(`${colors.red}Ollama is not running.${colors.reset}`);
            break;
          }

          const state: BrowserControllerState = await sendCommand(IPC_COMMANDS.TABS_LIST);
          const match = findBestMatchingTab(arg, state.tabs);
          if (!match) {
            console.log(`${colors.yellow}No tab matching "${arg}" found to compare.${colors.reset}`);
            break;
          }

          const currentMeta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          // Briefly switch to target tab to inspect it
          await sendCommand(IPC_COMMANDS.TABS_SWITCH, { tabId: match.tab.id });
          const targetMeta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          // Switch back
          if (state.activeTabId) {
            await sendCommand(IPC_COMMANDS.TABS_SWITCH, { tabId: state.activeTabId });
          }

          console.log(
            `\n${colors.cyan}🤖 [DualSurf Comparison]:${colors.reset} "${currentMeta.title}" vs "${targetMeta.title}"\n`
          );
          await ollama.comparePages(currentMeta, targetMeta, undefined, (token) => {
            process.stdout.write(token);
          });
          console.log('\n');
          break;
        }

        case 'extract': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: extract <data to extract into JSON>${colors.reset}`);
            break;
          }

          if (!(await ollama.isAvailable())) {
            console.log(`${colors.red}Ollama is not running.${colors.reset}`);
            break;
          }

          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(`\n${colors.cyan}🤖 [DualSurf Extraction] Processing "${meta.title}"...${colors.reset}\n`);
          const extracted = await ollama.extractStructuredData(meta, arg);
          if (extracted) {
            console.log(JSON.stringify(extracted, null, 2));
          } else {
            console.log(`${colors.yellow}Could not extract structured JSON for: "${arg}".${colors.reset}`);
          }
          console.log('\n');
          break;
        }

        case 'model': {
          const available = await ollama.getAvailableModels();
          if (arg.startsWith('pull ')) {
            const pullTarget = arg.substring(5).trim();
            console.log(`${colors.cyan}Pulling model "${pullTarget}" from Ollama registry...${colors.reset}`);
            const success = await ollama.pullModel(pullTarget, (status, percent) => {
              const p = percent !== undefined ? ` (${percent}%)` : '';
              process.stdout.write(`\r${colors.dim}${status}${p}...${colors.reset}   `);
            });
            console.log(success ? `\n${colors.green}Model pulled successfully.${colors.reset}` : `\n${colors.red}Failed to pull model.${colors.reset}`);
          } else if (arg) {
            ollama.setModel(arg);
            console.log(`${colors.green}Set active Ollama model to:${colors.reset} ${arg}`);
          } else {
            const current = await ollama.getOrSelectModel();
            const pingInfo = await ollama.ping();
            console.log(`${colors.bold}Current Ollama Model:${colors.reset} ${current}`);
            console.log(`${colors.dim}Connection Latency:   ${pingInfo.latencyMs}ms${colors.reset}`);
            console.log(`${colors.dim}Available local models: ${available.join(', ') || 'none'}${colors.reset}`);
            console.log(`${colors.dim}Use "model <name>" to switch, or "model pull <name>" to download.${colors.reset}`);
          }
          break;
        }

        case 'back': {
          await sendCommand(IPC_COMMANDS.NAV_BACK);
          console.log(`${colors.dim}Navigated back.${colors.reset}`);
          break;
        }

        case 'forward': {
          await sendCommand(IPC_COMMANDS.NAV_FORWARD);
          console.log(`${colors.dim}Navigated forward.${colors.reset}`);
          break;
        }

        case 'reload':
        case 'r': {
          await sendCommand(IPC_COMMANDS.NAV_RELOAD);
          console.log(`${colors.dim}Reloading page.${colors.reset}`);
          break;
        }

        case 'stop': {
          await sendCommand(IPC_COMMANDS.NAV_STOP);
          console.log(`${colors.dim}Stopped navigation.${colors.reset}`);
          break;
        }

        case 'bookmarks': {
          const bookmarks = await sendCommand(IPC_COMMANDS.BOOKMARKS_LIST);
          console.log(formatBookmarks(bookmarks));
          break;
        }

        case 'bookmark': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          const bm = await sendCommand(IPC_COMMANDS.BOOKMARKS_ADD, { url: meta.url, title: meta.title });
          console.log(`${colors.green}Saved bookmark:${colors.reset} ${bm.title} (${bm.url})`);
          break;
        }

        case 'history': {
          const history = await sendCommand(IPC_COMMANDS.HISTORY_LIST, { limit: 20 });
          console.log(formatHistory(history));
          break;
        }

        case 'downloads': {
          const downloads = await sendCommand(IPC_COMMANDS.DOWNLOADS_LIST, { limit: 20 });
          console.log(formatDownloads(downloads));
          break;
        }

        case 'gui': {
          await sendCommand(IPC_COMMANDS.SYSTEM_SHOW_GUI);
          console.log(`${colors.green}DualSurf graphical browser window launched.${colors.reset}`);
          break;
        }

        case 'sh':
        case 'exec': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: sh <system command> (or "! <cmd>")${colors.reset}`);
            break;
          }
          console.log(`${colors.dim}[Executing: ${arg}]${colors.reset}`);
          rl.pause();
          try {
            const { executeInteractiveShellCommand } = await import('./tools/index.js');
            await executeInteractiveShellCommand(arg);
          } catch (err: any) {
            console.error(`${colors.red}Execution error: ${err.message}${colors.reset}`);
          } finally {
            rl.resume();
          }
          break;
        }

        case 'tools': {
          const { auditInstalledTools, formatToolsAudit } = await import('./tools/index.js');
          console.log(formatToolsAudit(auditInstalledTools()));
          break;
        }

        case 'offline': {
          console.log(`\n${colors.bold}${colors.cyan}DualSurf Offline Mode Capabilities:${colors.reset}`);
          console.log(`  ${colors.green}✓ Local Files:${colors.reset}    Open offline files with "open file:///path/to/file.html" or "open ./test.html"`);
          console.log(`  ${colors.green}✓ Local Labs:${colors.reset}     Connect directly to localhost, 127.0.0.1, 10.x.x.x, 192.168.x.x subnets`);
          console.log(`  ${colors.green}✓ Local AI:${colors.reset}       Ollama runs 100% offline at http://127.0.0.1:11434 with llama3.2:1b`);
          console.log(`  ${colors.green}✓ Shell Tools:${colors.reset}    Execute any local Kali/Unix tool with "! <cmd>" (e.g. "! nmap localhost")`);
          console.log(`  ${colors.green}✓ Tool Audit:${colors.reset}     Type "tools" to see available utilities on your system\n`);
          break;
        }

        default: {
          // If input is natural language (multi-word, questions, or goal descriptions)
          const isNaturalLanguage =
            parts.length >= 2 ||
            /^(what|why|how|where|who|can|show|find|search|open|go|click|read|summarize|switch|close)\b/i.test(input);

          if (isNaturalLanguage && (await ollama.isAvailable())) {
            console.log(`${colors.dim}Interpreting natural language request with DualSurf Agent...${colors.reset}`);
            await agent.runGoal(input);
          } else {
            console.log(
              `${colors.red}Unknown command: "${cmd}".${colors.reset} Type "help" or enter a natural language goal.`
            );
          }
          break;
        }
      }
    } catch (err) {
      console.error(`${colors.red}Error: ${(err as Error).message}${colors.reset}`);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

function printReplHelp(): void {
  console.log(`
${colors.bold}${colors.cyan}DualSurf Interactive Terminal Mode:${colors.reset}

${colors.bold}${colors.magenta}AI & Natural Language:${colors.reset}
  ${colors.bold}<any prompt>${colors.reset}         Type natural language to autonomously browse (e.g. "open github and find trending")
  ${colors.bold}ask <question>${colors.reset}       Ask AI questions about the active webpage
  ${colors.bold}summarize${colors.reset}            Generate a concise AI summary of the active webpage
  ${colors.bold}compare <tab>${colors.reset}        Side-by-side AI comparison with another open tab
  ${colors.bold}extract <data>${colors.reset}        Extract structured entity or table data into JSON
  ${colors.bold}do <goal>${colors.reset}            Run multi-step autonomous browsing agent
  ${colors.bold}model [name]${colors.reset}         View or switch local Ollama model (or "model pull <name>")

${colors.bold}${colors.cyan}Semantic & Navigation:${colors.reset}
  ${colors.bold}open <url>${colors.reset}           Navigate to URL or domain in active tab
  ${colors.bold}search <query>${colors.reset}       Search with configured search engine
  ${colors.bold}click <n | text>${colors.reset}     Follow link by number [n] OR by semantic text label ("Documentation")
  ${colors.bold}text${colors.reset}                 Print structured readable page text & links
  ${colors.bold}links${colors.reset}                List numbered actionable links with endpoint badges
  ${colors.bold}endpoints [filter]${colors.reset}   Detect & classify all page endpoints (API, Auth, Download, Form)
  ${colors.bold}headings${colors.reset}             List page headings in document order
${colors.bold}${colors.cyan}Web Security & Reconnaissance:${colors.reset}
  ${colors.bold}assess <url>${colors.reset}         Complete single-command security assessment: attack surface to report
  ${colors.bold}scan <url> [file]${colors.reset}    Automated security audit: TLS, headers, CORS, tech, secrets & report
  ${colors.bold}attack-surface <dom>${colors.reset}  Passive external asset discovery, CT subdomains, cloud buckets & takeovers
  ${colors.bold}dns <host>${colors.reset}           Passive DNS records (A, AAAA, MX, TXT) and SPF/DMARC email security audit
  ${colors.bold}ports [target]${colors.reset}       Automated network port audit & service perimeter scanner
  ${colors.bold}recon / audit${colors.reset}        Full target reconnaissance (correlate endpoints, headers & suggested tools)
  ${colors.bold}sec-audit / vuln${colors.reset}     Passive vulnerability & DOM hygiene audit (CSRF, tabnabbing, secrets, CSP)
  ${colors.bold}cert [host]${colors.reset}          Inspect TLS/SSL certificate, expiration, SAN subdomains & cipher
  ${colors.bold}cors [url]${colors.reset}           Analyze CORS policy, wildcard origin & credential reflection risks
  ${colors.bold}tech [url]${colors.reset}           Fingerprint web server, frameworks, CMS, and CDN/WAF infrastructure
  ${colors.bold}secrets${colors.reset}              Scan DOM snippet and client storage for leaked tokens and API keys
  ${colors.bold}headers [url]${colors.reset}        Audit HTTP response security headers (CSP, HSTS, X-Frame, server leaks)
  ${colors.bold}cookies / storage${colors.reset}    Inspect active session cookies and localStorage entries
  ${colors.bold}export [file]${colors.reset}        Export full penetration testing / DOM audit report to Markdown
  ${colors.bold}status${colors.reset}               Display complete browser context, tab info, active user & AI status

${colors.bold}${colors.red}HTTP Interception Proxy & Repeater:${colors.reset}
  ${colors.bold}proxy [status]${colors.reset}       Display local proxy server status (127.0.0.1:8899) and breakpoint state
  ${colors.bold}proxy start [port]${colors.reset}   Start local loopback interception proxy server
  ${colors.bold}proxy stop${colors.reset}           Stop local loopback proxy server
  ${colors.bold}proxy intercept <on|off>${colors.reset} Toggle in-flight breakpoint request holding
  ${colors.bold}proxy rules${colors.reset}          List active request modification and header injection rules
  ${colors.bold}proxy queue${colors.reset}          Inspect held requests in breakpoint queue
  ${colors.bold}proxy forward <id>${colors.reset}   Forward intercepted request to target server
  ${colors.bold}proxy drop <id>${colors.reset}      Drop / abort intercepted request
  ${colors.bold}repeater send <url>${colors.reset}   Dispatch raw HTTP/S request with latency and status inspection

${colors.bold}${colors.blue}Blue Team & Defensive Operations (SOC / DFIR / IR / SOAR):${colors.reset}
  ${colors.bold}blue / roadmap${colors.reset}       Browse complete 31-domain Blue Team roadmap & career guides
  ${colors.bold}blue domain <n>${colors.reset}      Inspect detailed syllabus, subdomains & tools for domain (1-31)
  ${colors.bold}blue spec <role>${colors.reset}     Get career roadmap (soc, ir, hunt, detect, dfir)
  ${colors.bold}checklist${colors.reset}            Interactive 30-skill mastery checklist & progress tracker
  ${colors.bold}checklist check <n>${colors.reset}  Mark mastery task [1-30] complete with optional notes
  ${colors.bold}sigma [technique]${colors.reset}    Generate production Sigma YAML detection rule (e.g. sqli, t1110)
  ${colors.bold}hunt [file/text]${colors.reset}     Hunt for C2 beaconing, scanner tools, and process anomalies
  ${colors.bold}yara [name] [strs]${colors.reset}   Generate defensive YARA memory/disk artifact detection rule
  ${colors.bold}siem [file]${colors.reset}          Parse and analyze security logs (auth, web access, syslog) for attacks
  ${colors.bold}ioc [text/url]${colors.reset}       Extract, defang & triage indicators of compromise (IP, domain, hash)
  ${colors.bold}case [new/view/list]${colors.reset} Manage incident response tickets & generate containment playbooks
  ${colors.bold}hash <file>${colors.reset}          Compute SHA-256/SHA-1/MD5 forensic evidence hashes for chain of custody
  ${colors.bold}soar [target]${colors.reset}        Execute automated triage, enrichment, and response recommendation playbook
  ${colors.bold}mitre [activity]${colors.reset}     Map observed behaviors and threats to MITRE ATT&CK tactics & techniques

${colors.bold}${colors.red}Red Team & Offensive Operations (Pentest / Scope / Adversary Emulation):${colors.reset}
  ${colors.bold}red [domain <n>]${colors.reset}        Browse complete 32-domain Red Team roadmap & in-depth domain syllabus
  ${colors.bold}red spec <role>${colors.reset}         Offensive career tracks (web, network, ad, operator, cloud, exploit, ai)
  ${colors.bold}red study${colors.reset}              6-Month Accelerated Red Team & Adversary Emulation study curriculum
  ${colors.bold}red checklist${colors.reset}          25-task Red Team master skills progress tracker (0/25)
  ${colors.bold}red check <1-25>${colors.reset}        Mark offensive task completed with verification notes
  ${colors.bold}roe [list|check <target>]${colors.reset} Scope authorization manager: verify if domains/IPs are permitted
  ${colors.bold}finding [list|view|new|export]${colors.reset} Pentest finding manager, CVSS v3.1 scoring, Burp/ZAP/JSON export
  ${colors.bold}purple [matrix|status]${colors.reset}    Purple Team adversary emulation & ATT&CK detection matrix

${colors.bold}${colors.cyan}Tabs & Browser Control:${colors.reset}
  ${colors.bold}tabs${colors.reset}                 List all open tabs
  ${colors.bold}tab <n | name>${colors.reset}       Switch to tab by index [n] OR by tab name keyword ("github")
  ${colors.bold}tab new [url]${colors.reset}       Create new tab
  ${colors.bold}tab close [n]${colors.reset}       Close tab
  ${colors.bold}back / forward${colors.reset}       History navigation
  ${colors.bold}reload / stop${colors.reset}        Reload or abort navigation
  ${colors.bold}bookmarks / bookmark${colors.reset} List or save bookmarks
  ${colors.bold}history / downloads${colors.reset}  Show visit history or download list
  ${colors.bold}gui${colors.reset}                  Launch or switch to the graphical browser window
${colors.bold}${colors.yellow}System Tools, Elevated Access & Shell:${colors.reset}
  ${colors.bold}sudo <cmd>${colors.reset}           Execute command with elevated/root privileges (e.g. "sudo apt update")
  ${colors.bold}sudo su / su${colors.reset}         Drop into interactive root subshell with full TTY stdin/stdout access
  ${colors.bold}<system cmd>${colors.reset}         Execute any host command directly (e.g. whoami, nmap, curl, ls, dir, ip a)
  ${colors.bold}cd <dir> / pwd${colors.reset}       Change or print local working directory
  ${colors.bold}! <command>${colors.reset}          Shell escape: execute arbitrary shell command or script
  ${colors.bold}tools${colors.reset}                Audit available host tools (nmap, curl, dig, ping, whois, etc.)
  ${colors.bold}offline${colors.reset}              View offline mode status and lab navigation guide
  ${colors.bold}quit / exit${colors.reset}          Exit interactive session
`);
}
