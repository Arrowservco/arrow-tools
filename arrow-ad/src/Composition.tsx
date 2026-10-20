import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
import type { AdContent } from "./content";

const headingFont = "Barlow Condensed";
const bodyFont = "Inter";

Promise.all([
  loadFont({ family: headingFont, url: staticFile("fonts/barlow-condensed-latin-700-normal.woff2"), weight: "700" }),
  loadFont({ family: headingFont, url: staticFile("fonts/barlow-condensed-latin-800-normal.woff2"), weight: "800" }),
  loadFont({ family: bodyFont, url: staticFile("fonts/inter-latin-500-normal.woff2"), weight: "500" }),
  loadFont({ family: bodyFont, url: staticFile("fonts/inter-latin-600-normal.woff2"), weight: "600" }),
]);

const ease = Easing.bezier(0.16, 1, 0.3, 1);

// Fades a scene in and out at its edges.
const Scene: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const edge = 0.4 * fps;
  return (
    <AbsoluteFill
      style={{
        opacity: interpolate(
          frame,
          [0, edge, durationInFrames - edge, durationInFrames],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        ),
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "100px 120px",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// Slides + fades its children up after `delay` seconds.
const Reveal: React.FC<{ delay?: number; children: React.ReactNode }> = ({
  delay = 0,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        opacity: interpolate(frame, [delay * fps, (delay + 0.6) * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease,
        }),
        translate: interpolate(
          frame,
          [delay * fps, (delay + 0.8) * fps],
          ["0px 60px", "0px 0px"],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease },
        ),
      }}
    >
      {children}
    </div>
  );
};

const ArrowMark: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M10 50 H70 M48 24 L76 50 L48 76" stroke={color} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

// Slow-drifting arrows behind everything.
const Background: React.FC<{ c: AdContent["colors"] }> = ({ c }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{ background: `radial-gradient(circle at 30% 20%, ${c.bg}, ${c.bgDeep})` }}
    >
      {Array.from({ length: 7 }).map((_, i) => {
        const x = ((frame * (1.2 + i * 0.35) + i * 380) % 2400) - 300;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 90 + i * 150,
              left: x,
              opacity: 0.07,
            }}
          >
            <ArrowMark size={160 + (i % 3) * 60} color={c.accent} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Headline: React.FC<{ color: string; children: React.ReactNode; size?: number }> = ({
  color,
  children,
  size = 190,
}) => (
  <div
    style={{
      fontFamily: headingFont,
      fontWeight: 800,
      fontSize: size,
      lineHeight: 1,
      color,
      textTransform: "uppercase",
      letterSpacing: 2,
    }}
  >
    {children}
  </div>
);

const Sub: React.FC<{ color: string; children: React.ReactNode }> = ({
  color,
  children,
}) => (
  <div style={{ fontFamily: bodyFont, fontWeight: 500, fontSize: 64, color }}>
    {children}
  </div>
);

export const ArrowAd: React.FC<AdContent> = (p) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const c = p.colors;

  // Accent arrow that shoots across the frame during the brand reveal.
  const shoot = interpolate(frame, [4 * fps, 5.2 * fps], [-400, 2400], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.5, 0, 0.2, 1),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: c.bgDeep }}>
      <Background c={c} />

      {/* 0-4s Hook */}
      <Sequence  durationInFrames={4 * fps} name="Hook">
        <Scene>
          <Reveal>
            <Headline color={c.text}>{p.hookLine1}</Headline>
          </Reveal>
          <Reveal delay={1}>
            <Headline color={c.accent}>{p.hookLine2}</Headline>
          </Reveal>
        </Scene>
      </Sequence>

      {/* 4-9s Brand reveal */}
      <Sequence from={4 * fps} durationInFrames={5 * fps} name="Brand">
        <Scene>
          <Reveal delay={0.5}>
            <ArrowMark size={220} color={c.accent} />
          </Reveal>
          <Reveal delay={0.8}>
            <Headline color={c.text} size={220}>{p.companyName}</Headline>
          </Reveal>
          <Reveal delay={1.6}>
            <Sub color={c.muted}>{p.tagline}</Sub>
          </Reveal>
        </Scene>
      </Sequence>
      <div
        style={{
          position: "absolute",
          top: 520,
          left: shoot,
          opacity: 0.9,
        }}
      >
        <ArrowMark size={300} color={c.accent} />
      </div>

      {/* 9-21s Value points, 4s each */}
      {p.points.map((pt, i) => (
        <Sequence key={pt.title} from={(9 + i * 4) * fps} durationInFrames={4 * fps} name={pt.title}>
          <Scene>
            <Reveal>
              <div style={{ fontFamily: headingFont, fontWeight: 700, fontSize: 80, color: c.accent, letterSpacing: 8 }}>
                0{i + 1}
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <Headline color={c.text}>{pt.title}</Headline>
            </Reveal>
            <Reveal delay={0.7}>
              <Sub color={c.muted}>{pt.sub}</Sub>
            </Reveal>
          </Scene>
        </Sequence>
      ))}

      {/* 21-26s Closer */}
      <Sequence from={21 * fps} durationInFrames={5 * fps} name="Closer">
        <Scene>
          <Reveal>
            <Headline color={c.text}>{p.closer1}</Headline>
          </Reveal>
          <Reveal delay={1}>
            <Headline color={c.accent}>{p.closer2}</Headline>
          </Reveal>
        </Scene>
      </Sequence>

      {/* 26-30s CTA */}
      <Sequence from={26 * fps} durationInFrames={4 * fps} name="CTA">
        <Scene>
          <Reveal>
            <Headline color={c.accent}>{p.ctaHeadline}</Headline>
          </Reveal>
          {p.phone ? (
            <Reveal delay={0.4}>
              <Headline color={c.text} size={170}>{p.phone}</Headline>
            </Reveal>
          ) : null}
          <Reveal delay={0.8}>
            <div style={{ fontFamily: bodyFont, fontWeight: 600, fontSize: 80, color: c.text, marginTop: 24 }}>
              {p.website}
            </div>
          </Reveal>
        </Scene>
      </Sequence>
    </AbsoluteFill>
  );
};
