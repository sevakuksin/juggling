import { useCallback } from "react";
import { BEAT_PERIOD } from "@/physics/twoHandThrowConfig";
import { StepperNumberInput } from "./StepperNumberInput";

interface MetronomeControlProps {
  beatPeriodS: number;
  simTime: number;
  onBeatPeriodChange: (tb: number) => void;
}

const SWING_DEG = 28;

function clampBeatPeriod(tb: number): number {
  return Math.min(BEAT_PERIOD.max, Math.max(BEAT_PERIOD.min, tb));
}

function bpmFromPeriod(tb: number): number {
  return 60 / tb;
}

function periodFromBpm(bpm: number): number {
  if (bpm <= 0) return BEAT_PERIOD.default;
  return clampBeatPeriod(60 / bpm);
}

export function MetronomeControl({ beatPeriodS, simTime, onBeatPeriodChange }: MetronomeControlProps) {
  const bpm = bpmFromPeriod(beatPeriodS);
  const beats = simTime / beatPeriodS;
  const swingDeg = SWING_DEG * Math.cos(beats * Math.PI);

  const onBpmChange = useCallback(
    (v: number) => onBeatPeriodChange(periodFromBpm(v)),
    [onBeatPeriodChange],
  );

  const onPeriodChange = useCallback(
    (v: number) => onBeatPeriodChange(clampBeatPeriod(v)),
    [onBeatPeriodChange],
  );

  const bpmMin = Math.round(bpmFromPeriod(BEAT_PERIOD.max));
  const bpmMax = Math.round(bpmFromPeriod(BEAT_PERIOD.min));

  return (
    <div className="metronome-control">
      <div className="metronome-visual" aria-hidden>
        <div className="metronome-base" />
        <div className="metronome-pivot" style={{ transform: `rotate(${swingDeg}deg)` }}>
          <div className="metronome-rod" />
          <div className="metronome-weight" />
        </div>
      </div>
      <div className="metronome-fields">
        <label className="metronome-field metronome-field--equal">
          <span className="metronome-field-label">BPM</span>
          <StepperNumberInput
            value={Math.round(bpm)}
            onChange={onBpmChange}
            step={1}
            min={bpmMin}
            max={bpmMax}
            decimals={0}
            className="stepper-input--metronome"
            inputClassName="metronome-input"
            ariaLabel="Beats per minute"
            parse={(raw) => {
              const v = parseFloat(raw);
              return Number.isFinite(v) && v > 0 ? v : null;
            }}
          />
        </label>
        <label className="metronome-field metronome-field--equal">
          <span className="metronome-field-label">Beat period T_b</span>
          <div className="metronome-input-row">
            <StepperNumberInput
              value={beatPeriodS}
              onChange={onPeriodChange}
              step={0.01}
              min={BEAT_PERIOD.min}
              max={BEAT_PERIOD.max}
              decimals={2}
              className="stepper-input--metronome"
              inputClassName="metronome-input"
              ariaLabel="Beat period in seconds"
              parse={(raw) => {
                const v = parseFloat(raw);
                return Number.isFinite(v) ? v : null;
              }}
            />
            <span className="metronome-unit">s</span>
          </div>
        </label>
      </div>
    </div>
  );
}

export { bpmFromPeriod, periodFromBpm, clampBeatPeriod };
