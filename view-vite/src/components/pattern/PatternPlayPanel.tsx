interface PatternPlayPanelProps {
  playing: boolean;
  speed: number;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  onRestart?: () => void;
  showRestart?: boolean;
}

export function PatternPlayPanel({
  playing,
  speed,
  onTogglePlay,
  onSpeedChange,
  onRestart,
  showRestart,
}: PatternPlayPanelProps) {
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
    </div>
  );
}
