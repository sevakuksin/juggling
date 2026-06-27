import { landingHand, oppositeHand, type HandId, type PhysicsConfig } from "./config";
import { firstThrowBeat, throwBeatForHand } from "./hands";
import {
  buildHandSchedules,
  buildShowerHandSchedules,
  type HandMotionSchedules,
} from "./handSchedule";
import type { PatternDefinition } from "./patternCatalog";
import { NORMAL_THROW_MOTION, throwMotionSpecForParsed } from "./throwMotion";
import type { ParsedSiteswap, ParsedThrow } from "./siteswap";
import { dwellBeatsForThrow } from "./twoHandThrowConfig";

export interface CustomPatternRuntime {
  parsed: ParsedSiteswap;
  startHand: HandId;
}

export function customPatternRuntime(parsed: ParsedSiteswap, startHand: HandId): CustomPatternRuntime {
  return { parsed, startHand };
}

export function throwAtIndex(runtime: CustomPatternRuntime, index: number): ParsedThrow {
  const { throws, period } = runtime.parsed;
  return throws[((index % period) + period) % period];
}

export function siteswapStartBeat(_runtime: CustomPatternRuntime): number {
  return firstThrowBeat(_runtime.startHand);
}

export function throwIndexAtBeat(runtime: CustomPatternRuntime, beat: number): number {
  return beat - siteswapStartBeat(runtime);
}

export function scheduledHandAtBeat(startHand: HandId, beat: number): HandId | null {
  const base = firstThrowBeat(startHand);
  if (beat < base) return null;
  const k = beat - base;
  return k % 2 === 0 ? startHand : oppositeHand(startHand);
}

export function scheduledThrowAtBeat(runtime: CustomPatternRuntime, beat: number): ParsedThrow | null {
  const hand = scheduledHandAtBeat(runtime.startHand, beat);
  if (!hand || !throwBeatForHand(hand, beat)) return null;
  const idx = throwIndexAtBeat(runtime, beat);
  if (idx < 0) return null;
  return throwAtIndex(runtime, idx);
}

export function throwHeightAtBeat(runtime: CustomPatternRuntime, beat: number): number {
  return scheduledThrowAtBeat(runtime, beat)?.height ?? 0;
}

export function landingBeatForThrowIndex(
  runtime: CustomPatternRuntime,
  throwIndex: number,
): number {
  const t = throwAtIndex(runtime, throwIndex);
  const startBeat = siteswapStartBeat(runtime) + throwIndex;
  return startBeat + t.height;
}

export function handForThrowIndex(runtime: CustomPatternRuntime, throwIndex: number): HandId {
  const beat = siteswapStartBeat(runtime) + throwIndex;
  return scheduledHandAtBeat(runtime.startHand, beat)!;
}

export function landingHandForThrowIndex(
  runtime: CustomPatternRuntime,
  throwIndex: number,
): HandId {
  const t = throwAtIndex(runtime, throwIndex);
  const throwHand = handForThrowIndex(runtime, throwIndex);
  return landingHand(throwHand, t.height);
}

export function maxThrowHeight(parsed: ParsedSiteswap): number {
  return Math.max(...parsed.heights);
}

export function isUniformReverse(parsed: ParsedSiteswap): boolean {
  if (parsed.throws.length === 0) return false;
  return parsed.throws.every((t) => t.reversed && t.height === parsed.throws[0].height);
}

/** Shower-like: every throw is reversed high or normal 1, period 2, alternating hands. */
export function isShowerLike(parsed: ParsedSiteswap): boolean {
  if (parsed.period !== 2) return false;
  const [a, b] = parsed.throws;
  const highLow = (hi: ParsedThrow, lo: ParsedThrow) =>
    hi.height > 1 && hi.reversed && lo.height === 1 && !lo.reversed;
  return highLow(a, b) || highLow(b, a);
}

