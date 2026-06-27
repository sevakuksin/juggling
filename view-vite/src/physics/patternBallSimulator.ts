import type { HandId, HandMotionConfig, PhysicsConfig } from "./config";
import type { HandMotionSchedules } from "./hands";
import {
  ballLiftM,
  handNearInside,
  handNearInsideBetween,
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
  showerForceCatchOnLanding,
  showerLowMultiplexCatchBeats,
  showerStartupThrows,
  showerThrowReleaseTimeS,
  siteswapStartBeat,
  siteswapThrowValue,
  type HandStacks,
} from "./patternInit";
import { catchSlot, landingHandForPattern, motionFlagsForPattern, throwSlot, type PatternMotionFlags } from "./patternMotion";
import { oppositeHand } from "./config";
import { catchProbeGeometricInside, throwMotionSpec } from "./throwMotion";
import { positionAt, type ProjectileThrow } from "./projectile";
import { BALL_SIM, HAND_SCHEDULE, showerDwellBeats } from "./twoHandThrowConfig";

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
  catchGeometricInside: boolean;
}

interface SimContext {
  balls: BallState[];
  stacks: HandStacks;
  flags: PatternMotionFlags;
  pattern: PatternDefinition;
  startHand: HandId;
  dwell: number;
}

function stackIndexForBall(stacks: HandStacks, ballId: number, hand: HandId): number {
  const stack = hand === "left" ? stacks.left : stacks.right;
  const idx = stack.indexOf(ballId);
  return idx >= 0 ? idx : 0;
}

function popForThrow(
  ctx: SimContext,
  hand: HandId,
  beat: number,
  periodBeats: number,
): number | null {
  const stack = hand === "left" ? ctx.stacks.left : ctx.stacks.right;
  if (stack.length === 0) return null;
  const multiplex =
    ctx.pattern.family === "shower" &&
    hand === oppositeHand(ctx.startHand) &&
    showerLowMultiplexCatchBeats(ctx.pattern, ctx.startHand, ctx.dwell, periodBeats).has(beat);
  if (multiplex) return stack.shift() ?? null;
  return stack.pop() ?? null;
}

function pushBall(stacks: HandStacks, hand: HandId, ballId: number): void {
  const stack = hand === "left" ? stacks.left : stacks.right;
  if (stack.includes(ballId)) return;
  stack.push(ballId);
}

function showerPeriodBeats(pattern: PatternDefinition): number {
  const highThrow = pattern.reverseHighThrow ?? HAND_SCHEDULE.minThrowForPeriod;
  return (
    HAND_SCHEDULE.minPeriodBeatsMultiplier *
    Math.max(HAND_SCHEDULE.minThrowForPeriod, highThrow)
  );
}

