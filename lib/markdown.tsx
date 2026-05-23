// Minimal inline-markdown parser for the small subset our Tier 1/2 prose
// produces — single-asterisk italics (*jeliw*, *hajj*) and occasional
// double-asterisk bold. Block-level markdown is never produced.
//
// Returns a React fragment so callers can drop it straight into JSX. We
// intentionally do NOT use a full Markdown library — the surface area is
// small, dependencies stay slim, and behavior stays predictable when the
// LLM produces odd markup.

import type { ReactNode } from "react";

const INLINE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;

/**
 * Parse a single paragraph of inline-markdown into a React fragment.
 * Recognizes:
 *   *word* or *multi word*   →   <em>...</em>
 *   **word**                  →   <strong>...</strong>
 * Everything else is plain text.
 */
export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const token = m[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      out.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      out.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = idx + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
