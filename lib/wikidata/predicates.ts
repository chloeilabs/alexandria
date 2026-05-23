// Human-readable labels for Wikidata properties we use as relationship
// predicates. Used by the entity page when rendering connections.
// Outbound: "<entity> P22 → <target>" reads as "<entity>'s father is <target>".
// Inbound: "<source> P22 → <entity>" reads as "<source> has <entity> as father".

export interface PredicateLabel {
  /** Reads naturally for outbound: "<entity>'s {label} is <target>". */
  outbound: string;
  /** Reads naturally for inbound: "<source> {label} <entity>". */
  inbound: string;
}

export const PREDICATE_LABELS: Record<string, PredicateLabel> = {
  P31: { outbound: "is a", inbound: "is the type of" },
  P279: { outbound: "is a kind of", inbound: "is a superset of" },
  P361: { outbound: "is part of", inbound: "has part" },
  P527: { outbound: "has part", inbound: "is part of" },
  P22: { outbound: "father", inbound: "father of" },
  P25: { outbound: "mother", inbound: "mother of" },
  P40: { outbound: "child", inbound: "child of" },
  P26: { outbound: "spouse", inbound: "spouse of" },
  P3373: { outbound: "sibling", inbound: "sibling of" },
  P27: { outbound: "citizen of", inbound: "had as citizen" },
  P19: { outbound: "born in", inbound: "birthplace of" },
  P20: { outbound: "died in", inbound: "place of death of" },
  P106: { outbound: "occupation", inbound: "practiced by" },
  P102: { outbound: "member of", inbound: "had as member" },
  P140: { outbound: "religion", inbound: "follower" },
  P39: { outbound: "held position", inbound: "held by" },
  P69: { outbound: "studied at", inbound: "educated" },
  P108: { outbound: "worked for", inbound: "employed" },
  P166: { outbound: "received", inbound: "awarded to" },
  P50: { outbound: "authored", inbound: "author" },
  P57: { outbound: "directed", inbound: "director" },
  P162: { outbound: "produced", inbound: "producer" },
  P175: { outbound: "performed", inbound: "performer" },
  P98: { outbound: "edited", inbound: "editor" },
  P407: { outbound: "in language", inbound: "language of" },
  P136: { outbound: "genre", inbound: "exemplifies" },
  P127: { outbound: "owned by", inbound: "owns" },
  P112: { outbound: "founded by", inbound: "founded" },
  P749: { outbound: "parent organization", inbound: "subsidiary of" },
  P355: { outbound: "subsidiary", inbound: "parent of" },
  P137: { outbound: "operator", inbound: "operates" },
  P607: { outbound: "in conflict", inbound: "had as battle" },
  P710: { outbound: "participated in", inbound: "had as participant" },
  P823: { outbound: "speaker", inbound: "spoken at" },
  P17: { outbound: "in country", inbound: "contains" },
  P30: { outbound: "continent", inbound: "contains" },
  P276: { outbound: "located in", inbound: "contains" },
  P131: { outbound: "located in", inbound: "contains" },
  P155: { outbound: "follows", inbound: "followed by" },
  P156: { outbound: "followed by", inbound: "follows" },
};

export function labelFor(
  predicate: string,
  direction: "outbound" | "inbound",
): string {
  const l = PREDICATE_LABELS[predicate];
  if (!l) return predicate;
  return l[direction];
}
