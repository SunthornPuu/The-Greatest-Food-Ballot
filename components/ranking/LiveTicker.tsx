"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { dishArt, shortName } from "@/lib/candidates";
import type { TickerEvent } from "@/lib/count-data";
import { relativeTime, ticket } from "@/lib/ticket";

function describe(e: TickerEvent): string {
  if (e.prediction === -1) return "was spoiled 🗑️";
  if (e.prediction === 0) return "abstained 🤐";
  return `voted ${shortName(e.prediction)} ${dishArt(e.prediction)}`;
}

/** A strip of recent ballots, newest first, fed by realtime. */
export function LiveTicker({ events, now }: { events: TickerEvent[]; now: number }) {
  const reduce = useReducedMotion();
  const latest = events[0];
  return (
    <section aria-label="Live ticker" className="border-y-3 border-line bg-ink text-cell">
      <p className="sr-only" aria-live="polite">
        {latest ? `${ticket(latest.id)} ${describe(latest)}` : ""}
      </p>
      <ul className="flex h-11 items-center gap-6 overflow-hidden whitespace-nowrap px-4 font-mono text-sm" aria-hidden>
        {events.length === 0 && <li className="opacity-70">waiting for the first ballot…</li>}
        <AnimatePresence initial={false}>
          {events.map((e, i) => (
            <motion.li
              key={e.id}
              layout={reduce ? false : "position"}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: -40 }}
              animate={{ opacity: i === 0 ? 1 : Math.max(0.35, 1 - i * 0.1), x: 0 }}
              exit={{ opacity: 0 }}
              className="shrink-0"
            >
              <span className="font-bold text-hot">{ticket(e.id)}</span> {describe(e)}{" "}
              <span className="opacity-70">· {relativeTime(e.created_at, now)}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
