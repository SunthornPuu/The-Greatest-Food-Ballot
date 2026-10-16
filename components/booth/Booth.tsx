"use client";
import { ArrowLeft, Lightbulb, X } from "lucide-react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BallotBox } from "@/components/ballot-box/BallotBox";
import { BallotCanvas, type BallotCanvasHandle, type Tool } from "@/components/ballot-canvas/BallotCanvas";
import { exportBallot } from "@/components/ballot-canvas/exportBallot";
import { useStrokes, useUndoShortcuts } from "@/components/ballot-canvas/useStrokes";
import { Stamp } from "@/components/stamp/Stamp";
import { markBox } from "@/lib/ballot-geometry";
import { shortName } from "@/lib/candidates";
import { PEN_COLORS, PEN_SIZES } from "@/lib/ink";
import type { CastResult } from "@/lib/types";
import { verdict } from "@/lib/verdict";
import { ChallengeCards } from "./ChallengeCards";
import { ResultCard } from "./ResultCard";
import { ToolDock, type ToolKind } from "./ToolDock";

type Phase = "idle" | "dropping" | "counting" | "reveal" | "result" | "error";

const STATUS = ["reading marks…", "checking boxes…", "asking the model…"];
const COLD_START_MS = 8000;
const COOLDOWN_MS = 5000;
const COACH_KEY = "booth-coach-seen";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postBallot(image: Blob, thumb: Blob, nickname: string): Promise<CastResult> {
  const form = new FormData();
  form.append("image", image, "ballot.jpg");
  form.append("thumb", thumb, "thumb.jpg");
  if (nickname.trim()) form.append("nickname", nickname.trim());
  let res: Response;
  try {
    res = await fetch("/api/ballots", { method: "POST", body: form });
  } catch {
    throw new Error("Couldn't reach the counting machine. Check your connection.");
  }
  const body = (await res.json().catch(() => null)) as (CastResult & { error?: string }) | null;
  if (!res.ok || !body || body.error) throw new Error(body?.error ?? `The counting machine jammed (${res.status}).`);
  return body;
}

