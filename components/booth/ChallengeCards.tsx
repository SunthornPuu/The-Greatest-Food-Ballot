"use client";
import { useState } from "react";

const CHALLENGES = [
  { id: "classic", title: "Classic: one clean X", tip: "One X inside one dish's box.", expect: "Should read as that dish." },
  { id: "double", title: "Double trouble: mark two boxes", tip: "Put an X in two different boxes.", expect: "Two marks → should be spoiled (-1)." },
  { id: "outside", title: "Outside the lines: X next to the box", tip: "Draw the X on the dish name, not in the box.", expect: "A mark outside the boxes → should be spoiled (-1)." },
  { id: "tiny", title: "Tiny X", tip: "Zoom in and draw a very small X in a box.", expect: "Still one X in one box → should count for that dish." },
  { id: "abstain", title: "Abstain properly", tip: "Put an X in the box in the bottom pink band.", expect: "Should be abstained (0)." },
  { id: "doodle", title: "Doodle chaos", tip: "Scribble, draw a face, write your name.", expect: "Stray ink → should be spoiled (-1)." },
  { id: "tick", title: "Tick ✓ instead of X", tip: "Mark one box with a tick instead of a cross.", expect: "Not an X → should be spoiled (-1)." },
] as const;

/** Ways to test the model. Tapping shows the tip; nothing is drawn automatically. */
export function ChallengeCards() {
  const [open, setOpen] = useState<string | null>(null);
  const active = CHALLENGES.find((c) => c.id === open);
  return (
    <section aria-labelledby="challenges-h">
      <h2 id="challenges-h" className="font-display text-lg font-extrabold">
        Try to fool it
      </h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {CHALLENGES.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              aria-expanded={open === c.id}
              aria-controls="challenge-tip"
              onClick={() => setOpen(open === c.id ? null : c.id)}
              className={`press px-2.5 py-1.5 text-left text-sm font-semibold ${open === c.id ? "bg-hot" : "bg-surface-strong"}`}
            >
              {c.title}
            </button>
          </li>
        ))}
      </ul>
      <div id="challenge-tip" aria-live="polite" className="min-h-14">
        {active && (
          <div className="cell mt-3 p-3 text-sm">
            <p>{active.tip}</p>
            <p className="mt-1 font-mono text-xs">{active.expect}</p>
          </div>
        )}
      </div>
    </section>
  );
}
