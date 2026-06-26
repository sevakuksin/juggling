import type { HandId } from "./config";
import { oppositeHand } from "./config";
import { firstThrowBeat, throwBeatForHand } from "./hands";
import type { PatternDefinition } from "./patternCatalog";
import { patternValues } from "./patternCatalog";

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
