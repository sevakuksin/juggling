import type { HandId, PhysicsConfig } from "./config";
import { landingHand, oppositeHand } from "./config";
import { airTimeBeats } from "./airTime";
import { NORMAL_THROW_MOTION, throwMotionSpec, type ThrowMotionSpec } from "./throwMotion";
import type { PatternDefinition } from "./patternCatalog";
import { HAND_POSE_THETA, HAND_SCHEDULE, HAND_SPEED, showerDwellBeats } from "./twoHandThrowConfig";

const TAU = 2 * Math.PI;

/** Geometric inside (θ = 0 on reference ellipse). */
export function handInsideTheta(_hand: HandId): number {
  return HAND_POSE_THETA.inside;
}

/** Geometric outside (θ = π on reference ellipse). */
export function handOutsideTheta(_hand: HandId): number {
  return HAND_POSE_THETA.outside;
}

/** Functional throw or catch at a schedule event. */
export type HandEventKind = "throw" | "catch";

export type SegmentProfile = "toCatch" | "toThrow" | "lapInside" | "lapOutside" | "windBetweenThrows";

export interface HandEvent {
  t: number;
  kind: HandEventKind;
}

export interface HandMotionSegment {
  t0: number;
  t1: number;
  theta0: number;
  theta1: number;
  profile: SegmentProfile;
}

export interface HandMotionSchedule {
  hand: HandId;
  periodS: number;
  segments: HandMotionSegment[];
  /** Left hand reuses the right schedule shifted by one beat (T_b). */
  phaseOffsetS?: number;
}

export interface HandMotionSchedules {
  left: HandMotionSchedule;
  right: HandMotionSchedule;
  motionSpec: ThrowMotionSpec;
  /** Per-hand motion when throw heights differ (shower). */
  handMotionSpec?: Partial<Record<HandId, ThrowMotionSpec>>;
}

const SPEED = HAND_SPEED;

function clamp01(u: number): number {
  return Math.max(0, Math.min(1, u));
}

function blend(u: number, curved: number, linearWeight: number): number {
  return linearWeight * u + (1 - linearWeight) * curved;
}

function easeFromInside(u: number): number {
  const { linear: lw, power: p } = SPEED.fromInside;
  return blend(u, 1 - (1 - u) ** p, lw);
}

function easeToInside(u: number): number {
  const { linear: lw, power: p } = SPEED.toInside;
  return blend(u, u ** p, lw);
}

function throwBeatForHand(hand: HandId, beatIndex: number): boolean {
  return hand === "right" ? beatIndex % 2 === 0 : beatIndex % 2 === 1;
}

function unwrapForward(from: number, canonical: number): number {
  let end = canonical;
  while (end < from - 1e-9) end += TAU;
  return end;
}

function segmentProfile(
  from: HandEventKind,
  to: HandEventKind,
  throwFollowThrow: SegmentProfile = "lapInside",
): SegmentProfile {
  if (from === "throw" && to === "catch") return "toCatch";
  if (from === "catch" && to === "throw") return "toThrow";
  if (from === "throw" && to === "throw") return throwFollowThrow;
  if (from === "throw") return "lapInside";
  return "lapOutside";
}

function lerpAngle(theta0: number, theta1: number, u: number, easing: (t: number) => number): number {
  return theta0 + (theta1 - theta0) * easing(u);
}

