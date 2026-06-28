/** Airborne beats for siteswap throw h with d beats dwelling in hand (d ≤ h). */
export function airTimeBeats(throwValue: number, dwellBeats: number): number {
  if (throwValue <= 0) return 0;
  const d = Math.min(Math.max(0, dwellBeats), throwValue);
  return throwValue - d;
}

export function airTimeS(
  throwValue: number,
  dwellBeats: number,
  beatPeriodS: number,
): number {
  return airTimeBeats(throwValue, dwellBeats) * beatPeriodS;
}
