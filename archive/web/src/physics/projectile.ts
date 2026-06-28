import type { PhysicsConfig } from "./config";

export interface ProjectileThrow {
  startXy: [number, number];
  endXy: [number, number];
  tofS: number;
  massKg: number;
  g: number;
  startTimeS: number;
  label: string;
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

export function makeSiteswapThrow(
  throwValue: number,
  startHand: "left" | "right",
  cfg: PhysicsConfig,
  motion: { inside: (h: "left" | "right") => [number, number]; outside: (h: "left" | "right") => [number, number] },
  startBeat = 0,
): ProjectileThrow {
  const endHand =
    throwValue % 2 === 1
      ? startHand === "left"
        ? "right"
        : "left"
      : startHand;
  const tofS = throwValue * cfg.beatPeriodS;
  const startTimeS = startBeat * cfg.beatPeriodS;
  return {
    startXy: motion.inside(startHand),
    endXy: motion.outside(endHand),
    tofS,
    massKg: cfg.massKg,
    g: cfg.g,
    startTimeS,
    label: String(throwValue),
  };
}
