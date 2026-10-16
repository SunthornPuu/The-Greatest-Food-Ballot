"use client";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { BallotCanvas, type BallotCanvasHandle } from "@/components/ballot-canvas/BallotCanvas";
import { markBox } from "@/lib/ballot-geometry";
import { candidate, shortName } from "@/lib/candidates";
import { ticket } from "@/lib/ticket";
import { storageUrl, type BallotRow } from "@/lib/types";
import { verdict } from "@/lib/verdict";
import { VerdictStamp } from "./VerdictStamp";

type Props = {
  row: BallotRow;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onUpdate: (row: BallotRow) => void;
};

type Mark = { kind?: string; number?: number | null; label?: string; reason?: string; confidence?: number | null };

const noop = () => {};

function scoreLabel(k: string): string {
  const n = Number(k);
  return n === 0 ? "Abstain" : n === -1 ? "Spoiled" : `#${n} ${shortName(n)}`;
}

export function BallotDetail({ row, hasPrev, hasNext, onPrev, onNext, onClose, onUpdate }: Props) {
  const reduce = useReducedMotion() ?? false;
  const closeBtn = useRef<HTMLButtonElement>(null);
  const viewer = useRef<BallotCanvasHandle>(null);
  const [view, setView] = useState<"original" | "model">("original");
  const [sending, setSending] = useState(false);
  const [fbError, setFbError] = useState(false);
  const v = verdict(row.prediction);
  const box = markBox(row.prediction);
  const marks = (Array.isArray(row.analysis?.marks) ? row.analysis.marks : []) as Mark[];
  const scores = row.scores
    ? Object.entries(row.scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : [];

  // Focus the dialog on open, give focus back on close.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, []);

  useEffect(() => setView("original"), [row.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return; // the image viewer used the arrow key to pan
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onPrev();
      else if (e.key === "ArrowRight" && hasNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  const sendFeedback = async (value: 1 | -1) => {
    setSending(true);
    setFbError(false);
    try {
      const res = await fetch(`/api/ballots/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: value }),
      });
      if (!res.ok) throw new Error();
      onUpdate({ ...row, feedback: value });
    } catch {
      setFbError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="detail-h">
      <motion.div
        className="absolute inset-0 bg-ink/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 flex h-[92dvh] flex-col overflow-hidden border-t-3 border-line bg-bg md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[min(1000px,94vw)] md:border-l-3 md:border-t-0"
        initial={reduce ? { opacity: 0 } : { y: "100%" }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 320, damping: 34 }}
      >
        {/* header */}
        <div className="flex items-center gap-2 border-b-3 border-line p-2">
          <button type="button" onClick={onPrev} disabled={!hasPrev} aria-label="Previous ballot (←)" className="press grid size-10 place-items-center bg-surface-strong">
            <ChevronLeft size={20} />
          </button>
          <button type="button" onClick={onNext} disabled={!hasNext} aria-label="Next ballot (→)" className="press grid size-10 place-items-center bg-surface-strong">
            <ChevronRight size={20} />
          </button>
          <h2 id="detail-h" className="ml-1 flex-1 truncate font-display text-xl font-extrabold">
            <span className="font-mono">{ticket(row.id)}</span> · {v.label}
          </h2>
          <button ref={closeBtn} type="button" onClick={onClose} aria-label="Close (Esc)" className="press grid size-10 place-items-center bg-surface-strong">
            <X size={20} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_340px] md:overflow-hidden">
          {/* image */}
          <div className="relative h-[58dvh] border-b-3 border-line md:h-full md:border-b-0 md:border-r-3">
            <BallotCanvas
              key={`${row.id}-${view}`}
              ref={viewer}
              className="h-full w-full bg-paper-deep/40"
              src={view === "model" && row.processed_path ? storageUrl(row.processed_path) : storageUrl(row.image_path)}
              imageAlt={view === "model" ? "The model's annotated view of this ballot" : `Submitted ballot ${ticket(row.id)}`}
              strokes={[]}
              tool={{ kind: "pan" }}
              readOnly
              reducedMotion={reduce}
              onAddStroke={noop}
              onEraseIds={noop}
              overlay={
                view === "original" &&
                box && (
                  <rect
                    x={box.x - 14}
                    y={box.y - 14}
                    width={box.w + 28}
                    height={box.h + 28}
                    rx={14}
                    fill="none"
                    stroke="var(--hot)"
                    strokeWidth={12}
                    strokeDasharray="36 18"
                  />
                )
              }
            />
            {row.processed_path && (
              <div role="radiogroup" aria-label="Image" className="absolute left-2 top-2 flex gap-1">
                {(["original", "model"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={view === k}
                    onClick={() => setView(k)}
                    className={`press px-2.5 py-1 text-sm font-bold ${view === k ? "bg-hot" : "bg-surface-strong"}`}
                  >
                    {k === "original" ? "Original" : "Model's view"}
                  </button>
                ))}
              </div>
            )}
            {box && (
              <button
                type="button"
                onClick={() => viewer.current?.focusBox(box, 600)}
                className="press absolute bottom-2 left-2 bg-surface-strong px-2.5 py-1 text-sm font-bold"
              >
                Zoom to {row.prediction === 0 ? "abstain box" : `box #${row.prediction}`}
              </button>
            )}
          </div>

          {/* facts */}
          <div className="grid content-start gap-4 p-4 md:overflow-y-auto">
            <VerdictStamp prediction={row.prediction} size="lg" className="mx-auto w-[85%]" />
            <p className="text-center font-display text-2xl font-extrabold leading-tight">
              {v.art && <span aria-hidden>{v.art} </span>}
              {v.kind === "voted" ? candidate(row.prediction)?.name : v.label}
            </p>

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-sm">
              {row.confidence != null && (
                <>
                  <dt className="text-muted">confidence</dt>
                  <dd>{(row.confidence * 100).toFixed(1)}%</dd>
                </>
              )}
              {row.model_version && (
                <>
                  <dt className="text-muted">model</dt>
                  <dd>{row.model_version}</dd>
                </>
              )}
              {row.latency_ms != null && (
                <>
                  <dt className="text-muted">latency</dt>
                  <dd>{row.latency_ms} ms</dd>
                </>
              )}
              <dt className="text-muted">cast</dt>
              <dd>
                <time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString()}</time>
              </dd>
              {row.nickname && (
                <>
                  <dt className="text-muted">signed</dt>
                  <dd className="font-sans font-semibold">{row.nickname}</dd>
                </>
              )}
            </dl>

            {typeof row.analysis?.reason === "string" && (
              <div className="cell bg-surface-strong p-3">
                <p className="font-display font-extrabold">Why</p>
                <p className="font-mono text-sm">“{row.analysis.reason}”</p>
                {marks.length > 0 && (
                  <ul className="mt-2 grid gap-1 font-mono text-xs">
                    {marks.map((m, i) => (
                      <li key={i}>
                        {m.kind === "no_vote_box" ? "abstain box" : m.kind === "stray" ? "stray mark" : `box #${m.number}`} ·{" "}
                        <span className={m.label === "VALID" ? "" : "text-stamp-void"}>{m.label}</span>
                        {m.reason ? ` · ${m.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {scores.length > 0 && (
              <div>
                <p className="font-display font-extrabold">Top guesses</p>
                <ul className="mt-1 grid gap-1">
                  {scores.map(([k, p]) => (
                    <li key={k} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-xs">
                      <span className="truncate">{scoreLabel(k)}</span>
                      <span className="h-2.5 border-2 border-line bg-surface-strong">
                        <span className="block h-full bg-hot" style={{ width: `${Math.round(p * 100)}%` }} />
                      </span>
                      <span className="text-right font-mono">{(p * 100).toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="font-display font-extrabold">Did the model get it right?</p>
              <div className="mt-1 flex gap-2">
                {([1, -1] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    disabled={sending}
                    aria-pressed={row.feedback === val}
                    aria-label={val === 1 ? "Yes, it got it right" : "No, it got it wrong"}
                    onClick={() => sendFeedback(val)}
                    className={`press px-3 py-1.5 text-lg ${row.feedback === val ? "bg-hot" : "bg-surface-strong"}`}
                  >
                    {val === 1 ? "👍" : "👎"}
                  </button>
                ))}
              </div>
              {fbError && <p className="mt-1 text-sm text-stamp-void">Couldn&apos;t save that. Try again.</p>}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
