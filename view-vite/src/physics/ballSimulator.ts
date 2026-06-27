import type { HandId, PhysicsConfig } from "./config";
import { landingHand } from "./config";
import type { HandMotionConfig } from "./config";
import { airTimeBeats, airTimeS } from "./airTime";
import {
  ballLiftM,
  firstThrowBeat,
  handNearOutside,
  handNearOutsideBetween,
  handPosition,
  insideBallSlot,
  outsideBallSlot,
  throwBeatForHand,
  type HandMotionSchedules,
} from "./hands";
import { positionAt, type ProjectileThrow } from "./projectile";

export type BallPhase = "inHand" | "airborne" | "catching" | "dwell" | "dropping" | "gone";

export interface BallSnapshot {
  phase: BallPhase;
  x: number;
  y: number;
  visible: boolean;
  label: number;
  pendingThrow: number;
  pendingDwell: number;
  holdingHand: HandId;
  flight: ProjectileThrow | null;
  nextEventLabel: string;
}

export interface SimulatorParams {
  physics: PhysicsConfig;
  motion: HandMotionConfig;
  startHand: HandId;
  pendingThrow: number;
  dwellBeats: number;
  handSchedules?: HandMotionSchedules | null;
}

import { BALL_SIM, dwellBeatsForThrow } from "./twoHandThrowConfig";

export function heldBallPosition(
  hand: HandId,
  t: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  schedules?: HandMotionSchedules | null,
): [number, number] {
  const pose = handPosition(hand, t, cfg, motion, schedules);
  return [pose.x, pose.y + ballLiftM(cfg)];
}

function makeFlight(
  throwValue: number,
  dwellBeats: number,
  fromHand: HandId,
  releaseTimeS: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): ProjectileThrow {
  const toHand = landingHand(fromHand, throwValue);
  const tofS = airTimeS(throwValue, dwellBeats, cfg.beatPeriodS);
  return {
    startXy: insideBallSlot(fromHand, cfg, motion),
    endXy: outsideBallSlot(toHand, cfg, motion),
    tofS,
    massKg: cfg.massKg,
    g: cfg.g,
    startTimeS: releaseTimeS,
    label: String(throwValue),
  };
}

/** Static preview arc from a hand's throw slot to the landing catch slot. */
export function previewThrowFromHand(
  throwValue: number,
  dwellBeats: number,
  fromHand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): ProjectileThrow | null {
  if (throwValue <= 0) return null;
  if (airTimeBeats(throwValue, dwellBeats) <= 0) return null;
  return makeFlight(throwValue, dwellBeats, fromHand, 0, cfg, motion);
}

interface SimState {
  phase: BallPhase;
  label: number;
  pendingThrow: number;
  pendingDwell: number;
  holdingHand: HandId;
  catchingHand: HandId;
  flight: ProjectileThrow | null;
  catchStartS: number;
  catchDeadlineS: number;
  dwellEndS: number;
  dropX: number;
  dropY: number;
  dropStartS: number;
  goneEndS: number;
  lastReleaseBeat: number;
  lastCatchBeat: number;
}

function freshState(startHand: HandId, pending: number, dwell: number): SimState {
  return {
    phase: "inHand",
    label: pending,
    pendingThrow: pending,
    pendingDwell: dwell,
    holdingHand: startHand,
    catchingHand: startHand,
    flight: null,
    catchStartS: -1,
    catchDeadlineS: -1,
    dwellEndS: -1,
    dropX: 0,
    dropY: 0,
    dropStartS: -1,
    goneEndS: -1,
    lastReleaseBeat: -1,
    lastCatchBeat: -1,
  };
}

function beatIndexAt(timeS: number, beatPeriod: number): number {
  return Math.floor(timeS / beatPeriod + 1e-9);
}