function interpolateSegment(seg: HandMotionSegment, wt: number): number {
  const span = seg.t1 - seg.t0;
  const localU = span > 0 ? clamp01((wt - seg.t0) / span) : 0;
  switch (seg.profile) {
    case "toCatch": {
      if (seg.theta0 >= 1.75 * Math.PI && seg.theta1 <= Math.PI + 0.01) {
        return lerpAngle(0, Math.PI, localU, easeFromInside);
      }
      return lerpAngle(seg.theta0, seg.theta1, localU, easeFromInside);
    }
    case "toThrow":
      return lerpAngle(seg.theta0, seg.theta1, localU, easeToInside);
    case "lapInside": {
      const outside = unwrapForward(seg.theta0, handOutsideTheta("right"));
      if (localU < 0.5) return lerpAngle(seg.theta0, outside, localU * 2, easeFromInside);
      return lerpAngle(outside, seg.theta1, (localU - 0.5) * 2, easeToInside);
    }
    case "lapOutside": {
      const inside = unwrapForward(seg.theta0, handInsideTheta("right"));
      if (localU < 0.5) return lerpAngle(seg.theta0, inside, localU * 2, easeToInside);
      return lerpAngle(inside, seg.theta1, (localU - 0.5) * 2, easeFromInside);
    }
    case "windBetweenThrows": {
      const outside = unwrapForward(seg.theta0, handOutsideTheta("right"));
      const inside = unwrapForward(outside, handInsideTheta("right"));
      if (localU < 0.5) return lerpAngle(seg.theta0, outside, localU * 2, easeFromInside);
      return lerpAngle(outside, inside, (localU - 0.5) * 2, easeToInside);
    }
  }
}

function wrapTime(t: number, period: number): number {
  if (period <= 0) return t;
  let w = t % period;
  if (w < 0) w += period;
  return w;
}

export function handThetaAt(t: number, schedule: HandMotionSchedule): number {
  const { periodS, segments, phaseOffsetS = 0 } = schedule;
  if (segments.length === 0) return 0;

  const wt = wrapTime(t - phaseOffsetS, periodS);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const span = seg.t1 - seg.t0;
    if (span <= 0) continue;

    const wraps = seg.t1 > periodS + 1e-9;
    const localT = wraps && wt < seg.t0 - 1e-9 ? wt + periodS : wt;
    if (localT >= seg.t0 - 1e-9 && localT <= seg.t1 + 1e-9) {
      if (localT >= seg.t1 - 1e-9) return seg.theta1;
      return interpolateSegment(seg, localT);
    }
  }
  return segments[segments.length - 1].theta1;
}

function mergeEvents(events: HandEvent[]): HandEvent[] {
  const sorted = [...events].sort((a, b) => a.t - b.t || (a.kind === "catch" ? -1 : 1));
  const out: HandEvent[] = [];
  for (const e of sorted) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.t - e.t) < 1e-6) {
      if (prev.kind === e.kind) continue;
      out.push({ t: e.t + 1e-4, kind: e.kind });
      continue;
    }
    out.push({ ...e });
  }
  return out;
}

function collectEvents(
  throwValue: number,
  dwellBeats: number,
  cfg: PhysicsConfig,
  periodBeats: number,
): Map<HandId, HandEvent[]> {
  const Tb = cfg.beatPeriodS;
  const air = airTimeBeats(throwValue, dwellBeats);
  const map = new Map<HandId, HandEvent[]>([
    ["left", []],
    ["right", []],
  ]);

  for (let b = 0; b < periodBeats; b++) {
    for (const hand of ["left", "right"] as HandId[]) {
      if (throwBeatForHand(hand, b)) {
        map.get(hand)!.push({ t: b * Tb, kind: "throw" });
      }
    }
  }

  if (air > 0) {
    for (let b = 0; b < periodBeats; b++) {
      for (const hand of ["left", "right"] as HandId[]) {
        if (!throwBeatForHand(hand, b)) continue;
        const catchHand = landingHand(hand, throwValue);
        map.get(catchHand)!.push({ t: b * Tb + air * Tb, kind: "catch" });
      }
    }
  }

  return map;
}

function showerLowMultiplexCatchBeats(
  startHand: HandId,
  highThrow: number,
  highDwell: number,
  periodBeats: number,
): Set<number> {
  const beats = new Set<number>();
  const lowHand = oppositeHand(startHand);
  const air = airTimeBeats(highThrow, highDwell);
  if (air <= 0) return beats;
  for (let b = 0; b < periodBeats; b++) {
    if (!throwBeatForHand(startHand, b)) continue;
    if (landingHand(startHand, highThrow) !== lowHand) continue;
    beats.add(b + air);
  }
  return beats;
}

