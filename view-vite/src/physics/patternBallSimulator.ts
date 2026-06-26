import type { HandId, HandMotionConfig, PhysicsConfig } from "./config";
import type { HandMotionSchedules } from "./hands";
import {
  ballLiftM,
  handNearOutside,
  handNearOutsideBetween,
  throwBeatForHand,
} from "./hands";
import { airTimeBeats, airTimeS } from "./airTime";
import { heldBallPosition } from "./ballSimulator";
import type { PatternDefinition } from "./patternCatalog";
import {
  initialStacks,
  scheduledHandAtBeat,
  showerStartupThrows,
  siteswapStartBeat,
  siteswapThrowValue,
  type HandStacks,
} from "./patternInit";
import {
  catchSlot,
  landingHandForPattern,
  motionFlagsForPattern,
  throwSlot,
  type PatternMotionFlags,
} from "./patternMotion";
import { positionAt, type ProjectileThrow } from "./projectile";
import { BALL_SIM } from "./twoHandThrowConfig";

export type PatternBallPhase = "inHand" | "airborne" | "catching" | "dwell";

export interface PatternBallSnapshot {
  id: number;
  phase: PatternBallPhase;
  x: number;
  y: number;
  visible: boolean;
  label: number;
  holdingHand: HandId;
}

export interface PatternSimulatorParams {
  physics: PhysicsConfig;
  motion: HandMotionConfig;
  pattern: PatternDefinition;
  startHand: HandId;
  dwellBeats: number;
  handSchedules?: HandMotionSchedules | null;
}

interface BallState {
  id: number;
  phase: PatternBallPhase;
  holdingHand: HandId;
  catchingHand: HandId;
  flight: ProjectileThrow | null;
  catchStartS: number;
  catchDeadlineS: number;
  dwellEndS: number;
  label: number;
}

interface SimContext {
  balls: BallState[];
  stacks: HandStacks;
  flags: PatternMotionFlags;
  dwell: number;
}

function stackIndexForBall(stacks: HandStacks, ballId: number, hand: HandId): number {
  const stack = hand === "left" ? stacks.left : stacks.right;
  const idx = stack.indexOf(ballId);
  return idx >= 0 ? idx : 0;
}

function popTop(stacks: HandStacks, hand: HandId): number | null {
  const stack = hand === "left" ? stacks.left : stacks.right;
  if (stack.length === 0) return null;
  return stack.pop() ?? null;
}

function pushBall(stacks: HandStacks, hand: HandId, ballId: number): void {
  (hand === "left" ? stacks.left : stacks.right).push(ballId);
}

function makePatternFlight(
  throwValue: number,
  dwellBeats: number,
  fromHand: HandId,
  releaseTimeS: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  flags: PatternMotionFlags,
): ProjectileThrow {
  const toHand = landingHandForPattern(fromHand, throwValue, flags);
  const tofS = airTimeS(throwValue, dwellBeats, cfg.beatPeriodS);
  return {
    startXy: throwSlot(fromHand, cfg, motion, flags),
    endXy: catchSlot(toHand, cfg, motion, flags),
    tofS,
    massKg: cfg.massKg,
    g: cfg.g,
    startTimeS: releaseTimeS,
    label: String(throwValue),
  };
}

