import { useCallback } from "react";
import { BEAT_PERIOD } from "@/physics/twoHandThrowConfig";

interface MetronomeControlProps {
  beatPeriodS: number;
  simTime: number;
  onBeatPeriodChange: (tb: number) => void;
}

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
  const phase = (simTime / beatPeriodS) % 1;
  const swing = Math.sin(phase * Math.PI * 2);
  const barHeight = 36 + swing * 18;

  const onBpmInput = useCallback(
    (raw: string) => {
      const v = parseFloat(raw);
      if (!Number.isFinite(v) || v <= 0) return;
      onBeatPeriodChange(periodFromBpm(v));
    },
    [onBeatPeriodChange],
  );

  const onPeriodInput = useCallback(
    (raw: string) => {
      const v = parseFloat(raw);
      if (!Number.isFinite(v)) return;
      onBeatPeriodChange(clampBeatPeriod(v));
    },
    [onBeatPeriodChange],
  );

  return (
    <div className="metronome-control">
      <div className="metronome-visual" aria-hidden>
        <div className="metronome-rod" />
        <div className="metronome-bar" style={{ height: `${barHeight}px` }} />
        <div className="metronome-base" />
      </div>
      <label className="metronome-field metronome-field--bpm">
        <span className="metronome-field-label">BPM</span>
        <input
          type="number"
          className="metronome-input metronome-input--bpm"
          min={Math.round(bpmFromPeriod(BEAT_PERIOD.max))}
          max={Math.round(bpmFromPeriod(BEAT_PERIOD.min))}
          step={1}
          value={Math.round(bpm)}
          onChange={(e) => onBpmInput(e.target.value)}
        />
      </label>
      <label className="metronome-field metronome-field--tb">
        <span className="metronome-field-label">T_b</span>
        <div className="metronome-input-row">
          <input
            type="number"
            className="metronome-input"
            min={BEAT_PERIOD.min}
            max={BEAT_PERIOD.max}
            step={0.01}
            value={beatPeriodS.toFixed(2)}
            onChange={(e) => onPeriodInput(e.target.value)}
          />
          <span className="metronome-unit">s</span>
        </div>
      </label>
    </div>
  );
}

export { bpmFromPeriod, periodFromBpm, clampBeatPeriod };
