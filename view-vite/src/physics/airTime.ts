import { dwellBeatsForThrow } from "./twoHandThrowConfig";

/** Airborne beats: T_air = T_b × (n − D), with D from dwellBeatsForThrow. */
export function airTimeBeats(throwValue: number, dwellBeats: number): number {
  if (throwValue <= 0) return 0;
  const d = dwellBeatsForThrow(dwellBeats, throwValue);
  return throwValue - d;
}

/** Airborne beats with an already-resolved dwell D (no per-throw remapping). */
export function airTimeBeatsExact(throwValue: number, dwellBeats: number): number {
  if (throwValue <= 0) return 0;
  const d = Math.min(Math.max(0, dwellBeats), throwValue);
  return throwValue - d;
}

export function airTimeSExact(
  throwValue: number,
  dwellBeats: number,
  beatPeriodS: number,
): number {
  return airTimeBeatsExact(throwValue, dwellBeats) * beatPeriodS;
}

export function airTimeS(
  throwValue: number,
  dwellBeats: number,
  beatPeriodS: number,
): number {
  return airTimeBeats(throwValue, dwellBeats) * beatPeriodS;
}
