import type { BrowserControllerState, PageMetadata } from '@dualsurf/shared-types';

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

export function formatNumberedLinks(links: PageMetadata['links']): string {
  if (!links || links.length === 0) {
    return `${colors.dim}No actionable links detected on current page.${colors.reset}`;
  }

  const header = `${colors.bold}${colors.cyan}Links (${links.length})${colors.reset}`;
  const rows = links.map((l) => {
    const num = ` [${l.id}]`.padStart(5, ' ');
    return `${colors.cyan}${colors.bold}${num}${colors.reset} ${l.label}\n      ${colors.gray}${l.href}${colors.reset}`;
  });

  return [header, ...rows].join('\n');
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
