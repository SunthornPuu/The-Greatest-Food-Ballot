"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BallotBox } from "@/components/ballot-box/BallotBox";
import { applyBallot, fetchCountData, type CountData, type TickerEvent } from "@/lib/count-data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Confetti } from "./Confetti";
import { LiveTicker } from "./LiveTicker";
import { Podium } from "./Podium";
import { RaceBars } from "./RaceBars";
import { StatTiles } from "./StatTiles";

const REFRESH_MS = 60_000; // catch moderation (hidden=true) and anything realtime missed

export function TheCount({ initial }: { initial: CountData }) {
  const [data, setData] = useState(initial);
  const [flash, setFlash] = useState<number | null>(null);
  const [confetti, setConfetti] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const leader = useRef(initial.race[0]?.votes ? initial.race[0].candidate : null);

  const totalVotes = data.race.reduce((s, r) => s + r.votes, 0);

  // Confetti when the leader changes (not on first load).
  useEffect(() => {
    const top = data.race[0];
    const current = top && top.votes > 0 ? top.candidate : null;
    if (current != null && current !== leader.current) {
      if (leader.current != null || totalVotes === 1) setConfetti((c) => c + 1);
      leader.current = current;
    }
  }, [data.race, totalVotes]);

  // Wake the model when someone lands here, so their first ballot isn't a cold start.
  useEffect(() => {
    fetch("/api/health").catch(() => {});
  }, []);

  useEffect(() => {
    const db = supabaseBrowser();
    if (!db) return;
    const refresh = () =>
      fetchCountData(db)
        .then((d) => setData((cur) => ({ ...cur, ...d })))
        .catch(() => {});
    let flashTimer: ReturnType<typeof setTimeout> | undefined;
    const channel = db
      .channel("the-count")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ballots" }, (payload) => {
        const b = payload.new as TickerEvent & { hidden?: boolean };
        if (b.hidden) return;
        setData((cur) => ({ ...cur, ...applyBallot(cur, b) }));
        if (b.prediction >= 1) {
          setFlash(b.prediction);
          clearTimeout(flashTimer);
          flashTimer = setTimeout(() => setFlash(null), 1400);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ballots" }, refresh)
      .subscribe((status) => status === "SUBSCRIBED" && refresh());
    const poll = setInterval(refresh, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      db.removeChannel(channel);
      clearInterval(poll);
      clearInterval(tick);
      clearTimeout(flashTimer);
    };
  }, []);

  return (
    <div className="pb-16">
      <Confetti fire={confetti} />

      <header className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 px-4 pb-4 pt-6 sm:px-6">
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-[0.95] sm:text-6xl">The greatest food ballot</h1>
          <p className="mt-2 text-sm sm:text-base">hosted by the best looking team of U-Hackathon 2026</p>
        </div>
        <span className="cell flex items-center gap-2 bg-surface-strong px-3 py-1 font-mono text-sm font-bold">
          <span className="live-dot size-3 rounded-full bg-stamp-void" aria-hidden />
          LIVE
        </span>
      </header>

      <LiveTicker events={data.recent} now={now} />

      {!data.configured && (
        <p role="alert" className="cell mx-auto mt-6 max-w-6xl bg-surface-strong p-3 font-mono text-sm">
          Supabase isn&apos;t configured, so there&apos;s nothing to count yet.
        </p>
      )}

      <div className="mx-auto mt-8 grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
        <div className="grid content-start gap-8">
          <div>
            <h2 className="font-display text-2xl font-extrabold">The count</h2>
            {totalVotes === 0 && (
              <p className="mt-1 text-lg font-semibold">No votes yet. The polls are open.</p>
            )}
            <div className="mt-4">
              <Podium race={data.race} totalVotes={totalVotes} />
            </div>
          </div>
          <StatTiles stats={data.stats} />
        </div>

        <div className="grid content-start gap-8">
          <RaceBars race={data.race} totalVotes={totalVotes} flash={flash} />

          {/* The two CTAs, styled as the physical objects they lead to */}
          <div className="grid grid-cols-2 gap-4">
            <Link
              href="/vote"
              className="group relative block -rotate-2 border-3 border-line bg-paper p-4 shadow-hard-lg transition-transform hover:-rotate-1 hover:-translate-y-1 focus-visible:-rotate-1"
            >
              <span className="block h-2 w-2/3 bg-ink/80" aria-hidden />
              <span className="mt-2 grid grid-cols-[1fr_2.25rem] gap-1.5" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="contents">
                    <span className="h-5 border-2 border-line bg-cell" />
                    <span className="grid h-5 place-items-center border-2 border-line bg-white font-bold leading-none text-ballpoint">
                      {i === 1 ? "✕" : ""}
                    </span>
                  </span>
                ))}
              </span>
              <span className="mt-3 block font-display text-lg font-extrabold leading-tight sm:text-xl">✏️ Cast a ballot</span>
              <span className="text-xs">Draw your X. Try to fool the model.</span>
            </Link>
            <Link
              href="/log"
              className="group relative block rotate-1 border-3 border-line bg-surface p-4 shadow-hard-lg transition-transform hover:rotate-0 hover:-translate-y-1 focus-visible:rotate-0"
            >
              <BallotBox open className="mx-auto w-24 transition-transform group-hover:-translate-y-0.5 sm:w-28" />
              <span className="mt-2 block font-display text-lg font-extrabold leading-tight sm:text-xl">🗳️ Open the ballot box</span>
              <span className="text-xs">Every ballot and what the model said.</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
