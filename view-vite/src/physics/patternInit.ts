import {
  landingHand,
  oppositeHand,
  type HandId,
} from "./config";
import { airTimeBeats } from "./airTime";
import { firstThrowBeat, throwBeatForHand } from "./hands";
import type { PatternDefinition } from "./patternCatalog";
import { patternValues } from "./patternCatalog";
import { HAND_SCHEDULE } from "./twoHandThrowConfig";

/** Beat index when the low hand catches an incoming high throw (same beat as its throw 1). */
export function showerLowMultiplexCatchBeats(
  pattern: PatternDefinition,
  startHand: HandId,
  highDwell: number,
  periodBeats: number,
): Set<number> {
  const beats = new Set<number>();
  if (pattern.family !== "shower" || pattern.reverseHighThrow == null) return beats;
  const lowHand = oppositeHand(startHand);
  const highThrow = pattern.reverseHighThrow;
  const air = airTimeBeats(highThrow, highDwell);
  if (air <= 0) return beats;
  for (let b = 0; b < periodBeats; b++) {
    if (!throwBeatForHand(startHand, b)) continue;
    if (landingHand(startHand, highThrow) !== lowHand) continue;
    beats.add(b + air);
  }
  return beats;
}

/** Wall-clock release for a scheduled throw (low-hand multiplex throws are delayed). */
export function showerThrowReleaseTimeS(
  pattern: PatternDefinition,
  startHand: HandId,
  hand: HandId,
  beat: number,
  beatPeriodS: number,
  highDwell: number,
  periodBeats: number,
): number {
  const bt = beat * beatPeriodS;
  if (pattern.family !== "shower" || hand !== oppositeHand(startHand)) return bt;
  const multiplex = showerLowMultiplexCatchBeats(pattern, startHand, highDwell, periodBeats);
  if (multiplex.has(beat)) {
    return bt + HAND_SCHEDULE.showerCatchThenThrowFrac * beatPeriodS;
  }
  return bt;
}

/** Force catch on landing when hand-probe timing is unreliable. */
export function showerForceCatchOnLanding(
  pattern: PatternDefinition,
  startHand: HandId,
  throwValue: number,
  catchingHand: HandId,
  landsGeometricInside: boolean,
): boolean {
  if (landsGeometricInside) return true;
  if (pattern.family !== "shower" || pattern.reverseHighThrow == null) return false;
  return (
    throwValue === pattern.reverseHighThrow &&
    catchingHand === oppositeHand(startHand)
  );
}

export interface HandStacks {
  left: number[];
  right: number[];
}

/** Ball ids 0..n-1 distributed across hands at t=0. */
export function initialStacks(pattern: PatternDefinition, startHand: HandId): HandStacks {
  const left: number[] = [];
  const right: number[] = [];
  const n = pattern.ballCount;
  const push = (hand: HandId, id: number) => {
    (hand === "left" ? left : right).push(id);
  };

  if (pattern.id === "330") {
    push("left", 0);
    push("right", 1);
    return { left, right };
  }

  if (pattern.id === "40") {
    for (let i = 0; i < n; i++) push(startHand, i);
    return { left, right };
  }

  if (pattern.family === "shower") {
    const other = oppositeHand(startHand);
    for (let i = 0; i < n - 1; i++) push(startHand, i);
    push(other, n - 1);
    return { left, right };
  }

  const startCount = n % 2 === 1 ? Math.floor(n / 2) + 1 : n / 2;
  const otherHand = oppositeHand(startHand);
  let id = 0;
  for (let i = 0; i < startCount; i++) push(startHand, id++);
  for (let i = 0; i < n - startCount; i++) push(otherHand, id++);

  return { left, right };
}

export interface StartupThrow {
  beat: number;
  hand: HandId;
  value: number;
}

function showerStartupValue(pattern: PatternDefinition, hand: HandId, startHand: HandId): number {
  const values = patternValues(pattern);
  if (hand === startHand) {
    return pattern.reverseHighThrow ?? Math.max(...values);
  }
  return Math.min(...values.filter((v) => v > 0));
}

/** Chronological shower flash before steady siteswap. */
export function showerStartupThrows(
  pattern: PatternDefinition,
  startHand: HandId,
): StartupThrow[] {
  if (pattern.family !== "shower") return [];

  const other = oppositeHand(startHand);
  const events: StartupThrow[] = [];
  let beat = firstThrowBeat(startHand);

  for (let i = 0; i < pattern.ballCount - 1; i++) {
    while (!throwBeatForHand(startHand, beat)) beat++;
    events.push({
      beat,
      hand: startHand,
      value: showerStartupValue(pattern, startHand, startHand),
    });
    beat++;
  }
  while (!throwBeatForHand(other, beat)) beat++;
  events.push({
    beat,
    hand: other,
    value: showerStartupValue(pattern, other, startHand),
  });
  return events;
}

/** Global beat when alternating siteswap cycle begins (after shower flash). */
export function siteswapStartBeat(pattern: PatternDefinition, startHand: HandId): number {
  if (pattern.family !== "shower") return firstThrowBeat(startHand);
  const startup = showerStartupThrows(pattern, startHand);
  if (startup.length === 0) return firstThrowBeat(startHand);
  return startup[startup.length - 1].beat + 1;
}

export function startupThrowAtBeat(
  pattern: PatternDefinition,
  startHand: HandId,
  beat: number,
): StartupThrow | null {
  return showerStartupThrows(pattern, startHand).find((e) => e.beat === beat) ?? null;
}

export function siteswapThrowValue(
  pattern: PatternDefinition,
  startHand: HandId,
  beat: number,
): number {
  const startBeat = siteswapStartBeat(pattern, startHand);
  if (beat < startBeat) return 0;
  const throwIndex = beat - startBeat;
  return patternValues(pattern)[throwIndex % patternValues(pattern).length];
}

export function scheduledHandAtBeat(startHand: HandId, beat: number): HandId | null {
  const base = firstThrowBeat(startHand);
  if (beat < base) return null;
  const k = beat - base;
  return k % 2 === 0 ? startHand : oppositeHand(startHand);
}

/** Index into siteswap period for a steady-state beat (≥ 0), or −1 during startup. */
export function throwIndexAtBeat(
  pattern: PatternDefinition,
  startHand: HandId,
  beat: number,
): number {
  return beat - siteswapStartBeat(pattern, startHand);
}

/** Next throw height in the siteswap cycle after this beat's throw. */
export function nextPatternThrowValue(
  pattern: PatternDefinition,
  startHand: HandId,
  beat: number,
): number {
  const values = patternValues(pattern);
  const idx = throwIndexAtBeat(pattern, startHand, beat);
  if (idx < 0) return values[0] ?? 1;
  return values[(idx + 1) % values.length];
}

/** Throw height scheduled at a global beat (startup + siteswap). */
export function throwValueForBeat(
  pattern: PatternDefinition,
  startHand: HandId,
  beat: number,
): number {
  const startBeat = siteswapStartBeat(pattern, startHand);
  if (beat < startBeat) {
    return showerStartupThrows(pattern, startHand).find((e) => e.beat === beat)?.value ?? 0;
  }
  return siteswapThrowValue(pattern, startHand, beat);
}
