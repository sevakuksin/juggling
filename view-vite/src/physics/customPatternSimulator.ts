import { landingHand, oppositeHand, type HandId, type HandMotionConfig, type PhysicsConfig } from "./config";
import type { HandMotionSchedules } from "./hands";
import {
  ballLiftM,
  throwBeatForHand,
} from "./hands";
import { airTimeBeats, airTimeS } from "./airTime";
import { heldBallPosition } from "./ballSimulator";
import {
  asShowerPatternDefinition,
  ballCountFromParsed,
  customDwellAfterCatch,
  customDwellForThrow,
  customShowerHighHand,
  scheduledHandAtBeat,
  scheduledThrowAtBeat,
  siteswapStartBeat,
  throwIndexAtBeat,
  type CustomPatternRuntime,
} from "./customPattern";
import { catchSlot, throwSlot } from "./patternMotion";
import {
  showerLowMultiplexCatchBeats,
  showerThrowReleaseTimeS,
  type HandStacks,
} from "./patternInit";
import { catchProbeGeometricInside, throwMotionSpecForParsed } from "./throwMotion";
import { positionAt, type ProjectileThrow } from "./projectile";
import { BALL_SIM, HAND_SCHEDULE } from "./twoHandThrowConfig";

export type CustomBallPhase = "inHand" | "airborne" | "catching" | "dwell" | "dropping";

export interface CustomBallSnapshot {
  id: number;
  phase: CustomBallPhase;
  x: number;
  y: number;
  visible: boolean;
  label: number;
  holdingHand: HandId;
}

export interface CustomPatternSimResult {
  balls: CustomBallSnapshot[];
  error: string | null;
}

export interface CustomPatternSimulatorParams {
  physics: PhysicsConfig;
  motion: HandMotionConfig;
  runtime: CustomPatternRuntime;
  dwellBeats: number;
  handSchedules?: HandMotionSchedules | null;
}

interface BallState {
  id: number;
  phase: CustomBallPhase;
  holdingHand: HandId;
  catchingHand: HandId;
  flight: ProjectileThrow | null;
  catchStartS: number;
  catchDeadlineS: number;
  dwellEndS: number;
  label: number;
  catchGeometricInside: boolean;
  throwBeat: number;
  throwIndex: number;
  dropX: number;
  dropY: number;
  dropStartS: number;
  dropReason: string | null;
  hitGround: boolean;
}

interface SimContext {
  runtime: CustomPatternRuntime;
  balls: BallState[];
  stacks: HandStacks;
  dwell: number;
  error: string | null;
  nextBallId: number;
  handSchedules?: HandMotionSchedules | null;
}

function pushBall(stacks: HandStacks, hand: HandId, ballId: number): void {
  const stack = hand === "left" ? stacks.left : stacks.right;
  if (stack.includes(ballId)) return;
  stack.push(ballId);
}

function stackIndexForBall(stacks: HandStacks, ballId: number, hand: HandId): number {
  const stack = hand === "left" ? stacks.left : stacks.right;
  const idx = stack.indexOf(ballId);
  return idx >= 0 ? idx : 0;
}

function showerPeriodBeats(runtime: CustomPatternRuntime): number {
  const highThrow = runtime.parsed.heights.reduce((m, h) => Math.max(m, h), 0);
  return (
    HAND_SCHEDULE.minPeriodBeatsMultiplier * Math.max(HAND_SCHEDULE.minThrowForPeriod, highThrow)
  );
}

function popForThrow(ctx: SimContext, hand: HandId, beat: number): number | null {
  const stack = hand === "left" ? ctx.stacks.left : ctx.stacks.right;
  if (stack.length === 0) return null;
  const hiHand = customShowerHighHand(ctx.runtime);
  if (hiHand) {
    const showerDef = asShowerPatternDefinition(ctx.runtime.parsed);
    const periodBeats = showerPeriodBeats(ctx.runtime);
    const multiplex =
      hand === oppositeHand(hiHand) &&
      showerLowMultiplexCatchBeats(showerDef, hiHand, ctx.dwell, periodBeats).has(beat);
    if (multiplex) return stack.shift() ?? null;
  }
  return stack.pop() ?? null;
}

function removeFromStack(stacks: HandStacks, hand: HandId, ballId: number): void {
  const stack = hand === "left" ? stacks.left : stacks.right;
  const idx = stack.indexOf(ballId);
  if (idx >= 0) stack.splice(idx, 1);
}

