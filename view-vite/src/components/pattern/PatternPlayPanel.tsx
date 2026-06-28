import { useCallback, useEffect, useState } from "react";
import { SCRUB_WINDOW_S } from "@/physics/twoHandThrowConfig";

interface PatternPlayPanelProps {
  playing: boolean;
  speed: number;
  simTime: number;
  beatPeriodS: number;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  onSimTimeChange: (t: number) => void;
  onRestart?: () => void;
  showRestart?: boolean;
  windowS?: number;
}

export function PatternPlayPanel({
  playing,
  speed,
  simTime,
  beatPeriodS,
  onTogglePlay,
  onSpeedChange,
  onSimTimeChange,
  onRestart,
  showRestart,
  windowS = SCRUB_WINDOW_S,
}: PatternPlayPanelProps) {
  const [windowStart, setWindowStart] = useState(0);

  useEffect(() => {
    if (simTime < windowStart) {
      setWindowStart(Math.max(0, simTime - windowS * 0.25));
      return;
    }
    if (simTime > windowStart + windowS) {
      setWindowStart(simTime - windowS * 0.85);
    }
  }, [simTime, windowStart, windowS]);

  const localT = simTime - windowStart;
  const windowEnd = windowStart + windowS;

  const onScrub = useCallback(
    (raw: string) => {
      const v = parseFloat(raw);
      if (!Number.isFinite(v)) return;
      onSimTimeChange(Math.max(0, windowStart + v));
    },
    [onSimTimeChange, windowStart],
  );

  const beatTicks: number[] = [];
  if (beatPeriodS > 0) {
    const firstBeat = Math.ceil(windowStart / beatPeriodS) * beatPeriodS;
    for (let b = firstBeat; b <= windowEnd + 1e-9; b += beatPeriodS) {
      beatTicks.push(b);
    }
  }

  return (
    <div className="pattern-play-panel">
      <div className="pattern-play-row">
        <button
          type="button"
          className="btn-play btn-play--large"
          onClick={onTogglePlay}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "⏸" : "▶"}
        </button>
        {showRestart && onRestart && (
          <button type="button" className="btn-secondary" onClick={onRestart}>
            Restart
          </button>
        )}
        <label className="speed-label">
          Speed
          <select value={speed} onChange={(e) => onSpeedChange(parseFloat(e.target.value))}>
            <option value={0.25}>0.25×</option>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={1.5}>1.5×</option>
            <option value={2}>2×</option>
          </select>
        </label>
      </div>

      <div className="pattern-timeline">
        <div className="pattern-timeline-track" aria-hidden>
          {beatTicks.map((b) => {
            const pct = ((b - windowStart) / windowS) * 100;
            if (pct < 0 || pct > 100) return null;
            return (
              <span
                key={b}
                className="pattern-timeline-beat"
                style={{ left: `${pct}%` }}
              />
            );
          })}
          <span
            className="pattern-timeline-playhead"
            style={{ left: `${Math.min(100, Math.max(0, (localT / windowS) * 100))}%` }}
          />
        </div>
        <input
          type="range"
          className="pattern-timeline-slider"
          min={0}
          max={windowS}
          step={0.01}
          value={Math.min(windowS, Math.max(0, localT))}
          onChange={(e) => onScrub(e.target.value)}
          aria-label="Scrub simulation time"
        />
        <div className="pattern-timeline-labels">
          <span>{windowStart.toFixed(1)} s</span>
          <span className="pattern-timeline-now">{simTime.toFixed(2)} s</span>
          <span>{windowEnd.toFixed(1)} s</span>
        </div>
      </div>
    </div>
  );
}
