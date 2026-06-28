import type { ComponentType } from "react";
import { VerticalThrowDemo } from "../components/demos/VerticalThrowDemo";
import { TwoHandThrowDemo } from "../components/demos/TwoHandThrowDemo";
import { PatternJugglingDemo } from "../components/demos/PatternJugglingDemo";
import { PatternValidatorDemo } from "../components/demos/PatternValidatorDemo";

export interface DemoDefinition {
  /** URL slug under /demo/… */
  path: string;
  num: string;
  navTitle: string;
  navSubtitle: string;
  pageTitle: string;
  pageSubtitle: string;
  component: ComponentType;
  /** Short blurb on the home page card */
  description: string;
}

export const DEMOS: DemoDefinition[] = [
  {
    path: "vertical",
    num: "1",
    navTitle: "Vertical throw",
    navSubtitle: "Time of flight ↔ energy",
    pageTitle: "One ball: time of flight and energy",
    pageSubtitle: "Fix time or fix energy — they encode the same vertical parabola.",
    description: "Link throw height, time in the air, and launch energy for a single vertical toss.",
    component: VerticalThrowDemo,
  },
  {
    path: "two-hands",
    num: "2",
    navTitle: "Two hands",
    navSubtitle: "Elliptical hand motion",
    pageTitle: "One ball, two elliptical hands",
    pageSubtitle: "Catch outside, throw inside. Change throw number — it applies at the next catch.",
    description: "Siteswap throws with dwell time, inside→outside parabolas, and synced hand orbits.",
    component: TwoHandThrowDemo,
  },
  {
    path: "pattern",
    num: "3",
    navTitle: "Pattern",
    navSubtitle: "Coming soon",
    pageTitle: "Pattern juggling",
    pageSubtitle: "Multi-ball siteswap simulation.",
    description: "Full patterns with multiple balls — placeholder for now.",
    component: PatternJugglingDemo,
  },
  {
    path: "validator",
    num: "4",
    navTitle: "Validator",
    navSubtitle: "Valid / invalid siteswap",
    pageTitle: "Pattern validator",
    pageSubtitle: "Check if a siteswap string is valid.",
    description: "Enter a siteswap string and see the landing graph for valid and invalid throws.",
    component: PatternValidatorDemo,
  },
];

export function demoByPath(path: string): DemoDefinition | undefined {
  return DEMOS.find((d) => d.path === path);
}
