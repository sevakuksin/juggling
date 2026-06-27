import { useCallback, useMemo, useState } from "react";
import { DemoLayout } from "@/components/DemoLayout";
import { StatRow } from "@/components/Layout";
import { FreeTimeControls } from "@/components/TimeControls";
import { useFreeAnimationClock } from "@/hooks/useAnimationClock";
import type { HandId } from "@/physics/config";
import { DEFAULT_PHYSICS, DEFAULT_HAND_MOTION } from "@/physics/config";
import {
  ballCountFromParsed,
  buildCustomHandSchedules,
  customPatternRuntime,
} from "@/physics/customPattern";
import { computeCustomPatternAt } from "@/physics/customPatternSimulator";
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
import { formatThrowsDisplay, reportPatternWithReversal } from "@/physics/siteswap";
import { PALM_M } from "@/physics/sceneScale";
import { SvgStage } from "@/scene/SvgStage";
import {
  AnimatedHands,
  GroundLine,
  HandEllipses,
  SceneBall,
  ThrowCatchZones,
} from "@/scene/SceneLayers";
import { BALL_DISPLAY_RADIUS } from "@/sprites/BallSprite";

const BALL_CLASSES = ["ball--a", "ball--b", "ball--c", "ball--d", "ball--e"];

export function PatternScene() {
  const [patternInput, setPatternInput] = useState("3");
  const [startHand, setStartHand] = useState<HandId>("right");
  const [dwellBeats, setDwellBeats] = useState<number>(DWELL.default);
  const [beatPeriod, setBeatPeriod] = useState<number>(BEAT_PERIOD.default);
  const [handSep, setHandSep] = useState(DEFAULT_PHYSICS.handSeparationM);
  const [windowOffset, setWindowOffset] = useState(0);
  const [heightZoom, setHeightZoom] = useState<number>(HEIGHT_ZOOM.default);
  const [simEpoch, setSimEpoch] = useState(0);

  const { report, parseError } = useMemo(() => {
    try {
      return { report: reportPatternWithReversal(patternInput), parseError: null as string | null };
    } catch (e) {
      return {
        report: null,
        parseError: e instanceof Error ? e.message : String(e),
      };
    }
  }, [patternInput]);

  const canSim = report != null && report.valid && !parseError;

  const runtime = useMemo(() => {
    if (!canSim || !report) return null;
    return customPatternRuntime(
      { raw: report.pattern, throws: report.throws, heights: report.values, period: report.period },
      startHand,
    );
  }, [canSim, report, startHand]);

  const maxThrow = report ? Math.max(...report.values) : 3;
  const dwell = clampDwell(dwellBeats, maxThrow);

  const physics = useMemo(
    () => ({ ...DEFAULT_PHYSICS, beatPeriodS: beatPeriod, handSeparationM: handSep }),
    [beatPeriod, handSep],
  );

  const clock = useFreeAnimationClock(0);
  const displayT = clock.simTime;

  const handSchedules = useMemo(() => {
    if (!runtime) return null;
    return buildCustomHandSchedules(runtime, dwell, physics);
  }, [runtime, dwell, physics]);

  const simParams = useMemo(
    () =>
      runtime
        ? {
            physics,
            motion: DEFAULT_HAND_MOTION,
            runtime,
            dwellBeats: dwell,
            handSchedules,
          }
        : null,
    [physics, runtime, dwell, handSchedules],
  );

  const simResult = useMemo(() => {
    if (!simParams || !canSim) return { balls: [], error: null };
    void simEpoch;
    return computeCustomPatternAt(displayT, simParams);
  }, [simParams, canSim, displayT, simEpoch]);

  const bounds = useMemo(() => {
    const yMax = stageYMaxM(heightZoom);
    return twoHandBounds(handSep, DEFAULT_HAND_MOTION.rxM, yMax, physics.handHeightM);
  }, [handSep, heightZoom, physics.handHeightM]);

  const beat = displayT / beatPeriod;
  const ballCount = report ? ballCountFromParsed({ throws: report.throws, heights: report.values, period: report.period, raw: report.pattern }) : 0;

  const restart = useCallback(() => {
    setSimEpoch((e) => e + 1);
    clock.setSimTime(0);
  }, [clock]);

  const runtimeError = canSim ? simResult.error : null;

  return (
    <DemoLayout
      animation={
        <div className="pattern-stage-wrap">
          <SvgStage bounds={bounds}>
            <GroundLine bounds={bounds} />
            {handSchedules && (
              <>
                <HandEllipses cfg={physics} motion={DEFAULT_HAND_MOTION} schedules={handSchedules} />
                <ThrowCatchZones cfg={physics} motion={DEFAULT_HAND_MOTION} />
                <AnimatedHands
                  t={displayT}
                  cfg={physics}
                  motion={DEFAULT_HAND_MOTION}
                  schedules={handSchedules}
                />
              </>
            )}
            {!handSchedules && (
              <AnimatedHands t={0} cfg={physics} motion={DEFAULT_HAND_MOTION} />
            )}
            {simResult.balls.map((ball) =>
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
          {runtimeError && (
            <div className="pattern-runtime-error" role="alert">
              {runtimeError}
            </div>
          )}
        </div>
      }
      legend={
        <>
          <span className="legend-dot throw" /> throw
          <span className="legend-dot catch" /> catch
          <span className="svg-legend-meta">
            t {displayT.toFixed(2)} s · beat {beat.toFixed(2)}
            {report && (
              <>
                {" "}
                · {formatThrowsDisplay(report.throws)} · ~{ballCount} balls
              </>
            )}
          </span>
        </>
      }
      controls={
        <>
          <div className="control-group">
            <label className="control-label">
              Siteswap pattern
              <input
                type="text"
                className="pattern-input"
                value={patternInput}
                onChange={(e) => setPatternInput(e.target.value)}
                placeholder="3, 531, 5-1, 3-"
                spellCheck={false}
              />
            </label>
            <p className="hint">
              Append <code>-</code> after a digit for a reversed throw (e.g. <code>3-</code> reverse
              cascade, <code>5-1</code> shower).
            </p>
            {parseError && <p className="error-msg">{parseError}</p>}
            {report && !parseError && (
              <>
                <StatRow label="Throws" value={formatThrowsDisplay(report.throws)} />
                <StatRow
                  label="Ball count (avg)"
                  value={report.averageBallCount.toFixed(2)}
                  highlight={!Number.isInteger(report.averageBallCount)}
                />
                <StatRow label="Period" value={report.period} />
                {!report.valid && report.invalidReason && (
                  <p className="error-msg">{report.invalidReason}</p>
                )}
              </>
            )}
            {runtimeError && (
              <button type="button" className="toggle active" onClick={restart}>
                Restart pattern
              </button>
            )}
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
            <label className="control-label">
              Dwell D (beats in hand)
              <input
                type="range"
                min={DWELL.min}
                max={DWELL.max}
                step={DWELL.step}
                value={dwell}
                onChange={(e) => setDwellBeats(clampDwell(parseFloat(e.target.value), maxThrow))}
                disabled={!canSim}
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
            playing={clock.playing && canSim && !runtimeError}
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
