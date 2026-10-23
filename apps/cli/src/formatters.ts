import type {
  BrowserControllerState,
  PageMetadata,
  FindResult,
  EndpointItem,
  EndpointCategory,
} from '@dualsurf/shared-types';

export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
};

export function formatBanner(): string {
  return `${colors.bold}${colors.cyan}DUALSURF  |  TERMINAL MODE${colors.reset}\n${colors.gray}─────────────────────────────────────────────────────${colors.reset}`;
}

export function formatPageHeader(meta: PageMetadata): string {
  const lines = [
    formatBanner(),
    `${colors.bold}Title:${colors.reset} ${meta.title || '(No title)'}`,
    `${colors.bold}URL:  ${colors.reset} ${colors.cyan}${meta.url || 'about:blank'}${colors.reset}`,
  ];
  if (meta.isLoading) {
    lines.push(`${colors.yellow}Status: Loading...${colors.reset}`);
  }
  if (meta.endpoints && meta.endpoints.length > 0) {
    const apiCount = meta.endpoints.filter((e) => e.category === 'api').length;
    const authCount = meta.endpoints.filter((e) => e.category === 'auth').length;
    const dlCount = meta.endpoints.filter((e) => e.category === 'download').length;
    const formCount = meta.endpoints.filter((e) => e.category === 'form').length;

    const summaryParts: string[] = [];
    if (apiCount) summaryParts.push(`${apiCount} API`);
    if (authCount) summaryParts.push(`${authCount} Auth`);
    if (dlCount) summaryParts.push(`${dlCount} Download`);
    if (formCount) summaryParts.push(`${formCount} Form`);

    const summaryStr = summaryParts.length > 0 ? ` (${summaryParts.join(', ')})` : '';
    lines.push(
      `${colors.bold}Endpoints:${colors.reset} ${meta.endpoints.length} detected${summaryStr} ${colors.dim}(run "dualsurf endpoints")${colors.reset}`
    );
  }
  return lines.join('\n');
}

export function formatTabsList(state: BrowserControllerState): string {
  const header = [
    formatBanner(),
    `${colors.bold}OPEN TABS (${state.tabs.length})${colors.reset}`,
    `${colors.gray}─────────────────────────────────────────────────────${colors.reset}`,
  ];

  if (state.tabs.length === 0) {
    header.push(`${colors.dim}No open tabs.${colors.reset}`);
    return header.join('\n');
  }

  const rows = state.tabs.map((tab, idx) => {
    const isActive = tab.id === state.activeTabId;
    const marker = isActive ? `${colors.green}* [${idx + 1}]${colors.reset}` : `  [${idx + 1}]`;
    const title = tab.title.length > 40 ? tab.title.substring(0, 37) + '...' : tab.title;
    const url = tab.url.length > 45 ? tab.url.substring(0, 42) + '...' : tab.url;

    return `${marker} ${colors.bold}${title}${colors.reset}\n      ${colors.gray}${url}${colors.reset}`;
  });

  return [...header, ...rows].join('\n');
}

export function getCategoryBadge(category?: EndpointCategory, isExternal?: boolean): string {
  switch (category) {
    case 'api':
      return `${colors.bold}${colors.magenta}[API]${colors.reset}`;
    case 'auth':
      return `${colors.bold}${colors.yellow}[AUTH]${colors.reset}`;
    case 'download':
      return `${colors.bold}${colors.green}[DOWNLOAD]${colors.reset}`;
    case 'action':
      return `${colors.bold}${colors.red}[ACTION]${colors.reset}`;
    case 'form':
      return `${colors.bold}${colors.blue}[FORM]${colors.reset}`;
    case 'external':
      return `${colors.dim}[EXT]${colors.reset}`;
    case 'internal':
    default:
      return isExternal ? `${colors.dim}[EXT]${colors.reset}` : `${colors.dim}[INT]${colors.reset}`;
  }
}

export function formatNumberedLinks(links: PageMetadata['links']): string {
  if (!links || links.length === 0) {
    return `${colors.dim}No actionable links detected on current page.${colors.reset}`;
  }

  const header = `${colors.bold}${colors.cyan}Actionable Links & Detected Endpoints (${links.length})${colors.reset}\n${colors.gray}─────────────────────────────────────────────────────${colors.reset}`;
  const rows = links.map((l) => {
    const num = ` [${l.id}]`.padStart(5, ' ');
    const badge = getCategoryBadge(l.category, l.isExternal);
    const endpointPath = l.endpoint ? `Endpoint: ${colors.cyan}${l.endpoint}${colors.reset} -> ` : '';
    return `${colors.cyan}${colors.bold}${num}${colors.reset} ${badge} ${colors.bold}${l.label}${colors.reset}\n      ${colors.gray}${endpointPath}${l.href}${colors.reset}`;
  });

  return [header, ...rows].join('\n');
}

