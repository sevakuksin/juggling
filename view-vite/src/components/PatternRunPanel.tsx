import { useMemo, useState } from "react";
import { DemoLayout } from "@/components/DemoLayout";
import { FreeTimeControls } from "@/components/TimeControls";
import { useFreeAnimationClock } from "@/hooks/useAnimationClock";
import type { HandId } from "@/physics/config";
import { DEFAULT_PHYSICS, DEFAULT_HAND_MOTION } from "@/physics/config";
import { buildHandSchedules } from "@/physics/hands";
import { computePatternAt } from "@/physics/patternBallSimulator";
import type { PatternDefinition } from "@/physics/patternCatalog";
import { maxThrowInPattern } from "@/physics/patternCatalog";
import { twoHandBounds } from "@/physics/throwBounds";
import {
  clampDwell,
  SCRUB_WINDOW_S,
  stageYMaxM,
} from "@/physics/twoHandThrowConfig";
import { SvgStage } from "@/scene/SvgStage";
import {
  AnimatedHands,
  GroundLine,
  HandEllipses,
  SceneBall,
  ThrowCatchZones,
} from "@/scene/SceneLayers";
import { BALL_DISPLAY_RADIUS } from "@/sprites/BallSprite";

const BALL_CLASSES = ["ball--a", "ball--b", "ball--c"];

export interface PatternRunSettings {
  startHand: HandId;
  dwellBeats: number;
  beatPeriod: number;
  handSep: number;
  heightZoom: number;
}

interface PatternRunPanelProps {
  pattern: PatternDefinition;
  settings: PatternRunSettings;
}

export function PatternRunPanel({
  pattern,
  settings,
}: PatternRunPanelProps) {
  const { startHand, dwellBeats, beatPeriod, handSep, heightZoom } = settings;
  const [windowOffset, setWindowOffset] = useState(0);

  const maxThrow = maxThrowInPattern(pattern);
  const dwell = clampDwell(dwellBeats, maxThrow);

  const physics = useMemo(
    () => ({ ...DEFAULT_PHYSICS, beatPeriodS: beatPeriod, handSeparationM: handSep }),
    [beatPeriod, handSep],
  );

  const handSchedules = useMemo(
    () => buildHandSchedules(maxThrow, dwell, physics),
    [maxThrow, dwell, physics],
  );

  const params = useMemo(
    () => ({
      physics,
      motion: DEFAULT_HAND_MOTION,
      pattern,
      startHand,
      dwellBeats: dwell,
      handSchedules,
    }),
    [physics, pattern, startHand, dwell, handSchedules],
  );

  const clock = useFreeAnimationClock(0);
  const displayT = clock.simTime;
  const balls = useMemo(() => computePatternAt(displayT, params), [displayT, params]);

  const bounds = useMemo(() => {
    const yMax = stageYMaxM(heightZoom);
    return twoHandBounds(handSep, DEFAULT_HAND_MOTION.rxM, yMax, physics.handHeightM);
  }, [handSep, heightZoom, physics.handHeightM]);

  const beat = displayT / beatPeriod;

  return (
    <div className="pattern-run-block">
      <DemoLayout
        animation={
          <SvgStage bounds={bounds}>
            <GroundLine bounds={bounds} />
            <HandEllipses cfg={physics} motion={DEFAULT_HAND_MOTION} schedules={handSchedules} />
            <ThrowCatchZones cfg={physics} motion={DEFAULT_HAND_MOTION} />
            <AnimatedHands
              t={displayT}
              cfg={physics}
              motion={DEFAULT_HAND_MOTION}
              schedules={handSchedules}
            />
            {balls.map((ball) =>
              ball.visible ? (
                <SceneBall
                  key={ball.id}
                  x={ball.x}
                  y={ball.y}
                  radius={BALL_DISPLAY_RADIUS}
                  label={ball.phase === "airborne" ? ball.label : undefined}
                  className={BALL_CLASSES[ball.id % BALL_CLASSES.length]}
                />
              ) : null,
            )}
          </SvgStage>
        }
        legend={
          <span className="svg-legend-meta">
            t {displayT.toFixed(2)} s · beat {beat.toFixed(2)} · {pattern.label} ({pattern.siteswap})
          </span>
        }
        controls={
          <FreeTimeControls
            simTime={clock.simTime}
            windowS={SCRUB_WINDOW_S}
            playing={clock.playing}
            speed={clock.speed}
            onTogglePlay={clock.togglePlay}
            windowOffset={windowOffset}
            onWindowOffsetChange={setWindowOffset}
            onScrub={(localT) => clock.setSimTime(windowOffset + localT)}
            onSpeedChange={clock.setSpeed}
          />
        }
      />
    </div>
  );
}
