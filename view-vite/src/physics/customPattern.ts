import { landingHand, oppositeHand, type HandId, type PhysicsConfig } from "./config";
import { firstThrowBeat, throwBeatForHand } from "./hands";
import { airTimeBeatsExact } from "./airTime";
import {
  buildHandSchedules,
  buildShowerHandSchedules,
  buildThrowTypeSegments,
  type HandEvent,
  type HandMotionSchedule,
  type HandMotionSchedules,
} from "./handSchedule";
import type { PatternDefinition } from "./patternCatalog";
import {
  NORMAL_THROW_MOTION,
  landGeometric,
  releaseGeometric,
  throwMotionSpecFromThrows,
  type ThrowMotionSpec,
} from "./throwMotion";
import type { ParsedSiteswap, ParsedThrow } from "./siteswap";
import { dwellForThrowHeight, dwellProfileMax, type DwellProfile } from "./twoHandThrowConfig";

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

export function isUniformNormal(parsed: ParsedSiteswap): boolean {
  if (parsed.throws.length === 0) return false;
  const h = parsed.throws[0].height;
  return parsed.throws.every((t) => !t.reversed && t.height === h);
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

export function landingThrowAtBeat(
  runtime: CustomPatternRuntime,
  throwBeat: number,
): ParsedThrow | null {
  const cur = scheduledThrowAtBeat(runtime, throwBeat);
  if (!cur) return null;
  return scheduledThrowAtBeat(runtime, throwBeat + cur.height);
}

export function motionSpecForCustomThrow(
  runtime: CustomPatternRuntime,
  throwIndex: number,
  throwBeat: number,
): ThrowMotionSpec {
  const { parsed, startHand } = runtime;
  const cur = throwAtIndex(runtime, throwIndex);
  const landRef =
    landingThrowAtBeat(runtime, throwBeat) ??
    throwAtIndex(runtime, (throwIndex + 1) % parsed.period);
  const spec = throwMotionSpecFromThrows(cur, landRef);

  if (isUniformReverse(parsed)) {
    return { ...spec, reversedHandMotion: true };
  }

  if (isShowerLike(parsed)) {
    const hiHand = showerStartHand(parsed, startHand);
    const hand = handForThrowIndex(runtime, throwIndex);
    return { ...spec, reversedHandMotion: hand === hiHand };
  }

  return spec;
}

export type HandReversalMode = "all-reversed" | "all-normal" | "mixed";

/** How reversal is distributed on one hand across its throws (including period wrap). */
export function handReversalMode(
  runtime: CustomPatternRuntime,
  hand: HandId,
): HandReversalMode {
  const { period } = runtime.parsed;
  const start = siteswapStartBeat(runtime);
  let sawReversed = false;
  let sawNormal = false;
  for (let b = start; b < start + period * 2; b++) {
    if (scheduledHandAtBeat(runtime.startHand, b) !== hand) continue;
    if (!throwBeatForHand(hand, b)) continue;
    const idx = throwIndexAtBeat(runtime, b);
    if (idx < 0) continue;
    const t = throwAtIndex(runtime, idx);
    if (t.reversed) sawReversed = true;
    else sawNormal = true;
  }
  if (sawReversed && !sawNormal) return "all-reversed";
  if (sawNormal && !sawReversed) return "all-normal";
  return "mixed";
}

/** Ball endpoints + reversed hand path for a scheduled throw beat. */
export function motionSpecForHandAtBeat(
  runtime: CustomPatternRuntime,
  hand: HandId,
  throwIndex: number,
  throwBeat: number,
): ThrowMotionSpec {
  const spec = motionSpecForCustomThrow(runtime, throwIndex, throwBeat);
  const cur = throwAtIndex(runtime, throwIndex);
  const mode = handReversalMode(runtime, hand);
  if (mode === "all-reversed") {
    return { ...spec, reversedHandMotion: true };
  }
  if (mode === "mixed" && cur.reversed) {
    return { ...spec, reversedHandMotion: true };
  }
  return { ...spec, reversedHandMotion: false };
}

function throwBeatAtOrBeforeHand(hand: HandId, beat: number): number | null {
  const b = Math.floor(beat + 1e-9);
  if (!Number.isFinite(b) || b < 0) return null;
  if (throwBeatForHand(hand, b)) return b;
  return throwBeatAtOrBeforeHand(hand, b - 1);
}

function revHMAtHandBeat(
  runtime: CustomPatternRuntime,
  hand: HandId,
  beat: number,
): boolean {
  const throwBeat = throwBeatAtOrBeforeHand(hand, Math.floor(beat + 1e-9));
  if (throwBeat == null) return false;
  const idx = throwIndexAtBeat(runtime, throwBeat);
  if (idx < 0) return false;
  return motionSpecForHandAtBeat(runtime, hand, idx, throwBeat).reversedHandMotion ?? false;
}

/** Functional throw/catch events for one hand from parsed pattern timing. */
function collectCustomHandEvents(
  runtime: CustomPatternRuntime,
  hand: HandId,
  cfg: PhysicsConfig,
  dwellProfile: DwellProfile,
  scanBeats: number,
): HandEvent[] {
  const Tb = cfg.beatPeriodS;
  const start = siteswapStartBeat(runtime);
  const { startHand } = runtime;
  const events: HandEvent[] = [];

  for (let b = start; b < start + scanBeats; b++) {
    if (scheduledHandAtBeat(startHand, b) !== hand) continue;
    if (!throwBeatForHand(hand, b)) continue;
    const idx = throwIndexAtBeat(runtime, b);
    if (idx < 0) continue;
    const spec = motionSpecForHandAtBeat(runtime, hand, idx, b);
    const parsedThrow = throwAtIndex(runtime, idx);
    events.push({
      t: b * Tb,
      kind: "throw",
      functionalSide: releaseGeometric(spec),
      reversedHandMotion: spec.reversedHandMotion,
      throwReversed: parsedThrow.reversed,
    });
  }

  for (let tb = start; tb < start + scanBeats; tb++) {
    const throwHand = scheduledHandAtBeat(startHand, tb);
    if (!throwHand || !throwBeatForHand(throwHand, tb)) continue;
    const st = scheduledThrowAtBeat(runtime, tb);
    if (!st || st.height <= 0) continue;
    if (landingHand(throwHand, st.height) !== hand) continue;
    const dwell = customDwellForThrow(runtime, dwellProfile, st.height);
    const air = airTimeBeatsExact(st.height, dwell);
    if (air < 1e-6) continue;
    const idx = throwIndexAtBeat(runtime, tb);
    const spec = motionSpecForCustomThrow(runtime, idx, tb);
    const rawCatchBeat = tb + air;
    const catchBeat = start + (((rawCatchBeat - start) % scanBeats) + scanBeats) % scanBeats;
    events.push({
      t: catchBeat * Tb,
      kind: "catch",
      functionalSide: landGeometric(spec),
      reversedHandMotion: revHMAtHandBeat(runtime, hand, rawCatchBeat),
    });
  }

  return events;
}

function buildCustomPatternHandSchedules(
  runtime: CustomPatternRuntime,
  dwellProfile: DwellProfile,
  cfg: PhysicsConfig,
): HandMotionSchedules | null {
  const maxH = maxThrowHeight(runtime.parsed);
  if (maxH <= 0) return null;

  // True repeat of the hand-throw-type cycle: a period-P siteswap sampled every
  // other beat repeats every 2·P/gcd(P,2) beats. Using maxH (uniform-pattern sizing)
  // would mis-align the schedule and produce extra loops.
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const P = runtime.parsed.period;
  const periodBeats = (2 * P) / gcd(P, 2);
  const periodS = periodBeats * cfg.beatPeriodS;
  const { startHand } = runtime;

  function scheduleFor(hand: HandId): HandMotionSchedule {
    const events = collectCustomHandEvents(runtime, hand, cfg, dwellProfile, periodBeats);
    return {
      hand,
      periodS,
      segments: buildThrowTypeSegments(events, periodS),
      phaseOffsetS: 0,
    };
  }

  return {
    right: scheduleFor("right"),
    left: scheduleFor("left"),
    motionSpec: NORMAL_THROW_MOTION,
    useVisualTheta: true,
    motionSpecAtBeat: (hand, beat) => {
      const st = scheduledThrowAtBeat(runtime, beat);
      if (!st || scheduledHandAtBeat(startHand, beat) !== hand) {
        return NORMAL_THROW_MOTION;
      }
      const idx = throwIndexAtBeat(runtime, beat);
      return motionSpecForHandAtBeat(runtime, hand, idx, beat);
    },
  };
}

export function buildCustomHandSchedules(
  runtime: CustomPatternRuntime,
  dwellProfile: DwellProfile,
  cfg: PhysicsConfig,
): HandMotionSchedules | null {
  const { parsed, startHand } = runtime;
  const maxH = maxThrowHeight(parsed);
  if (maxH <= 0) return null;

  const dwell = dwellForThrowHeight(dwellProfile, maxH);

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

  if (isUniformNormal(parsed)) {
    return buildHandSchedules(maxH, dwell, cfg);
  }

  return buildCustomPatternHandSchedules(runtime, dwellProfile, cfg);
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
  profile: DwellProfile,
  throwValue: number,
): number {
  return dwellForThrowHeight(profile, throwValue);
}

export function customDwellAfterCatch(
  runtime: CustomPatternRuntime,
  profile: DwellProfile,
  hand: HandId,
): number {
  return dwellForThrowHeight(profile, throwHeightForHand(runtime, hand));
}

export { dwellProfileMax };

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