/** High hand: throws on its beats, catches incoming 1-throws. */
function collectShowerHighHandEvents(
  hand: HandId,
  startHand: HandId,
  highThrow: number,
  highDwell: number,
  lowDwell: number,
  cfg: PhysicsConfig,
  periodBeats: number,
): HandEvent[] {
  const Tb = cfg.beatPeriodS;
  const lowThrow = 1;
  const events: HandEvent[] = [];

  for (let b = 0; b < periodBeats; b++) {
    if (throwBeatForHand(hand, b)) {
      events.push({ t: b * Tb, kind: "throw" });
    }
  }

  for (let b = 0; b < periodBeats; b++) {
    for (const throwing of ["left", "right"] as HandId[]) {
      if (!throwBeatForHand(throwing, b)) continue;
      const throwVal = throwing === startHand ? highThrow : lowThrow;
      const dwell = throwVal === lowThrow ? lowDwell : highDwell;
      const air = airTimeBeats(throwVal, dwell);
      if (air <= 0) continue;
      if (landingHand(throwing, throwVal) !== hand) continue;
      events.push({ t: b * Tb + air * Tb, kind: "catch" });
    }
  }

  return mergeEvents(events);
}

/** Low hand: multiplex beats catch high throw first, then throw 1 after a short dwell. */
function collectShowerLowHandEvents(
  hand: HandId,
  startHand: HandId,
  highThrow: number,
  highDwell: number,
  lowDwell: number,
  cfg: PhysicsConfig,
  periodBeats: number,
): HandEvent[] {
  const Tb = cfg.beatPeriodS;
  const lowThrow = 1;
  const split = HAND_SCHEDULE.showerCatchThenThrowFrac * Tb;
  const multiplex = showerLowMultiplexCatchBeats(startHand, highThrow, highDwell, periodBeats);
  const events: HandEvent[] = [];

  for (let b = 0; b < periodBeats; b++) {
    if (!throwBeatForHand(hand, b)) continue;
    if (multiplex.has(b)) {
      events.push({ t: b * Tb, kind: "catch" });
      events.push({ t: b * Tb + split, kind: "throw" });
    } else {
      events.push({ t: b * Tb, kind: "throw" });
    }
  }

  for (let b = 0; b < periodBeats; b++) {
    for (const throwing of ["left", "right"] as HandId[]) {
      if (!throwBeatForHand(throwing, b)) continue;
      const throwVal = throwing === startHand ? highThrow : lowThrow;
      const dwell = throwVal === lowThrow ? lowDwell : highDwell;
      const air = airTimeBeats(throwVal, dwell);
      if (air <= 0) continue;
      if (landingHand(throwing, throwVal) !== hand) continue;
      const catchBeat = b + air;
      if (multiplex.has(catchBeat)) continue;
      events.push({ t: catchBeat * Tb, kind: "catch" });
    }
  }

  return mergeEvents(events);
}

/** Shower: each hand's throws/catches with correct air times (1 vs high throw). */
function collectShowerHandEvents(
  hand: HandId,
  startHand: HandId,
  highThrow: number,
  highDwell: number,
  lowDwell: number,
  cfg: PhysicsConfig,
  periodBeats: number,
): HandEvent[] {
  if (hand === oppositeHand(startHand)) {
    return collectShowerLowHandEvents(
      hand,
      startHand,
      highThrow,
      highDwell,
      lowDwell,
      cfg,
      periodBeats,
    );
  }
  return collectShowerHighHandEvents(
    hand,
    startHand,
    highThrow,
    highDwell,
    lowDwell,
    cfg,
    periodBeats,
  );
}

function segmentEndTheta(from: number, profile: SegmentProfile): number {
  if (profile === "toCatch") return unwrapForward(from, handOutsideTheta("right"));
  if (profile === "toThrow" || profile === "windBetweenThrows") {
    return unwrapForward(from, handInsideTheta("right"));
  }
  if (profile === "lapInside" || profile === "lapOutside") return from + TAU;
  return from;
}

