import { useState } from "react";
import type { HandId } from "@/physics/config";
import { DEFAULT_PHYSICS } from "@/physics/config";
import { PATTERN_CATALOG } from "@/physics/patternCatalog";
import {
  BEAT_PERIOD,
  DWELL,
  HAND_SEP,
  HEIGHT_ZOOM,
} from "@/physics/twoHandThrowConfig";
import { PatternRunPanel, type PatternRunSettings } from "@/components/PatternRunPanel";
import { PALM_M } from "@/physics/sceneScale";

export function PatternGalleryScene() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [startHand, setStartHand] = useState<HandId>("right");
  const [dwellBeats, setDwellBeats] = useState<number>(DWELL.default);
  const [beatPeriod, setBeatPeriod] = useState<number>(BEAT_PERIOD.default);
  const [handSep, setHandSep] = useState(DEFAULT_PHYSICS.handSeparationM);
  const [heightZoom, setHeightZoom] = useState<number>(HEIGHT_ZOOM.default);

  const settings: PatternRunSettings = {
    startHand,
    dwellBeats,
    beatPeriod,
    handSep,
    heightZoom,
  };

  const selected = PATTERN_CATALOG.find((p) => p.id === selectedId);

  return (
    <div className="pattern-gallery">
      <section className="pattern-settings">
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
          <label className="control-label">
            Dwell D (beats in hand)
            <input
              type="range"
              min={DWELL.min}
              max={DWELL.max}
              step={DWELL.step}
              value={dwellBeats}
              onChange={(e) => setDwellBeats(parseFloat(e.target.value))}
            />
            <span className="control-value">D={dwellBeats.toFixed(2)}</span>
          </label>
          <label className="control-label">
            Height zoom
            <input
              type="range"
              min={HEIGHT_ZOOM.min}
              max={HEIGHT_ZOOM.max}
              step={0.05}
              value={heightZoom}
              onChange={(e) => setHeightZoom(parseFloat(e.target.value))}
            />
            <span className="control-value">{heightZoom.toFixed(2)}×</span>
          </label>
          <label className="control-label">
            Beat period T_b (s)
            <input
              type="range"
              min={BEAT_PERIOD.min}
              max={BEAT_PERIOD.max}
              step={0.01}
              value={beatPeriod}
              onChange={(e) => setBeatPeriod(parseFloat(e.target.value))}
            />
            <span className="control-value">{beatPeriod.toFixed(2)} s</span>
          </label>
          <label className="control-label">
            Hand separation (m)
            <input
              type="range"
              min={HAND_SEP.minPalms * PALM_M}
              max={HAND_SEP.maxPalms * PALM_M}
              step={HAND_SEP.stepPalms * PALM_M}
              value={handSep}
              onChange={(e) => setHandSep(parseFloat(e.target.value))}
            />
            <span className="control-value">{handSep.toFixed(2)} m</span>
          </label>
        </div>
      </section>

      <div className="pattern-grid" role="list">
        {PATTERN_CATALOG.map((pattern) => (
          <button
            key={pattern.id}
            type="button"
            role="listitem"
            className={
              selectedId === pattern.id ? "pattern-card pattern-card--active" : "pattern-card"
            }
            onClick={() => setSelectedId(selectedId === pattern.id ? null : pattern.id)}
          >
            <span className="pattern-card-label">{pattern.label}</span>
            <span className="pattern-card-badge">{pattern.ballCount} balls</span>
          </button>
        ))}
      </div>

      {selected && (
        <PatternRunPanel key={selected.id} pattern={selected} settings={settings} />
      )}
    </div>
  );
}