function makePatternFlight(
  throwValue: number,
  dwellBeats: number,
  fromHand: HandId,
  releaseTimeS: number,
  beat: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  pattern: PatternDefinition,
  startHand: HandId,
  flags: PatternMotionFlags,
): ProjectileThrow {
  const spec = throwMotionSpec(pattern, throwValue, beat, startHand);
  const toHand = landingHandForPattern(fromHand, throwValue, flags);
  const tofS = airTimeS(throwValue, dwellBeats, cfg.beatPeriodS);
  return {
    startXy: throwSlot(fromHand, cfg, motion, spec),
    endXy: catchSlot(toHand, cfg, motion, spec),
    tofS,
    massKg: cfg.massKg,
    g: cfg.g,
    startTimeS: releaseTimeS,
    label: String(throwValue),
    landsGeometricInside: catchProbeGeometricInside(spec),
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

function catchHandNearSlot(
  hand: HandId,
  landT: number,
  beatPeriod: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  schedules: HandMotionSchedules | null | undefined,
  catchGeometricInside: boolean,
): boolean {
  const probeEnd = landT + BALL_SIM.catchProbeBeats * beatPeriod;
  if (catchGeometricInside) {
    return handNearInsideBetween(hand, landT, probeEnd, cfg, motion, schedules);
  }
  return handNearOutsideBetween(hand, landT, probeEnd, cfg, motion, schedules);
}

function handNearCatchSlot(
  hand: HandId,
  t: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  schedules: HandMotionSchedules | null | undefined,
  catchGeometricInside: boolean,
): boolean {
  return catchGeometricInside
    ? handNearInside(hand, t, cfg, motion, schedules)
    : handNearOutside(hand, t, cfg, motion, schedules);
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

function forceFinishCatchingOnHand(ctx: SimContext, hand: HandId, t: number, bp: number): void {
  for (const ball of ctx.balls) {
    if (ball.phase !== "catching" || ball.catchingHand !== hand) continue;
    finishCatch(ball, t, bp, dwellAfterCatch(ctx, hand));
    pushBall(ctx.stacks, ball.holdingHand, ball.id);
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
      catchGeometricInside: false,
    });
  }
  return { balls, stacks, flags: motionFlagsForPattern(pattern), pattern, startHand, dwell };
}

function dwellForThrow(ctx: SimContext, throwValue: number): number {
  if (ctx.pattern.family === "shower") {
    return showerDwellBeats(ctx.dwell, throwValue);
  }
  return Math.min(ctx.dwell, throwValue);
}

/** Dwell after catch: shower hands use their own throw height, not the incoming ball. */
function dwellAfterCatch(ctx: SimContext, hand: HandId): number {
  if (ctx.pattern.family === "shower" && ctx.pattern.reverseHighThrow != null) {
    const throwVal = hand === ctx.startHand ? ctx.pattern.reverseHighThrow : 1;
    return showerDwellBeats(ctx.dwell, throwVal);
  }
  return ctx.dwell;
}

function releaseBall(
  ctx: SimContext,
  ballId: number,
  throwValue: number,
  beat: number,
  bt: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): void {
  const ball = ctx.balls[ballId];
  ball.label = throwValue;
  if (throwValue <= 0) return;

  const d = dwellForThrow(ctx, throwValue);
  const airBeats = airTimeBeats(throwValue, d);
  if (airBeats <= 0) {
    ball.phase = "dwell";
    ball.dwellEndS = bt + d * cfg.beatPeriodS;
    pushBall(ctx.stacks, ball.holdingHand, ballId);
    return;
  }
  ball.flight = makePatternFlight(
    throwValue,
    d,
    ball.holdingHand,
    bt,
    beat,
    cfg,
    motion,
    ctx.pattern,
    ctx.startHand,
    ctx.flags,
  );
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
      const catchGeometricInside = ball.flight.landsGeometricInside ?? false;
      ball.catchingHand = landingHandForPattern(ball.holdingHand, throwVal, ctx.flags);
      forceFinishCatchingOnHand(ctx, ball.catchingHand, landT, bp);
      ball.catchGeometricInside = catchGeometricInside;
      ball.label = throwVal;
      ball.flight = null;
      ball.catchStartS = landT;
      ball.catchDeadlineS = landT + BALL_SIM.catchTimeoutBeats * bp;
      ball.phase = "catching";
      if (
        catchGeometricInside ||
        showerForceCatchOnLanding(
          ctx.pattern,
          ctx.startHand,
          throwVal,
          ball.catchingHand,
          catchGeometricInside,
        ) ||
        catchHandNearSlot(ball.catchingHand, landT, bp, cfg, motion, schedules, catchGeometricInside)
      ) {
        finishCatch(ball, landT, bp, dwellAfterCatch(ctx, ball.catchingHand));
        pushBall(ctx.stacks, ball.holdingHand, ball.id);
      }
    }
  }
}

function processCatching(ctx: SimContext, t: number, bp: number): void {
  for (const ball of ctx.balls) {
    if (ball.phase !== "catching") continue;
    if (ball.catchDeadlineS >= 0 && t >= ball.catchDeadlineS) {
      finishCatch(ball, ball.catchStartS, bp, dwellAfterCatch(ctx, ball.catchingHand));
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
  const periodBeats = showerPeriodBeats(pattern);

  for (let b = 0; b <= maxBeat; b++) {
    const beatStart = b * bp;
    const beatEnd = (b + 1) * bp;
    const processTo = Math.min(t, beatEnd);

    processLandings(ctx, processTo, bp, cfg, motion, handSchedules);
    processCatching(ctx, processTo, bp);

    for (const ball of ctx.balls) {
      if (
        ball.phase === "catching" &&
        handNearCatchSlot(
          ball.catchingHand,
          processTo,
          cfg,
          motion,
          handSchedules,
          ball.catchGeometricInside,
        )
      ) {
        finishCatch(ball, processTo, bp, dwellAfterCatch(ctx, ball.catchingHand));
        pushBall(ctx.stacks, ball.holdingHand, ball.id);
      }
    }

    processDwell(ctx, processTo);

    if (beatStart > t) break;

    const sched = shouldThrowAtBeat(pattern, startHand, b, ctx);
    if (sched && sched.value > 0) {
      const releaseT = showerThrowReleaseTimeS(
        pattern,
        startHand,
        sched.hand,
        b,
        bp,
        dwell,
        periodBeats,
      );
      if (releaseT <= t) {
        const ballId = popForThrow(ctx, sched.hand, b, periodBeats);
        if (ballId !== null) {
          releaseBall(ctx, ballId, sched.value, b, releaseT, cfg, motion);
        }
      }
    }

    if (beatEnd > t) break;
  }

  processLandings(ctx, t, bp, cfg, motion, handSchedules);
  processCatching(ctx, t, bp);
  for (const ball of ctx.balls) {
    if (
      ball.phase === "catching" &&
      handNearCatchSlot(ball.catchingHand, t, cfg, motion, handSchedules, ball.catchGeometricInside)
    ) {
      finishCatch(ball, t, bp, dwellAfterCatch(ctx, ball.catchingHand));
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
