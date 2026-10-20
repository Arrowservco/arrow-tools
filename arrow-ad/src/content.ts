// All ad copy and brand settings live here. Edit this file to match the website.
export type AdContent = {
  readonly companyName: string;
  readonly website: string;
  readonly phone: string; // leave "" to hide
  readonly hookLine1: string;
  readonly hookLine2: string;
  readonly tagline: string;
  readonly points: readonly { readonly title: string; readonly sub: string }[];
  readonly closer1: string;
  readonly closer2: string;
  readonly ctaHeadline: string;
  readonly colors: {
    readonly bg: string;
    readonly bgDeep: string;
    readonly accent: string;
    readonly text: string;
    readonly muted: string;
  };
};

export const defaultContent: AdContent = {
  companyName: "Arrow Service Company",
  website: "arrowservicecompany.com",
  phone: "",
  hookLine1: "Need it done right?",
  hookLine2: "Skip the runaround.",
  tagline: "Straight to the point.",
  points: [
    { title: "Fast Response", sub: "You call. We show up." },
    { title: "Done Right", sub: "Quality work, start to finish." },
    { title: "Fair & Upfront", sub: "No surprises. Ever." },
  ],
  closer1: "Right on target.",
  closer2: "Every time.",
  ctaHeadline: "Get Your Free Quote",
  colors: {
    bg: "#0b1f3a",
    bgDeep: "#050f1e",
    accent: "#ff7a1a",
    text: "#ffffff",
    muted: "#9fb3cc",
  },
};
