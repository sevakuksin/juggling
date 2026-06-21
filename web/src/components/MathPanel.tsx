import katex from "katex";

interface MathPanelProps {
  title?: string;
  lines: string[];
}

export function MathPanel({ title, lines }: MathPanelProps) {
  return (
    <div className="math-panel">
      {title && <h4 className="math-panel-title">{title}</h4>}
      <div className="math-lines">
        {lines.map((line, i) => (
          <div
            key={i}
            className="math-line"
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(line, { throwOnError: false, displayMode: false }),
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface StatRowProps {
  label: string;
  value: string | number;
  highlight?: boolean;
}

export function StatRow({ label, value, highlight }: StatRowProps) {
  return (
    <div className={`stat-row${highlight ? " stat-row--highlight" : ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
