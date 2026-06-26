import { DemoLayout } from "@/components/DemoLayout";
import { SvgStage } from "@/scene/SvgStage";
import { AnimatedHands, GroundLine, SceneBall } from "@/scene/SceneLayers";
import { DEFAULT_PHYSICS, DEFAULT_HAND_MOTION } from "@/physics/config";
import { twoHandBounds } from "@/physics/throwBounds";
import { BALL_DISPLAY_RADIUS } from "@/sprites/BallSprite";

export function PatternScene() {
  const bounds = twoHandBounds(0.8, 0.1, 2.2, DEFAULT_PHYSICS.handHeightM);

  return (
    <DemoLayout
      animation={
        <SvgStage bounds={bounds}>
          <GroundLine bounds={bounds} />
          <AnimatedHands t={0} cfg={DEFAULT_PHYSICS} motion={DEFAULT_HAND_MOTION} />
          <SceneBall x={-0.15} y={1.15} radius={BALL_DISPLAY_RADIUS} className="ball--a" label={3} />
          <SceneBall x={0.15} y={1.25} radius={BALL_DISPLAY_RADIUS} className="ball--b" label={3} />
          <SceneBall x={0} y={1.55} radius={BALL_DISPLAY_RADIUS} className="ball--c" label={3} />
        </SvgStage>
      }
      controls={
        <div className="placeholder-card">
          <h3>Pattern juggling</h3>
          <p className="placeholder-sub">
            Coming soon — multi-ball simulation built on the two-hand engine.
          </p>
          <label className="control-label disabled">
            Pattern
            <input type="text" value="333" disabled placeholder="e.g. 531" />
          </label>
          <p className="hint">
            Three sample balls show CSS color variants. Full pattern scheduling will animate each ball
            along its parabolic path.
          </p>
        </div>
      }
    />
  );
}
