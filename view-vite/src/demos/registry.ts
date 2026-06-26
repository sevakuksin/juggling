import type { ComponentType } from "react";
import { VerticalThrowScene } from "@/demos/VerticalThrowScene";
import { TwoHandThrowScene } from "@/demos/TwoHandThrowScene";
import { PatternGalleryScene } from "@/demos/PatternGalleryScene";
import { PatternScene } from "@/demos/PatternScene";
import { ValidatorScene } from "@/demos/ValidatorScene";

export interface DemoDefinition {
  path: string;
  num: string;
  navTitle: string;
  navSubtitle: string;
  pageTitle: string;
  pageSubtitle: string;
  description: string;
  component: ComponentType;
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
    component: VerticalThrowScene,
  },
  {
    path: "two-hands",
    num: "2",
    navTitle: "Two hands",
    navSubtitle: "",
    pageTitle: "Two hands",
    pageSubtitle: "",
    description: "",
    component: TwoHandThrowScene,
  },
  {
    path: "patterns",
    num: "3",
    navTitle: "Patterns",
    navSubtitle: "",
    pageTitle: "Patterns",
    pageSubtitle: "",
    description: "",
    component: PatternGalleryScene,
  },
  {
    path: "pattern",
    num: "4",
    navTitle: "Pattern",
    navSubtitle: "Coming soon",
    pageTitle: "Pattern juggling",
    pageSubtitle: "Multi-ball siteswap simulation.",
    description: "Full patterns with multiple balls — placeholder for now.",
    component: PatternScene,
  },
  {
    path: "validator",
    num: "5",
    navTitle: "Validator",
    navSubtitle: "Valid / invalid siteswap",
    pageTitle: "Pattern validator",
    pageSubtitle: "Check if a siteswap string is valid.",
    description: "Enter a siteswap string and see the landing graph for valid and invalid throws.",
    component: ValidatorScene,
  },
];

export function demoByPath(path: string): DemoDefinition | undefined {
  return DEMOS.find((d) => d.path === path);
}