function catchHandNearOutside(
  hand: HandId,
  landT: number,
  beatPeriod: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  schedules?: HandMotionSchedules | null,
): boolean {
  const probeEnd = landT + BALL_SIM.catchProbeBeats * beatPeriod;
  return handNearOutsideBetween(hand, landT, probeEnd, cfg, motion, schedules);
}

function beginCatch(
  s: SimState,
  landT: number,
  beatPeriod: number,
  motion: HandMotionConfig,
  cfg: PhysicsConfig,
  schedules?: HandMotionSchedules | null,
): void {
  if (!s.flight) return;
  const throwVal = parseInt(s.flight.label, 10);
  s.catchingHand = landingHand(s.holdingHand, throwVal);
  s.holdingHand = s.catchingHand;
  s.label = s.pendingThrow;
  s.flight = null;
  s.lastCatchBeat = beatIndexAt(landT, beatPeriod);
  s.catchStartS = landT;
  s.catchDeadlineS = landT + BALL_SIM.catchTimeoutBeats * beatPeriod;

  if (catchHandNearOutside(s.catchingHand, landT, beatPeriod, cfg, motion, schedules)) {
    finishCatch(s, landT, beatPeriod);
    return;
  }

  s.phase = "catching";
}

function finishCatch(s: SimState, landT: number, beatPeriod: number): void {
  s.catchStartS = -1;
  s.catchDeadlineS = -1;
  const d = dwellBeatsForThrow(s.pendingDwell, s.pendingThrow);
  if (d > 0) {
    s.phase = "dwell";
    s.dwellEndS = landT + d * beatPeriod;
  } else {
    s.phase = "inHand";
  }
}

function onRelease(
  s: SimState,
  bt: number,
  b: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  schedules?: HandMotionSchedules | null,
): void {
  const n = s.label;
  const effectiveDwell = dwellBeatsForThrow(s.pendingDwell, n);
  if (n === 0) {
    const [dx, dy] = heldBallPosition(s.holdingHand, bt, cfg, motion, schedules);
    s.phase = "dropping";
    s.dropX = dx;
    s.dropY = dy;
    s.dropStartS = bt;
    s.lastReleaseBeat = b;
    return;
  }
  if (n >= 1 && n <= 13) {
    const airBeats = airTimeBeats(n, s.pendingDwell);
    if (airBeats <= 0) {
      s.phase = "dwell";
      s.dwellEndS = bt + effectiveDwell * cfg.beatPeriodS;
      s.lastReleaseBeat = b;
      return;
    }
    s.flight = makeFlight(n, s.pendingDwell, s.holdingHand, bt, cfg, motion);
    s.phase = "airborne";
    s.lastReleaseBeat = b;
  }
}

function canRelease(s: SimState, beat: number, startHand: HandId): boolean {
  if (s.phase !== "inHand") return false;
  if (beat < firstThrowBeat(startHand)) return false;
  if (!throwBeatForHand(s.holdingHand, beat)) return false;
  if (beat <= s.lastReleaseBeat) return false;
  if (beat === s.lastCatchBeat) return false;
  return true;
}

function tickCatchTimeout(s: SimState, t: number, beatPeriod: number): void {
  if (s.phase !== "catching" || s.catchDeadlineS < 0) return;
  if (t >= s.catchDeadlineS) {
    finishCatch(s, s.catchStartS, beatPeriod);
  }
}

