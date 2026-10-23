import * as dns from 'dns/promises';
import type {
  DnsAuditRecord,
  EmailSecurityPosture,
  AttackSurfaceAsset,
  AdminInterfaceCheck,
  EndpointItem,
  CloudStorageAudit,
  SubdomainTakeoverCheck,
  ApiDiscoveryResult,
} from '@dualsurf/shared-types';
import { colors } from '../formatters.js';

// ============================================================================
// 1. DNS & EMAIL SECURITY AUDITOR (SPF, DMARC, MX, A, AAAA, TXT)
// ============================================================================

/**
 * Perform comprehensive, passive DNS and email authentication posture review.
 */
export async function auditDnsAndEmail(host: string): Promise<{
  dnsRecords: DnsAuditRecord[];
  emailSecurity: EmailSecurityPosture;
  ipList: string[];
}> {
  const dnsRecords: DnsAuditRecord[] = [];
  const ipList: string[] = [];
  const emailIssues: string[] = [];
  const mxRecords: string[] = [];
  let spfRecord: string | undefined = undefined;
  let dmarcRecord: string | undefined = undefined;
  let dmarcPolicy: EmailSecurityPosture['dmarcPolicy'] = 'missing';

  // 1. Resolve A (IPv4)
  try {
    const aRecords = await dns.resolve4(host);
    for (const ip of aRecords) {
      ipList.push(ip);
      dnsRecords.push({ type: 'A', value: ip });
    }
  } catch {}

  // 2. Resolve AAAA (IPv6)
  try {
    const aaaaRecords = await dns.resolve6(host);
    for (const ip of aaaaRecords) {
      dnsRecords.push({ type: 'AAAA', value: ip });
    }
  } catch {}

  // 3. Resolve MX (Mail Exchangers)
  try {
    const mxList = await dns.resolveMx(host);
    for (const m of mxList) {
      const val = `${m.exchange} (Priority: ${m.priority})`;
      mxRecords.push(val);
      dnsRecords.push({ type: 'MX', value: val });
    }
  } catch {}

  // 4. Resolve TXT (Root TXT for SPF)
  try {
    const txtEntries = await dns.resolveTxt(host);
    for (const chunk of txtEntries) {
      const fullTxt = chunk.join(' ');
      dnsRecords.push({ type: 'TXT', value: fullTxt });
      if (fullTxt.toLowerCase().startsWith('v=spf1')) {
        spfRecord = fullTxt;
      }
    }
  } catch {}

  // 5. Resolve NS (Name Servers)
  try {
    const nsList = await dns.resolveNs(host);
    for (const ns of nsList) {
      dnsRecords.push({ type: 'NS', value: ns });
    }
  } catch {}

  // 6. Query _dmarc.<host> for DMARC policy
  try {
    const dmarcEntries = await dns.resolveTxt(`_dmarc.${host}`);
    for (const chunk of dmarcEntries) {
      const fullTxt = chunk.join(' ');
      if (fullTxt.toLowerCase().includes('v=dmarc1')) {
        dmarcRecord = fullTxt;
        const pMatch = fullTxt.match(/\bp=([a-zA-Z]+)/i);
        if (pMatch) {
          const policy = pMatch[1].toLowerCase();
          if (policy === 'reject') dmarcPolicy = 'reject';
          else if (policy === 'quarantine') dmarcPolicy = 'quarantine';
          else if (policy === 'none') dmarcPolicy = 'none';
        }
      }
    }
  } catch {}

  // Evaluate Email Security Posture & Vulnerability Gaps
  if (!spfRecord) {
    emailIssues.push('Missing SPF (Sender Policy Framework) record in DNS TXT records.');
  }

  if (!dmarcRecord) {
    emailIssues.push('Missing RFC 7489 DMARC policy record at _dmarc.' + host);
  } else if (dmarcPolicy === 'none') {
    emailIssues.push("DMARC enforcement is configured to 'p=none' (monitoring only; does not reject spoofed emails).");
  }

  const emailSecurity: EmailSecurityPosture = {
    hasSpf: Boolean(spfRecord),
    spfRecord,
    hasDmarc: Boolean(dmarcRecord),
    dmarcPolicy,
    dmarcRecord,
    mxRecords,
    issues: emailIssues,
  };

  return { dnsRecords, emailSecurity, ipList };
}

