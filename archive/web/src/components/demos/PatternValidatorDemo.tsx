import { useMemo, useState } from "react";
import { LandingGraph } from "../validator/LandingGraph";
import { StatRow } from "../MathPanel";
import { reportPattern } from "../../physics/siteswap";

export function PatternValidatorDemo() {
  const [pattern, setPattern] = useState("531");

  const { report, error } = useMemo(() => {
    try {
      return { report: reportPattern(pattern), error: null as string | null };
    } catch (e) {
      return { report: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [pattern]);

  return (
    <section className="demo-section" id="demo-validator">
      <div className="demo-grid demo-grid--validator">
        <div className="validator-viz">
          {report && !error ? (
            <LandingGraph report={report} size={240} />
          ) : (
            <div className="validator-error-graph">?</div>
          )}
          {report && (
            <div className={`valid-badge ${report.valid ? "valid" : "invalid"}`}>
              {report.valid ? "Valid pattern" : "Invalid pattern"}
            </div>
          )}
        </div>
        <div className="demo-side">
          <label className="control-label">
            Siteswap pattern
            <input
              type="text"
              className="pattern-input"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="333, 531, 441…"
            />
          </label>
          {error && <p className="error-msg">{error}</p>}
          {report && !error && (
            <>
              <StatRow label="Period" value={report.period} />
              <StatRow label="Throws" value={report.values.join(" ")} />
              <StatRow
                label="Ball count (avg)"
                value={report.averageBallCount.toFixed(2)}
                highlight={!Number.isInteger(report.averageBallCount)}
              />
              <StatRow label="Landing residues" value={report.landingResidues.join(", ")} />
              {!report.valid && report.invalidReason && (
                <p className="hint invalid-reason">{report.invalidReason}</p>
              )}
              <p className="hint">
                Arrows show where each throw lands: beat <em>i</em> →{" "}
                <em>(i + throw) mod period</em>. Valid patterns need unique landings and an integer
                ball count.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
