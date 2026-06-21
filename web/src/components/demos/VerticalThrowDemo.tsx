import { useCallback, useMemo, useState } from "react";
import { CanvasStage } from "../CanvasStage";
import { MathPanel, StatRow } from "../MathPanel";
import { TimeControls } from "../TimeControls";
import { useAnimationClock } from "../../hooks/useAnimationClock";
import { DEFAULT_PHYSICS } from "../../physics/config";
import { makeVerticalThrow, energyJ, apexHeightM, vy0 } from "../../physics/projectile";
import {
  verticalEnergyFromTof,
  tofFromVerticalEnergy,
  verticalVelocityFromTof,
  apexHeightFromTof,
} from "../../physics/vertical";
import { drawVerticalScene } from "../../render/drawScene";
import { VERTICAL_BOUNDS } from "../../render/canvasStage";

type LockMode = "time" | "energy";

export function VerticalThrowDemo() {
  const [mass, setMass] = useState(DEFAULT_PHYSICS.massKg);
  const [tof, setTof] = useState(1.0);
  const [energy, setEnergy] = useState(verticalEnergyFromTof(mass, 1.0));
  const [mode, setMode] = useState<LockMode>("time");

  const syncFromTime = (m: number, t: number) => {
    setEnergy(verticalEnergyFromTof(m, t));
  };

  const syncFromEnergy = (m: number, e: number) => {
    setTof(tofFromVerticalEnergy(m, e));
  };

  const throw_ = useMemo(
    () => makeVerticalThrow(tof, { ...DEFAULT_PHYSICS, massKg: mass }),
    [tof, mass],
  );

  const clock = useAnimationClock(tof, { loop: true });

  const vy = verticalVelocityFromTof(tof);
  const apex = apexHeightFromTof(tof);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      drawVerticalScene(ctx, canvas, VERTICAL_BOUNDS, throw_, clock.simTime);
    },
    [throw_, clock.simTime],
  );

  return (
    <section className="demo-section" id="demo-vertical">
      <div className="demo-grid">
        <div className="demo-canvas-wrap">
          <CanvasStage onDraw={draw} deps={[draw]} animating={clock.playing} />
        </div>
        <div className="demo-side">
          <div className="control-group">
            <label className="control-label">
              Mass (kg)
              <input
                type="range"
                min={0.03}
                max={0.25}
                step={0.005}
                value={mass}
                onChange={(e) => {
                  const m = parseFloat(e.target.value);
                  setMass(m);
                  if (mode === "time") syncFromTime(m, tof);
                  else syncFromEnergy(m, energy);
                }}
              />
              <span className="control-value">{mass.toFixed(3)}</span>
            </label>
            <div className="toggle-group">
              <button
                type="button"
                className={mode === "time" ? "toggle active" : "toggle"}
                onClick={() => setMode("time")}
              >
                Fix time
              </button>
              <button
                type="button"
                className={mode === "energy" ? "toggle active" : "toggle"}
                onClick={() => setMode("energy")}
              >
                Fix energy
              </button>
            </div>
            <label className="control-label">
              Time of flight (s)
              <input
                type="range"
                min={0.1}
                max={4}
                step={0.05}
                value={tof}
                disabled={mode === "energy"}
                onChange={(e) => {
                  const t = parseFloat(e.target.value);
                  setTof(t);
                  syncFromTime(mass, t);
                  clock.reset();
                }}
              />
              <span className="control-value">{tof.toFixed(2)}</span>
            </label>
            <label className="control-label">
              Energy (J)
              <input
                type="range"
                min={0.01}
                max={20}
                step={0.01}
                value={energy}
                disabled={mode === "time"}
                onChange={(e) => {
                  const en = parseFloat(e.target.value);
                  setEnergy(en);
                  syncFromEnergy(mass, en);
                  clock.reset();
                }}
              />
              <span className="control-value">{energy.toFixed(3)}</span>
            </label>
          </div>
          <TimeControls
            simTime={clock.simTime}
            maxTime={tof}
            playing={clock.playing}
            speed={clock.speed}
            onTogglePlay={clock.togglePlay}
            onTimeChange={clock.setSimTime}
            onSpeedChange={clock.setSpeed}
            onReset={clock.reset}
          />
          <MathPanel
            title="Live calculation"
            lines={[
              `v_y = \\frac{gT}{2} = \\frac{9.81 \\times ${tof.toFixed(2)}}{2} = ${vy.toFixed(2)}\\;\\mathrm{m/s}`,
              `E = \\tfrac{1}{2}mv_y^2 = ${energy.toFixed(3)}\\;\\mathrm{J}`,
              `\\text{apex} = \\frac{v_y^2}{2g} = ${apex.toFixed(2)}\\;\\mathrm{m}`,
            ]}
          />
          <StatRow label="vy₀ (computed)" value={`${vy0(throw_).toFixed(2)} m/s`} />
          <StatRow label="E₀ (computed)" value={`${energyJ(throw_).toFixed(3)} J`} highlight />
          <StatRow label="Apex" value={`${apexHeightM(throw_).toFixed(2)} m`} />
        </div>
      </div>
    </section>
  );
}
