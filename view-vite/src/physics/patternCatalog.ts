import { isValidSiteswap, parsePattern } from "./siteswap";

export type PatternFamily = "cascade" | "reverseCascade" | "shower";

export interface PatternDefinition {
  id: string;
  label: string;
  siteswap: string;
  ballCount: number;
  family: PatternFamily;
  /** Shower: high throw (5 or 7) uses reversed functional ends. */
  reverseHighThrow?: number;
}

export const PATTERN_CATALOG: PatternDefinition[] = [
  { id: "330", label: "330", siteswap: "330", ballCount: 2, family: "cascade" },
  { id: "3", label: "3", siteswap: "3", ballCount: 3, family: "cascade" },
  { id: "40", label: "40", siteswap: "40", ballCount: 2, family: "cascade" },
  { id: "4", label: "4", siteswap: "4", ballCount: 4, family: "cascade" },
  { id: "5", label: "5", siteswap: "5", ballCount: 5, family: "cascade" },
  { id: "3-reverse", label: "3 reverse", siteswap: "3", ballCount: 3, family: "reverseCascade" },
  { id: "51", label: "51", siteswap: "51", ballCount: 3, family: "shower", reverseHighThrow: 5 },
  { id: "71", label: "71", siteswap: "71", ballCount: 4, family: "shower", reverseHighThrow: 7 },
];

export function patternById(id: string): PatternDefinition | undefined {
  return PATTERN_CATALOG.find((p) => p.id === id);
}

export function patternValues(pattern: PatternDefinition): number[] {
  return parsePattern(pattern.siteswap);
}

export function maxThrowInPattern(pattern: PatternDefinition): number {
  return Math.max(...patternValues(pattern));
}

/** Validate catalog entries at module load. */
for (const p of PATTERN_CATALOG) {
  const values = parsePattern(p.siteswap);
  if (!isValidSiteswap(values)) {
    console.warn(`Pattern ${p.id} (${p.siteswap}) is not a valid siteswap.`);
  }
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  if (Math.abs(avg - p.ballCount) > 0.01) {
    console.warn(`Pattern ${p.id} ballCount ${p.ballCount} != average ${avg}.`);
  }
}
