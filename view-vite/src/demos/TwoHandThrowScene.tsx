import { useEffect, useMemo, useState } from "react";
import { DemoLayout } from "@/components/DemoLayout";
import { StatRow } from "@/components/Layout";
import { FreeTimeControls } from "@/components/TimeControls";
import { useFreeAnimationClock } from "@/hooks/useAnimationClock";
import type { HandId } from "@/physics/config";
import { DEFAULT_PHYSICS, DEFAULT_HAND_MOTION } from "@/physics/config";
import { computeBallAt, previewThrowFromHand } from "@/physics/ballSimulator";
import { airTimeBeats } from "@/physics/airTime";
import { buildHandSchedules, handPhaseRad } from "@/physics/hands";
import { PALM_M } from "@/physics/sceneScale";
import { twoHandBounds } from "@/physics/throwBounds";
import {
  BEAT_PERIOD,
  BALL_SIM,
  clampDwell,
  DWELL,
  dwellRangeForThrow,
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
  ThrowTrajectoryGuides,
} from "@/scene/SceneLayers";
import { BallPreview, BALL_DISPLAY_RADIUS } from "@/sprites/BallSprite";

import { useCatchHitSound } from "@/hooks/useCatchHitSound";

export function TwoHandThrowScene() {
  const [startHand, setStartHand] = useState<HandId>("right");
  const [pendingThrow, setPendingThrow] = useState(3);
  const [dwellBeats, setDwellBeats] = useState<number>(DWELL.default);
  const [beatPeriod, setBeatPeriod] = useState<number>(BEAT_PERIOD.default);
  const [handSep, setHandSep] = useState(DEFAULT_PHYSICS.handSeparationM);
  const [windowOffset, setWindowOffset] = useState(0);
  const [heightZoom, setHeightZoom] = useState<number>(HEIGHT_ZOOM.default);

  const dwellRange = dwellRangeForThrow(pendingThrow);

  useEffect(() => {
    setDwellBeats((prev) => clampDwell(prev, pendingThrow));
  }, [pendingThrow]);

  const physics = useMemo(
    () => ({ ...DEFAULT_PHYSICS, beatPeriodS: beatPeriod, handSeparationM: handSep }),
    [beatPeriod, handSep],
  );

  const handSchedules = useMemo(() => {
    const d = pendingThrow > 0 ? clampDwell(dwellBeats, pendingThrow) : 0;
    return buildHandSchedules(pendingThrow, d, physics);
  }, [pendingThrow, dwellBeats, physics]);

  const params = useMemo(
    () => ({
      physics,
      motion: DEFAULT_HAND_MOTION,
      startHand,
      pendingThrow,
      dwellBeats: pendingThrow > 0 ? clampDwell(dwellBeats, pendingThrow) : 0,
      handSchedules,
    }),
    [physics, startHand, pendingThrow, dwellBeats, handSchedules],
  );

  const clock = useFreeAnimationClock(0);
  const displayT = clock.simTime;
  const ball = useMemo(() => computeBallAt(displayT, params), [displayT, params]);
  useCatchHitSound(ball.phase);

  const bounds = useMemo(() => {
    const yMax = stageYMaxM(heightZoom);
    return twoHandBounds(handSep, DEFAULT_HAND_MOTION.rxM, yMax, physics.handHeightM);
  }, [handSep, heightZoom, physics.handHeightM]);

  const previewFlights = useMemo(() => {
    const d = pendingThrow > 0 ? clampDwell(dwellBeats, pendingThrow) : 0;
    if (pendingThrow <= 0) return { left: null, right: null };
    return {
      left: previewThrowFromHand(pendingThrow, d, "left", physics, DEFAULT_HAND_MOTION),
      right: previewThrowFromHand(pendingThrow, d, "right", physics, DEFAULT_HAND_MOTION),
    };
  }, [pendingThrow, dwellBeats, physics]);

  const beat = displayT / beatPeriod;
  const d = pendingThrow > 0 ? clampDwell(dwellBeats, pendingThrow) : 0;
  const airBeats = airTimeBeats(pendingThrow, d);
  const airTimeStr = (airBeats * beatPeriod).toFixed(2);
  const dwellDisplay = d.toFixed(2);
  const airBeatsDisplay = airBeats.toFixed(2);
  const thetaR = handPhaseRad("right", displayT, physics, handSchedules);
  const thetaL = handPhaseRad("left", displayT, physics, handSchedules);

  return (
    <DemoLayout
      animation={
        <SvgStage bounds={bounds}>
          <GroundLine bounds={bounds} />
          <HandEllipses cfg={physics} motion={DEFAULT_HAND_MOTION} schedules={handSchedules} />
          <ThrowCatchZones cfg={physics} motion={DEFAULT_HAND_MOTION} />
          <ThrowTrajectoryGuides
            left={previewFlights.left}
            right={previewFlights.right}
            handHeightM={physics.handHeightM}
          />
          <AnimatedHands
            t={displayT}
            cfg={physics}
            motion={DEFAULT_HAND_MOTION}
            schedules={handSchedules}
          />
          {ball.visible && (
            <SceneBall
              x={ball.x}
              y={ball.y}
              radius={BALL_DISPLAY_RADIUS}
              label={ball.phase === "airborne" ? ball.label : undefined}
            />
          )}
        </SvgStage>
      }
      legend={
        <>
          <span className="legend-dot throw" /> throw (inside)
          <span className="legend-dot catch" /> catch (outside)
          <span className="svg-legend-meta">
            t {displayT.toFixed(2)} s · beat {beat.toFixed(2)} · T<sub>b</sub> {beatPeriod.toFixed(2)} s
            {pendingThrow > 0 && (
              <> · n={pendingThrow} D={dwellDisplay} · air {airBeats > 0 ? airTimeStr : "0"} s</>
            )}
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
            <label className="control-label control-label--throw">
              <span>Throw number (applied at next catch)</span>
              <div className="throw-row">
                <input
                  type="range"
                  min={0}
                  max={BALL_SIM.maxThrow}
                  step={1}
                  value={pendingThrow}
                  onChange={(e) => setPendingThrow(parseInt(e.target.value, 10))}
                />
                <BallPreview value={pendingThrow} size={40} />
              </div>
            </label>
            {pendingThrow > 0 && (
              <label className="control-label">
                Dwell D (beats in hand)
                <input
                  type="range"
                  min={dwellRange.min}
                  max={dwellRange.max}
                  step={DWELL.step}
                  value={d}
                  onChange={(e) =>
                    setDwellBeats(clampDwell(parseFloat(e.target.value), pendingThrow))
                  }
                />
                <span className="control-value">
                  D={dwellDisplay} · air = (n−D)={airBeatsDisplay} beats = {airTimeStr} s
                </span>
              </label>
            )}
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
          <div className="formula-panel">
            <h3 className="formula-title">Hand phase (2-beat ellipse)</h3>
            <p>ω = π/T_b = {(Math.PI / beatPeriod).toFixed(2)} rad/s</p>
            <p>θ_R = {thetaR.toFixed(2)} rad · θ_L = {thetaL.toFixed(2)} rad</p>
            {pendingThrow > 0 && (
              <p>
                T<sub>air</sub> = (n−D)·T_b = {airBeatsDisplay} × {beatPeriod.toFixed(2)} = {airTimeStr} s
              </p>
            )}
          </div>
          <StatRow label="Ball label (in flight)" value={ball.visible ? ball.label : "—"} />
          <StatRow label="Throw n / dwell D" value={`${pendingThrow} / ${dwellDisplay}`} highlight />
          <StatRow label="Phase" value={ball.phase} />
          <StatRow label="Next event" value={ball.nextEventLabel} />
          <p className="hint">
            Air time is <strong>(n − D) × T_b</strong>.
            {pendingThrow === 1
              ? " For n=1, D is 0.1–0.4 beats (default 0.25)."
              : " D defaults to 0.8 beats in hand after each catch."}
          </p>
        </>
      }
    />
  );
}
