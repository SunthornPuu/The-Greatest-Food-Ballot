/**
 * What counts as a vote: the rules plus drawn examples of valid and spoiled marks
 * (after the election commission's "บัตรดี / บัตรเสีย" chart).
 */

type Example = { label: string; d: string; dot?: boolean };

// Each mark is drawn in a 64×36 viewBox; the box is x 2–54, y 2–34 (right margin is for "outside the box").
const VALID: Example[] = [
  { label: "X corner to corner", d: "M5 5 L51 31 M51 5 L5 31" },
  { label: "Plus sign", d: "M28 6 V30 M8 18 H48" },
  { label: "Small x", d: "M24 14 L32 22 M32 14 L24 22" },
  { label: "Off-center X", d: "M30 7 L46 28 M46 8 L27 27" },
  { label: "Looped cross", d: "M14 29 C 22 2, 44 6, 35 20 S 17 22, 44 8" },
  { label: "Traced twice", d: "M6 6 L50 30 M9 4 L52 27 M50 6 L6 30" },
];

const SPOILED: Example[] = [
  { label: "X in brackets", d: "M24 12 L33 24 M33 12 L24 24 M20 9 Q13 18 20 27 M37 9 Q44 18 37 27" },
  { label: "Tick", d: "M18 18 L25 26 L40 8" },
  { label: "Slash", d: "M20 29 L37 7" },
  { label: "V or ^", d: "M18 9 L28 27 L38 9" },
  { label: "Circle or shape", d: "M28 10 a8 8 0 1 0 0.1 0" },
  { label: "Star or ✱", d: "M28 7 V29 M18 12 L38 24 M38 12 L18 24" },
  { label: "Dot", d: "M28 18 L28.2 18", dot: true },
  { label: "Two X's", d: "M10 12 L20 24 M20 12 L10 24 M34 12 L44 24 M44 12 L34 24" },
  { label: "X + writing", d: "M8 10 L20 26 M20 10 L8 26 M27 15 c3 -4 5 4 8 0 s5 4 8 0 M27 24 c3 -3 5 3 8 0" },
  { label: "X outside the box", d: "M47 9 L62 27 M62 9 L47 27" },
];

function MarkBox({ ex }: { ex: Example }) {
  return (
    <svg viewBox="0 0 64 36" className="h-auto w-full" aria-hidden>
      <rect x="2" y="2" width="52" height="32" fill="var(--white)" stroke="var(--ink)" strokeWidth="2.5" />
      <path
        d={ex.d}
        fill="none"
        stroke="var(--ballpoint)"
        strokeWidth={ex.dot ? 5 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Filled chip: white on ballpoint blue / stamp red, readable on pink paper and at night. */
function Chip({ kind }: { kind: "valid" | "spoiled" }) {
  return (
    <span
      className={`shrink-0 px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-white ${
        kind === "valid" ? "bg-ballpoint" : "bg-stamp-void"
      }`}
    >
      {kind === "valid" ? "COUNTS" : "SPOILED"}
    </span>
  );
}

function Rule({ kind, children }: { kind: "valid" | "spoiled"; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Chip kind={kind} />
      <span>{children}</span>
    </li>
  );
}

function Examples({ title, kind, items }: { title: string; kind: "valid" | "spoiled"; items: Example[] }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 font-display text-base font-extrabold">
        <Chip kind={kind} />
        {title}
      </h3>
      <ul className="mt-2 grid grid-cols-3 gap-x-2 gap-y-2.5">
        {items.map((ex) => (
          <li key={ex.label} className="grid gap-1">
            <MarkBox ex={ex} />
            <span className="text-[11px] leading-tight">{ex.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MarkGuide() {
  return (
    <section aria-labelledby="rules-h" className="grid gap-4">
      <div>
        <h2 id="rules-h" className="font-display text-lg font-extrabold">
          What counts as a vote
        </h2>
        <ul className="mt-2 grid gap-2 text-sm">
          <Rule kind="valid">
            <strong>One X (or +) inside one box</strong> counts for that dish.
          </Rule>
          <Rule kind="valid">
            An X in the <strong>bottom pink box</strong> means you abstain. A ballot with nothing marked counts as
            abstained too.
          </Rule>
          <Rule kind="spoiled">
            <strong>Marks in two or more boxes.</strong>
          </Rule>
          <Rule kind="spoiled">
            <strong>Any mark outside the boxes</strong>, on a dish name or in the margin.
          </Rule>
          <Rule kind="spoiled">
            <strong>Any other shape</strong> in a box: tick, circle, star, writing.
          </Rule>
        </ul>
        <p className="mt-2 font-mono text-xs text-muted">The model follows these rules. See if it does.</p>
      </div>
      <Examples title="Valid marks" kind="valid" items={VALID} />
      <Examples title="Spoiled marks" kind="spoiled" items={SPOILED} />
    </section>
  );
}
