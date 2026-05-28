// The single source of truth for the caveat string we attach to any
// MCP response that exposes generated content. Imported everywhere
// citations or LLM-claimed material is surfaced so there is no path
// that bypasses it.

export const PROVENANCE_CAVEAT =
  "These entries are AI-distilled summaries. Citations are LLM-claimed, not externally verified.";

export const CITATION_CAVEAT =
  "These are LLM-claimed sources, not externally verified.";

export function wrapWithCaveat(payload: unknown): string {
  return `${JSON.stringify(payload, null, 2)}\n\n[${CITATION_CAVEAT}]`;
}
