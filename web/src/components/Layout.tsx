import { ReactNode } from "react";

const SECTIONS = [
  { id: "demo-vertical", num: "1", title: "Vertical throw", subtitle: "Time of flight ↔ energy" },
  { id: "demo-two-hands", num: "2", title: "Two hands", subtitle: "Elliptical hand motion" },
  { id: "demo-pattern", num: "3", title: "Pattern", subtitle: "Coming soon" },
  { id: "demo-validator", num: "4", title: "Validator", subtitle: "Valid / invalid siteswap" },
];

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <h1 className="app-title">Juggling Physics</h1>
          <p className="app-subtitle">Interactive demos — from one ball to siteswap patterns</p>
        </div>
        <nav className="section-nav" aria-label="Demo sections">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="nav-link">
              <span className="nav-num">{s.num}</span>
              <span className="nav-text">
                {s.title}
                <small>{s.subtitle}</small>
              </span>
            </a>
          ))}
        </nav>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        Physics mirrors the{" "}
        <code>juggling_0.ipynb</code> notebook · built with React + Canvas
      </footer>
    </div>
  );
}

export function DemoHeader({ num, title, subtitle }: { num: string; title: string; subtitle: string }) {
  return (
    <div className="demo-header">
      <span className="demo-num">{num}</span>
      <div>
        <h2 className="demo-title">{title}</h2>
        <p className="demo-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}
