import { useMemo, useState } from "react";
import { DemoLayout } from "@/components/DemoLayout";
import { FreeTimeControls } from "@/components/TimeControls";
import { useFreeAnimationClock } from "@/hooks/useAnimationClock";
import type { HandId } from "@/physics/config";
import { DEFAULT_PHYSICS, DEFAULT_HAND_MOTION } from "@/physics/config";
import { buildHandSchedules, buildShowerHandSchedules } from "@/physics/hands";
import { computePatternAt } from "@/physics/patternBallSimulator";
import {
  maxThrowInPattern,
  PATTERN_CATALOG,
  type PatternDefinition,
} from "@/physics/patternCatalog";
import { throwMotionSpec, NORMAL_THROW_MOTION } from "@/physics/throwMotion";
import { PALM_M } from "@/physics/sceneScale";
import { twoHandBounds } from "@/physics/throwBounds";
import {
  BEAT_PERIOD,
  clampDwell,
  DWELL,
  HAND_SEP,
  HEIGHT_ZOOM,
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

export function PatternGalleryScene() {
  const [pattern, setPattern] = useState<PatternDefinition>(PATTERN_CATALOG[0]);
  const [startHand, setStartHand] = useState<HandId>("right");
  const [dwellBeats, setDwellBeats] = useState<number>(DWELL.default);
  const [beatPeriod, setBeatPeriod] = useState<number>(BEAT_PERIOD.default);
  const [handSep, setHandSep] = useState(DEFAULT_PHYSICS.handSeparationM);
  const [windowOffset, setWindowOffset] = useState(0);
  const [heightZoom, setHeightZoom] = useState<number>(HEIGHT_ZOOM.default);

  const maxThrow = maxThrowInPattern(pattern);
  const dwell = clampDwell(dwellBeats, maxThrow);

  const physics = useMemo(
    () => ({ ...DEFAULT_PHYSICS, beatPeriodS: beatPeriod, handSeparationM: handSep }),
    [beatPeriod, handSep],
  );

  const clock = useFreeAnimationClock(0);
  const displayT = clock.simTime;

  const handSchedules = useMemo(() => {
    if (pattern.family === "shower") {
      return buildShowerHandSchedules(pattern, startHand, dwell, physics);
    }
    const motionSpec =
      pattern.family === "reverseCascade"
        ? throwMotionSpec(pattern, maxThrow)
        : NORMAL_THROW_MOTION;
    return buildHandSchedules(maxThrow, dwell, physics, { motionSpec });
  }, [pattern, startHand, maxThrow, dwell, physics]);

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

  const balls = useMemo(() => computePatternAt(displayT, params), [displayT, params]);

  const bounds = useMemo(() => {
    const yMax = stageYMaxM(heightZoom);
    return twoHandBounds(handSep, DEFAULT_HAND_MOTION.rxM, yMax, physics.handHeightM);
  }, [handSep, heightZoom, physics.handHeightM]);

  const beat = displayT / beatPeriod;

  return (
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
        <>
          <span className="legend-dot throw" /> throw
          <span className="legend-dot catch" /> catch
          <span className="svg-legend-meta">
            t {displayT.toFixed(2)} s · beat {beat.toFixed(2)} · {pattern.label} ({pattern.siteswap})
            · {pattern.ballCount} balls
          </span>
        </>
      }
      controls={
        <>
          <div className="control-group">
            <div className="toggle-group">
              <span className="control-sublabel">Starting hand</span>
              <button
                type="button"
                className={startHand === "left" ? "toggle active" : "toggle"}
                onClick={() => setStartHand("left")}
              >
                Left
              </button>
              <button
                type="button"
                className={startHand === "right" ? "toggle active" : "toggle"}
                onClick={() => setStartHand("right")}
              >
                Right
              </button>
            </div>
            <div className="control-label">
              <span>Pattern</span>
              <div className="pattern-picker" role="list">
                {PATTERN_CATALOG.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="listitem"
                    className={
                      pattern.id === p.id ? "pattern-card pattern-card--active" : "pattern-card"
                    }
                    onClick={() => setPattern(p)}
                  >
                    <span className="pattern-card-label">{p.label}</span>
                    <span className="pattern-card-badge">{p.ballCount}</span>
                  </button>
                ))}
              </div>
            </div>
            <label className="control-label">
              Dwell D (beats in hand)
              <input
                type="range"
                min={DWELL.min}
                max={DWELL.max}
                step={DWELL.step}
                value={dwell}
                onChange={(e) => setDwellBeats(clampDwell(parseFloat(e.target.value), maxThrow))}
              />
              <span className="control-value">D={dwell.toFixed(2)}</span>
            </label>
            <label className="control-label">
              Height zoom
              <input
                type="range"
                min={HEIGHT_ZOOM.min}
                max={HEIGHT_ZOOM.max}
                step={0.05}
                value={heightZoom}
                onChange={(e) => setHeightZoom(parseFloat(e.target.value))}
              />
              <span className="control-value">
                {heightZoom.toFixed(2)}× · 0–{bounds.yMax.toFixed(1)} m
              </span>
            </label>
            <label className="control-label">
              Beat period T_b (s)
              <input
                type="range"
                min={BEAT_PERIOD.min}
                max={BEAT_PERIOD.max}
                step={0.01}
                value={beatPeriod}
                onChange={(e) => setBeatPeriod(parseFloat(e.target.value))}
              />
              <span className="control-value">
                {beatPeriod.toFixed(2)} s ({(60 / beatPeriod).toFixed(0)} beats/min)
              </span>
            </label>
            <label className="control-label">
              Hand separation (m)
              <input
                type="range"
                min={HAND_SEP.minPalms * PALM_M}
                max={HAND_SEP.maxPalms * PALM_M}
                step={HAND_SEP.stepPalms * PALM_M}
                value={handSep}
                onChange={(e) => setHandSep(parseFloat(e.target.value))}
              />
              <span className="control-value">
                {handSep.toFixed(2)} m ({(handSep / PALM_M).toFixed(1)} palms)
              </span>
            </label>
          </div>
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
        </>
      }
    />
  );
}
