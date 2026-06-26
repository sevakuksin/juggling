import type { HandId, PhysicsConfig } from "./config";
import { landingHand } from "./config";
import { airTimeBeats } from "./airTime";
import { HAND_POSE_THETA, HAND_SCHEDULE, HAND_SPEED } from "./twoHandThrowConfig";

const TAU = 2 * Math.PI;

/** Throw pose (inside); x mirror is applied in handXyFromTheta. */
export function handInsideTheta(_hand: HandId): number {
  return HAND_POSE_THETA.inside;
}

/** Catch pose (outside). */
export function handOutsideTheta(_hand: HandId): number {
  return HAND_POSE_THETA.outside;
}

export type HandEventKind = "throw" | "catch";

export type SegmentProfile = "toCatch" | "toThrow" | "lapInside" | "lapOutside";

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

function segmentProfile(from: HandEventKind, to: HandEventKind): SegmentProfile {
  if (from === "throw" && to === "catch") return "toCatch";
  if (from === "catch" && to === "throw") return "toThrow";
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
    case "toCatch":
      return lerpAngle(seg.theta0, seg.theta1, localU, easeFromInside);
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
    if (wt >= seg.t0 - 1e-9 && wt <= seg.t1 + 1e-9) {
      if (wt >= seg.t1 - 1e-9) return seg.theta1;
      return interpolateSegment(seg, wt);
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

function segmentEndTheta(from: number, profile: SegmentProfile): number {
  if (profile === "toCatch") return unwrapForward(from, handOutsideTheta("right"));
  if (profile === "toThrow") return unwrapForward(from, handInsideTheta("right"));
  if (profile === "lapInside" || profile === "lapOutside") return from + TAU;
  return from;
}

/** Build from the right-hand event stream (throws on beat 0). */
function buildSegments(events: HandEvent[], periodS: number): HandMotionSegment[] {
  const loop = mergeEvents(events.filter((e) => e.t <= periodS + 1e-9));
  if (loop.length === 0) {
    return [{ t0: 0, t1: periodS, theta0: 0, theta1: TAU, profile: "lapInside" }];
  }

  const loopWithWrap = [...loop, { t: periodS, kind: loop[0].kind }];
  let theta = handInsideTheta("right");
  const segments: HandMotionSegment[] = [];

  for (let i = 0; i < loop.length; i++) {
    const cur = loop[i];
    const nxt = loopWithWrap[i + 1];
    if (nxt.t - cur.t < 1e-9) continue;

    const profile = segmentProfile(cur.kind, nxt.kind);
    const theta1 = segmentEndTheta(theta, profile);
    segments.push({ t0: cur.t, t1: nxt.t, theta0: theta, theta1, profile });
    theta = theta1;
  }

  if (segments.length === 0) {
    segments.push({ t0: 0, t1: periodS, theta0: 0, theta1: TAU, profile: "lapInside" });
  }

  return segments;
}

/** Steady-state cascade: one schedule (right), left = same motion shifted by T_b. */
export function buildHandSchedules(
  throwValue: number,
  dwellBeats: number,
  cfg: PhysicsConfig,
): HandMotionSchedules | null {
  if (throwValue <= 0) return null;

  const periodBeats =
    HAND_SCHEDULE.minPeriodBeatsMultiplier *
    Math.max(HAND_SCHEDULE.minThrowForPeriod, throwValue);
  const periodS = periodBeats * cfg.beatPeriodS;
  const segments = buildSegments(collectEvents(throwValue, dwellBeats, cfg, periodBeats).get("right")!, periodS);

  return {
    right: { hand: "right", periodS, segments, phaseOffsetS: 0 },
    left: { hand: "left", periodS, segments, phaseOffsetS: cfg.beatPeriodS },
  };
}