export function computeBallAt(t: number, params: SimulatorParams): BallSnapshot {
  const { physics: cfg, motion, startHand, pendingThrow, dwellBeats, handSchedules } = params;
  const dwell = Math.min(Math.max(0, dwellBeats), pendingThrow);
  let s = freshState(startHand, pendingThrow, dwell);

  if (t <= 0) {
    const [x, y] = heldBallPosition(s.holdingHand, 0, cfg, motion, handSchedules);
    return mkSnap(s, x, y);
  }

  const bp = cfg.beatPeriodS;
  const maxBeat = Math.ceil(t / bp) + 2;

  for (let b = 0; b <= maxBeat; b++) {
    const bt = b * bp;

    if (s.phase === "airborne" && s.flight) {
      const landT = s.flight.startTimeS + s.flight.tofS;
      if (landT <= t && landT <= bt + 1e-9) {
        beginCatch(s, landT, bp, motion, cfg, handSchedules);
      }
    }

    if (s.phase === "catching") {
      tickCatchTimeout(s, Math.min(t, bt), bp);
      if (handNearOutside(s.catchingHand, Math.min(t, bt), cfg, motion, handSchedules)) {
        finishCatch(s, Math.min(t, bt), bp);
      }
    }

    if (s.phase === "dwell" && s.dwellEndS <= t && s.dwellEndS <= bt + 1e-9) {
      s.phase = "inHand";
    }

    if (s.phase === "dropping" && s.dropStartS >= 0) {
      const elapsed = Math.min(t, bt) - s.dropStartS;
      if (elapsed > 0) {
        const y = s.dropY - 0.5 * cfg.g * elapsed * elapsed;
        if (y <= cfg.handHeightM - ballLiftM(cfg)) {
          s.phase = "gone";
          s.goneEndS = s.dropStartS + elapsed + BALL_SIM.respawnS;
        }
      }
    }

    if (s.phase === "gone" && s.goneEndS <= t) {
      s = freshState(startHand, pendingThrow, dwell);
    }

    if (bt > t) break;

    if (canRelease(s, b, startHand)) {
      onRelease(s, bt, b, cfg, motion, handSchedules);
    }
  }

  if (s.phase === "airborne" && s.flight) {
    const landT = s.flight.startTimeS + s.flight.tofS;
    if (t >= landT) beginCatch(s, landT, bp, motion, cfg, handSchedules);
  }

  if (s.phase === "catching") {
    tickCatchTimeout(s, t, bp);
    if (handNearOutside(s.catchingHand, t, cfg, motion, handSchedules)) {
      finishCatch(s, t, bp);
    }
  }

  if (s.phase === "dwell" && t >= s.dwellEndS) s.phase = "inHand";
  if (s.phase === "gone" && t >= s.goneEndS) {
    s = freshState(startHand, pendingThrow, dwell);
  }

  if (s.phase === "gone") {
    return { ...mkSnap(s, 0, 0), visible: false, nextEventLabel: "respawn" };
  }

  if (s.phase === "dropping" && s.dropStartS >= 0) {
    const elapsed = t - s.dropStartS;
    const y = s.dropY - 0.5 * cfg.g * elapsed * elapsed;
    const floorY = cfg.handHeightM - ballLiftM(cfg);
    return mkSnap(s, s.dropX, Math.max(floorY, y));
  }

  if (s.phase === "airborne" && s.flight) {
    const [x, y] = positionAt(s.flight, t);
    return {
      ...mkSnap(s, x, y),
      label: parseInt(s.flight.label, 10),
      nextEventLabel: "catch",
    };
  }

  if (s.phase === "catching") {
    const [x, y] = heldBallPosition(s.catchingHand, t, cfg, motion, handSchedules);
    return { ...mkSnap(s, x, y), nextEventLabel: "catch" };
  }

  const [x, y] = heldBallPosition(s.holdingHand, t, cfg, motion, handSchedules);
  return mkSnap(s, x, y);
}

function mkSnap(s: SimState, x: number, y: number): BallSnapshot {
  const next =
    s.phase === "dwell"
      ? "hold"
      : s.phase === "airborne" || s.phase === "catching"
        ? "catch"
        : "throw";
  return {
    phase: s.phase,
    x,
    y,
    visible: true,
    label: s.label,
    pendingThrow: s.pendingThrow,
    pendingDwell: s.pendingDwell,
    holdingHand: s.holdingHand,
    flight: s.flight,
    nextEventLabel: next,
  };
}
