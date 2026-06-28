export interface PhysicsConfig {
  massKg: number;
  g: number;
  beatPeriodS: number;
  handSeparationM: number;
  handHeightM: number;
  ballRadiusM: number;
}

export interface HandMotionConfig {
  rxM: number;
  ryM: number;
}

export const DEFAULT_PHYSICS: PhysicsConfig = {
  massKg: 0.1,
  g: 9.81,
  beatPeriodS: 0.5,
  handSeparationM: 0.8,
  handHeightM: 1.05,
  ballRadiusM: 0.045,
};

export const DEFAULT_HAND_MOTION: HandMotionConfig = {
  rxM: 0.1,
  ryM: 0.06,
};

export function leftX(cfg: PhysicsConfig): number {
  return -cfg.handSeparationM / 2;
}

export function rightX(cfg: PhysicsConfig): number {
  return cfg.handSeparationM / 2;
}

export type HandId = "left" | "right";

export function oppositeHand(h: HandId): HandId {
  return h === "left" ? "right" : "left";
}

export function landingHand(start: HandId, throwValue: number): HandId {
  return throwValue % 2 === 1 ? oppositeHand(start) : start;
}