function dropBall(
  ctx: SimContext,
  ball: BallState,
  reason: string,
  t: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): void {
  if (ball.phase === "dropping") return;
  removeFromStack(ctx.stacks, ball.holdingHand, ball.id);
  removeFromStack(ctx.stacks, ball.catchingHand, ball.id);
  if (ball.phase === "airborne" && ball.flight) {
    const [x, y] = positionAt(ball.flight, Math.max(t, ball.flight.startTimeS));
    ball.dropX = x;
    ball.dropY = y;
  } else {
    const hand = ball.phase === "catching" ? ball.catchingHand : ball.holdingHand;
    const [x, y] = heldBallPosition(hand, t, cfg, motion, ctx.handSchedules);
    ball.dropX = x;
    ball.dropY = y;
  }
  ball.phase = "dropping";
  ball.dropStartS = t;
  ball.dropReason = reason;
  ball.flight = null;
  ball.catchStartS = -1;
  ball.catchDeadlineS = -1;
}

function dropHeldOnHand(
  ctx: SimContext,
  hand: HandId,
  reason: string,
  t: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): void {
  for (const ball of ctx.balls) {
    if (ball.phase === "dropping" || ball.phase === "airborne") continue;
    const onHand =
      ball.holdingHand === hand || (ball.phase === "catching" && ball.catchingHand === hand);
    if (onHand) dropBall(ctx, ball, reason, t, cfg, motion);
  }
}

function ballsOnHand(ctx: SimContext, hand: HandId): number {
  const stackLen = hand === "left" ? ctx.stacks.left.length : ctx.stacks.right.length;
  let catching = 0;
  for (const ball of ctx.balls) {
    if (ball.phase === "catching" && ball.catchingHand === hand) catching++;
  }
  return stackLen + catching;
}