export function showerHighThrow(parsed: ParsedSiteswap): number | null {
  if (!isShowerLike(parsed)) return null;
  const hi = parsed.throws.find((t) => t.height > 1 && t.reversed);
  return hi?.height ?? null;
}

export function showerStartHand(parsed: ParsedSiteswap, startHand: HandId): HandId {
  if (!isShowerLike(parsed)) return startHand;
  const hiIdx = parsed.throws.findIndex((t) => t.height > 1 && t.reversed);
  const hiHand = handForThrowIndex({ parsed, startHand }, hiIdx);
  return hiHand;
}

/** Synthesize catalog-shaped pattern for shower hand schedules. */
export function asShowerPatternDefinition(parsed: ParsedSiteswap): PatternDefinition {
  const highThrow = showerHighThrow(parsed)!;
  const ballCount = parsed.heights.reduce((a, b) => a + b, 0) / parsed.period;
  return {
    id: "custom-shower",
    label: parsed.raw,
    siteswap: parsed.heights.join(""),
    ballCount,
    family: "shower",
    reverseHighThrow: highThrow,
  };
}

export function ballCountFromParsed(parsed: ParsedSiteswap): number {
  return parsed.heights.reduce((a, b) => a + b, 0) / parsed.period;
}

export function buildCustomHandSchedules(
  runtime: CustomPatternRuntime,
  dwell: number,
  cfg: PhysicsConfig,
): HandMotionSchedules | null {
  const { parsed, startHand } = runtime;
  const maxH = maxThrowHeight(parsed);
  if (maxH <= 0) return null;

  if (isShowerLike(parsed)) {
    const showerDef = asShowerPatternDefinition(parsed);
    const hiHand = showerStartHand(parsed, startHand);
    return buildShowerHandSchedules(showerDef, hiHand, dwell, cfg);
  }

  if (isUniformReverse(parsed)) {
    return buildHandSchedules(maxH, dwell, cfg, {
      motionSpec: { reversed: true, reversedHandMotion: true },
    });
  }

  const schedules = buildHandSchedules(maxH, dwell, cfg);
  if (!schedules) return null;
  schedules.motionSpecAtBeat = (hand, beat) => {
    const st = scheduledThrowAtBeat(runtime, beat);
    if (!st || scheduledHandAtBeat(startHand, beat) !== hand) {
      return NORMAL_THROW_MOTION;
    }
    const idx = throwIndexAtBeat(runtime, beat);
    return throwMotionSpecForParsed(parsed.throws, idx);
  };
  return schedules;
}

export function throwHeightForHand(runtime: CustomPatternRuntime, hand: HandId): number {
  const { period } = runtime.parsed;
  for (let i = 0; i < period; i++) {
    if (handForThrowIndex(runtime, i) === hand) {
      return throwAtIndex(runtime, i).height;
    }
  }
  return maxThrowHeight(runtime.parsed);
}

export function customDwellForThrow(
  _runtime: CustomPatternRuntime,
  dwell: number,
  throwValue: number,
): number {
  return dwellBeatsForThrow(dwell, throwValue);
}

export function customDwellAfterCatch(
  runtime: CustomPatternRuntime,
  dwell: number,
  hand: HandId,
): number {
  return dwellBeatsForThrow(dwell, throwHeightForHand(runtime, hand));
}

export function customShowerHighHand(runtime: CustomPatternRuntime): HandId | null {
  if (!isShowerLike(runtime.parsed)) return null;
  return showerStartHand(runtime.parsed, runtime.startHand);
}

export function customForceCatchOnLanding(
  runtime: CustomPatternRuntime,
  throwIndex: number,
  catchingHand: HandId,
  landsGeometricInside: boolean,
): boolean {
  if (landsGeometricInside) return true;
  if (!isShowerLike(runtime.parsed)) return false;
  const t = throwAtIndex(runtime, throwIndex);
  const hiHand = showerStartHand(runtime.parsed, runtime.startHand);
  return t.reversed && t.height > 1 && catchingHand === oppositeHand(hiHand);
}
