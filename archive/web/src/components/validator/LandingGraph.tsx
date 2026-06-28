import { useRef, useEffect } from "react";
import type { SiteswapReport } from "../../physics/siteswap";
import { landingCollisions, missingLandingTargets } from "../../physics/siteswap";

interface LandingGraphProps {
  report: SiteswapReport;
  size?: number;
}

export function LandingGraph({ report, size = 220 }: LandingGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { values, valid, period, averageBallCount } = report;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = devicePixelRatio;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.34;
    const p = period;

    const collisions = landingCollisions(values);
    const collisionTargets = new Set(collisions.keys());
    const missing = new Set(missingLandingTargets(values));
    const residues = values.map((v, i) => (i + v) % p);

    for (let i = 0; i < p; i++) {
      const target = residues[i];
      const a0 = (i / p) * 2 * Math.PI - Math.PI / 2;
      const a1 = (target / p) * 2 * Math.PI - Math.PI / 2;
      const x0 = cx + r * Math.cos(a0);
      const y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);

      const isCollision = collisionTargets.has(target) && (collisions.get(target)?.length ?? 0) > 1;
      ctx.strokeStyle = isCollision ? "#e8564a" : valid ? "#27ae60" : "#5b7fa5";
      ctx.lineWidth = isCollision ? 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      const ang = Math.atan2(y1 - y0, x1 - x0);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - 8 * Math.cos(ang - 0.4), y1 - 8 * Math.sin(ang - 0.4));
      ctx.lineTo(x1 - 8 * Math.cos(ang + 0.4), y1 - 8 * Math.sin(ang + 0.4));
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }

    for (let i = 0; i < p; i++) {
      const a = (i / p) * 2 * Math.PI - Math.PI / 2;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      const isMissing = missing.has(i);
      ctx.fillStyle = isMissing ? "#f6f7f9" : "#fff";
      ctx.strokeStyle = isMissing ? "#e8564a" : "#4a5568";
      ctx.lineWidth = isMissing ? 2 : 1.5;
      ctx.setLineDash(isMissing ? [3, 3] : []);
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#1a2332";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i), x, y);
      ctx.font = "9px system-ui";
      ctx.fillStyle = "#5c6570";
      ctx.fillText(String(values[i]), x, y + 18);
    }

    ctx.fillStyle = "#1a2332";
    ctx.font = "bold 13px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const ballLabel = Number.isInteger(averageBallCount)
      ? `${averageBallCount} balls`
      : `${averageBallCount.toFixed(2)} ✗`;
    ctx.fillText(ballLabel, cx, cy - 6);
    ctx.font = "10px system-ui";
    ctx.fillStyle = valid ? "#27ae60" : "#e8564a";
    ctx.fillText(valid ? "valid" : "invalid", cx, cy + 10);
  }, [report, size, values, valid, period, averageBallCount]);

  return (
    <canvas
      ref={canvasRef}
      className="landing-graph"
      style={{ width: size, height: size }}
      aria-label="Siteswap landing graph"
    />
  );
}
