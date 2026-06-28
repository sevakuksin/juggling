import type { HandId, PhysicsConfig } from "./config";
import { landingHand, oppositeHand } from "./config";
import { airTimeBeats } from "./airTime";
import {
  NORMAL_THROW_MOTION,
  throwMotionSpec,
  type GeometricSide,
  type ThrowMotionSpec,
} from "./throwMotion";
import type { PatternDefinition } from "./patternCatalog";
import { HAND_POSE_THETA, HAND_SCHEDULE, HAND_SPEED } from "./twoHandThrowConfig";

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

export type SegmentProfile =
  | "toCatch"
  | "toThrow"
  | "lapInside"
  | "lapOutside"
  | "windBetweenThrows"
  | "sameSideReturn"
  | "sameSidePassThrough"
  | "continueForward"
  | "typeReversal"
  | "kf";

/** Easing for keyframe ("kf") segments: speed state at each endpoint. */
export type EaseKind = "linear" | "accel" | "decel" | "smooth";

export interface HandEvent {
  t: number;
  kind: HandEventKind;
  /** Functional inside/outside at this event (defaults: throw=inside, catch=outside). */
  functionalSide?: GeometricSide;
  /** Hand path remap active at this event (custom mixed patterns). */
  reversedHandMotion?: boolean;
  /** Parsed throw is reversed (`-` notation). */
  throwReversed?: boolean;
}

