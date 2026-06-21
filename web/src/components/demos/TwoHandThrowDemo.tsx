import { useCallback, useMemo, useState } from "react";
import { BallPreview } from "../BallPreview";
import { CanvasStage } from "../CanvasStage";
import { MathPanel, StatRow } from "../MathPanel";
import { FreeTimeControls } from "../TimeControls";
import { useFreeAnimationClock } from "../../hooks/useAnimationClock";
import type { HandId } from "../../physics/config";
import { DEFAULT_PHYSICS, DEFAULT_HAND_MOTION } from "../../physics/config";
import { computeBallAt } from "../../physics/ballSimulator";
import { airTimeBeats } from "../../physics/airTime";
import { handPhaseRad } from "../../physics/hands";
import { yMaxForThrow } from "../../physics/throwBounds";
import { drawTwoHandScene } from "../../render/drawScene";
import { twoHandBounds } from "../../render/canvasStage";

const WINDOW_S = 8;

export function TwoHandThrowDemo() {
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
  const ball = useMemo(
    () => computeBallAt(displayT, params),
    [displayT, params],
  );

  const bounds = useMemo(() => {
    const d = Math.min(dwellBeats, pendingThrow);
    const yMax = yMaxForThrow(
      pendingThrow,
      d,
      physics,
      DEFAULT_HAND_MOTION,
      heightZoom,
      startHand,
    );
    return twoHandBounds(
      handSep,
      DEFAULT_HAND_MOTION.rxM,
      yMax,
      physics.handHeightM,
    );
  }, [handSep, pendingThrow, dwellBeats, physics, heightZoom, startHand]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      drawTwoHandScene(
        ctx,
        canvas,
        bounds,
        physics,
        DEFAULT_HAND_MOTION,
        displayT,
        ball,
      );
    },
    [bounds, physics, displayT, ball],
  );

  const beat = displayT / beatPeriod;
  const d = Math.min(dwellBeats, pendingThrow);
  const airBeats = airTimeBeats(pendingThrow, d);
  const airTimeStr = (airBeats * beatPeriod).toFixed(2);

  const thetaR = handPhaseRad("right", displayT, physics);
  const thetaL = handPhaseRad("left", displayT, physics);

  return (
    <section className="demo-section" id="demo-two-hands">
      <div className="demo-grid">
        <div className="demo-canvas-wrap">
          <CanvasStage onDraw={draw} deps={[draw]} animating={clock.playing} />
          <p className="canvas-legend">
            <span className="legend-dot throw" /> throw (inside)
            <span className="legend-dot catch" /> catch (outside)
            <span className="canvas-legend-meta">
              t&nbsp;{displayT.toFixed(2)}&nbsp;s · beat&nbsp;{beat.toFixed(2)} ·
              T<sub>b</sub>&nbsp;{beatPeriod.toFixed(2)}&nbsp;s
              {pendingThrow > 0 && (
                <>
                  {" "}
                  · h={pendingThrow} d={d} · air {(airBeats > 0 ? airTimeStr : "0")}&nbsp;s
                </>
              )}
            </span>
          </p>
        </div>
        <div className="demo-side">
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
                Dwell d (beats in hand, ≤ h)
                <input
                  type="range"
                  min={0}
                  max={pendingThrow}
                  step={1}
                  value={d}
                  onChange={(e) => setDwellBeats(parseInt(e.target.value, 10))}
                />
                <span className="control-value">
                  d={d} · air = (h−d)={airBeats} beats = {airTimeStr} s
                </span>
              </label>
            )}
            <label className="control-label">
              Height zoom (see tall throws)
              <input
                type="range"
                min={0.6}
                max={2.5}
                step={0.05}
                value={heightZoom}
                onChange={(e) => setHeightZoom(parseFloat(e.target.value))}
              />
              <span className="control-value">{heightZoom.toFixed(2)}× · top {bounds.yMax.toFixed(1)} m</span>
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
          <MathPanel
            title="Hand phase (2-beat ellipse)"
            lines={[
              `\\omega = \\frac{\\pi}{T_b} = ${(Math.PI / beatPeriod).toFixed(2)}\\;\\mathrm{rad/s}`,
              `\\theta_R = \\omega t = ${thetaR.toFixed(2)}\\;\\mathrm{rad}`,
              `\\theta_L = \\theta_R + \\pi = ${thetaL.toFixed(2)}\\;\\mathrm{rad}`,
              `\\text{one full orbit per } 2 T_b = ${(2 * beatPeriod).toFixed(2)}\\;\\mathrm{s}`,
              pendingThrow > 0
                ? `T_{\\mathrm{air}} = (h-d)\\,T_b = ${airBeats} \\times ${beatPeriod.toFixed(2)} = ${airTimeStr}\\;\\mathrm{s}`
                : "",
            ].filter(Boolean)}
          />
          <StatRow label="Ball label (in flight)" value={ball.visible ? ball.label : "—"} />
          <StatRow label="Throw h / dwell d" value={`${pendingThrow} / ${d}`} highlight />
          <StatRow label="Phase" value={ball.phase} />
          <StatRow label="Next event" value={ball.nextEventLabel} />
          <p className="hint">
            Air time is <strong>(h − d) × T_b</strong>. Dwelling d beats in hand after catch (and
            before a zero-air throw). Default d=1 aligns throw 3 with the outside catch window.
            Parabola stays inside → outside.
          </p>
        </div>
      </div>
    </section>
  );
}
