interface TimeControlsProps {
  simTime: number;
  maxTime: number;
  playing: boolean;
  speed: number;
  onTogglePlay: () => void;
  onTimeChange: (t: number) => void;
  onSpeedChange: (s: number) => void;
  onReset?: () => void;
  timeLabel?: string;
}

export function TimeControls({
  simTime,
  maxTime,
  playing,
  speed,
  onTogglePlay,
  onTimeChange,
  onSpeedChange,
  onReset,
  timeLabel = "Time",
}: TimeControlsProps) {
  return (
    <div className="time-controls">
      <div className="time-controls-row">
        <button type="button" className="btn-play" onClick={onTogglePlay} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "⏸" : "▶"}
        </button>
        {onReset && (
          <button type="button" className="btn-secondary" onClick={onReset}>
            Reset
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
      <label className="slider-label">
        {timeLabel}: {simTime.toFixed(2)} s / {maxTime.toFixed(2)} s
        <input
          type="range"
          min={0}
          max={maxTime}
          step={0.01}
          value={Math.min(simTime, maxTime)}
          onChange={(e) => onTimeChange(parseFloat(e.target.value))}
        />
      </label>
    </div>
  );
}

interface FreeTimeControlsProps {
  simTime: number;
  windowS: number;
  playing: boolean;
  speed: number;
  onTogglePlay: () => void;
  onScrub: (localT: number) => void;
  windowOffset: number;
  onWindowOffsetChange: (offset: number) => void;
  onSpeedChange: (s: number) => void;
}

export function FreeTimeControls({
  simTime,
  windowS,
  playing,
  speed,
  onTogglePlay,
  onScrub,
  windowOffset,
  onWindowOffsetChange,
  onSpeedChange,
}: FreeTimeControlsProps) {
  const localT = ((simTime - windowOffset) % windowS + windowS) % windowS;
  return (
    <div className="time-controls">
      <div className="time-controls-row">
        <button type="button" className="btn-play" onClick={onTogglePlay}>
          {playing ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onWindowOffsetChange(Math.floor(simTime / windowS) * windowS)}
        >
          Sync window
        </button>
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
        <span className="time-readout">t = {simTime.toFixed(2)} s</span>
      </div>
      <label className="slider-label">
        Scrub ({windowS.toFixed(0)} s window)
        <input
          type="range"
          min={0}
          max={windowS}
          step={0.01}
          value={localT}
          onChange={(e) => onScrub(parseFloat(e.target.value))}
        />
      </label>
    </div>
  );
}
