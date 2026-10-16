"use client";
import { motion, useReducedMotion } from "motion/react";
import { candidate, dishArt } from "@/lib/candidates";
import type { RaceEntry } from "@/lib/count-data";

const STEPS = [
  { place: 2, h: "h-24 sm:h-32", label: "2nd" },
  { place: 1, h: "h-36 sm:h-48", label: "1st" },
  { place: 3, h: "h-16 sm:h-24", label: "3rd" },
];

export function Podium({ race, totalVotes }: { race: RaceEntry[]; totalVotes: number }) {
  const reduce = useReducedMotion();
  const top = race.filter((r) => r.votes > 0).slice(0, 3);

  return (
    <section aria-labelledby="podium-h" className="relative">
      <h2 id="podium-h" className="sr-only">
        Top 3
      </h2>
      <ol className="grid grid-cols-3 items-end gap-2 sm:gap-4">
        {STEPS.map((step) => {
          const entry = top[step.place - 1];
          const c = entry ? candidate(entry.candidate) : undefined;
          const share = entry && totalVotes ? Math.round((entry.votes / totalVotes) * 100) : 0;
          return (
            <li key={step.place} className="flex flex-col items-center" style={{ order: step.place === 1 ? 2 : step.place === 2 ? 1 : 3 }}>
              <motion.div
                key={entry?.candidate ?? `empty-${step.place}`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35 }}
                className="mb-2 grid min-h-28 w-full content-end justify-items-center gap-1 text-center"
              >
                {entry && c ? (
                  <>
                    <span className={step.place === 1 ? "text-5xl sm:text-6xl" : "text-4xl sm:text-5xl"} aria-hidden>
                      {dishArt(entry.candidate)}
                    </span>
                    <span className="line-clamp-2 font-display text-sm font-extrabold leading-tight sm:text-lg">{c.name}</span>
                    <span className="font-mono text-xs sm:text-sm">
                      {entry.votes} vote{entry.votes === 1 ? "" : "s"} · {share}%
                    </span>
                  </>
                ) : (
                  <span className="grid size-14 place-items-center rounded-full border-3 border-dashed border-line font-display text-2xl text-muted" aria-label="empty spot">
                    ?
                  </span>
                )}
              </motion.div>
              <div
                className={`${step.h} grid w-full place-items-start justify-center border-3 border-line pt-2 shadow-hard ${
                  step.place === 1 ? "bg-hot" : "bg-surface"
                } rounded-t-[6px]`}
              >
                <span className="font-display text-2xl font-extrabold sm:text-4xl">{step.label}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
