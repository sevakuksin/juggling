import { Layout, DemoHeader } from "./components/Layout";
import { VerticalThrowDemo } from "./components/demos/VerticalThrowDemo";
import { TwoHandThrowDemo } from "./components/demos/TwoHandThrowDemo";
import { PatternJugglingDemo } from "./components/demos/PatternJugglingDemo";
import { PatternValidatorDemo } from "./components/demos/PatternValidatorDemo";

export default function App() {
  return (
    <Layout>
      <DemoHeader
        num="1"
        title="One ball: time of flight and energy"
        subtitle="Fix time or fix energy — they encode the same vertical parabola."
      />
      <VerticalThrowDemo />

      <DemoHeader
        num="2"
        title="One ball, two elliptical hands"
        subtitle="Catch outside, throw inside. Change throw number — it applies at the next catch."
      />
      <TwoHandThrowDemo />

      <DemoHeader num="3" title="Pattern juggling" subtitle="Multi-ball siteswap simulation." />
      <PatternJugglingDemo />

      <DemoHeader num="4" title="Pattern validator" subtitle="Check if a siteswap string is valid." />
      <PatternValidatorDemo />
    </Layout>
  );
}