export function Booth() {
  const ink = useStrokes();
  const canvas = useRef<BallotCanvasHandle>(null);
  const stage = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() ?? false;

  const [kind, setKind] = useState<ToolKind>("pen");
  const [color, setColor] = useState<string>(PEN_COLORS[0].value);
  const [size, setSize] = useState<number>(PEN_SIZES[0].value);
  const [nickname, setNickname] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<CastResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRing, setShowRing] = useState(false);
  const [showStamp, setShowStamp] = useState(false);
  const [status, setStatus] = useState(0);
  const [coldStart, setColdStart] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [coach, setCoach] = useState<null | "touch" | "mouse">(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const busy = phase === "dropping" || phase === "counting" || phase === "reveal";
  const editing = phase === "idle" || phase === "error";
  const hasInk = ink.strokes.length > 0;
  const tool: Tool = kind === "pen" ? { kind: "pen", color, size } : { kind };

  useUndoShortcuts(ink.undo, ink.redo, editing);

  // Wake the model (Cloud Run / serverless cold start) as soon as the booth opens.
  useEffect(() => {
    fetch("/api/health").catch(() => {});
  }, []);

  // One-time coach mark.
  useEffect(() => {
    try {
      if (localStorage.getItem(COACH_KEY)) return;
    } catch {
      return;
    }
    setCoach(window.matchMedia("(pointer: coarse)").matches ? "touch" : "mouse");
  }, []);
  const dismissCoach = useCallback(() => {
    setCoach(null);
    try {
      localStorage.setItem(COACH_KEY, "1");
    } catch {}
  }, []);

  // "Counting…" status lines + cold-start hint.
  useEffect(() => {
    if (phase !== "counting") return;
    setStatus(0);
    setColdStart(false);
    const rot = setInterval(() => setStatus((s) => (s + 1) % STATUS.length), 1100);
    const cold = setTimeout(() => setColdStart(true), COLD_START_MS);
    return () => {
      clearInterval(rot);
      clearTimeout(cold);
    };
  }, [phase]);

  // Cooldown countdown.
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const t = setTimeout(() => setCooldownLeft((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldownLeft]);

  const shake = () => {
    if (reduce || !stage.current) return;
    animate(stage.current, { x: [0, -7, 6, -4, 2, 0], y: [0, 3, -2, 1, 0, 0] }, { duration: 0.28 });
  };

  const cast = async () => {
    if (busy || cooldownLeft > 0) return;
    dismissCoach();
    setError(null);
    setResult(null);
    setShowRing(false);
    setShowStamp(false);

    let blobs: { image: Blob; thumb: Blob };
    try {
      blobs = await exportBallot(ink.strokes);
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
      return;
    }

    canvas.current?.fit(0);
    setPhase("dropping");
    setCooldownLeft(COOLDOWN_MS / 1000);
    const request = postBallot(blobs.image, blobs.thumb, nickname);
    request.catch(() => {}); // handled below; avoid unhandled-rejection noise during the drop
    await sleep(reduce ? 200 : 650);
    setPhase("counting");

    let row: CastResult;
    try {
      [row] = await Promise.all([request, sleep(reduce ? 300 : 1200)]);
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
      return;
    }

    setResult(row);
    setPhase("reveal");
    const box = markBox(row.prediction);
    if (box) {
      setShowRing(true);
      canvas.current?.focusBox(box, 900);
      await sleep(reduce ? 100 : 1000);
    }
    setShowStamp(true);
    shake();
    await sleep(reduce ? 200 : 750);
    setPhase("result");
  };

  const again = (keepInk: boolean) => {
    if (!keepInk) ink.clear();
    setResult(null);
    setShowRing(false);
    setShowStamp(false);
    setPhase("idle");
    canvas.current?.fit();
  };

  const v = result ? verdict(result.prediction) : null;
  const ringBox = result && showRing ? markBox(result.prediction) : null;

  // Fold → drop into the box; reappear flat for counting; slide back out of the box on error.
  const ballotMotion = reduce
    ? { opacity: phase === "dropping" ? 0 : 1 }
    : phase === "dropping"
      ? { scaleY: [1, 0.5, 0.5], scaleX: [1, 1, 0.35], y: ["0%", "0%", "62%"], opacity: [1, 1, 0] }
      : phase === "counting"
        ? { scaleY: 1, scaleX: 1, y: ["0%", "0%"], opacity: [0, 1] }
        : phase === "error"
          ? { scaleY: [0.5, 1], scaleX: [0.35, 1], y: ["62%", "0%"], opacity: [0, 1] }
          : { scaleY: 1, scaleX: 1, y: "0%", opacity: 1 };
  const ballotTransition = reduce
    ? { duration: 0.2 }
    : phase === "dropping"
      ? { duration: 0.6, times: [0, 0.4, 1], ease: "easeIn" as const }
      : phase === "error"
        ? { duration: 0.5, ease: "easeOut" as const }
        : { duration: 0.35 };

  const submitBar = (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={cast}
        disabled={!hasInk || !editing || cooldownLeft > 0}
        aria-describedby="cast-hint"
        className="press w-full bg-hot px-4 py-3 font-display text-xl font-extrabold uppercase tracking-wide"
      >
        {busy ? "Counting…" : cooldownLeft > 0 && editing ? `Wait ${cooldownLeft}s` : "Cast ballot"}
      </button>
      <p id="cast-hint" className="min-h-5 text-center text-sm">
        {!hasInk && editing && (
          <>
            Mark the ballot first ·{" "}
            <button
              type="button"
              onClick={cast}
              disabled={cooldownLeft > 0}
              className="font-semibold underline underline-offset-2 disabled:opacity-50"
            >
              submit it blank anyway
            </button>
          </>
        )}
      </p>
    </div>
  );

  const dock = (
    <ToolDock
      kind={kind}
      color={color}
      size={size}
      canUndo={ink.canUndo}
      canRedo={ink.canRedo}
      hasInk={hasInk}
      disabled={!editing}
      onKind={setKind}
      onColor={setColor}
      onSize={setSize}
      onUndo={ink.undo}
      onRedo={ink.redo}
      onClear={ink.clear}
      onFit={() => canvas.current?.fit()}
    />
  );

  return (
    <div className="h-dvh overflow-hidden overscroll-none lg:grid lg:grid-cols-[minmax(0,1fr)_400px]">
      {/* Stage: the ballot */}
      <section aria-label="Your ballot" className="flex h-dvh flex-col lg:h-full">
        <div ref={stage} className="relative min-h-0 flex-1 overflow-hidden bg-paper-deep/40">
          <motion.div
            className="absolute inset-0 origin-center"
            animate={ballotMotion}
            transition={ballotTransition}
            initial={false}
          >
            <BallotCanvas
              ref={canvas}
              className="h-full w-full"
              strokes={ink.strokes}
              tool={tool}
              readOnly={!editing}
              reducedMotion={reduce}
              onAddStroke={ink.add}
              onEraseIds={ink.removeIds}
              onInteract={coach ? dismissCoach : undefined}
              overlay={
                ringBox && (
                  <rect
                    className="ring-pulse"
                    x={ringBox.x - 18}
                    y={ringBox.y - 18}
                    width={ringBox.w + 36}
                    height={ringBox.h + 36}
                    rx={18}
                    fill="none"
                    stroke="var(--hot)"
                    strokeWidth={14}
                  />
                )
              }
            />
          </motion.div>

          {/* Scanning line while counting */}
          {phase === "counting" && (
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <div className="scan-line absolute inset-x-0 h-1.5 bg-hot shadow-[0_0_18px_6px_var(--hot)]" />
            </div>
          )}

          {/* Ballot box catches the folded ballot */}
          <AnimatePresence>
            {phase === "dropping" && (
              <motion.div
                className="pointer-events-none absolute bottom-3 left-1/2 w-44 -translate-x-1/2"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ duration: 0.25 }}
              >
                <BallotBox glow className="w-full" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status chip */}
          <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-3 flex flex-col items-center gap-1.5 px-3">
            {phase === "counting" && (
              <>
                <span className="cell bg-ink px-3 py-1 font-mono text-sm text-cell">{STATUS[status]}</span>
                {coldStart && (
                  <span className="cell bg-surface-strong px-3 py-1 font-mono text-xs">
                    waking up the counting machine (cold start)…
                  </span>
                )}
              </>
            )}
          </div>

          {/* The verdict stamp */}
          {showStamp && v && result && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
              <Stamp
                kind={v.kind}
                title={v.kind === "voted" ? `VOTED · #${result.prediction}` : v.stamp}
                subtitle={v.kind === "voted" ? shortName(result.prediction).toUpperCase() : undefined}
                label={`Verdict: ${v.label}`}
                className="w-[min(78%,460px)]"
              />
            </div>
          )}

          {/* Jammed */}
          {phase === "error" && (
            <div role="alert" className="absolute inset-x-3 top-3 z-10 mx-auto max-w-md">
              <div className="cell bg-surface-strong p-3">
                <p className="font-display text-lg font-extrabold">The counting machine jammed</p>
                <p className="text-sm">{error}</p>
                <p className="mt-1 text-xs text-muted">Your ink is safe.</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={cast} disabled={cooldownLeft > 0} className="press bg-hot px-3 py-1.5 font-bold">
                    {cooldownLeft > 0 ? `Retry in ${cooldownLeft}s` : "Retry"}
                  </button>
                  <button type="button" onClick={() => setPhase("idle")} className="press bg-surface px-3 py-1.5 font-bold">
                    Keep editing
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* First-visit coach mark */}
          {coach && phase === "idle" && (
            <button
              type="button"
              onClick={dismissCoach}
              className="cell absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 bg-ink px-4 py-3 text-center font-semibold text-cell"
            >
              {coach === "touch" ? "Pinch to zoom · one finger to draw" : "Scroll to zoom · drag to draw · double-click to zoom in"}
              <span className="mt-1 block text-xs font-normal opacity-80">tap to dismiss</span>
            </button>
          )}

          {/* Mobile result sheet */}
          {phase === "result" && result && (
            <motion.div
              className="absolute inset-x-2 bottom-2 z-20 max-h-[60%] overflow-y-auto lg:hidden"
              initial={{ y: "110%" }}
              animate={{ y: 0 }}
              transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 300, damping: 30 }}
            >
              <ResultCard result={result} onAgain={again} />
            </motion.div>
          )}
        </div>

        {/* Mobile tool dock + submit */}
        <div className="border-t-3 border-line bg-bg p-2 lg:hidden">
          <div className="mb-2 flex items-center gap-2">
            <Link href="/" aria-label="Back to The Count" className="press grid size-11 shrink-0 place-items-center bg-surface-strong">
              <ArrowLeft size={20} />
            </Link>
            <span className="flex-1 font-display text-lg font-extrabold">The Booth</span>
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              aria-expanded={infoOpen}
              aria-controls="booth-panel"
              className="press flex h-11 items-center gap-1.5 bg-surface-strong px-3 text-sm font-bold"
            >
              <Lightbulb size={18} /> Tips & sign
            </button>
          </div>
          {dock}
          <div className="mt-2">{submitBar}</div>
        </div>
      </section>

      {/* Side panel (desktop) / pop-up sheet (mobile), so the page itself never scrolls */}
      {infoOpen && (
        <div className="fixed inset-0 z-40 bg-ink/50 lg:hidden" aria-hidden onClick={() => setInfoOpen(false)} />
      )}
      <aside
        id="booth-panel"
        className={`${
          infoOpen ? "fixed inset-x-0 bottom-0 z-50 grid max-h-[80dvh] overflow-y-auto border-t-3 bg-bg" : "hidden"
        } content-start gap-5 border-line p-4 lg:static lg:z-auto lg:grid lg:max-h-none lg:overflow-y-auto lg:border-l-3 lg:border-t-0`}
      >
        <header>
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/"
              className="press hidden items-center gap-1.5 bg-surface-strong px-2.5 py-1 text-sm font-bold lg:inline-flex"
            >
              <ArrowLeft size={16} /> The Count
            </Link>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              aria-label="Close tips"
              className="press ml-auto grid size-10 place-items-center bg-surface-strong lg:hidden"
            >
              <X size={18} />
            </button>
          </div>
          <h1 className="mt-3 font-display text-3xl font-extrabold leading-none">The Booth</h1>
          <p className="mt-2 text-sm">
            Put an <strong>X</strong> in one box to vote, or in the bottom pink box to abstain. Then try to fool the model.
          </p>
        </header>
        <div className="hidden gap-4 lg:grid">
          {dock}
          {submitBar}
        </div>
        {phase === "result" && result && (
          <div className="hidden lg:block">
            <ResultCard result={result} onAgain={again} />
          </div>
        )}
        <ChallengeCards />
        <label className="grid gap-1">
          <span className="font-display text-lg font-extrabold">Sign your ballot</span>
          <span className="text-sm">Optional. Shown in the ballot box.</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 24))}
            maxLength={24}
            placeholder="nickname"
            autoComplete="nickname"
            className="border-3 border-line bg-surface-strong px-3 py-2 font-mono"
          />
          <span className="text-right font-mono text-xs">{nickname.length}/24</span>
        </label>
      </aside>
    </div>
  );
}
