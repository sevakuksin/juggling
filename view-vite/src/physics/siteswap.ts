export interface SiteswapReport {
  pattern: string;
  values: number[];
  period: number;
  averageBallCount: number;
  landingResidues: number[];
  valid: boolean;
  invalidReason?: string;
}

export interface SiteswapReport {
  pattern: string;
  values: number[];
  period: number;
  averageBallCount: number;
  landingResidues: number[];
  valid: boolean;
  invalidReason?: string;
}

export interface ParsedThrow {
  height: number;
  reversed: boolean;
}

export interface ParsedSiteswap {
  raw: string;
  throws: ParsedThrow[];
  heights: number[];
  period: number;
}

export interface SiteswapReportWithReversal extends SiteswapReport {
  throws: ParsedThrow[];
}

function parseThrowHeight(ch: string): number {
  if (ch >= "0" && ch <= "9") return parseInt(ch, 10);
  if (ch >= "a" && ch <= "z") return 10 + ch.charCodeAt(0) - "a".charCodeAt(0);
  throw new Error(`Unsupported character: ${ch}`);
}

export function parseSiteswapWithReversal(input: string): ParsedSiteswap {
  const cleaned = input.toLowerCase().replace(/[\s,]/g, "");
  const throws: ParsedThrow[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === "-") {
      throw new Error("Unexpected '-' (must follow a throw digit).");
    }
    const height = parseThrowHeight(ch);
    let reversed = false;
    if (i + 1 < cleaned.length && cleaned[i + 1] === "-") {
      reversed = true;
      i++;
    }
    throws.push({ height, reversed });
  }
  if (throws.length === 0) throw new Error("Empty pattern.");
  return {
    raw: input,
    throws,
    heights: throws.map((t) => t.height),
    period: throws.length,
  };
}

export function formatThrowsDisplay(throws: ParsedThrow[]): string {
  return throws
    .map((t) => {
      const h = t.height >= 10 ? String.fromCharCode("a".charCodeAt(0) + t.height - 10) : String(t.height);
      return t.reversed ? `${h}⁻` : h;
    })
    .join(" ");
}

export function reportPatternWithReversal(input: string): SiteswapReportWithReversal {
  const parsed = parseSiteswapWithReversal(input);
  const values = parsed.heights;
  const valid = isValidSiteswap(values);
  return {
    pattern: input,
    values,
    throws: parsed.throws,
    period: parsed.period,
    averageBallCount: ballCount(values),
    landingResidues: landingResidues(values),
    valid,
    invalidReason: valid ? undefined : invalidReason(values),
  };
}

export function parsePattern(pattern: string): number[] {
  return parseSiteswapWithReversal(pattern).heights;
}

export function ballCount(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function landingResidues(values: number[]): number[] {
  const p = values.length;
  return values.map((v, i) => (i + v) % p);
}

export function isValidSiteswap(values: number[]): boolean {
  const residues = landingResidues(values);
  const unique = new Set(residues).size === residues.length;
  const integerBalls = Number.isInteger(ballCount(values));
  return unique && integerBalls;
}

export function invalidReason(values: number[]): string | undefined {
  const residues = landingResidues(values);
  const counts = new Map<number, number>();
  for (const r of residues) counts.set(r, (counts.get(r) ?? 0) + 1);
  const dupes = [...counts.entries()].filter(([, c]) => c > 1);
  if (dupes.length > 0) {
    return `Duplicate landing beats: ${dupes.map(([k, c]) => `${k} (×${c})`).join(", ")}`;
  }
  const avg = ballCount(values);
  if (!Number.isInteger(avg)) {
    return `Average throw ${avg.toFixed(2)} is not an integer (ball count must be whole)`;
  }
  return undefined;
}

export function reportPattern(pattern: string): SiteswapReport {
  const values = parsePattern(pattern);
  const valid = isValidSiteswap(values);
  return {
    pattern,
    values,
    period: values.length,
    averageBallCount: ballCount(values),
    landingResidues: landingResidues(values),
    valid,
    invalidReason: valid ? undefined : invalidReason(values),
  };
}

export function landingCollisions(values: number[]): Map<number, number[]> {
  const residues = landingResidues(values);
  const byTarget = new Map<number, number[]>();
  residues.forEach((r, i) => {
    const list = byTarget.get(r) ?? [];
    list.push(i);
    byTarget.set(r, list);
  });
  const collisions = new Map<number, number[]>();
  for (const [target, sources] of byTarget) {
    if (sources.length > 1) collisions.set(target, sources);
  }
  return collisions;
}

export function missingLandingTargets(values: number[]): number[] {
  const p = values.length;
  const residues = new Set(landingResidues(values));
  const missing: number[] = [];
  for (let i = 0; i < p; i++) if (!residues.has(i)) missing.push(i);
  return missing;
}
