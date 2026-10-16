"use client";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { relativeTime, ticket } from "@/lib/ticket";
import { storageUrl, type BallotRow } from "@/lib/types";
import { verdict } from "@/lib/verdict";
import { VerdictStamp } from "./VerdictStamp";

type Props = {
  row: BallotRow;
  now: number;
  highlight: boolean;
  priority?: boolean;
  onOpen: (id: string) => void;
};

export function BallotCard({ row, now, highlight, priority, onOpen }: Props) {
  const reduce = useReducedMotion();
  const v = verdict(row.prediction);
  return (
    <motion.li
      layout={reduce ? false : "position"}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="list-none"
    >
      <button
        type="button"
        onClick={() => onOpen(row.id)}
        aria-label={`Ballot ${ticket(row.id)}: ${v.label}${row.nickname ? `, signed ${row.nickname}` : ""}`}
        className={`press group block w-full overflow-hidden bg-surface text-left ${
          highlight ? "ring-4 ring-hot ring-offset-2 ring-offset-bg animate-[pulse_1s_ease-in-out_3]" : ""
        }`}
      >
        <div className="relative aspect-[600/720] border-b-3 border-line bg-paper">
          <Image
            src={storageUrl(row.thumb_path)}
            alt=""
            fill
            sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            priority={priority}
            className="object-cover"
          />
          <VerdictStamp prediction={row.prediction} className="absolute bottom-[8%] right-[4%] w-[78%] drop-shadow-[0_1px_0_white]" />
        </div>
        <div className="grid gap-1 p-2">
          <div className="flex items-baseline justify-between gap-2 font-mono text-xs">
            <span className="font-bold">{ticket(row.id)}</span>
            <time dateTime={row.created_at} className="text-muted">
              {relativeTime(row.created_at, now)}
            </time>
          </div>
          {row.nickname && <p className="truncate text-sm font-semibold">✍️ {row.nickname}</p>}
          {row.confidence != null && (
            <div className="flex items-center gap-2" aria-label={`confidence ${(row.confidence * 100).toFixed(0)} percent`}>
              <div className="h-2 flex-1 border-2 border-line bg-surface-strong">
                <div className="h-full bg-hot" style={{ width: `${Math.round(row.confidence * 100)}%` }} />
              </div>
              <span className="font-mono text-[11px]">{(row.confidence * 100).toFixed(0)}%</span>
            </div>
          )}
          {row.feedback === -1 && <p className="font-mono text-[11px] text-stamp-void">👎 flagged wrong</p>}
        </div>
      </button>
    </motion.li>
  );
}

export function SkeletonCard() {
  return (
    <li className="list-none" aria-hidden>
      <div className="cell overflow-hidden">
        <div className="aspect-[600/720] animate-pulse border-b-3 border-line bg-paper-deep" />
        <div className="grid gap-2 p-2">
          <div className="h-3 w-2/3 animate-pulse bg-paper-deep" />
          <div className="h-2 w-full animate-pulse bg-paper-deep" />
        </div>
      </div>
    </li>
  );
}
