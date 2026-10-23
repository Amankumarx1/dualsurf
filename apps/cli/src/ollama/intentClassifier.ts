export type IntentType =
  | 'direct_qa'
  | 'summarize'
  | 'compare_tabs'
  | 'extract_data'
  | 'semantic_click'
  | 'agent_action'
  | 'unknown';

export interface ClassifiedIntent {
  type: IntentType;
  confidence: number;
  extractedQuery: string;
  metadata?: Record<string, any>;
}

/**
 * Rapid heuristic intent classifier to route natural language requests
 * to the most efficient subsystem before invoking heavy loops.
 */
export function classifyUserIntent(input: string): ClassifiedIntent {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // 1. Direct Page Summary
  if (
    /^(summarize|summary|tldr|tl;dr|give me a summary|overview)\b/i.test(lower) ||
    /^(summarize\s+(this|the)\s+(page|article|site))\b/i.test(lower)
  ) {
    let style: 'bullets' | 'tldr' | 'executive' = 'bullets';
    if (lower.includes('tldr') || lower.includes('brief')) style = 'tldr';
    else if (lower.includes('executive') || lower.includes('in-depth')) style = 'executive';

    return {
      type: 'summarize',
      confidence: 0.95,
      extractedQuery: trimmed,
      metadata: { style },
    };
  }

  // 2. Tab Comparison (e.g. "compare this with tab 2", "compare with tab-1")
  const compareMatch = lower.match(/compare\s+(?:this|active\s+tab)?\s*(?:with|to|and)\s*tab\s*\[?(\w+)\]?/i);
  if (compareMatch) {
    return {
      type: 'compare_tabs',
      confidence: 0.9,
      extractedQuery: trimmed,
      metadata: { targetTab: compareMatch[1] },
    };
  }

  // 3. Structured Data Extraction (e.g. "extract all emails as json", "extract pricing table")
  if (/^extract\s+(?:the\s+)?(.+?)(?:\s+as\s+json|\s+table)?$/i.test(lower)) {
    return {
      type: 'extract_data',
      confidence: 0.85,
      extractedQuery: trimmed.replace(/^extract\s+/i, ''),
    };
  }

  // 4. Semantic Click (e.g. "click 'Sign In'", "press documentation")
  const clickMatch = trimmed.match(/^(?:click|press|follow)\s+(?:the\s+)?(?:link\s+|button\s+)?['"]?([^'"]+)['"]?$/i);
  if (clickMatch && !/^(?:here|link|button)$/i.test(clickMatch[1].trim())) {
    return {
      type: 'semantic_click',
      confidence: 0.88,
      extractedQuery: clickMatch[1].trim(),
    };
  }

  // 5. In-Page Question & Answer (e.g. "what does X mean?", "how much is...", "who wrote this?")
  const isQuestion =
    /^(what|why|how|who|when|where|which|is there|are there|can i|does this|explain|tell me about)\b/i.test(lower) ||
    lower.endsWith('?');

  const involvesNavigation =
    /\b(go to|navigate|search for|open|visit|browse|google|duckduckgo|find on web)\b/i.test(lower);

  if (isQuestion && !involvesNavigation) {
    return {
      type: 'direct_qa',
      confidence: 0.85,
      extractedQuery: trimmed,
    };
  }

  // 6. Multi-step Agent Goal (actions, browsing, searching, navigating)
  return {
    type: 'agent_action',
    confidence: 0.8,
    extractedQuery: trimmed,
  };
}
