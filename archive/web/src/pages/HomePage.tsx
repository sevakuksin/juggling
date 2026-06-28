import { Link } from "react-router-dom";
import { DEMOS } from "../demos/registry";

export function HomePage() {
  return (
    <div className="home-page">
      <section className="home-intro">
        <h2 className="home-heading">Choose a visualization</h2>
        <p className="home-lead">
          Each demo is a self-contained lesson in juggling physics — from a single vertical throw to
          siteswap validation. More will be added here over time.
        </p>
      </section>
      <ul className="demo-cards">
        {DEMOS.map((demo) => (
          <li key={demo.path}>
            <Link to={`/demo/${demo.path}`} className="demo-card">
              <span className="demo-card-num">{demo.num}</span>
              <div className="demo-card-body">
                <h3 className="demo-card-title">{demo.navTitle}</h3>
                <p className="demo-card-sub">{demo.navSubtitle}</p>
                <p className="demo-card-desc">{demo.description}</p>
                <span className="demo-card-cta">Open demo →</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