function makeFlight(
  ctx: SimContext,
  throwValue: number,
  fromHand: HandId,
  releaseTimeS: number,
  throwIndex: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): ProjectileThrow {
  const spec = throwMotionSpecForParsed(ctx.runtime.parsed.throws, throwIndex);
  const toHand = landingHand(fromHand, throwValue);
  const tofS = airTimeS(throwValue, ctx.dwell, cfg.beatPeriodS);
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

function createBall(ctx: SimContext, hand: HandId): number {
  const id = ctx.nextBallId++;
  ctx.balls.push({
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
    throwBeat: -1,
    throwIndex: -1,
    dropX: 0,
    dropY: 0,
    dropStartS: -1,
    dropReason: null,
    hitGround: false,
  });
  pushBall(ctx.stacks, hand, id);
  return id;
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

function landingBeatIndex(landT: number, bp: number): number {
  return Math.round(landT / bp - 1e-9);
}

/** Airborne ball landing on `hand` with land time in (afterT, beforeT]. */
function hasIncomingAirborneToHand(
  ctx: SimContext,
  hand: HandId,
  afterT: number,
  beforeT: number,
): boolean {
  for (const ball of ctx.balls) {
    if (ball.phase !== "airborne" || !ball.flight) continue;
    const throwVal = parseInt(ball.flight.label, 10);
    if (landingHand(ball.holdingHand, throwVal) !== hand) continue;
    const landT = ball.flight.startTimeS + ball.flight.tofS;
    if (landT > afterT + 1e-9 && landT <= beforeT + 1e-9) return true;
  }
  return false;
}


function tryCatch(
  ctx: SimContext,
  ball: BallState,
  landT: number,
  bp: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): void {
  const throwVal = parseInt(ball.flight!.label, 10);
  const fromHand = ball.holdingHand;
  const catchGeometricInside = ball.flight!.landsGeometricInside ?? false;
  const landBeat = landingBeatIndex(landT, bp);
  const catchHand = landingHand(fromHand, throwVal);

  const catchHandScheduled =
    scheduledHandAtBeat(ctx.runtime.startHand, landBeat) === catchHand
      ? scheduledThrowAtBeat(ctx.runtime, landBeat)
      : null;
  if (catchHandScheduled && catchHandScheduled.height === 0) {
    dropBall(
      ctx,
      ball,
      `Catch on beat ${landBeat} where hand is scheduled 0`,
      landT,
      cfg,
      motion,
    );
    return;
  }

  if (ballsOnHand(ctx, catchHand) > 0) {
    dropBall(
      ctx,
      ball,
      `Hand already holding a ball on catch (beat ${landBeat})`,
      landT,
      cfg,
      motion,
    );
    return;
  }

  ball.catchingHand = catchHand;
  ball.catchGeometricInside = catchGeometricInside;
  ball.label = throwVal;
  ball.flight = null;
  ball.catchStartS = landT;
  ball.catchDeadlineS = landT + BALL_SIM.catchTimeoutBeats * bp;
  ball.phase = "catching";

  finishCatch(ball, landT, bp, customDwellAfterCatch(ctx.runtime, ctx.dwell, ball.catchingHand));
  pushBall(ctx.stacks, ball.holdingHand, ball.id);
}

function processLandings(
  ctx: SimContext,
  t: number,
  bp: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): void {
  for (const ball of ctx.balls) {
    if (ball.phase !== "airborne" || !ball.flight) continue;
    const landT = ball.flight.startTimeS + ball.flight.tofS;
    if (landT <= t) {
      tryCatch(ctx, ball, landT, bp, cfg, motion);
    }
  }
}

function processCatching(ctx: SimContext, t: number, cfg: PhysicsConfig, motion: HandMotionConfig): void {
  for (const ball of ctx.balls) {
    if (ball.phase !== "catching") continue;
    if (ball.catchDeadlineS >= 0 && t >= ball.catchDeadlineS) {
      dropBall(ctx, ball, "Missed catch", t, cfg, motion);
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

function processDropping(ctx: SimContext, t: number, cfg: PhysicsConfig): void {
  const floorY = cfg.ballRadiusM;
  for (const ball of ctx.balls) {
    if (ball.phase !== "dropping" || ball.dropStartS < 0) continue;
    const elapsed = t - ball.dropStartS;
    const y = ball.dropY - 0.5 * cfg.g * elapsed * elapsed;
    if (y <= floorY) {
      ball.dropY = floorY;
      if (!ball.hitGround) {
        ball.hitGround = true;
        if (!ctx.error) {
          ctx.error = ball.dropReason ?? "Ball hit the ground";
        }
      }
    }
  }
}

function releaseBall(
  ctx: SimContext,
  ballId: number,
  throwValue: number,
  beat: number,
  throwIndex: number,
  bt: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): void {
  const ball = ctx.balls[ballId];
  ball.label = throwValue;
  ball.throwBeat = beat;
  ball.throwIndex = throwIndex;

  const d = customDwellForThrow(ctx.runtime, ctx.dwell, throwValue);
  const airBeats = airTimeBeats(throwValue, ctx.dwell);
  if (airBeats <= 0) {
    ball.phase = "dwell";
    ball.dwellEndS = bt + d * cfg.beatPeriodS;
    if (!ctx.stacks[ball.holdingHand === "left" ? "left" : "right"].includes(ballId)) {
      pushBall(ctx.stacks, ball.holdingHand, ballId);
    }
    return;
  }
  removeFromStack(ctx.stacks, ball.holdingHand, ballId);
  ball.flight = makeFlight(ctx, throwValue, ball.holdingHand, bt, throwIndex, cfg, motion);
  ball.phase = "airborne";
}

function checkZeroBeatHold(
  ctx: SimContext,
  hand: HandId,
  beat: number,
  t: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): void {
  const stackLen = hand === "left" ? ctx.stacks.left.length : ctx.stacks.right.length;
  const holding = ctx.balls.some(
    (b) =>
      b.phase !== "airborne" &&
      b.phase !== "dropping" &&
      (b.holdingHand === hand || b.catchingHand === hand),
  );
  if (stackLen > 0 || holding) {
    dropHeldOnHand(ctx, hand, `Hand holds a ball on 0-throw beat ${beat}`, t, cfg, motion);
  }
}

function attemptThrowAtBeat(
  ctx: SimContext,
  b: number,
  hand: HandId,
  st: { height: number },
  throwIndex: number,
  t: number,
  bp: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  thrownThisBeat: Set<string>,
): void {
  const key = `${hand}:${b}`;
  if (thrownThisBeat.has(key)) return;

  const releaseT = releaseTimeS(ctx, hand, b, bp);
  if (releaseT > t + 1e-9) return;

  const beatEnd = (b + 1) * bp;
  processLandings(ctx, Math.min(t, beatEnd), bp, cfg, motion);
  processCatching(ctx, Math.min(t, beatEnd), cfg, motion);

  const incoming = hasIncomingAirborneToHand(ctx, hand, releaseT - 1e-9, beatEnd);
  let ballId = popForThrow(ctx, hand, b);

  if (ballId === null) {
    if (incoming) return;
    const maxBalls = Math.round(ballCountFromParsed(ctx.runtime.parsed));
    if (ctx.balls.filter((b) => b.phase !== "dropping").length >= maxBalls) return;
    ballId = createBall(ctx, hand);
  }

  thrownThisBeat.add(key);
  releaseBall(ctx, ballId, st.height, b, throwIndex, releaseT, cfg, motion);
}

function freshContext(
  runtime: CustomPatternRuntime,
  dwell: number,
  handSchedules?: HandMotionSchedules | null,
): SimContext {
  return {
    runtime,
    balls: [],
    stacks: { left: [], right: [] },
    dwell,
    error: null,
    nextBallId: 0,
    handSchedules,
  };
}

function releaseTimeS(
  ctx: SimContext,
  hand: HandId,
  beat: number,
  bp: number,
): number {
  const hiHand = customShowerHighHand(ctx.runtime);
  if (hiHand) {
    const showerDef = asShowerPatternDefinition(ctx.runtime.parsed);
    return showerThrowReleaseTimeS(
      showerDef,
      hiHand,
      hand,
      beat,
      bp,
      ctx.dwell,
      showerPeriodBeats(ctx.runtime),
    );
  }
  return beat * bp;
}

export function computeCustomPatternAt(
  t: number,
  params: CustomPatternSimulatorParams,
): CustomPatternSimResult {
  const { physics: cfg, motion, runtime, dwellBeats, handSchedules } = params;
  const dwell = Math.min(Math.max(0, dwellBeats), 13);
  const ctx = freshContext(runtime, dwell, handSchedules);

  if (t <= 0) {
    return { balls: [], error: null };
  }

  const bp = cfg.beatPeriodS;
  const maxBeat = Math.ceil(t / bp) + 2;
  const startBeat = siteswapStartBeat(runtime);
  const thrownThisBeat = new Set<string>();

  for (let b = 0; b <= maxBeat; b++) {
    const beatStart = b * bp;
    const beatEnd = (b + 1) * bp;
    const processTo = Math.min(t, beatEnd);

    processLandings(ctx, processTo, bp, cfg, motion);
    processCatching(ctx, processTo, cfg, motion);
    processDwell(ctx, processTo);
    processDropping(ctx, processTo, cfg);

    if (beatStart > t) break;

    const hand = scheduledHandAtBeat(runtime.startHand, b);
    if (hand && throwBeatForHand(hand, b) && b >= startBeat) {
      const st = scheduledThrowAtBeat(runtime, b);
      if (st) {
        if (st.height === 0) {
          if (processTo >= beatEnd - 1e-9) {
            checkZeroBeatHold(ctx, hand, b, processTo, cfg, motion);
          }
        } else {
          attemptThrowAtBeat(
            ctx,
            b,
            hand,
            st,
            throwIndexAtBeat(runtime, b),
            t,
            bp,
            cfg,
            motion,
            thrownThisBeat,
          );
        }
      }
    }

    if (beatEnd > t) break;
  }

  processLandings(ctx, t, bp, cfg, motion);
  processCatching(ctx, t, cfg, motion);
  processDwell(ctx, t);

  for (let b = startBeat; b <= maxBeat; b++) {
    const hand = scheduledHandAtBeat(runtime.startHand, b);
    if (!hand || !throwBeatForHand(hand, b)) continue;
    const st = scheduledThrowAtBeat(runtime, b);
    if (!st || st.height === 0) continue;
    const releaseT = releaseTimeS(ctx, hand, b, bp);
    if (releaseT > t + 1e-9) continue;
    attemptThrowAtBeat(
      ctx,
      b,
      hand,
      st,
      throwIndexAtBeat(runtime, b),
      t,
      bp,
      cfg,
      motion,
      thrownThisBeat,
    );
  }

  processDropping(ctx, t, cfg);

  const balls = ctx.balls.map((ball) => {
    if (ball.phase === "dropping" && ball.dropStartS >= 0) {
      const elapsed = t - ball.dropStartS;
      const y = ball.dropY - 0.5 * cfg.g * elapsed * elapsed;
      const floorY = cfg.ballRadiusM;
      return {
        id: ball.id,
        phase: ball.phase,
        x: ball.dropX,
        y: Math.max(floorY, y),
        visible: true,
        label: ball.label,
        holdingHand: ball.holdingHand,
      };
    }
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
    if (ball.phase === "inHand" || ball.phase === "dwell") {
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
    }
    return {
      id: ball.id,
      phase: ball.phase,
      x: 0,
      y: 0,
      visible: false,
      label: ball.label,
      holdingHand: ball.holdingHand,
    };
  });

  return { balls, error: ctx.error };
}