// ============================================================================
// 2. ADMINISTRATIVE & HIDDEN INTERFACE PROBE
// ============================================================================

const ADMIN_CANDIDATE_PATHS = [
  '/.env',
  '/.git/HEAD',
  '/admin',
  '/admin/login',
  '/administrator',
  '/wp-admin',
  '/dashboard',
  '/actuator',
  '/actuator/health',
  '/swagger-ui.html',
  '/api-docs',
  '/graphql',
];

/**
 * Non-destructively probes target for sensitive administrative, debug, or repo interfaces.
 */
export async function probeAdminInterfaces(
  baseUrl: string,
  options: {
    timeoutMs?: number;
    authCookie?: string;
    bearerToken?: string;
    customHeaders?: Record<string, string>;
  } = {}
): Promise<AdminInterfaceCheck[]> {
  const timeoutMs = options.timeoutMs || 2500;
  const results: AdminInterfaceCheck[] = [];
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  const reqHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 DualSurf-AttackSurface/1.0',
    Accept: 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8',
    ...(options.customHeaders || {}),
  };
  if (options.authCookie) {
    reqHeaders['Cookie'] = options.authCookie;
  }
  if (options.bearerToken) {
    reqHeaders['Authorization'] = options.bearerToken.startsWith('Bearer ')
      ? options.bearerToken
      : `Bearer ${options.bearerToken}`;
  }

  // 1. Establish baseline response for non-existent path to detect SPAs, custom 404s, or catch-all redirects
  let isWildcard200 = false;
  let baselineLength = -1;
  let isGlobalAuthWall = false;
  try {
    const canaryUrl = `${normalizedBase}/_dualsurf_canary_probe_${Date.now()}`;
    const canaryRes = await fetch(canaryUrl, {
      method: 'GET',
      headers: reqHeaders,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (canaryRes.status === 200) {
      isWildcard200 = true;
      const canaryBody = await canaryRes.text();
      baselineLength = canaryBody.length;
    } else if (canaryRes.status === 401 || canaryRes.status === 403) {
      isGlobalAuthWall = true;
    }
  } catch {}

  // 2. Probe candidates in small batches with redirect: 'manual' and strict content verification
  const batchSize = 4;
  for (let i = 0; i < ADMIN_CANDIDATE_PATHS.length; i += batchSize) {
    const chunk = ADMIN_CANDIDATE_PATHS.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      chunk.map(async (p) => {
        const fullUrl = `${normalizedBase}${p}`;
        try {
          const res = await fetch(fullUrl, {
            method: 'GET',
            headers: reqHeaders,
            redirect: 'manual',
            signal: AbortSignal.timeout(timeoutMs),
          });

          const status = res.status;

          // If path redirects (301/302/307/308), only consider it if it redirects to an explicit admin/auth target
          if (status >= 300 && status < 400) {
            const location = res.headers.get('location') || '';
            // If redirect goes to root home page or general error, it is NOT an exposed admin interface
            if (location === '/' || location === normalizedBase || location === `${normalizedBase}/`) {
              return null;
            }
            if (/(admin|login|oauth|auth|signin|dashboard)/i.test(location) && !location.endsWith('/')) {
              return {
                path: p,
                url: fullUrl,
                status,
                exposed: false,
                notes: `Redirects to login/auth endpoint: ${location}`,
              };
            }
            return null;
          }

          let exposed = false;
          let notes: string | undefined = undefined;

          if (status === 200) {
            const contentType = (res.headers.get('content-type') || '').toLowerCase();
            const body = await res.text();

            // If target server is a Single Page Application returning index.html (200) for all paths,
            // verify response length differs significantly from baseline canary
            if (isWildcard200 && Math.abs(body.length - baselineLength) < 120) {
              return null;
            }

            const isHtml = contentType.includes('text/html') || body.trim().startsWith('<!DOCTYPE') || body.trim().startsWith('<html');

            if (p === '/.env') {
              // Real .env files are NOT HTML pages and contain key-value environment pairs
              if (!isHtml && /(?:^|\n)\s*(?:DB_PASSWORD|DATABASE_URL|SECRET_KEY|API_KEY|APP_KEY|APP_SECRET|AWS_SECRET_ACCESS_KEY|[A-Z0-9_]{3,}\s*=\s*\S+)/m.test(body)) {
                exposed = true;
                notes = 'Critical: Sensitive environment configuration file exposed publicly!';
              }
            } else if (p === '/.git/HEAD') {
              // Real Git HEAD is NOT HTML and starts with 'ref: refs/' or SHA-1 hash
              if (!isHtml && (/^ref:\s+refs\/heads\//.test(body.trim()) || /^[0-9a-f]{40}$/i.test(body.trim()))) {
                exposed = true;
                notes = 'Critical: Git repository metadata exposed publicly!';
              }
            } else if (p.startsWith('/actuator')) {
              // Real Spring Boot Actuator endpoint returns JSON with health/status/beans
              if (contentType.includes('json') || (body.includes('"status"') && (body.includes('"UP"') || body.includes('"DOWN"') || body.includes('"_links"')))) {
                exposed = true;
                notes = 'High: Unauthenticated Spring Boot Actuator endpoint accessible!';
              }
            } else if (p === '/swagger-ui.html' || p === '/api-docs') {
              if (body.includes('swagger-ui') || body.includes('SwaggerUIBundle') || body.includes('"openapi"') || body.includes('"swagger"')) {
                exposed = true;
                notes = 'Administrative/API documentation interface directly accessible.';
              }
            } else if (p === '/wp-admin') {
              if (body.includes('wp-login.php') || body.includes('id="user_login"') || body.includes('wp-admin-bar')) {
                exposed = true;
                notes = 'WordPress administrative portal directly accessible.';
              }
            } else if (p === '/graphql') {
              // Real GraphQL endpoint requires POST or explicit GraphQL schema error
              if (contentType.includes('json') && (body.includes('"errors"') || body.includes('"data"'))) {
                exposed = true;
                notes = 'GraphQL endpoint accessible.';
              }
            } else if (p === '/admin' || p === '/admin/login' || p === '/administrator' || p === '/dashboard') {
              // Must contain dedicated login form with password field and not match generic homepage
              const hasLoginForm = /<form\b[^>]*>/i.test(body) && /input\b[^>]*type=["']password["']/i.test(body);
              if (hasLoginForm && (body.toLowerCase().includes('admin') || body.toLowerCase().includes('dashboard') || body.toLowerCase().includes('portal'))) {
                exposed = true;
                notes = 'Administrative interface directly accessible.';
              }
            }
          } else if ((status === 401 || status === 403) && !isGlobalAuthWall) {
            notes = 'Protected interface detected (Authentication required).';
          }

          // Only return confirmed hits
          if (exposed || notes) {
            return {
              path: p,
              url: fullUrl,
              status,
              exposed,
              notes,
            };
          }
          return null;
        } catch {
          return null;
        }
      })
    );

    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  return results;
}

// ============================================================================
// 3. ATTACK SURFACE REGISTER & SUBDOMAIN INVENTORY
// ============================================================================

/**
 * Validates whether a candidate hostname belongs to the target organization
 * and is not an unrelated tenant on a shared multi-tenant hosting platform.
 */
function isRelatedAsset(candidateHost: string, targetHost: string): boolean {
  const cand = candidateHost.toLowerCase().trim();
  const target = targetHost.toLowerCase().trim();
  if (cand === target) return true;

  // Shared multi-tenant platforms where subdomains are owned by independent customers
  const sharedSuffixes = [
    'pythonanywhere.com',
    'eu.pythonanywhere.com',
    'github.io',
    'gitlab.io',
    'vercel.app',
    'netlify.app',
    'herokuapp.com',
    'pages.dev',
    'azurewebsites.net',
    's3.amazonaws.com',
    'firebaseapp.com',
    'web.app',
    'fly.dev',
    'render.com',
    'onrender.com',
  ];

  for (const suffix of sharedSuffixes) {
    if (target.endsWith('.' + suffix)) {
      const withoutSuffix = target.slice(0, -(suffix.length + 1));
      const parts = withoutSuffix.split('.');
      const tenant = parts[parts.length - 1]; // e.g. "codexstudios"
      const tenantDomain = `${tenant}.${suffix}`;
      return cand === tenantDomain || cand.endsWith('.' + tenantDomain);
    }
  }

  // Standard custom domain logic (e.g. target="www.company.com" -> base="company.com")
  const targetParts = target.split('.');
  const apex = targetParts.length >= 2 ? targetParts.slice(-2).join('.') : target;
  return cand === apex || cand.endsWith('.' + apex);
}

/**
 * Correlates DNS records, TLS Subject Alternative Names, and extracted endpoints
 * into a structured attack surface register.
 */
export function buildAttackSurfaceRegister(
  host: string,
  ipList: string[] = [],
  sanList: string[] = [],
  endpoints: EndpointItem[] = [],
  ctSubdomains: string[] = []
): AttackSurfaceAsset[] {
  const assetsMap = new Map<string, AttackSurfaceAsset>();
  const primaryIp = ipList[0];

  // 1. Add primary apex/subdomain host
  assetsMap.set(host, {
    hostname: host,
    ip: primaryIp,
    assetType: 'domain',
    environment: 'production',
    source: 'dns',
    publiclyExposed: true,
    inScope: true,
  });

  // 2. Correlate TLS Subject Alt Names (SANs) with strict tenant isolation
  for (const san of sanList) {
    const cleanSan = san.replace(/^\*\./, '').toLowerCase().trim();
    if (!cleanSan || assetsMap.has(cleanSan)) continue;
    if (!isRelatedAsset(cleanSan, host)) continue; // Filter out foreign multi-tenant cert entries

    let assetType: AttackSurfaceAsset['assetType'] = 'subdomain';
    let environment: AttackSurfaceAsset['environment'] = 'production';

    if (cleanSan.startsWith('api.') || cleanSan.includes('-api.')) assetType = 'api';
    else if (cleanSan.startsWith('admin.') || cleanSan.includes('panel.')) assetType = 'admin';
    else if (cleanSan.startsWith('staging.') || cleanSan.includes('stage.') || cleanSan.includes('qa.')) {
      assetType = 'staging';
      environment = 'staging';
    } else if (cleanSan.startsWith('dev.') || cleanSan.includes('test.')) {
      assetType = 'subdomain';
      environment = 'development';
    } else if (cleanSan.startsWith('mail.') || cleanSan.startsWith('smtp.')) assetType = 'mail';
    else if (cleanSan.startsWith('files.') || cleanSan.includes('storage.')) assetType = 'storage';

    assetsMap.set(cleanSan, {
      hostname: cleanSan,
      assetType,
      environment,
      source: 'san',
      publiclyExposed: true,
      inScope: true,
    });
  }

  // 3. Correlate passive Certificate Transparency (crt.sh) subdomains
  for (const ct of ctSubdomains) {
    const cleanCt = ct.replace(/^\*\./, '').toLowerCase().trim();
    if (!cleanCt || assetsMap.has(cleanCt)) continue;
    if (!isRelatedAsset(cleanCt, host)) continue; // Filter out foreign subdomains

    let assetType: AttackSurfaceAsset['assetType'] = 'subdomain';
    let environment: AttackSurfaceAsset['environment'] = 'production';

    if (cleanCt.startsWith('api.') || cleanCt.includes('-api.')) assetType = 'api';
    else if (cleanCt.startsWith('admin.') || cleanCt.includes('panel.')) assetType = 'admin';
    else if (cleanCt.startsWith('staging.') || cleanCt.includes('stage.') || cleanCt.includes('qa.')) {
      assetType = 'staging';
      environment = 'staging';
    } else if (cleanCt.startsWith('dev.') || cleanCt.includes('test.')) {
      assetType = 'subdomain';
      environment = 'development';
    } else if (cleanCt.startsWith('mail.') || cleanCt.startsWith('smtp.')) assetType = 'mail';
    else if (cleanCt.startsWith('files.') || cleanCt.includes('storage.')) assetType = 'storage';

    assetsMap.set(cleanCt, {
      hostname: cleanCt,
      assetType,
      environment,
      source: 'san', // certificate log
      publiclyExposed: true,
      inScope: true,
    });
  }

  // 4. Correlate in-page endpoint origins & hrefs
  for (const ep of endpoints) {
    try {
      const u = new URL(ep.url);
      const h = u.hostname.toLowerCase().trim();
      if (h && !assetsMap.has(h) && isRelatedAsset(h, host)) {
        let assetType: AttackSurfaceAsset['assetType'] = 'subdomain';
        if (h.startsWith('api.')) assetType = 'api';
        else if (h.startsWith('admin.')) assetType = 'admin';

        assetsMap.set(h, {
          hostname: h,
          assetType,
          environment: 'production',
          source: 'endpoint',
          publiclyExposed: true,
          inScope: true,
        });
      }
    } catch {}
  }

  return Array.from(assetsMap.values()).sort((a, b) => a.hostname.localeCompare(b.hostname));
}

/**
 * Passively harvest historical and unlinked subdomains from public Certificate Transparency (crt.sh) logs.
 * Zero packets sent to target server.
 */
export async function harvestCertificateTransparencySubdomains(
  domain: string,
  options: { timeoutMs?: number } = {}
): Promise<string[]> {
  const timeoutMs = options.timeoutMs || 4000;
  const cleanDomain = domain
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase();

  const domainParts = cleanDomain.split('.');
  const apexDomain = domainParts.length > 2 ? domainParts.slice(-2).join('.') : cleanDomain;

  try {
    const url = `https://crt.sh/?q=%.${apexDomain}&output=json`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 DualSurf-CT-Harvest/1.0',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) return [];

    const data: any = await res.json();
    if (!Array.isArray(data)) return [];

    const discovered = new Set<string>();
    for (const item of data) {
      if (item && item.name_value) {
        const rawNames = String(item.name_value).split('\n');
        for (const name of rawNames) {
          const cleanName = name.replace(/^\*\./, '').toLowerCase().trim();
          if (cleanName && cleanName.endsWith(apexDomain) && !cleanName.includes('*')) {
            discovered.add(cleanName);
          }
        }
      }
    }

    return Array.from(discovered);
  } catch {
    return [];
  }
}

// ============================================================================
// 4. CLOUD STORAGE BUCKET AUDITOR (AWS S3, GCP, AZURE)
// ============================================================================

export async function auditCloudStorageBuckets(
  targetDomain: string,
  options: { timeoutMs?: number } = {}
): Promise<CloudStorageAudit[]> {
  const timeoutMs = options.timeoutMs || 2500;
  const cleanHost = targetDomain
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase();

  const domainParts = cleanHost.split('.');
  const baseName = domainParts.length > 2 ? domainParts[domainParts.length - 2] : domainParts[0];
  const domainDashed = cleanHost.replace(/\./g, '-');

  const candidateNames = Array.from(
    new Set([
      baseName,
      domainDashed,
      `${baseName}-assets`,
      `${baseName}-static`,
      `${baseName}-public`,
      `${baseName}-backup`,
      `${baseName}-media`,
      `${baseName}-prod`,
      `${baseName}-staging`,
    ])
  ).filter((n) => n && n.length >= 3);

  const audits: CloudStorageAudit[] = [];

  for (const name of candidateNames.slice(0, 6)) {
    const providers: Array<{ provider: CloudStorageAudit['provider']; url: string }> = [
      { provider: 'aws', url: `https://${name}.s3.amazonaws.com` },
      { provider: 'gcp', url: `https://storage.googleapis.com/${name}` },
      { provider: 'azure', url: `https://${name}.blob.core.windows.net` },
    ];

    await Promise.all(
      providers.map(async ({ provider, url }) => {
        try {
          const res = await fetch(url, {
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 DualSurf-CloudAudit/1.0' },
            signal: AbortSignal.timeout(timeoutMs),
          });

          if (res.status === 200) {
            const body = await res.text();
            const listing =
              body.includes('<ListBucketResult>') ||
              body.includes('<Contents>') ||
              body.includes('<EnumerationResults>');
            audits.push({
              provider,
              bucketName: name,
              url,
              status: 'open',
              publiclyReadable: true,
              listingEnabled: listing,
              details: listing
                ? 'Critical: Public cloud storage bucket with directory listing enabled!'
                : 'High: Public cloud storage bucket accessible without authentication.',
            });
          } else if (res.status === 403) {
            audits.push({
              provider,
              bucketName: name,
              url,
              status: 'protected',
              publiclyReadable: false,
              listingEnabled: false,
              details: 'Bucket exists but access is private/restricted (AccessDenied).',
            });
          }
        } catch {
          // Timeout or DNS failure indicates bucket doesn't exist
        }
      })
    );
  }

  return audits;
}

// ============================================================================
// 5. SUBDOMAIN TAKEOVER & DANGLING CNAME AUDITOR
// ============================================================================

const DANGLING_CNAME_FINGERPRINTS = [
  { service: 'GitHub Pages', cnameSubstring: 'github.io', bodySignature: "there isn't a github pages site here" },
  { service: 'AWS S3', cnameSubstring: 'amazonaws.com', bodySignature: 'the specified bucket does not exist' },
  { service: 'AWS S3', cnameSubstring: 's3-website', bodySignature: 'nosuchbucket' },
  { service: 'Heroku', cnameSubstring: 'herokuapp.com', bodySignature: 'no such app' },
  { service: 'Fastly', cnameSubstring: 'fastly.net', bodySignature: 'fastly error: unknown domain' },
  { service: 'Zendesk', cnameSubstring: 'zendesk.com', bodySignature: 'help center closed' },
  { service: 'Surge.sh', cnameSubstring: 'surge.sh', bodySignature: 'project not found' },
  { service: 'Shopify', cnameSubstring: 'myshopify.com', bodySignature: 'sorry, this shop is currently unavailable' },
  { service: 'Ghost', cnameSubstring: 'ghost.io', bodySignature: 'the thing you were looking for is no longer here' },
  { service: 'Pantheon', cnameSubstring: 'pantheonsite.io', bodySignature: 'do not know of the site which you seek' },
];

export async function auditSubdomainTakeovers(
  subdomains: string[],
  options: { timeoutMs?: number } = {}
): Promise<SubdomainTakeoverCheck[]> {
  const timeoutMs = options.timeoutMs || 2500;
  const results: SubdomainTakeoverCheck[] = [];
  const uniqueSubs = Array.from(new Set(subdomains.filter((s) => s && !s.startsWith('*.'))));

  for (const sub of uniqueSubs.slice(0, 15)) {
    try {
      const cnames = await dns.resolveCname(sub);
      if (!cnames || cnames.length === 0) continue;

      const targetCname = cnames[0].toLowerCase();
      const matchedFp = DANGLING_CNAME_FINGERPRINTS.find((fp) => targetCname.includes(fp.cnameSubstring));

      if (matchedFp) {
        let isVulnerable = false;
        let evidence: string | undefined = undefined;

        try {
          const res = await fetch(`http://${sub}`, {
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 DualSurf-TakeoverAudit/1.0' },
            signal: AbortSignal.timeout(timeoutMs),
          });
          const body = (await res.text()).toLowerCase();
          if (body.includes(matchedFp.bodySignature)) {
            isVulnerable = true;
            evidence = `CNAME points to ${targetCname}. Destination returns signature "${matchedFp.bodySignature}".`;
          }
        } catch {}

        results.push({
          subdomain: sub,
          cnameDestination: targetCname,
          service: matchedFp.service,
          vulnerable: isVulnerable,
          evidence: evidence || `CNAME resolves to third-party provider: ${targetCname}`,
        });
      }
    } catch {}
  }

  return results;
}

// ============================================================================
// 6. API SPECIFICATION & GRAPHQL INTROSPECTION AUDITOR
// ============================================================================

export async function auditApiAndGraphQl(
  baseUrl: string,
  options: {
    timeoutMs?: number;
    authCookie?: string;
    bearerToken?: string;
    customHeaders?: Record<string, string>;
  } = {}
): Promise<ApiDiscoveryResult> {
  const timeoutMs = options.timeoutMs || 2500;
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  const reqHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 DualSurf-ApiDiscovery/1.0',
    Accept: 'application/json, text/plain, */*',
    ...(options.customHeaders || {}),
  };
  if (options.authCookie) {
    reqHeaders['Cookie'] = options.authCookie;
  }
  if (options.bearerToken) {
    reqHeaders['Authorization'] = options.bearerToken.startsWith('Bearer ')
      ? options.bearerToken
      : `Bearer ${options.bearerToken}`;
  }

  let openApiFound = false;
  let openApiUrl: string | undefined = undefined;
  let openApiTitle: string | undefined = undefined;
  let endpointsCount: number | undefined = undefined;

  const API_DOC_PATHS = [
    '/openapi.json',
    '/swagger.json',
    '/api-docs',
    '/v3/api-docs',
    '/swagger/v1/swagger.json',
    '/api/swagger.json',
  ];

  const apiDocResults = await Promise.all(
    API_DOC_PATHS.map(async (p) => {
      const docUrl = `${normalizedBase}${p}`;
      try {
        const res = await fetch(docUrl, {
          method: 'GET',
          headers: reqHeaders,
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (res.status === 200) {
          const text = await res.text();
          try {
            const json = JSON.parse(text);
            if (json.openapi || json.swagger || json.paths) {
              return {
                openApiFound: true,
                openApiUrl: docUrl,
                openApiTitle: json.info?.title || 'OpenAPI Documentation',
                endpointsCount: Object.keys(json.paths || {}).length,
              };
            }
          } catch {}
        }
      } catch {}
      return null;
    })
  );

  const matchedDoc = apiDocResults.find(Boolean);
  if (matchedDoc) {
    openApiFound = matchedDoc.openApiFound;
    openApiUrl = matchedDoc.openApiUrl;
    openApiTitle = matchedDoc.openApiTitle;
    endpointsCount = matchedDoc.endpointsCount;
  }

  // Probe GraphQL & test Introspection
  let graphQlFound = false;
  let graphQlUrl: string | undefined = undefined;
  let graphQlIntrospectionEnabled = false;
  let typesCount: number | undefined = undefined;

  const GRAPHQL_PATHS = ['/graphql', '/api/graphql', '/v1/graphql', '/query'];

  const graphQlResults = await Promise.all(
    GRAPHQL_PATHS.map(async (gp) => {
      const gUrl = `${normalizedBase}${gp}`;
      try {
        const introQuery = JSON.stringify({ query: '{ __schema { types { name } } }' });
        const res = await fetch(gUrl, {
          method: 'POST',
          headers: {
            ...reqHeaders,
            'Content-Type': 'application/json',
          },
          body: introQuery,
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (res.status === 200) {
          const text = await res.text();
          try {
            const json = JSON.parse(text);
            if (json.data?.__schema?.types) {
              return {
                graphQlFound: true,
                graphQlUrl: gUrl,
                graphQlIntrospectionEnabled: true,
                typesCount: Array.isArray(json.data.__schema.types) ? json.data.__schema.types.length : undefined,
              };
            }
          } catch {}
        } else if (res.status === 400 || res.status === 405) {
          const text = await res.text();
          if (text.toLowerCase().includes('graphql') || text.toLowerCase().includes('syntax error')) {
            return {
              graphQlFound: true,
              graphQlUrl: gUrl,
              graphQlIntrospectionEnabled: false,
              typesCount: undefined,
            };
          }
        }
      } catch {}
      return null;
    })
  );

  const matchedGql = graphQlResults.find(Boolean);
  if (matchedGql) {
    graphQlFound = matchedGql.graphQlFound;
    graphQlUrl = matchedGql.graphQlUrl;
    graphQlIntrospectionEnabled = matchedGql.graphQlIntrospectionEnabled;
    typesCount = matchedGql.typesCount;
  }

  return {
    openApiFound,
    openApiUrl,
    openApiTitle,
    endpointsCount,
    graphQlFound,
    graphQlUrl,
    graphQlIntrospectionEnabled,
    typesCount,
  };
}

// ============================================================================
// 7. TERMINAL FORMATTER
// ============================================================================

export function formatAttackSurfaceTerminal(
  assets: AttackSurfaceAsset[],
  email: EmailSecurityPosture,
  adminChecks: AdminInterfaceCheck[],
  cloudBuckets: CloudStorageAudit[] = [],
  takeovers: SubdomainTakeoverCheck[] = [],
  apiDiscovery?: ApiDiscoveryResult
): string {
  const lines: string[] = [
    `\n  ${colors.bold}${colors.cyan}EXTERNAL ATTACK SURFACE & ASSET INVENTORY:${colors.reset}`,
    `  ${colors.bold}${'ASSET HOSTNAME'.padEnd(28)} ${'TYPE'.padEnd(12)} ${'ENVIRONMENT'.padEnd(14)} ${'DISCOVERY'}${colors.reset}`,
    `  ${colors.gray}${'─'.repeat(26)}   ${'─'.repeat(10)}   ${'─'.repeat(12)}   ${'─'.repeat(12)}${colors.reset}`,
  ];

  assets.slice(0, 10).forEach((a) => {
    const envColor =
      a.environment === 'staging' || a.environment === 'development'
        ? colors.yellow
        : colors.green;
    lines.push(
      `  ${colors.bold}${a.hostname.padEnd(28)}${colors.reset} ${a.assetType.padEnd(12)} ${envColor}${a.environment.padEnd(14)}${colors.reset} [${colors.dim}${a.source}${colors.reset}]`
    );
  });

  if (assets.length > 10) {
    lines.push(`  ${colors.dim}... and ${assets.length - 10} additional assets documented in report.${colors.reset}`);
  }

  // Email Security Posture
  const policyStr = email.dmarcPolicy || 'missing';
  const dmarcColor = policyStr === 'reject' || policyStr === 'quarantine' ? colors.green : colors.red;
  lines.push(
    `\n  ${colors.bold}${colors.cyan}EMAIL & DOMAIN AUTHENTICATION POSTURE:${colors.reset}`,
    `  • SPF Record:   ${email.hasSpf ? `${colors.green}✔ Configured${colors.reset} (${colors.dim}${email.spfRecord?.slice(0, 50)}...${colors.reset})` : `${colors.red}✖ Missing SPF Record${colors.reset}`}`,
    `  • DMARC Policy: ${dmarcColor}${policyStr.toUpperCase()}${colors.reset} ${email.dmarcRecord ? `(${colors.dim}${email.dmarcRecord.slice(0, 45)}...${colors.reset})` : `${colors.red}✖ Missing RFC 7489 Policy${colors.reset}`}`
  );

  // Cloud Storage Buckets
  if (cloudBuckets.length > 0) {
    lines.push(`\n  ${colors.bold}${colors.cyan}CLOUD STORAGE BUCKET EXPOSURE AUDIT:${colors.reset}`);
    cloudBuckets.forEach((b) => {
      const statusBadge = b.publiclyReadable
        ? `${colors.red}CRITICAL: PUBLIC READ${b.listingEnabled ? ' + DIRECTORY LISTING' : ''}${colors.reset}`
        : `${colors.green}PROTECTED (Private)${colors.reset}`;
      lines.push(
        `  • [${b.provider.toUpperCase()}] ${colors.bold}${b.bucketName}${colors.reset} -> ${statusBadge} (${colors.dim}${b.url}${colors.reset})`
      );
    });
  }

  // Subdomain Takeovers
  if (takeovers.length > 0) {
    lines.push(`\n  ${colors.bold}${colors.yellow}SUBDOMAIN TAKEOVER & DANGLING CNAME AUDIT:${colors.reset}`);
    takeovers.forEach((t) => {
      const badge = t.vulnerable
        ? `${colors.red}CRITICAL: VULNERABLE TO TAKEOVER${colors.reset}`
        : `${colors.cyan}DANGLING CNAME${colors.reset}`;
      lines.push(
        `  • ${colors.bold}${t.subdomain}${colors.reset} -> ${badge} (${t.service || 'Third-Party'}: ${t.cnameDestination})`
      );
    });
  }

  // API Discovery & GraphQL
  if (apiDiscovery && (apiDiscovery.openApiFound || apiDiscovery.graphQlFound)) {
    lines.push(`\n  ${colors.bold}${colors.cyan}API SPECIFICATION & GRAPHQL AUDIT:${colors.reset}`);
    if (apiDiscovery.openApiFound) {
      lines.push(
        `  • OpenAPI Spec:  ${colors.green}✔ Discovered${colors.reset} (${colors.bold}${apiDiscovery.endpointsCount ?? 0} endpoints${colors.reset}) at ${colors.dim}${apiDiscovery.openApiUrl}${colors.reset}`
      );
    }
    if (apiDiscovery.graphQlFound) {
      const introBadge = apiDiscovery.graphQlIntrospectionEnabled
        ? `${colors.red}HIGH: INTROSPECTION QUERY ENABLED (${apiDiscovery.typesCount ?? 0} types revealed)${colors.reset}`
        : `${colors.green}Introspection Disabled (Hardened)${colors.reset}`;
      lines.push(`  • GraphQL API:   ${introBadge} at ${colors.dim}${apiDiscovery.graphQlUrl}${colors.reset}`);
    }
  }

  // Admin interfaces
  if (adminChecks.length > 0) {
    lines.push(`\n  ${colors.bold}${colors.yellow}ADMINISTRATIVE & SENSITIVE INTERFACES PROBED:${colors.reset}`);
    adminChecks.forEach((ac) => {
      const statusColor = ac.exposed ? colors.red : colors.cyan;
      lines.push(
        `  • ${colors.bold}${ac.path.padEnd(18)}${colors.reset} -> HTTP ${statusColor}${ac.status}${colors.reset} ${ac.notes ? `(${ac.notes})` : ''}`
      );
    });
  }

  return lines.join('\n');
}
