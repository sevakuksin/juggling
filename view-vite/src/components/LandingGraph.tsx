import type { SiteswapReport } from "@/physics/siteswap";
import { landingCollisions, missingLandingTargets } from "@/physics/siteswap";

interface LandingGraphProps {
  report: SiteswapReport;
  size?: number;
}

export function LandingGraph({ report, size = 240 }: LandingGraphProps) {
  const { values, valid, period } = report;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.34;
  const p = period;

  const collisions = landingCollisions(values);
  const collisionTargets = new Set(collisions.keys());
  const missing = new Set(missingLandingTargets(values));
  const residues = values.map((v, i) => (i + v) % p);

  const nodeAngle = (i: number) => (i / p) * 2 * Math.PI - Math.PI / 2;
  const nodeX = (i: number) => cx + r * Math.cos(nodeAngle(i));
  const nodeY = (i: number) => cy + r * Math.sin(nodeAngle(i));

  return (
    <svg
      className="landing-graph"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label="Siteswap landing graph"
    >
      {values.map((v, i) => {
        const target = residues[i];
        const x0 = nodeX(i);
        const y0 = nodeY(i);
        const x1 = nodeX(target);
        const y1 = nodeY(target);
        const isCollision =
          collisionTargets.has(target) && (collisions.get(target)?.length ?? 0) > 1;
        const stroke = isCollision ? "#e8564a" : valid ? "#27ae60" : "#5b7fa5";
        const ang = Math.atan2(y1 - y0, x1 - x0);
        const ax = x1 - 8 * Math.cos(ang - 0.4);
        const ay = y1 - 8 * Math.sin(ang - 0.4);
        const bx = x1 - 8 * Math.cos(ang + 0.4);
        const by = y1 - 8 * Math.sin(ang + 0.4);

        return (
          <g key={`edge-${i}`}>
            <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={stroke} strokeWidth={isCollision ? 2 : 1.5} />
            <polygon points={`${x1},${y1} ${ax},${ay} ${bx},${by}`} fill={stroke} />
          </g>
        );
      })}
      {Array.from({ length: p }, (_, i) => {
        const x = nodeX(i);
        const y = nodeY(i);
        const isMissing = missing.has(i);
        const isTargetCollision = collisionTargets.has(i);
        const fill = isTargetCollision ? "#e8564a" : isMissing ? "#f4a261" : valid ? "#27ae60" : "#5b7fa5";
        return (
          <g key={`node-${i}`}>
            <circle cx={x} cy={y} r={14} fill={fill} opacity={0.9} />
            <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={11} fontWeight={700}>
              {i}
            </text>
            <text x={x} y={y + 22} textAnchor="middle" fill="#5c6570" fontSize={10}>
              {values[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
