"use client";
import Link from "next/link";
import { useState } from "react";
import { ticket } from "@/lib/ticket";
import { storageUrl, type CastResult } from "@/lib/types";
import { verdict } from "@/lib/verdict";

type Props = {
  result: CastResult;
  onAgain: (keepInk: boolean) => void;
};

export function ResultCard({ result, onAgain }: Props) {
  const v = verdict(result.prediction);
  const saved = result.saved !== false;
  const [feedback, setFeedback] = useState<1 | -1 | null>(result.feedback);
  const [sending, setSending] = useState(false);
  const [fbError, setFbError] = useState(false);
  const processed = result.processed_data_url ?? (result.processed_path ? storageUrl(result.processed_path) : null);
  const reason = typeof result.analysis?.reason === "string" ? result.analysis.reason : null;

  const send = async (value: 1 | -1) => {
    setSending(true);
    setFbError(false);
    try {
      const res = await fetch(`/api/ballots/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: value }),
      });
      if (!res.ok) throw new Error();
      setFeedback(value);
    } catch {
      setFbError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-labelledby="result-h" className="cell bg-surface-strong p-4">
      <p className="font-mono text-xs text-muted">
        TICKET {ticket(result.id)}
        {result.latency_ms != null && ` · ${(result.latency_ms / 1000).toFixed(1)}s`}
        {result.model_version && ` · ${result.model_version}`}
      </p>
      <h2 id="result-h" className="mt-1 flex items-center gap-2 font-display text-2xl font-extrabold leading-tight">
        {v.art && <span aria-hidden>{v.art}</span>}
        {v.label}
      </h2>
      {result.confidence != null && (
        <p className="mt-1 font-mono text-sm">confidence {(result.confidence * 100).toFixed(0)}%</p>
      )}
      {reason && <p className="mt-2 font-mono text-xs">model: “{reason}”</p>}

      {processed && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold">What the model saw</summary>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL or storage URL */}
          <img
            src={processed}
            alt="The model's annotated view of your ballot"
            className="mt-2 w-full border-3 border-line"
          />
        </details>
      )}

      {saved ? (
        <div className="mt-4">
          <p className="text-sm font-semibold">Did the model get it right?</p>
          <div className="mt-1 flex gap-2">
            {([1, -1] as const).map((val) => (
              <button
                key={val}
                type="button"
                disabled={sending}
                aria-pressed={feedback === val}
                onClick={() => send(val)}
                className={`press px-3 py-1.5 text-lg ${feedback === val ? "bg-hot" : "bg-surface"}`}
                aria-label={val === 1 ? "Yes, it got it right" : "No, it got it wrong"}
              >
                {val === 1 ? "👍" : "👎"}
              </button>
            ))}
          </div>
          {fbError && <p className="mt-1 text-sm text-stamp-void">Couldn&apos;t save that. Try again.</p>}
        </div>
      ) : (
        <p className="mt-3 border-l-4 border-hot pl-2 text-sm">
          Dry run: the model read your ballot, but it wasn&apos;t saved (Supabase isn&apos;t configured yet).
        </p>
      )}

      <div className="mt-4 grid gap-2">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onAgain(false)} className="press bg-hot px-3 py-2 font-display font-extrabold">
            Vote again
          </button>
          <button type="button" onClick={() => onAgain(true)} className="press bg-surface px-3 py-2 text-sm font-bold">
            Again, keep my ink
          </button>
        </div>
        {saved && (
          <Link
            href={`/log?b=${result.id}&highlight=${result.id}`}
            className="press block bg-surface px-3 py-2 text-center text-sm font-bold"
          >
            See it in the ballot box →
          </Link>
        )}
      </div>
    </section>
  );
}
