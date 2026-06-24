import { useMemo, useState } from "react";
import { DemoLayout } from "@/components/DemoLayout";
import { StatRow } from "@/components/Layout";
import { TimeControls } from "@/components/TimeControls";
import { useAnimationClock } from "@/hooks/useAnimationClock";
import { DEFAULT_PHYSICS } from "@/physics/config";
import { makeVerticalThrow, energyJ, apexHeightM, positionAt, vy0 } from "@/physics/projectile";
import {
  verticalEnergyFromTof,
  tofFromVerticalEnergy,
  verticalVelocityFromTof,
  apexHeightFromTof,
} from "@/physics/vertical";
import { verticalBounds } from "@/physics/throwBounds";
import { SvgStage } from "@/scene/SvgStage";
import { GroundLine, HeightScale, SceneBall, TrajectoryPath } from "@/scene/SceneLayers";
import { HandSprite } from "@/sprites/HandSprite";
import { BALL_DISPLAY_RADIUS } from "@/sprites/BallSprite";

type LockMode = "time" | "energy";

export function VerticalThrowScene() {
  const [mass, setMass] = useState(DEFAULT_PHYSICS.massKg);
  const [tof, setTof] = useState(1.0);
  const [energy, setEnergy] = useState(verticalEnergyFromTof(mass, 1.0));
  const [mode, setMode] = useState<LockMode>("time");

  const syncFromTime = (m: number, t: number) => setEnergy(verticalEnergyFromTof(m, t));
  const syncFromEnergy = (m: number, e: number) => setTof(tofFromVerticalEnergy(m, e));

  const throw_ = useMemo(
    () => makeVerticalThrow(tof, { ...DEFAULT_PHYSICS, massKg: mass }),
    [tof, mass],
  );

  const clock = useAnimationClock(tof, { loop: true });
  const bounds = useMemo(() => verticalBounds(tof, DEFAULT_PHYSICS.handHeightM), [tof]);
  const [bx, by] = positionAt(throw_, Math.min(clock.simTime, throw_.tofS));
  const vy = verticalVelocityFromTof(tof);
  const apex = apexHeightFromTof(tof);
  const handY = DEFAULT_PHYSICS.handHeightM;

  return (
    <DemoLayout
      animation={
        <SvgStage bounds={bounds}>
          <GroundLine bounds={bounds} />
          <HeightScale yMax={bounds.yMax} x={bounds.xMin + 0.06} />
          <TrajectoryPath flight={throw_} />
          <HandSprite hand="left" x={0} y={handY} />
          <SceneBall x={bx} y={by} radius={BALL_DISPLAY_RADIUS} />
        </SvgStage>
      }
      controls={
        <>
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
          <div className="formula-panel">
            <h3 className="formula-title">Live calculation</h3>
            <p>
              v<sub>y</sub> = gT/2 = {vy.toFixed(2)} m/s
            </p>
            <p>E = ½mv² = {energy.toFixed(3)} J</p>
            <p>apex = v²/(2g) = {apex.toFixed(2)} m</p>
          </div>
          <StatRow label="vy₀ (computed)" value={`${vy0(throw_).toFixed(2)} m/s`} />
          <StatRow label="E₀ (computed)" value={`${energyJ(throw_).toFixed(3)} J`} highlight />
          <StatRow label="Apex" value={`${apexHeightM(throw_).toFixed(2)} m`} />
        </>
      }
    />
  );
}
