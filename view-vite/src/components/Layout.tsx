import { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { DEMOS } from "@/demos/registry";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="app-brand">
            <h1 className="app-title">Juggling Physics</h1>
            <p className="app-subtitle">SVG animations — from one ball to siteswap patterns</p>
          </Link>
        </div>
        <nav className="section-nav" aria-label="Demo sections">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}
          >
            <span className="nav-num nav-num--home">⌂</span>
            <span className="nav-text">
              Home
              <small>All visualizations</small>
            </span>
          </NavLink>
          {DEMOS.map((demo) => (
            <NavLink
              key={demo.path}
              to={`/demo/${demo.path}`}
              className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}
            >
              <span className="nav-num">{demo.num}</span>
              <span className="nav-text">
                {demo.navTitle}
                <small>{demo.navSubtitle}</small>
              </span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        SVG sprite rendering · companion to <code>juggling_0.ipynb</code>
      </footer>
    </div>
  );
}

export function DemoHeader({
  num,
  title,
  subtitle,
}: {
  num: string;
  title: string;
  subtitle: string;
}) {
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

export function StatRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className={`stat-row${highlight ? " stat-row--highlight" : ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
