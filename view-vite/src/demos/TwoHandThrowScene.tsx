import { useMemo, useState } from "react";
import { DemoLayout } from "@/components/DemoLayout";
import { StatRow } from "@/components/Layout";
import { FreeTimeControls } from "@/components/TimeControls";
import { useFreeAnimationClock } from "@/hooks/useAnimationClock";
import type { HandId } from "@/physics/config";
import { DEFAULT_PHYSICS, DEFAULT_HAND_MOTION } from "@/physics/config";
import { computeBallAt } from "@/physics/ballSimulator";
import { airTimeBeats } from "@/physics/airTime";
import { handPhaseRad } from "@/physics/hands";
import { twoHandBounds, yMaxForThrow } from "@/physics/throwBounds";
import { SvgStage } from "@/scene/SvgStage";
import {
  AnimatedHands,
  GroundLine,
  HandEllipses,
  SceneBall,
  ThrowCatchZones,
  TrajectoryPath,
} from "@/scene/SceneLayers";
import { BallPreview, BALL_DISPLAY_RADIUS } from "@/sprites/BallSprite";

const WINDOW_S = 8;

export function TwoHandThrowScene() {
  const [startHand, setStartHand] = useState<HandId>("right");
  const [pendingThrow, setPendingThrow] = useState(3);
  const [dwellBeats, setDwellBeats] = useState(1);
  const [beatPeriod, setBeatPeriod] = useState(0.5);
  const [handSep, setHandSep] = useState(0.8);
  const [windowOffset, setWindowOffset] = useState(0);
  const [heightZoom, setHeightZoom] = useState(1.0);

  const physics = useMemo(
    () => ({ ...DEFAULT_PHYSICS, beatPeriodS: beatPeriod, handSeparationM: handSep }),
    [beatPeriod, handSep],
  );

  const params = useMemo(
    () => ({
      physics,
      motion: DEFAULT_HAND_MOTION,
      startHand,
      pendingThrow,
      dwellBeats: Math.min(dwellBeats, pendingThrow),
    }),
    [physics, startHand, pendingThrow, dwellBeats],
  );

  const clock = useFreeAnimationClock(0);
  const displayT = clock.simTime;
  const ball = useMemo(() => computeBallAt(displayT, params), [displayT, params]);

  const bounds = useMemo(() => {
    const d = Math.min(dwellBeats, pendingThrow);
    const yMax = yMaxForThrow(pendingThrow, d, physics, DEFAULT_HAND_MOTION, heightZoom, startHand);
    return twoHandBounds(handSep, DEFAULT_HAND_MOTION.rxM, yMax, physics.handHeightM);
  }, [handSep, pendingThrow, dwellBeats, physics, heightZoom, startHand]);

  const beat = displayT / beatPeriod;
  const d = Math.min(dwellBeats, pendingThrow);
  const airBeats = airTimeBeats(pendingThrow, d);
  const airTimeStr = (airBeats * beatPeriod).toFixed(2);
  const dwellDisplay = d.toFixed(2);
  const airBeatsDisplay = airBeats.toFixed(2);
  const thetaR = handPhaseRad("right", displayT, physics);
  const thetaL = handPhaseRad("left", displayT, physics);

  return (
    <DemoLayout
      animation={
        <SvgStage bounds={bounds}>
          <GroundLine bounds={bounds} />
          <HandEllipses cfg={physics} motion={DEFAULT_HAND_MOTION} />
          <ThrowCatchZones cfg={physics} motion={DEFAULT_HAND_MOTION} />
          {ball.flight && <TrajectoryPath flight={ball.flight} opacity={0.55} />}
          <AnimatedHands t={displayT} cfg={physics} motion={DEFAULT_HAND_MOTION} />
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
                  max={13}
                  step={1}
                  value={pendingThrow}
                  onChange={(e) => {
                    const h = parseInt(e.target.value, 10);
                    setPendingThrow(h);
                    setDwellBeats((prev) => Math.min(prev, h));
                  }}
                />
                <BallPreview value={pendingThrow} size={40} />
              </div>
            </label>
            {pendingThrow > 0 && (
              <label className="control-label">
                Dwell D (beats in hand, ≤ n)
                <input
                  type="range"
                  min={0}
                  max={pendingThrow}
                  step={0.05}
                  value={d}
                  onChange={(e) => setDwellBeats(parseFloat(e.target.value))}
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
                min={0.6}
                max={2.5}
                step={0.05}
                value={heightZoom}
                onChange={(e) => setHeightZoom(parseFloat(e.target.value))}
              />
              <span className="control-value">
                {heightZoom.toFixed(2)}× · top {bounds.yMax.toFixed(1)} m
              </span>
            </label>
            <label className="control-label">
              Beat period T_b (s)
              <input
                type="range"
                min={0.35}
                max={0.8}
                step={0.05}
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
                min={0.3}
                max={1.5}
                step={0.05}
                value={handSep}
                onChange={(e) => setHandSep(parseFloat(e.target.value))}
              />
              <span className="control-value">{handSep.toFixed(2)}</span>
            </label>
          </div>
          <FreeTimeControls
            simTime={clock.simTime}
            windowS={WINDOW_S}
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
            Air time is <strong>(n − D) × T_b</strong>. Default D=1 aligns throw 3 with the outside catch
            window.
          </p>
        </>
      }
    />
  );
}
