export interface SiteswapReport {
  pattern: string;
  values: number[];
  period: number;
  averageBallCount: number;
  landingResidues: number[];
  valid: boolean;
  invalidReason?: string;
}

export function parsePattern(pattern: string): number[] {
  const cleaned = pattern.toLowerCase().replace(/[\s,]/g, "");
  const values: number[] = [];
  for (const ch of cleaned) {
    if (ch >= "0" && ch <= "9") values.push(parseInt(ch, 10));
    else if (ch >= "a" && ch <= "z") values.push(10 + ch.charCodeAt(0) - "a".charCodeAt(0));
    else throw new Error(`Unsupported character: ${ch}`);
  }
  if (values.length === 0) throw new Error("Empty pattern.");
  return values;
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