export function formatEndpoints(
  endpoints?: EndpointItem[],
  filter?: string
): string {
  if (!endpoints || endpoints.length === 0) {
    return `${colors.dim}No endpoints detected on active page.${colors.reset}`;
  }

  let filtered = endpoints;
  if (filter) {
    const f = filter.toLowerCase().replace(/^-+/, '');
    filtered = endpoints.filter(
      (e) =>
        e.category.toLowerCase().includes(f) ||
        e.path.toLowerCase().includes(f) ||
        (e.method && e.method.toLowerCase().includes(f)) ||
        (e.label && e.label.toLowerCase().includes(f))
    );
  }

  const header = [
    formatBanner(),
    `${colors.bold}DETECTED ENDPOINTS (${filtered.length} endpoints)${colors.reset}`,
    `${colors.gray}─────────────────────────────────────────────────────${colors.reset}`,
  ];

  if (filtered.length === 0) {
    header.push(`${colors.dim}No endpoints matching filter "${filter}".${colors.reset}`);
    return header.join('\n');
  }

  // Group by category
  const categories: Record<string, EndpointItem[]> = {};
  filtered.forEach((e) => {
    const cat = e.category.toUpperCase();
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(e);
  });

  const sections: string[] = [...header];

  for (const [catName, items] of Object.entries(categories)) {
    sections.push(`\n${colors.bold}${colors.cyan}● ${catName} ENDPOINTS (${items.length})${colors.reset}`);
    items.forEach((item) => {
      const methodBadge = item.method ? `${colors.yellow}[${item.method}]${colors.reset} ` : '';
      const extBadge = item.isExternal ? ` ${colors.dim}(external: ${item.origin})${colors.reset}` : '';
      const labelStr = item.label ? ` ${colors.dim}— ${item.label}${colors.reset}` : '';
      sections.push(
        `  ${colors.cyan}${colors.bold}[${item.id}]${colors.reset} ${methodBadge}${colors.green}${item.path}${colors.reset}${extBadge}${labelStr}\n      ${colors.gray}${item.url}${colors.reset}`
      );
    });
  }

  return sections.join('\n');
}

export function formatHeadings(headings: PageMetadata['headings']): string {
  if (!headings || headings.length === 0) {
    return `${colors.dim}No headings detected on current page.${colors.reset}`;
  }

  const header = `${colors.bold}${colors.cyan}Headings (${headings.length})${colors.reset}`;
  const rows = headings.map((h) => {
    const indent = '  '.repeat(Math.max(0, h.level - 1));
    return `${indent}${colors.magenta}[H${h.level}]${colors.reset} ${h.text}`;
  });

  return [header, ...rows].join('\n');
}

export function formatPageText(meta: PageMetadata): string {
  const sections = [formatPageHeader(meta)];

  if (meta.headings && meta.headings.length > 0) {
    sections.push('');
    sections.push(formatHeadings(meta.headings.slice(0, 10)));
  }

  if (meta.textSnippet) {
    sections.push('');
    sections.push(`${colors.bold}Content:${colors.reset}`);
    sections.push(meta.textSnippet);
  }

  if (meta.links && meta.links.length > 0) {
    sections.push('');
    sections.push(formatNumberedLinks(meta.links.slice(0, 15)));
    if (meta.links.length > 15) {
      sections.push(`${colors.dim}... and ${meta.links.length - 15} more links (run "dualsurf links" to view all)${colors.reset}`);
    }
  }

  return sections.join('\n');
}

export function formatBookmarks(bookmarks: any[]): string {
  const header = [
    formatBanner(),
    `${colors.bold}SAVED BOOKMARKS (${bookmarks.length})${colors.reset}`,
    `${colors.gray}─────────────────────────────────────────────────────${colors.reset}`,
  ];

  if (bookmarks.length === 0) {
    header.push(`${colors.dim}No saved bookmarks. Use "dualsurf bookmark add <url> [title]" to add one.${colors.reset}`);
    return header.join('\n');
  }

  const rows = bookmarks.map((b) => {
    return `  ${colors.cyan}★${colors.reset} ${colors.bold}${b.title}${colors.reset} ${colors.dim}(id: ${b.id})${colors.reset}\n    ${colors.gray}${b.url}${colors.reset}`;
  });

  return [...header, ...rows].join('\n');
}

export function formatHistory(history: any[]): string {
  const header = [
    formatBanner(),
    `${colors.bold}BROWSING HISTORY (${history.length})${colors.reset}`,
    `${colors.gray}─────────────────────────────────────────────────────${colors.reset}`,
  ];

  if (history.length === 0) {
    header.push(`${colors.dim}No browsing history found.${colors.reset}`);
    return header.join('\n');
  }

  const rows = history.map((h) => {
    const time = new Date(h.visitedAt).toLocaleTimeString();
    const count = h.visitCount > 1 ? `${colors.dim}(visits: ${h.visitCount})${colors.reset}` : '';
    return `  ${colors.gray}[${time}]${colors.reset} ${colors.bold}${h.title}${colors.reset} ${count}\n    ${colors.cyan}${h.url}${colors.reset}`;
  });

  return [...header, ...rows].join('\n');
}

export function formatDownloads(downloads: any[]): string {
  const header = [
    formatBanner(),
    `${colors.bold}DOWNLOADS ACTIVITY (${downloads.length})${colors.reset}`,
    `${colors.gray}─────────────────────────────────────────────────────${colors.reset}`,
  ];

  if (downloads.length === 0) {
    header.push(`${colors.dim}No recent download activity.${colors.reset}`);
    return header.join('\n');
  }

  const rows = downloads.map((d) => {
    const size = d.totalBytes ? ` (${(d.totalBytes / (1024 * 1024)).toFixed(1)} MB)` : '';
    return `  ${colors.green}↓${colors.reset} ${colors.bold}${d.filename}${colors.reset}${size} [${d.status}]\n    ${colors.gray}${d.path}${colors.reset}`;
  });

  return [...header, ...rows].join('\n');
}

export function formatFindResults(result: FindResult): string {
  const header = [
    formatBanner(),
    `${colors.bold}PAGE SEARCH FOR: "${result.query}" (${result.count} matches)${colors.reset}`,
    `${colors.gray}─────────────────────────────────────────────────────${colors.reset}`,
  ];

  if (result.matches.length === 0) {
    header.push(`${colors.dim}No occurrences found on the active page.${colors.reset}`);
    return header.join('\n');
  }

  const rows = result.matches.map((m) => {
    return `  ${colors.bold}${colors.yellow}[${m.index}]${colors.reset} ${m.snippet}`;
  });

  return [...header, ...rows].join('\n');
}