function heldPosWithStack(
  ball: BallState,
  t: number,
  stacks: HandStacks,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  schedules?: HandMotionSchedules | null,
): [number, number] {
  const idx = stackIndexForBall(stacks, ball.id, ball.holdingHand);
  const [x, y] = heldBallPosition(ball.holdingHand, t, cfg, motion, schedules);
  const lift = ballLiftM(cfg) * 0.35 * idx;
  return [x, y + lift];
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

function finishCatch(ball: BallState, landT: number, beatPeriod: number, dwell: number): void {
  ball.catchStartS = -1;
  ball.catchDeadlineS = -1;
  ball.holdingHand = ball.catchingHand;
  if (dwell > 0) {
    ball.phase = "dwell";
    ball.dwellEndS = landT + dwell * beatPeriod;
  } else {
    ball.phase = "inHand";
  }
}

function shouldThrowAtBeat(
  pattern: PatternDefinition,
  startHand: HandId,
  beat: number,
  ctx: SimContext,
): { hand: HandId; value: number } | null {
  const hand = scheduledHandAtBeat(startHand, beat);
  if (!hand || !throwBeatForHand(hand, beat)) return null;

  const startBeat = siteswapStartBeat(pattern, startHand);
  if (beat < startBeat) {
    const startup = showerStartupThrows(pattern, startHand).find((e) => e.beat === beat);
    if (!startup || startup.hand !== hand) return null;
    const stack = hand === "left" ? ctx.stacks.left : ctx.stacks.right;
    if (stack.length === 0) return null;
    return { hand, value: startup.value };
  }

  const value = siteswapThrowValue(pattern, startHand, beat);
  const stack = hand === "left" ? ctx.stacks.left : ctx.stacks.right;
  if (value === 0) return { hand, value: 0 };
  if (stack.length === 0) return null;
  return { hand, value };
}

function freshContext(
  pattern: PatternDefinition,
  startHand: HandId,
  dwell: number,
): SimContext {
  const stacks = initialStacks(pattern, startHand);
  const balls: BallState[] = [];
  for (let id = 0; id < pattern.ballCount; id++) {
    let hand: HandId = "left";
    if (stacks.left.includes(id)) hand = "left";
    else if (stacks.right.includes(id)) hand = "right";
    balls.push({
      id,
      phase: "inHand",
      holdingHand: hand,
      catchingHand: hand,
      flight: null,
      catchStartS: -1,
      catchDeadlineS: -1,
      dwellEndS: -1,
      label: 0,
    });
  }
  return { balls, stacks, flags: motionFlagsForPattern(pattern), dwell };
}

function releaseBall(
  ctx: SimContext,
  ballId: number,
  throwValue: number,
  bt: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): void {
  const ball = ctx.balls[ballId];
  ball.label = throwValue;
  if (throwValue <= 0) return;

  const d = Math.min(ctx.dwell, throwValue);
  const airBeats = airTimeBeats(throwValue, d);
  if (airBeats <= 0) {
    ball.phase = "dwell";
    ball.dwellEndS = bt + d * cfg.beatPeriodS;
    return;
  }
  ball.flight = makePatternFlight(throwValue, d, ball.holdingHand, bt, cfg, motion, ctx.flags);
  ball.phase = "airborne";
}

function processLandings(
  ctx: SimContext,
  t: number,
  bp: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  schedules: HandMotionSchedules | null | undefined,
): void {
  for (const ball of ctx.balls) {
    if (ball.phase !== "airborne" || !ball.flight) continue;
    const landT = ball.flight.startTimeS + ball.flight.tofS;
    if (landT <= t) {
      const throwVal = parseInt(ball.flight.label, 10);
      ball.catchingHand = landingHandForPattern(ball.holdingHand, throwVal, ctx.flags);
      ball.flight = null;
      ball.catchStartS = landT;
      ball.catchDeadlineS = landT + BALL_SIM.catchTimeoutBeats * bp;
      ball.phase = "catching";
      if (catchHandNearOutside(ball.catchingHand, landT, bp, cfg, motion, schedules)) {
        finishCatch(ball, landT, bp, ctx.dwell);
        pushBall(ctx.stacks, ball.holdingHand, ball.id);
      }
    }
  }
}

function processCatching(ctx: SimContext, t: number, bp: number): void {
  for (const ball of ctx.balls) {
    if (ball.phase !== "catching") continue;
    if (ball.catchDeadlineS >= 0 && t >= ball.catchDeadlineS) {
      finishCatch(ball, ball.catchStartS, bp, ctx.dwell);
      pushBall(ctx.stacks, ball.holdingHand, ball.id);
    }
  }
}

function processDwell(ctx: SimContext, t: number): void {
  for (const ball of ctx.balls) {
    if (ball.phase === "dwell" && t >= ball.dwellEndS) {
      ball.phase = "inHand";
    }
  }
}

export function computePatternAt(t: number, params: PatternSimulatorParams): PatternBallSnapshot[] {
  const { physics: cfg, motion, pattern, startHand, dwellBeats, handSchedules } = params;
  const dwell = Math.min(Math.max(0, dwellBeats), 13);
  const ctx = freshContext(pattern, startHand, dwell);

  if (t <= 0) {
    return ctx.balls.map((ball) => {
      const [x, y] = heldPosWithStack(ball, 0, ctx.stacks, cfg, motion, handSchedules);
      return {
        id: ball.id,
        phase: ball.phase,
        x,
        y,
        visible: true,
        label: ball.label,
        holdingHand: ball.holdingHand,
      };
    });
  }

  const bp = cfg.beatPeriodS;
  const maxBeat = Math.ceil(t / bp) + 2;

  for (let b = 0; b <= maxBeat; b++) {
    const bt = b * bp;

    processLandings(ctx, Math.min(t, bt), bp, cfg, motion, handSchedules);
    processCatching(ctx, Math.min(t, bt), bp);

    for (const ball of ctx.balls) {
      if (
        ball.phase === "catching" &&
        handNearOutside(ball.catchingHand, Math.min(t, bt), cfg, motion, handSchedules)
      ) {
        finishCatch(ball, Math.min(t, bt), bp, ctx.dwell);
        pushBall(ctx.stacks, ball.holdingHand, ball.id);
      }
    }

    processDwell(ctx, Math.min(t, bt));

    if (bt > t) break;

    const sched = shouldThrowAtBeat(pattern, startHand, b, ctx);
    if (!sched || sched.value === 0) continue;

    const ballId = popTop(ctx.stacks, sched.hand);
    if (ballId === null) continue;
    releaseBall(ctx, ballId, sched.value, bt, cfg, motion);
  }

  processLandings(ctx, t, bp, cfg, motion, handSchedules);
  processCatching(ctx, t, bp);
  for (const ball of ctx.balls) {
    if (ball.phase === "catching" && handNearOutside(ball.catchingHand, t, cfg, motion, handSchedules)) {
      finishCatch(ball, t, bp, ctx.dwell);
      pushBall(ctx.stacks, ball.holdingHand, ball.id);
    }
  }
  processDwell(ctx, t);

  return ctx.balls.map((ball) => {
    if (ball.phase === "airborne" && ball.flight) {
      const [x, y] = positionAt(ball.flight, t);
      return {
        id: ball.id,
        phase: ball.phase,
        x,
        y,
        visible: true,
        label: parseInt(ball.flight.label, 10),
        holdingHand: ball.holdingHand,
      };
    }
    if (ball.phase === "catching") {
      const [x, y] = heldPosWithStack(ball, t, ctx.stacks, cfg, motion, handSchedules);
      return {
        id: ball.id,
        phase: ball.phase,
        x,
        y,
        visible: true,
        label: ball.label,
        holdingHand: ball.catchingHand,
      };
    }
    const [x, y] = heldPosWithStack(ball, t, ctx.stacks, cfg, motion, handSchedules);
    return {
      id: ball.id,
      phase: ball.phase,
      x,
      y,
      visible: true,
      label: ball.label,
      holdingHand: ball.holdingHand,
    };
  });
}
