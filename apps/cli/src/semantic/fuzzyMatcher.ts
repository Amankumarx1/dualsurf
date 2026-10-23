import type { LinkItem, TabState } from '@dualsurf/shared-types';

export interface MatchResult<T> {
  item: T;
  score: number;
}

/**
 * Clean a natural language query for matching against elements.
 * E.g., "click the 'Pricing' button" -> "pricing"
 */
export function normalizeQuery(query: string): string {
  let clean = query.trim().toLowerCase();
  // Strip outer quotes
  clean = clean.replace(/^['"`]+|['"`]+$/g, '');
  // Strip action prefixes
  clean = clean.replace(/^(click|open|press|follow|go\s+to|visit|select|switch\s+to)\s+/i, '');
  // Strip leading articles
  clean = clean.replace(/^the\s+/i, '');
  // Strip quotes if wrapped around the target phrase (e.g. "Pricing")
  clean = clean.replace(/^['"`]+|['"`]+$/g, '');
  // Strip trailing element qualifiers
  clean = clean.replace(/\s+(link|button|tab|page)$/i, '');
  // Strip trailing quotes if any
  clean = clean.replace(/^['"`]+|['"`]+$/g, '');
  return clean.trim();
}

/**
 * Score how well a candidate text matches the search query.
 * Higher is better. Max ~100.
 */
function scoreString(query: string, target: string): number {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();

  if (!q || !t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 85;

  // Word boundary match (e.g. query "sign in" inside "Please Sign In Now")
  const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(q)}\\b`, 'i');
  if (wordBoundaryRegex.test(t)) return 75;

  if (t.includes(q)) return 60;

  // Match all individual words
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  if (words.length > 1) {
    const matchedCount = words.filter((w) => t.includes(w)).length;
    if (matchedCount === words.length) {
      return 55;
    }
    if (matchedCount > 0) {
      return 30 + Math.floor((matchedCount / words.length) * 20);
    }
  }

  return 0;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find the best link that matches a natural language user query.
 */
export function findBestMatchingLink(
  query: string,
  links: LinkItem[]
): MatchResult<LinkItem> | null {
  const matches = findTopMatchingLinks(query, links, 1);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Find top matching links ranked by relevance.
 */
export function findTopMatchingLinks(
  query: string,
  links: LinkItem[],
  limit = 3
): Array<MatchResult<LinkItem>> {
  const clean = normalizeQuery(query);
  if (!clean || !links || links.length === 0) return [];

  const scored: Array<MatchResult<LinkItem>> = [];

  for (const link of links) {
    const labelScore = scoreString(clean, link.label);
    const hrefScore = scoreString(clean, link.href) * 0.7; // slight penalty for URL-only match
    const finalScore = Math.max(labelScore, hrefScore);

    if (finalScore >= 40) {
      scored.push({ item: link, score: finalScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Find the best matching tab by title, URL, or domain keyword.
 */
export function findBestMatchingTab(
  query: string,
  tabs: TabState[]
): { tab: TabState; index: number; score: number } | null {
  const clean = normalizeQuery(query);
  if (!clean || !tabs || tabs.length === 0) return null;

  let best: { tab: TabState; index: number; score: number } | null = null;

  tabs.forEach((tab, index) => {
    const titleScore = scoreString(clean, tab.title);
    const urlScore = scoreString(clean, tab.url) * 0.8;
    const finalScore = Math.max(titleScore, urlScore);

    if (finalScore >= 35 && (!best || finalScore > best.score)) {
      best = { tab, index: index + 1, score: finalScore };
    }
  });

  return best;
}
