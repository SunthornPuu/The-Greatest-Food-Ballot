"use client";
import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import type { VerdictKind } from "@/lib/verdict";

const INK: Record<VerdictKind, string> = {
  voted: "#E0279A", // hot pink, deepened so it reads on pink paper
  abstained: "var(--stamp-skip)",
  spoiled: "var(--stamp-void)",
};

type Props = {
  kind: VerdictKind;
  title: string; // "VOTED · #5"
  subtitle?: string; // "GREEN CURRY"
  /** Screen-reader text, e.g. "Verdict: voted for Green Curry". */
  label: string;
  size?: "lg" | "sm";
  animate?: boolean;
  rotate?: number;
  className?: string;
};

/** Rubber-stamp verdict: rotated, rough-edged, with an optional "thunk" entrance. */
export function Stamp({ kind, title, subtitle, label, size = "lg", animate = true, rotate = -8, className }: Props) {
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const color = INK[kind];
  const w = size === "lg" ? 520 : 260;
  const titleSize = size === "lg" ? 58 : 30;
  const subSize = size === "lg" ? 30 : 16;
  const h = subtitle ? (size === "lg" ? 170 : 88) : size === "lg" ? 120 : 62;

  const svg = (
    <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full" role="img" aria-label={label}>
      <defs>
        <filter id={`rough-${id}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale={size === "lg" ? 5 : 3} />
        </filter>
        <filter id={`grain-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="8" />
          {/* white with speckled alpha → mostly solid ink with worn spots */}
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.6 1.75" />
        </filter>
        <mask id={`ink-${id}`}>
          <rect width={w} height={h} fill="white" filter={`url(#grain-${id})`} />
        </mask>
      </defs>
      <g filter={`url(#rough-${id})`} mask={`url(#ink-${id})`} fill="none" stroke={color} style={{ color }}>
        <rect x="6" y="6" width={w - 12} height={h - 12} rx="10" strokeWidth={size === "lg" ? 7 : 4} />
        <rect x="16" y="16" width={w - 32} height={h - 32} rx="6" strokeWidth={size === "lg" ? 2.5 : 1.5} />
        <text
          x={w / 2}
          y={subtitle ? h * 0.47 : h * 0.62}
          textAnchor="middle"
          fill="currentColor"
          stroke="none"
          fontFamily="var(--font-display)"
          fontWeight={800}
          fontSize={titleSize}
          letterSpacing="2"
          textLength={title.length > 12 ? w - 70 : undefined}
          lengthAdjust="spacingAndGlyphs"
        >
          {title}
        </text>
        {subtitle && (
          <text
            x={w / 2}
            y={h * 0.78}
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontFamily="var(--font-display)"
            fontWeight={700}
            fontSize={subSize}
            letterSpacing="3"
            textLength={subtitle.length > 22 ? w - 70 : undefined}
            lengthAdjust="spacingAndGlyphs"
          >
            {subtitle}
          </text>
        )}
      </g>
    </svg>
  );

  if (!animate) {
    return (
      <div className={className} style={{ transform: `rotate(${rotate}deg)` }}>
        {svg}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0, rotate } : { opacity: 0, scale: 1.4, rotate: rotate - 4 }}
      animate={{ opacity: 1, scale: 1, rotate }}
      transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 700, damping: 26, mass: 0.9 }}
    >
      {svg}
    </motion.div>
  );
}
