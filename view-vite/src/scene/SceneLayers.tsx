import type { HandId, PhysicsConfig } from "@/physics/config";
import type { HandMotionConfig } from "@/physics/config";
import { ellipsePoints, handPosition, handXyInside, handXyOutside } from "@/physics/hands";
import { pointsToSvgPath, trajectoryPoints, type ProjectileThrow } from "@/physics/projectile";
import { HandSprite } from "@/sprites/HandSprite";
import { BallSprite } from "@/sprites/BallSprite";

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

export function HeightScale({ yMax, x }: { yMax: number; x: number }) {
  const ticks: number[] = [];
  const step = yMax > 2.5 ? 0.5 : 0.25;
  for (let y = 0; y <= yMax + 0.01; y += step) ticks.push(Math.round(y * 100) / 100);

  return (
    <g className="height-scale">
      {ticks.map((y) => (
        <line key={y} x1={x} y1={y} x2={x + 0.06} y2={y} className="height-scale-tick" />
      ))}
    </g>
  );
}

export function TrajectoryPath({ flight, opacity = 0.7 }: { flight: ProjectileThrow; opacity?: number }) {
  if (flight.tofS <= 0) return null;
  const d = pointsToSvgPath(trajectoryPoints(flight));
  if (!d) return null;
  return <path className="scene-trajectory" d={d} opacity={opacity} fill="none" />;
}

export function HandEllipses({
  cfg,
  motion,
}: {
  cfg: PhysicsConfig;
  motion: HandMotionConfig;
}) {
  const left = pointsToSvgPath(ellipsePoints("left", cfg, motion));
  const right = pointsToSvgPath(ellipsePoints("right", cfg, motion));
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
        return (
          <g key={hand}>
            <circle cx={ti} cy={yi} r={0.025} className="zone-throw" />
            <rect
              x={to - 0.025}
              y={yo - 0.025}
              width={0.05}
              height={0.05}
              className="zone-catch"
            />
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
  showLeft?: boolean;
  showRight?: boolean;
}

export function AnimatedHands({
  t,
  cfg,
  motion,
  showLeft = true,
  showRight = true,
}: AnimatedHandsProps) {
  const left = handPosition("left", t, cfg, motion);
  const right = handPosition("right", t, cfg, motion);
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
