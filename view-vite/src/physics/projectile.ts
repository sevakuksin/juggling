import type { PhysicsConfig } from "./config";

export interface ProjectileThrow {
  startXy: [number, number];
  endXy: [number, number];
  tofS: number;
  massKg: number;
  g: number;
  startTimeS: number;
  label: string;
  /** Geometric landing point; immediate catch when hand probe differs from functional default. */
  landsGeometricInside?: boolean;
}

export function kineticEnergy(massKg: number, vx: number, vy: number): number {
  return 0.5 * massKg * (vx * vx + vy * vy);
}

export function vx0(th: ProjectileThrow): number {
  return (th.endXy[0] - th.startXy[0]) / th.tofS;
}

export function vy0(th: ProjectileThrow): number {
  const [, y0] = th.startXy;
  const [, y1] = th.endXy;
  return (y1 - y0 + 0.5 * th.g * th.tofS ** 2) / th.tofS;
}

export function speed0(th: ProjectileThrow): number {
  return Math.hypot(vx0(th), vy0(th));
}

export function energyJ(th: ProjectileThrow): number {
  return kineticEnergy(th.massKg, vx0(th), vy0(th));
}

export function apexHeightM(th: ProjectileThrow): number {
  const vy = vy0(th);
  const t = vy / th.g;
  const [, y0] = th.startXy;
  return y0 + vy * t - 0.5 * th.g * t * t;
}

export function endTimeS(th: ProjectileThrow): number {
  return th.startTimeS + th.tofS;
}

export function positionAt(th: ProjectileThrow, tAbs: number): [number, number] {
  if (tAbs <= th.startTimeS) return th.startXy;
  if (tAbs >= endTimeS(th)) return th.endXy;
  const tau = tAbs - th.startTimeS;
  const [x0, y0] = th.startXy;
  const vx = vx0(th);
  const vy = vy0(th);
  return [x0 + vx * tau, y0 + vy * tau - 0.5 * th.g * tau * tau];
}

export function trajectoryPoints(th: ProjectileThrow, n = 120): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = th.startTimeS + (i / n) * th.tofS;
    pts.push(positionAt(th, t));
  }
  return pts;
}

export function makeVerticalThrow(
  tofS: number,
  cfg: PhysicsConfig,
  tAbs = 0,
): ProjectileThrow {
  return {
    startXy: [0, cfg.handHeightM],
    endXy: [0, cfg.handHeightM],
    tofS,
    massKg: cfg.massKg,
    g: cfg.g,
    startTimeS: tAbs,
    label: "",
  };
}

export function pointsToSvgPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  const [x0, y0] = points[0];
  let d = `M ${x0} ${y0}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0]} ${points[i][1]}`;
  }
  return d;
}

/** Time fractions along the arc where the ball is at targetY (0–2: up and down legs). */
export function flightTimeFracsAtHeight(th: ProjectileThrow, targetY: number): number[] {
  const [, y0] = th.startXy;
  const vy = vy0(th);
  const disc = vy * vy - 2 * th.g * (targetY - y0);
  if (disc <= 1e-9) return [];
  const sqrt = Math.sqrt(disc);
  const fracs: number[] = [];
  for (const tau of [(vy - sqrt) / th.g, (vy + sqrt) / th.g]) {
    if (tau > th.tofS * 0.02 && tau < th.tofS * 0.98) {
      fracs.push(tau / th.tofS);
    }
  }
  return fracs.sort((a, b) => a - b);
}

/** Shared arrow height for multiple throws (lower portion of the arc). */
export function sharedTrajectoryArrowHeight(
  flights: ProjectileThrow[],
  handHeightM: number,
  fraction = 0.32,
): number {
  if (flights.length === 0) return handHeightM + 0.12;
  const minApex = Math.min(...flights.map(apexHeightM));
  const rise = Math.max(minApex - handHeightM, 0.05);
  return handHeightM + rise * fraction;
}

/** Chevron arrow aligned with flight direction at a fraction along the arc. */
export function trajectoryArrowD(
  th: ProjectileThrow,
  tFrac: number,
  sizeM = 0.045,
): string {
  const tau = tFrac * th.tofS;
  const t = th.startTimeS + tau;
  const [x, y] = positionAt(th, t);
  const vx = vx0(th);
  const vy = vy0(th) - th.g * tau;
  const len = Math.hypot(vx, vy) || 1;
  const ux = vx / len;
  const uy = vy / len;
  const wing = sizeM * 0.42;
  const px = -uy;
  const py = ux;
  const bx = x - ux * sizeM;
  const by = y - uy * sizeM;
  const x1 = bx + px * wing;
  const y1 = by + py * wing;
  const x2 = bx - px * wing;
  const y2 = by - py * wing;
  return `M ${x1} ${y1} L ${x} ${y} L ${x2} ${y2}`;
}
