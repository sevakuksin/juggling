import type { HandId, PhysicsConfig } from "../physics/config";
import { leftX, rightX } from "../physics/config";
import type { HandMotionConfig } from "../physics/config";
import { ellipsePoints, handPosition, handXyInside, handXyOutside } from "../physics/hands";
import { trajectoryPoints, positionAt, type ProjectileThrow } from "../physics/projectile";
import type { BallSnapshot } from "../physics/ballSimulator";
import {
  applyTransform,
  drawGrid,
  drawHeightScale,
  makeTransform,
  toScreen,
  type StageBounds,
  type ViewTransform,
} from "./canvasStage";

export const COLORS = {
  ball: "#e8564a",
  ballEdge: "#b83a32",
  traj: "#5b7fa5",
  handLeft: "#2f80ed",
  handRight: "#27ae60",
  handEdge: "#1a2332",
  ellipse: "#c5ced9",
  throwZone: "#2a9d8f",
  catchZone: "#f4a261",
};

function drawHand(
  ctx: CanvasRenderingContext2D,
  tx: ViewTransform,
  x: number,
  y: number,
  hand: HandId,
): void {
  const [sx, sy] = toScreen(tx, x, y);
  const color = hand === "left" ? COLORS.handLeft : COLORS.handRight;
  const w = 0.14 * tx.scale;
  const h = 0.052 * tx.scale;
  ctx.fillStyle = color;
  ctx.strokeStyle = COLORS.handEdge;
  ctx.lineWidth = 1;
  roundRect(ctx, sx - w / 2, sy - h / 2, w, h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.max(10, 0.11 * tx.scale)}px system-ui`;
  ctx.textAlign = "center";
  ctx.fillText(hand === "left" ? "L" : "R", sx, sy + 0.07 * tx.scale);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  tx: ViewTransform,
  x: number,
  y: number,
  radius: number,
  label?: number | string,
): void {
  const [sx, sy] = toScreen(tx, x, y);
  const r = radius * tx.scale;

  // Ground shadow (circular)
  ctx.save();
  ctx.fillStyle = "rgba(26, 35, 50, 0.1)";
  ctx.beginPath();
  ctx.arc(sx + 1, sy + r * 0.15 + 2, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const grad = ctx.createRadialGradient(
    sx - r * 0.32,
    sy - r * 0.34,
    r * 0.05,
    sx,
    sy,
    r,
  );
  grad.addColorStop(0, "#ff9a8b");
  grad.addColorStop(0.4, COLORS.ball);
  grad.addColorStop(1, "#922b21");

  ctx.fillStyle = grad;
  ctx.strokeStyle = COLORS.ballEdge;
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Circular highlight
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.beginPath();
  ctx.arc(sx - r * 0.28, sy - r * 0.3, r * 0.22, 0, Math.PI * 2);
  ctx.fill();

  if (label !== undefined && label !== "") {
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(8, r * 0.85)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(label), sx, sy);
  }
}

function drawTrajectory(
  ctx: CanvasRenderingContext2D,
  tx: ViewTransform,
  pts: [number, number][],
  alpha = 0.65,
): void {
  if (pts.length < 2) return;
  ctx.strokeStyle = COLORS.traj;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  const [x0, y0] = toScreen(tx, pts[0][0], pts[0][1]);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = toScreen(tx, pts[i][0], pts[i][1]);
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function drawEllipses(
  ctx: CanvasRenderingContext2D,
  tx: ViewTransform,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): void {
  ctx.strokeStyle = COLORS.ellipse;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  for (const hand of ["left", "right"] as HandId[]) {
    const pts = ellipsePoints(hand, cfg, motion);
    ctx.beginPath();
    const [x0, y0] = toScreen(tx, pts[0][0], pts[0][1]);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < pts.length; i++) {
      const [x, y] = toScreen(tx, pts[i][0], pts[i][1]);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawZones(
  ctx: CanvasRenderingContext2D,
  tx: ViewTransform,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): void {
  for (const hand of ["left", "right"] as HandId[]) {
    const [ti, yi] = handXyInside(hand, cfg, motion);
    const [sx, sy] = toScreen(tx, ti, yi);
    ctx.fillStyle = COLORS.throwZone;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
    const [to, yo] = handXyOutside(hand, cfg, motion);
    const [ox, oy] = toScreen(tx, to, yo);
    ctx.fillStyle = COLORS.catchZone;
    ctx.fillRect(ox - 4, oy - 4, 8, 8);
    ctx.globalAlpha = 1;
  }
}

export function drawVerticalScene(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  bounds: StageBounds,
  throw_: ProjectileThrow,
  t: number,
): ViewTransform {
  const tx = makeTransform(canvas, bounds);
  applyTransform(ctx, tx);
  drawHeightScale(ctx, tx, bounds);
  drawGrid(ctx, tx, bounds);
  drawTrajectory(ctx, tx, trajectoryPoints(throw_));
  const [bx, by] = positionAt(throw_, Math.min(t, throw_.tofS));
  drawBall(ctx, tx, bx, by, 0.045);
  return tx;
}

export function drawTwoHandScene(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  bounds: StageBounds,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  t: number,
  ball: BallSnapshot,
): ViewTransform {
  const tx = makeTransform(canvas, bounds, { paddingBottom: 24 });
  applyTransform(ctx, tx);
  drawHeightScale(ctx, tx, bounds);
  drawGrid(ctx, tx, bounds);
  drawEllipses(ctx, tx, cfg, motion);
  drawZones(ctx, tx, cfg, motion);

  if (ball.flight) {
    drawTrajectory(ctx, tx, trajectoryPoints(ball.flight), 0.55);
  }

  const left = handPosition("left", t, cfg, motion);
  const right = handPosition("right", t, cfg, motion);
  drawHand(ctx, tx, left.x, left.y, "left");
  drawHand(ctx, tx, right.x, right.y, "right");

  if (ball.visible) {
    drawBall(ctx, tx, ball.x, ball.y, cfg.ballRadiusM, ball.label);
  }

  return tx;
}

export { leftX, rightX };
