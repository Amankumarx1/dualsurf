import type { VulnerableDependency, DependencyCve } from '@dualsurf/shared-types';

interface KnownAdvisory {
  library: string;
  maxVulnerableVersion: string;
  cves: DependencyCve[];
}

/**
 * Compare semantic versions: a < b returns -1, a > b returns 1, a == b returns 0.
 */
export function compareSemver(v1: string, v2: string): number {
  const clean = (v: string) => v.replace(/^[^0-9]*/, '').split('.').map((p) => parseInt(p, 10) || 0);
  const p1 = clean(v1);
  const p2 = clean(v2);
  const len = Math.max(p1.length, p2.length, 3);
  for (let i = 0; i < len; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
  }
  return 0;
}

const ADVISORY_DATABASE: KnownAdvisory[] = [
  {
    library: 'jQuery',
    maxVulnerableVersion: '3.5.0',
    cves: [
      {
        cveId: 'CVE-2020-11022',
        cvssScore: 6.1,
        severity: 'MEDIUM',
        summary: 'Regex in jQuery.htmlPrefilter allows Cross-Site Scripting (XSS) even with sanitizers.',
        fixedIn: '3.5.0',
      },
      {
        cveId: 'CVE-2020-11023',
        cvssScore: 6.1,
        severity: 'MEDIUM',
        summary: 'Untrusted HTML passed to DOM manipulation methods allows execution of untrusted code.',
        fixedIn: '3.5.0',
      },
      {
        cveId: 'CVE-2019-11358',
        cvssScore: 6.1,
        severity: 'MEDIUM',
        summary: 'Prototype Pollution via jQuery.extend(true, {}, ...).',
        fixedIn: '3.4.0',
      },
    ],
  },
  {
    library: 'Lodash',
    maxVulnerableVersion: '4.17.21',
    cves: [
      {
        cveId: 'CVE-2021-23337',
        cvssScore: 7.2,
        severity: 'HIGH',
        summary: 'Command Injection vulnerability in template function via malicious template variable names.',
        fixedIn: '4.17.21',
      },
      {
        cveId: 'CVE-2020-8203',
        cvssScore: 7.4,
        severity: 'HIGH',
        summary: 'Prototype Pollution vulnerability in zipObjectDeep allowing property injection.',
        fixedIn: '4.17.20',
      },
    ],
  },
  {
    library: 'Bootstrap',
    maxVulnerableVersion: '4.3.1',
    cves: [
      {
        cveId: 'CVE-2019-8331',
        cvssScore: 6.1,
        severity: 'MEDIUM',
        summary: 'Cross-site scripting (XSS) in tooltip and popover plugins via data-template.',
        fixedIn: '4.3.1',
      },
      {
        cveId: 'CVE-2018-14041',
        cvssScore: 6.1,
        severity: 'MEDIUM',
        summary: 'XSS in the data-target attribute of collapse and scrollspy plugins.',
        fixedIn: '3.4.0',
      },
    ],
  },
  {
    library: 'AngularJS',
    maxVulnerableVersion: '1.8.0',
    cves: [
      {
        cveId: 'CVE-2020-7676',
        cvssScore: 7.5,
        severity: 'HIGH',
        summary: 'Prototype Pollution vulnerability in angular.merge.',
        fixedIn: '1.8.0',
      },
    ],
  },
  {
    library: 'Moment.js',
    maxVulnerableVersion: '2.29.4',
    cves: [
      {
        cveId: 'CVE-2022-31129',
        cvssScore: 7.5,
        severity: 'HIGH',
        summary: 'Regular Expression Denial of Service (ReDoS) when parsing invalid date strings.',
        fixedIn: '2.29.4',
      },
    ],
  },
  {
    library: 'Axios',
    maxVulnerableVersion: '0.21.1',
    cves: [
      {
        cveId: 'CVE-2020-28168',
        cvssScore: 5.9,
        severity: 'MEDIUM',
        summary: 'Server-Side Request Forgery (SSRF) bypass through follow-redirects dependency.',
        fixedIn: '0.21.1',
      },
    ],
  },
];

const SCRIPT_FINGERPRINTS: Array<{
  name: string;
  regex: RegExp;
}> = [
  { name: 'jQuery', regex: /(?:jquery(?:[-./@]|(?:\.min)?\.js\/))([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i },
  { name: 'Lodash', regex: /(?:lodash(?:[-./@]|(?:\.min)?\.js\/))([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i },
  { name: 'Bootstrap', regex: /(?:bootstrap(?:[-./@]|(?:\.min)?\.js\/))([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i },
  { name: 'AngularJS', regex: /(?:angular(?:[-./@]|(?:\.min)?\.js\/))([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i },
  { name: 'Moment.js', regex: /(?:moment(?:[-./@]|(?:\.min)?\.js\/))([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i },
  { name: 'Axios', regex: /(?:axios(?:[-./@]|(?:\.min)?\.js\/))([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i },
];

/**
 * Scan HTML source code for loaded frontend scripts and match against known CVE advisories.
 */
export function scanFrontendDependencies(html: string): VulnerableDependency[] {
  const results: VulnerableDependency[] = [];
  const scriptSrcRegex = /<script[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  const scriptUrls: string[] = [];
  while ((match = scriptSrcRegex.exec(html)) !== null) {
    if (match[1]) scriptUrls.push(match[1]);
  }

  const detectedMap = new Map<string, { version: string; url: string }>();

  for (const src of scriptUrls) {
    for (const fp of SCRIPT_FINGERPRINTS) {
      const vMatch = src.match(fp.regex);
      if (vMatch && vMatch[1]) {
        const ver = vMatch[1];
        if (!detectedMap.has(fp.name)) {
          detectedMap.set(fp.name, { version: ver, url: src });
        }
      }
    }
  }

  // Cross-reference with Advisory Database
  for (const [libName, info] of detectedMap.entries()) {
    const advisory = ADVISORY_DATABASE.find((a) => a.library.toLowerCase() === libName.toLowerCase());
    if (advisory) {
      if (compareSemver(info.version, advisory.maxVulnerableVersion) < 0) {
        results.push({
          library: libName,
          detectedVersion: info.version,
          sourceUrl: info.url,
          cveList: advisory.cves,
        });
      }
    }
  }

  return results;
}
