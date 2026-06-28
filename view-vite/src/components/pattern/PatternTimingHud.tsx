import type { HandId } from "@/physics/config";
import {
  DWELL,
  DWELL_THROW_1,
  DWELL_THROW_2,
  type DwellProfile,
} from "@/physics/twoHandThrowConfig";
import { DraggableDwellPie } from "./DraggableDwellPie";
import { MetronomeControl } from "./MetronomeControl";

interface PatternTimingHudProps {
  beatPeriodS: number;
  simTime: number;
  onBeatPeriodChange: (tb: number) => void;
  dwellProfile: DwellProfile;
  onDwellProfileChange: (profile: DwellProfile) => void;
  startHand: HandId;
  onStartHandChange: (hand: HandId) => void;
}

export function PatternTimingHud({
  beatPeriodS,
  simTime,
  onBeatPeriodChange,
  dwellProfile,
  onDwellProfileChange,
  startHand,
  onStartHandChange,
}: PatternTimingHudProps) {
  return (
    <div className="pattern-hud">
      <MetronomeControl
        beatPeriodS={beatPeriodS}
        simTime={simTime}
        onBeatPeriodChange={onBeatPeriodChange}
      />
      <div className="pattern-hud-pies">
        <DraggableDwellPie
          label="≥3"
          value={dwellProfile.general}
          min={DWELL.min}
          max={DWELL.max}
          onChange={(general) => onDwellProfileChange({ ...dwellProfile, general })}
        />
        <DraggableDwellPie
          label="1"
          value={dwellProfile.throw1}
          min={DWELL_THROW_1.min}
          max={DWELL_THROW_1.max}
          onChange={(throw1) => onDwellProfileChange({ ...dwellProfile, throw1 })}
        />
        <DraggableDwellPie
          label="2"
          value={dwellProfile.throw2}
          min={DWELL_THROW_2.min}
          max={DWELL_THROW_2.max}
          onChange={(throw2) => onDwellProfileChange({ ...dwellProfile, throw2 })}
        />
      </div>
      <div className="pattern-hud-hand">
        <span className="pattern-hud-hand-label">Start</span>
        <button
          type="button"
          className={startHand === "left" ? "toggle toggle--sm active" : "toggle toggle--sm"}
          onClick={() => onStartHandChange("left")}
        >
          L
        </button>
        <button
          type="button"
          className={startHand === "right" ? "toggle toggle--sm active" : "toggle toggle--sm"}
          onClick={() => onStartHandChange("right")}
        >
          R
        </button>
      </div>
    </div>
  );
}