/** Normal hand schedule: functional throw at geometric inside, catch at geometric outside. */
function buildSegments(
  events: HandEvent[],
  periodS: number,
  options: { throwFollowThrow?: SegmentProfile } = {},
): HandMotionSegment[] {
  const throwFollowThrow = options.throwFollowThrow ?? "lapInside";
  const loop = mergeEvents(events.filter((e) => e.t <= periodS + 1e-9));
  if (loop.length === 0) {
    return [{ t0: 0, t1: periodS, theta0: 0, theta1: TAU, profile: "lapInside" }];
  }

  const loopWithWrap = [...loop, { t: periodS, kind: loop[0].kind }];
  let theta = handInsideTheta("right");
  const segments: HandMotionSegment[] = [];

  for (let i = 0; i < loop.length; i++) {
    const cur = loop[i];
    const isLast = i === loop.length - 1;
    const nxt = isLast
      ? { t: loop[0].t + periodS, kind: loop[0].kind }
      : loopWithWrap[i + 1];
    if (nxt.t - cur.t < 1e-9) continue;

    const profile = segmentProfile(cur.kind, nxt.kind, throwFollowThrow);
    const theta1 = segmentEndTheta(theta, profile);
    segments.push({ t0: cur.t, t1: nxt.t, theta0: theta, theta1, profile });
    theta = theta1;
  }

  if (segments.length === 0) {
    segments.push({ t0: 0, t1: periodS, theta0: 0, theta1: TAU, profile: "lapInside" });
  }

  return segments;
}

export interface HandScheduleOptions {
  motionSpec?: ThrowMotionSpec;
  /** @deprecated use motionSpec.reversedHandMotion */
  reverseRotation?: boolean;
}

/** Steady-state cascade: normal segments and phase offsets; reverse mirrors the other hand. */
export function buildHandSchedules(
  throwValue: number,
  dwellBeats: number,
  cfg: PhysicsConfig,
  options: HandScheduleOptions = {},
): HandMotionSchedules | null {
  if (throwValue <= 0) return null;

  const motionSpec =
    options.motionSpec ??
    (options.reverseRotation
      ? { reversed: true, reversedHandMotion: true }
      : NORMAL_THROW_MOTION);

  const periodBeats =
    HAND_SCHEDULE.minPeriodBeatsMultiplier *
    Math.max(HAND_SCHEDULE.minThrowForPeriod, throwValue);
  const periodS = periodBeats * cfg.beatPeriodS;
  const segments = buildSegments(
    collectEvents(throwValue, dwellBeats, cfg, periodBeats).get("right")!,
    periodS,
  );

  const tb = cfg.beatPeriodS;

  return {
    right: { hand: "right", periodS, segments, phaseOffsetS: 0 },
    left: { hand: "left", periodS, segments, phaseOffsetS: tb },
    motionSpec,
  };
}

/** Shower 51/71: per-hand schedules (1 vs high throw) and motion specs. */
export function buildShowerHandSchedules(
  pattern: PatternDefinition,
  startHand: HandId,
  dwellBeats: number,
  cfg: PhysicsConfig,
): HandMotionSchedules {
  const highThrow = pattern.reverseHighThrow!;
  const periodBeats =
    HAND_SCHEDULE.minPeriodBeatsMultiplier *
    Math.max(HAND_SCHEDULE.minThrowForPeriod, highThrow);
  const periodS = periodBeats * cfg.beatPeriodS;
  const tb = cfg.beatPeriodS;
  const otherHand = oppositeHand(startHand);
  const lowDwell = showerDwellBeats(dwellBeats, 1);

  const highSpec = throwMotionSpec(pattern, highThrow);
  const lowSpec = throwMotionSpec(pattern, 1);

  function scheduleFor(hand: HandId): HandMotionSchedule {
    const isHighHand = hand === startHand;
    const events = collectShowerHandEvents(
      hand,
      startHand,
      highThrow,
      dwellBeats,
      lowDwell,
      cfg,
      periodBeats,
    );
    return {
      hand,
      periodS,
      segments: buildSegments(
        events,
        periodS,
        isHighHand ? {} : { throwFollowThrow: "windBetweenThrows" },
      ),
      phaseOffsetS: isHighHand ? (hand === "right" ? 0 : tb) : 0,
    };
  }

  return {
    right: scheduleFor("right"),
    left: scheduleFor("left"),
    motionSpec: NORMAL_THROW_MOTION,
    handMotionSpec: {
      [startHand]: highSpec,
      [otherHand]: lowSpec,
    },
  };
}
