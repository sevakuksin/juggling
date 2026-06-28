export function PatternJugglingDemo() {
  return (
    <section className="demo-section demo-section--placeholder" id="demo-pattern">
      <div className="placeholder-card">
        <h3>Pattern juggling</h3>
        <p className="placeholder-sub">Coming soon — multi-ball simulation built on the two-hand engine.</p>
        <label className="control-label disabled">
          Pattern
          <input type="text" value="333" disabled placeholder="e.g. 531" />
        </label>
        <p className="hint">
          This section will run full siteswap patterns with multiple balls in flight. For now, try the
          validator or the single-ball two-hand demo from the home page.
        </p>
      </div>
    </section>
  );
}
