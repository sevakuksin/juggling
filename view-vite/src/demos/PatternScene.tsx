import { useCallback, useMemo, useState } from "react";
import { DemoLayout } from "@/components/DemoLayout";
import { PatternPlayPanel } from "@/components/pattern/PatternPlayPanel";
import { PatternTimingHud } from "@/components/pattern/PatternTimingHud";
import { StageZoomOverlay } from "@/components/pattern/StageZoomOverlay";
import { useFreeAnimationClock } from "@/hooks/useAnimationClock";
import { useMultiCatchHitSound } from "@/hooks/useMultiCatchHitSound";
import type { HandId } from "@/physics/config";
import { DEFAULT_PHYSICS, DEFAULT_HAND_MOTION } from "@/physics/config";
import {
  buildCustomHandSchedules,
  customPatternRuntime,
} from "@/physics/customPattern";
import { computeCustomPatternAt } from "@/physics/customPatternSimulator";
import { lenM } from "@/physics/sceneScale";
import { twoHandBounds } from "@/physics/throwBounds";
import {
  defaultDwellProfile,
  HEIGHT_ZOOM,
  type DwellProfile,
  stageYMaxM,
} from "@/physics/twoHandThrowConfig";
import { reportPatternWithReversal, formatThrowsDisplay } from "@/physics/siteswap";
import { SvgStage } from "@/scene/SvgStage";
import { HandSeparationLayer } from "@/scene/HandSeparationLayer";
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
  const [dwellProfile, setDwellProfile] = useState<DwellProfile>(defaultDwellProfile);
  const [beatPeriod, setBeatPeriod] = useState<number>(DEFAULT_PHYSICS.beatPeriodS);
  const [handSep, setHandSep] = useState(DEFAULT_PHYSICS.handSeparationM);
  const [stageZoom, setStageZoom] = useState<number>(HEIGHT_ZOOM.default);
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

  const canSim = report != null && !parseError;

  const runtime = useMemo(() => {
    if (!report || parseError) return null;
    return customPatternRuntime(
      { raw: report.pattern, throws: report.throws, heights: report.values, period: report.period },
      startHand,
    );
  }, [report, parseError, startHand]);

  const physics = useMemo(
    () => ({ ...DEFAULT_PHYSICS, beatPeriodS: beatPeriod, handSeparationM: handSep }),
    [beatPeriod, handSep],
  );

  const clock = useFreeAnimationClock(0);
  const displayT = clock.simTime;

  const handSchedules = useMemo(() => {
    if (!runtime) return null;
    return buildCustomHandSchedules(runtime, dwellProfile, physics);
  }, [runtime, dwellProfile, physics]);

  const simParams = useMemo(
    () =>
      runtime
        ? {
            physics,
            motion: DEFAULT_HAND_MOTION,
            runtime,
            dwellProfile,
            handSchedules,
          }
        : null,
    [physics, runtime, dwellProfile, handSchedules],
  );

  const simResult = useMemo(() => {
    if (!simParams) return { balls: [], error: null };
    void simEpoch;
    return computeCustomPatternAt(displayT, simParams);
  }, [simParams, displayT, simEpoch]);

  useMultiCatchHitSound(simResult.balls);

  const bounds = useMemo(() => {
    const yMax = stageYMaxM(stageZoom);
    return twoHandBounds(
      handSep,
      DEFAULT_HAND_MOTION.rxM,
      yMax,
      physics.handHeightM,
      stageZoom,
    );
  }, [handSep, stageZoom, physics.handHeightM]);

  const restart = useCallback(() => {
    setSimEpoch((e) => e + 1);
    clock.setSimTime(0);
  }, [clock]);

  const runtimeError = simResult.error;

  return (
    <DemoLayout
      animation={
        <div className="pattern-scene">
          <div className="pattern-overlay-rail">
            <PatternTimingHud
              beatPeriodS={beatPeriod}
              simTime={displayT}
              onBeatPeriodChange={setBeatPeriod}
              dwellProfile={dwellProfile}
              onDwellProfileChange={setDwellProfile}
              startHand={startHand}
              onStartHandChange={setStartHand}
            />
            <label className="pattern-overlay-input-label">
              Siteswap
              <input
                type="text"
                className="pattern-input pattern-input--bar"
                value={patternInput}
                onChange={(e) => setPatternInput(e.target.value)}
                placeholder="3, 531, 5-1, 423-"
                spellCheck={false}
              />
            </label>
            {report && !parseError && report.valid && (
              <p className="hint pattern-overlay-msg pattern-parsed-throws">
                Parsed: {formatThrowsDisplay(report.throws)}
              </p>
            )}
            {parseError && <p className="error-msg pattern-overlay-msg">{parseError}</p>}
            {report && !parseError && !report.valid && report.invalidReason && (
              <p className="hint invalid-reason pattern-overlay-msg">{report.invalidReason}</p>
            )}
            <div className="pattern-overlay-actions">
              <PatternPlayPanel
                playing={clock.playing && canSim && !runtimeError}
                speed={clock.speed}
                onTogglePlay={clock.togglePlay}
                onSpeedChange={clock.setSpeed}
                showRestart={!!runtimeError}
                onRestart={restart}
              />
              <StageZoomOverlay
                zoom={stageZoom}
                onZoomChange={setStageZoom}
                min={HEIGHT_ZOOM.min}
                max={HEIGHT_ZOOM.max}
              />
            </div>
          </div>
          <div className="pattern-stage-wrap">
            <SvgStage bounds={bounds} extendOriginLeftM={lenM(4.5)}>
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
                  <HandSeparationLayer
                    t={displayT}
                    cfg={physics}
                    motion={DEFAULT_HAND_MOTION}
                    schedules={handSchedules}
                    handSepM={handSep}
                    onHandSepChange={setHandSep}
                  />
                </>
              )}
              {!handSchedules && (
                <>
                  <AnimatedHands t={0} cfg={physics} motion={DEFAULT_HAND_MOTION} />
                  <HandSeparationLayer
                    t={0}
                    cfg={physics}
                    motion={DEFAULT_HAND_MOTION}
                    handSepM={handSep}
                    onHandSepChange={setHandSep}
                  />
                </>
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
        </div>
      }
    />
  );
}