export interface HandMotionSegment {
  t0: number;
  t1: number;
  theta0: number;
  theta1: number;
  profile: SegmentProfile;
  /** Functional side the hand should reach at segment end. */
  targetSide?: GeometricSide;
  /** Same-side wiggle passes through the point (non-zero θ̇) when the next event needs the other side. */
  passThrough?: boolean;
  /** Wiggle waypoint time for sameSidePassThrough (seconds). */
  tWaypoint?: number;
  /** Functional side after the waypoint (sameSidePassThrough). */
  afterSide?: GeometricSide;
  /** Catch waypoint time for typeReversal (seconds). */
  tCatch?: number;
  /** Catch side for typeReversal. */
  catchSide?: GeometricSide;
  /** Easing for "kf" segments. */
  ease?: EaseKind;
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
  /** Per-beat motion override (custom mixed patterns). */
  motionSpecAtBeat?: (hand: HandId, beat: number) => ThrowMotionSpec;
  /** Schedule stores geometric visual θ (custom patterns); skip path remap on read. */
  useVisualTheta?: boolean;
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

function easeKf(kind: EaseKind, u: number): number {
  switch (kind) {
    case "accel":
      return u * u;
    case "decel":
      return 1 - (1 - u) ** 2;
    case "smooth":
      return u * u * (3 - 2 * u);
    default:
      return u;
  }
}

function throwBeatForHand(hand: HandId, beatIndex: number): boolean {
  return hand === "right" ? beatIndex % 2 === 0 : beatIndex % 2 === 1;
}

function unwrapForward(from: number, canonical: number): number {
  let end = canonical;
  while (end < from - 1e-9) end += TAU;
  return end;
}

/** Unwrap target backward (decreasing θ) from `from`. */
function unwrapBackward(from: number, canonical: number): number {
  let end = canonical;
  while (end > from + 1e-9) end -= TAU;
  while (end + TAU <= from + 1e-9) end += TAU;
  return end;
}

function functionalSideAt(event: HandEvent, kind: HandEventKind): GeometricSide {
  if (event.functionalSide) return event.functionalSide;
  return kind === "throw" ? "inside" : "outside";
}

function thetaForSide(side: GeometricSide): number {
  return side === "inside" ? handInsideTheta("right") : handOutsideTheta("right");
}

function visualThetaAtSide(side: GeometricSide): number {
  return side === "inside" ? handInsideTheta("right") : handOutsideTheta("right");
}

/** Reach `side` from `from` along the lower ellipse arc (through θ = 3π/2). */
function lowerArcTheta(from: number, side: GeometricSide): number {
  const target = visualThetaAtSide(side);
  return side === "inside" ? unwrapForward(from, target) : unwrapBackward(from, target);
}

function transitProfile(toSide: GeometricSide): SegmentProfile {
  return toSide === "outside" ? "toCatch" : "toThrow";
}

function segmentProfile(
  _cur: HandEvent,
  from: HandEventKind,
  to: HandEventKind,
  fromSide: GeometricSide,
  toSide: GeometricSide,
  throwFollowThrow: SegmentProfile = "lapInside",
  explicitSides: boolean,
): SegmentProfile {
  const sameDest = explicitSides && fromSide === toSide;
  if (from === "throw" && to === "catch") {
    return sameDest ? "sameSideReturn" : transitProfile(toSide);
  }
  if (from === "catch" && to === "throw") {
    return sameDest ? "sameSideReturn" : transitProfile(toSide);
  }
  if (from === "throw" && to === "throw") {
    if (sameDest) return "sameSideReturn";
    if (explicitSides) return transitProfile(toSide);
    return throwFollowThrow;
  }
  if (from === "catch" && to === "catch") {
    return sameDest ? "sameSideReturn" : transitProfile(toSide);
  }
  if (from === "throw") return "lapInside";
  return transitProfile(toSide);
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
    case "windBetweenThrows": {
      const outside = unwrapForward(seg.theta0, handOutsideTheta("right"));
      const inside = unwrapForward(outside, handInsideTheta("right"));
      if (localU < 0.5) return lerpAngle(seg.theta0, outside, localU * 2, easeFromInside);
      return lerpAngle(outside, inside, (localU - 0.5) * 2, easeToInside);
    }
    case "sameSideReturn": {
      const { sameSideOvershootRad, sameSideOutFrac, sameSideHoldFrac } = HAND_SCHEDULE;
      const backFrac = 1 - sameSideOutFrac - sameSideHoldFrac;
      const target = unwrapForward(seg.theta0, visualThetaAtSide(seg.targetSide ?? "inside"));
      const overshoot = seg.theta0 + sameSideOvershootRad;
      if (localU < sameSideOutFrac) {
        return lerpAngle(seg.theta0, overshoot, localU / sameSideOutFrac, easeFromInside);
      }
      if (localU < sameSideOutFrac + sameSideHoldFrac) return overshoot;
      const backEase = seg.passThrough ? easeFromInside : easeToInside;
      return lerpAngle(
        overshoot,
        target,
        (localU - sameSideOutFrac - sameSideHoldFrac) / backFrac,
        backEase,
      );
    }
    case "sameSidePassThrough": {
      const tWp = seg.tWaypoint ?? seg.t1;
      const wpTheta = unwrapForward(seg.theta0, visualThetaAtSide(seg.targetSide ?? "inside"));
      if (wt <= tWp + 1e-9) {
        const wiggleSeg: HandMotionSegment = {
          ...seg,
          t1: tWp,
          profile: "sameSideReturn",
          passThrough: true,
          theta1: wpTheta,
        };
        return interpolateSegment(wiggleSeg, wt);
      }
      const u = clamp01((wt - tWp) / (seg.t1 - tWp));
      return lerpAngle(wpTheta, seg.theta1, u, easeFromInside);
    }
    case "continueForward":
      return lerpAngle(seg.theta0, seg.theta1, localU, easeFromInside);
    case "kf":
      return lerpAngle(seg.theta0, seg.theta1, localU, (u) => easeKf(seg.ease ?? "linear", u));
    case "typeReversal": {
      const { sameSideOvershootRad } = HAND_SCHEDULE;
      const tCatch = seg.tCatch ?? seg.t1;
      const catchSide = seg.catchSide ?? "outside";
      const catchTheta = unwrapBackward(
        seg.theta0 + sameSideOvershootRad,
        visualThetaAtSide(catchSide),
      );
      if (wt <= seg.t0 + 1e-9) return seg.theta0;
      if (wt >= seg.t1 - 1e-9) return seg.theta1;
      const overshootEnd = seg.t0 + Math.min((tCatch - seg.t0) * 0.25, 0.15);
      const overshoot = seg.theta0 + sameSideOvershootRad;
      if (wt <= overshootEnd) {
        const u = (wt - seg.t0) / Math.max(overshootEnd - seg.t0, 1e-9);
        return lerpAngle(seg.theta0, overshoot, u, easeFromInside);
      }
      if (wt <= tCatch + 1e-9) {
        const u = (wt - overshootEnd) / Math.max(tCatch - overshootEnd, 1e-9);
        return lerpAngle(overshoot, catchTheta, u, easeFromInside);
      }
      const u = (wt - tCatch) / Math.max(seg.t1 - tCatch, 1e-9);
      return lerpAngle(catchTheta, seg.theta1, u, easeFromInside);
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
  dwellBeats: number,
  periodBeats: number,
): Set<number> {
  const beats = new Set<number>();
  const lowHand = oppositeHand(startHand);
  const air = airTimeBeats(highThrow, dwellBeats);
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
  dwellBeats: number,
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
      const air = airTimeBeats(throwVal, dwellBeats);
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
  dwellBeats: number,
  cfg: PhysicsConfig,
  periodBeats: number,
): HandEvent[] {
  const Tb = cfg.beatPeriodS;
  const lowThrow = 1;
  const split = HAND_SCHEDULE.showerCatchThenThrowFrac * Tb;
  const multiplex = showerLowMultiplexCatchBeats(startHand, highThrow, dwellBeats, periodBeats);
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
      const air = airTimeBeats(throwVal, dwellBeats);
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
  dwellBeats: number,
  cfg: PhysicsConfig,
  periodBeats: number,
): HandEvent[] {
  if (hand === oppositeHand(startHand)) {
    return collectShowerLowHandEvents(
      hand,
      startHand,
      highThrow,
      dwellBeats,
      cfg,
      periodBeats,
    );
  }
  return collectShowerHighHandEvents(
    hand,
    startHand,
    highThrow,
    dwellBeats,
    cfg,
    periodBeats,
  );
}

function segmentEndTheta(
  from: number,
  profile: SegmentProfile,
  targetSide: GeometricSide | undefined,
  visualPlanning: boolean,
  afterSide?: GeometricSide,
): number {
  if (visualPlanning) {
    if (profile === "sameSideReturn") {
      return unwrapForward(from, visualThetaAtSide(targetSide ?? "inside"));
    }
    if (profile === "sameSidePassThrough") {
      const wp = visualThetaAtSide(targetSide ?? "inside");
      const endSide = afterSide ?? "outside";
      return lowerArcTheta(unwrapForward(from, wp), endSide);
    }
    if (profile === "toCatch") return lowerArcTheta(from, "outside");
    if (profile === "toThrow" || profile === "windBetweenThrows") {
      return lowerArcTheta(from, "inside");
    }
  } else {
    if (profile === "sameSideReturn") {
      return unwrapForward(from, thetaForSide(targetSide ?? "inside"));
    }
    if (profile === "toCatch") return lowerArcTheta(from, "outside");
    if (profile === "toThrow" || profile === "windBetweenThrows") {
      return lowerArcTheta(from, "inside");
    }
  }
  if (profile === "lapInside" || profile === "lapOutside") return from + TAU;
  return from;
}

/** Build θ segments from functional throw/catch events. */
export function buildSegments(
  events: HandEvent[],
  periodS: number,
  options: { throwFollowThrow?: SegmentProfile } = {},
): HandMotionSegment[] {
  const throwFollowThrow = options.throwFollowThrow ?? "lapInside";
  const loop = mergeEvents(events.filter((e) => e.t <= periodS + 1e-9));
  if (loop.length === 0) {
    return [{ t0: 0, t1: periodS, theta0: 0, theta1: TAU, profile: "lapInside" }];
  }

  const loopWithWrap = [
    ...loop,
    ...loop.map((e, j) => ({
      ...e,
      t: e.t + periodS,
      _wrapGen: 1,
      _wrapIdx: j,
    })),
  ];

  const usesVisualPlanning = loop.some((e) => e.functionalSide !== undefined);
  let theta = usesVisualPlanning
    ? visualThetaAtSide(functionalSideAt(loop[0], loop[0].kind))
    : handInsideTheta("right");
  const segments: HandMotionSegment[] = [];

  for (let i = 0; i < loop.length; i++) {
    const cur = loop[i];
    const nxt = loopWithWrap[i + 1];
    const after = loopWithWrap[i + 2];
    if (nxt.t - cur.t < 1e-9) continue;

    const fromSide = functionalSideAt(cur, cur.kind);
    const toSide = functionalSideAt(nxt, nxt.kind);
    const afterSide = functionalSideAt(after, after.kind);
    const explicitSides = cur.functionalSide !== undefined || nxt.functionalSide !== undefined;
    const sameDest = explicitSides && fromSide === toSide;

    if (
      usesVisualPlanning &&
      sameDest &&
      afterSide !== toSide &&
      after.t - cur.t > 1e-9
    ) {
      const theta1 = segmentEndTheta(
        theta,
        "sameSidePassThrough",
        toSide,
        true,
        afterSide,
      );
      segments.push({
        t0: cur.t,
        t1: after.t,
        tWaypoint: nxt.t,
        theta0: theta,
        theta1,
        profile: "sameSidePassThrough",
        targetSide: toSide,
        afterSide,
      });
      theta = theta1;
      i += 1;
      continue;
    }

    const profile = segmentProfile(
      cur,
      cur.kind,
      nxt.kind,
      fromSide,
      toSide,
      throwFollowThrow,
      explicitSides,
    );
    const theta1 = segmentEndTheta(theta, profile, toSide, usesVisualPlanning);
    segments.push({
      t0: cur.t,
      t1: nxt.t,
      theta0: theta,
      theta1,
      profile,
      targetSide: toSide,
    });
    theta = theta1;
  }

  if (segments.length === 0) {
    segments.push({ t0: 0, t1: periodS, theta0: 0, theta1: TAU, profile: "lapInside" });
  }

  return segments;
}

function sideAt(event: HandEvent): GeometricSide {
  return functionalSideAt(event, event.kind);
}

/**
 * Mixed custom patterns: each throw's type sets a rotation direction
 * (normal = forward / increasing θ through inside; reversed = backward through outside).
 * Runs of the same type are continuous ellipse laps. At a normal↔reversed boundary the
 * hand slows, reverses direction, and catches the incoming ball during the turnaround.
 */
export function buildThrowTypeSegments(events: HandEvent[], periodS: number): HandMotionSegment[] {
  const loop = mergeEvents(events.filter((e) => e.t <= periodS + 1e-9));
  const throws = loop.filter((e) => e.kind === "throw").sort((a, b) => a.t - b.t);
  if (throws.length === 0) {
    return [{ t0: 0, t1: periodS, theta0: 0, theta1: TAU, profile: "kf", ease: "linear" }];
  }

  const n = throws.length;
  const dirOf = (e: HandEvent) => (e.throwReversed ? -1 : 1);
  const throwPoint = (e: HandEvent) => (e.throwReversed ? Math.PI : 0);
  /** Interval i (throw i → throw i+1) reverses direction. */
  const isReversal = (i: number) => dirOf(throws[i]) !== dirOf(throws[(i + 1) % n]);

  // Continuous absolute θ at each throw boundary (0..n).
  const thetaAt: number[] = new Array(n + 1);
  thetaAt[0] = throwPoint(throws[0]);
  for (let i = 0; i < n; i++) {
    const d = dirOf(throws[(i + 1) % n]);
    const delta = isReversal(i) ? d * Math.PI : d * TAU;
    thetaAt[i + 1] = thetaAt[i] + delta;
  }
  // A throw boundary is "slow" (velocity ≈ 0) when the upcoming interval reverses.
  const slowAt = (i: number) => isReversal(((i % n) + n) % n);

  const segments: HandMotionSegment[] = [];

  for (let i = 0; i < n; i++) {
    const tStart = throws[i].t;
    const tEnd = i + 1 < n ? throws[i + 1].t : throws[0].t + periodS;
    if (tEnd - tStart < 1e-9) continue;

    const thS = thetaAt[i];
    const thE = thetaAt[i + 1];
    const lo = Math.min(thS, thE);
    const hi = Math.max(thS, thE);

    const catches = loop
      .filter((e) => e.kind === "catch" && e.t > tStart + 1e-9 && e.t < tEnd - 1e-9)
      .sort((a, b) => a.t - b.t);

    const kfs: { t: number; th: number; slow: boolean }[] = [
      { t: tStart, th: thS, slow: slowAt(i) },
    ];

    const ov = HAND_SCHEDULE.catchOvershootRad;
    const dirIn = dirOf(throws[i]);
    const sweepSign = Math.sign(thE - thS) || 1;

    for (const c of catches) {
      const cBase = sideAt(c) === "inside" ? 0 : Math.PI;
      let v = cBase;
      while (v < lo - 1e-9) v += TAU;
      while (v > hi + 1e-9) v -= TAU;
      if (v < lo - 1e-9) v += TAU;
      const atStart = Math.abs(v - thS) < 1e-6;
      const atEnd = Math.abs(v - thE) < 1e-6;

      if (atStart) {
        // Overshoot past the throw point in the incoming direction, then cross
        // back through it exactly when the ball lands, continuing into the reversal.
        const tPrev = kfs[kfs.length - 1].t;
        const tApex = (tPrev + c.t) / 2;
        kfs.push({ t: tApex, th: thS + dirIn * ov, slow: true });
        kfs.push({ t: c.t, th: thS, slow: false });
      } else if (atEnd) {
        // Reach the catch side, overshoot past it, return through it at the next throw.
        kfs.push({ t: c.t, th: thE, slow: false });
        const tApex = (c.t + tEnd) / 2;
        kfs.push({ t: tApex, th: thE + sweepSign * ov, slow: true });
      } else {
        kfs.push({ t: c.t, th: v, slow: false });
      }
    }

    kfs.push({ t: tEnd, th: thE, slow: slowAt(i + 1) });

    for (let k = 0; k < kfs.length - 1; k++) {
      const a = kfs[k];
      const b = kfs[k + 1];
      if (b.t - a.t < 1e-9) continue;
      const ease: EaseKind =
        a.slow && b.slow ? "smooth" : a.slow ? "accel" : b.slow ? "decel" : "linear";
      segments.push({ t0: a.t, t1: b.t, theta0: a.th, theta1: b.th, profile: "kf", ease });
    }
  }

  if (segments.length === 0) {
    segments.push({
      t0: 0,
      t1: periodS,
      theta0: thetaAt[0],
      theta1: thetaAt[0] + TAU,
      profile: "kf",
      ease: "linear",
    });
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

  const highSpec = throwMotionSpec(pattern, highThrow);
  const lowSpec = throwMotionSpec(pattern, 1);

  function scheduleFor(hand: HandId): HandMotionSchedule {
    const isHighHand = hand === startHand;
    const events = collectShowerHandEvents(
      hand,
      startHand,
      highThrow,
      dwellBeats,
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
