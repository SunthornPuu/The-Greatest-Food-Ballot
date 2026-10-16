/** The ballot box: a chunky ink-outlined box with a slot. `open` lifts the lid (Log header). */
export function BallotBox({ open = false, glow = false, className }: { open?: boolean; glow?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 240 200" className={className} aria-hidden>
      {/* lid */}
      <g
        style={{
          transformOrigin: "30px 70px",
          transform: open ? "rotate(-14deg) translateY(-6px)" : undefined,
          transition: "transform 300ms ease",
        }}
      >
        <path d="M22 58 L48 36 H192 L218 58 Z" fill="var(--paper-deep)" stroke="var(--ink)" strokeWidth="5" strokeLinejoin="round" />
        <rect x="18" y="56" width="204" height="18" rx="3" fill="var(--hot)" stroke="var(--ink)" strokeWidth="5" />
        {/* slot */}
        <rect
          x="78"
          y="41"
          width="84"
          height="10"
          rx="4"
          fill="var(--ink)"
          style={{ filter: glow ? "drop-shadow(0 0 6px var(--hot))" : undefined }}
        />
      </g>
      {/* body */}
      <path d="M30 74 H210 L200 186 H40 Z" fill="var(--cell)" stroke="var(--ink)" strokeWidth="5" strokeLinejoin="round" />
      <rect x="62" y="98" width="116" height="62" rx="4" fill="var(--white)" stroke="var(--ink)" strokeWidth="4" />
      {/* tiny ballot + X on the label */}
      <rect x="76" y="110" width="26" height="34" rx="2" fill="var(--paper)" stroke="var(--ink)" strokeWidth="3" />
      <path d="M82 120 L96 134 M96 120 L82 134" stroke="var(--ballpoint)" strokeWidth="4" strokeLinecap="round" />
      <path d="M112 116 H164 M112 128 H156 M112 140 H148" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
      {/* shadow line */}
      <path d="M40 186 H200" stroke="var(--ink)" strokeWidth="5" />
    </svg>
  );
}
