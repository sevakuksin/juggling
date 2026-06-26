import type { HandId, PhysicsConfig } from "@/physics/config";
import type { HandMotionConfig } from "@/physics/config";
import { lenM } from "@/physics/sceneScale";
import { ellipseLowerHalfPath, handPosition, handXyInside, handXyOutside, type HandMotionSchedules } from "@/physics/hands";
import {
  flightTimeFracsAtHeight,
  pointsToSvgPath,
  sharedTrajectoryArrowHeight,
  trajectoryArrowD,
  trajectoryPoints,
  type ProjectileThrow,
} from "@/physics/projectile";
import { HandSprite } from "@/sprites/HandSprite";
import { BallSprite } from "@/sprites/BallSprite";

export { HeightScale, MeterScale } from "@/scene/MeterScale";

interface GroundProps {
  bounds: { xMin: number; xMax: number; yMin: number };
}

export function GroundLine({ bounds }: GroundProps) {
  return (
    <line
      className="scene-ground"
      x1={bounds.xMin}
      y1={bounds.yMin}
      x2={bounds.xMax}
      y2={bounds.yMin}
    />
  );
}

export function TrajectoryPath({
  flight,
  opacity = 0.28,
  arrows = false,
  arrowFracs,
  arrowHeight,
}: {
  flight: ProjectileThrow;
  opacity?: number;
  arrows?: boolean;
  arrowFracs?: number[];
  /** Place arrows where the arc crosses this height (ascending + descending). */
  arrowHeight?: number;
}) {
  if (flight.tofS <= 0) return null;
  const d = pointsToSvgPath(trajectoryPoints(flight));
  if (!d) return null;
  const fracs =
    arrows && arrowHeight != null
      ? flightTimeFracsAtHeight(flight, arrowHeight)
      : arrows
        ? (arrowFracs ?? [])
        : [];
  return (
    <g className="trajectory-group">
      <path className="scene-trajectory" d={d} opacity={opacity} fill="none" />
      {fracs.map((f, i) => {
        const ad = trajectoryArrowD(flight, f);
        return (
          <path
            key={i}
            className="trajectory-arrow"
            d={ad}
            opacity={Math.min(1, opacity + 0.22)}
            fill="none"
          />
        );
      })}
    </g>
  );
}

export function ThrowTrajectoryGuides({
  left,
  right,
  handHeightM,
  opacity = 0.28,
}: {
  left: ProjectileThrow | null;
  right: ProjectileThrow | null;
  handHeightM: number;
  opacity?: number;
}) {
  const flights = [left, right].filter((f): f is ProjectileThrow => f != null);
  if (flights.length === 0) return null;
  const arrowHeight = sharedTrajectoryArrowHeight(flights, handHeightM);
  return (
    <>
      {left && <TrajectoryPath flight={left} opacity={opacity} arrows arrowHeight={arrowHeight} />}
      {right && <TrajectoryPath flight={right} opacity={opacity} arrows arrowHeight={arrowHeight} />}
    </>
  );
}

export function HandEllipses({
  cfg,
  motion,
  schedules,
}: {
  cfg: PhysicsConfig;
  motion: HandMotionConfig;
  schedules?: HandMotionSchedules | null;
}) {
  const left = ellipseLowerHalfPath("left", cfg, motion, schedules);
  const right = ellipseLowerHalfPath("right", cfg, motion, schedules);
  return (
    <g className="hand-ellipses">
      <path d={left} fill="none" className="ellipse-guide" />
      <path d={right} fill="none" className="ellipse-guide" />
    </g>
  );
}

export function ThrowCatchZones({
  cfg,
  motion,
}: {
  cfg: PhysicsConfig;
  motion: HandMotionConfig;
}) {
  const hands: HandId[] = ["left", "right"];
  return (
    <g className="throw-catch-zones">
      {hands.map((hand) => {
        const [ti, yi] = handXyInside(hand, cfg, motion);
        const [to, yo] = handXyOutside(hand, cfg, motion);
        const r = lenM(0.32);
        const s = lenM(0.64);
        return (
          <g key={hand}>
            <circle cx={ti} cy={yi} r={r} className="zone-throw" />
            <rect x={to - r} y={yo - r} width={s} height={s} className="zone-catch" />
          </g>
        );
      })}
    </g>
  );
}

interface AnimatedHandsProps {
  t: number;
  cfg: PhysicsConfig;
  motion: HandMotionConfig;
  schedules?: HandMotionSchedules | null;
  showLeft?: boolean;
  showRight?: boolean;
}

export function AnimatedHands({
  t,
  cfg,
  motion,
  schedules,
  showLeft = true,
  showRight = true,
}: AnimatedHandsProps) {
  const left = handPosition("left", t, cfg, motion, schedules);
  const right = handPosition("right", t, cfg, motion, schedules);
  return (
    <>
      {showLeft && <HandSprite hand="left" x={left.x} y={left.y} />}
      {showRight && <HandSprite hand="right" x={right.x} y={right.y} />}
    </>
  );
}

interface SceneBallProps {
  x: number;
  y: number;
  radius: number;
  label?: number | string;
  className?: string;
}

export function SceneBall({ x, y, radius, label, className }: SceneBallProps) {
  return (
    <BallSprite
      x={x}
      y={y}
      radius={radius}
      label={label}
      className={className}
    />
  );
}
