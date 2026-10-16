"use client";
import { ArrowLeft } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BallotBox } from "@/components/ballot-box/BallotBox";
import { fetchCount, fetchOne, fetchPage, matches, PAGE_SIZE, parseFilter, type LogFilter } from "@/lib/ballots-query";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { BallotRow } from "@/lib/types";
import { BallotCard, SkeletonCard } from "./BallotCard";
import { BallotDetail } from "./BallotDetail";
import { Filters } from "./Filters";

const SCROLLED_PX = 320;

export function BallotWall() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filter = useMemo(() => parseFilter(new URLSearchParams(params.toString())), [params]);
  const filterKey = `${filter.kind}:${filter.dish ?? ""}`;
  const openId = params.get("b");
  const highlightParam = params.get("highlight");

  const [rows, setRows] = useState<BallotRow[]>([]);
  const [pending, setPending] = useState<BallotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [highlight, setHighlight] = useState<string | null>(highlightParam);
  const [detail, setDetail] = useState<BallotRow | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const setQuery = useCallback(
    (mut: (q: URLSearchParams) => void, push = false) => {
      const q = new URLSearchParams(params.toString());
      mut(q);
      const s = q.toString();
      (push ? router.push : router.replace)(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  // First page + count whenever the filter changes.
  useEffect(() => {
    let cancelled = false;
    setRows([]);
    setPending([]);
    setDone(false);
    setError(null);
    setLoading(true);
    loadingRef.current = true;
    Promise.all([fetchPage(filter, null), fetchCount(filter)])
      .then(([page, count]) => {
        if (cancelled) return;
        setRows(page);
        setDone(page.length < PAGE_SIZE);
        setTotal(count);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        loadingRef.current = false;
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterKey captures filter
  }, [filterKey]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || done || error) return;
    const last = rows[rows.length - 1];
    if (!last) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const page = await fetchPage(filterRef.current, last.created_at);
      setRows((r) => [...r, ...page.filter((p) => !r.some((x) => x.id === p.id))]);
      setDone(page.length < PAGE_SIZE);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [rows, done, error]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), {
      rootMargin: "600px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // Realtime: new ballots slide in at the top (or wait behind a pill if you've scrolled down).
  useEffect(() => {
    const db = supabaseBrowser();
    if (!db) return;
    const channel = db
      .channel("ballot-wall")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ballots" }, (payload) => {
        const row = payload.new as BallotRow & { hidden?: boolean };
        if (row.hidden || !matches(row, filterRef.current)) return;
        setTotal((t) => (t == null ? t : t + 1));
        if (window.scrollY > SCROLLED_PX) setPending((p) => [row, ...p.filter((x) => x.id !== row.id)]);
        else setRows((r) => [row, ...r.filter((x) => x.id !== row.id)]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ballots" }, (payload) => {
        const row = payload.new as BallotRow & { hidden?: boolean };
        const keep = !row.hidden && matches(row, filterRef.current);
        const apply = (list: BallotRow[]) =>
          keep ? list.map((x) => (x.id === row.id ? { ...x, ...row } : x)) : list.filter((x) => x.id !== row.id);
        setRows(apply);
        setPending(apply);
        setDetail((d) => (d && d.id === row.id ? (row.hidden ? null : { ...d, ...row }) : d));
      })
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, []);

  // Relative times tick.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // Highlight glow from the Booth, briefly.
  useEffect(() => {
    if (!highlightParam) return;
    setHighlight(highlightParam);
    const t = setTimeout(() => setHighlight(null), 3500);
    return () => clearTimeout(t);
  }, [highlightParam]);

  // Detail view follows ?b=<id> (shareable).
  useEffect(() => {
    if (!openId) return setDetail(null);
    const local = rows.find((r) => r.id === openId) ?? pending.find((r) => r.id === openId);
    if (local) return setDetail(local);
    let cancelled = false;
    fetchOne(openId).then((r) => !cancelled && setDetail(r));
    return () => {
      cancelled = true;
    };
  }, [openId, rows, pending]);

  const index = detail ? rows.findIndex((r) => r.id === detail.id) : -1;
  const open = (id: string) => setQuery((q) => q.set("b", id), true);
  const close = () =>
    setQuery((q) => {
      q.delete("b");
      q.delete("highlight");
    });
  const go = (delta: number) => {
    const r = rows[index + delta];
    if (r) setQuery((q) => q.set("b", r.id));
    if (delta > 0 && index + delta >= rows.length - 3) loadMore();
  };
  const showPending = () => {
    setRows((r) => [...pending, ...r.filter((x) => !pending.some((p) => p.id === x.id))]);
    setPending([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const changeFilter = (f: LogFilter) =>
    setQuery((q) => {
      f.kind === "all" ? q.delete("f") : q.set("f", f.kind);
      f.dish ? q.set("dish", String(f.dish)) : q.delete("dish");
      q.delete("b");
      q.delete("highlight");
    });

  return (
    <div className="mx-auto max-w-7xl px-3 pb-16 pt-4 sm:px-5">
      <Link href="/" className="press inline-flex items-center gap-1.5 bg-surface-strong px-2.5 py-1 text-sm font-bold">
        <ArrowLeft size={16} /> The Count
      </Link>
      <header className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-3">
        <BallotBox open className="w-28 shrink-0 sm:w-36" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl font-extrabold leading-none sm:text-5xl">The Ballot Box</h1>
          <p className="mt-2 text-sm">
            Every ballot anyone has cast, and what the model said about it.{" "}
            <span className="font-mono font-bold">{total == null ? "…" : total}</span>{" "}
            {filter.kind === "all" && !filter.dish ? "ballots" : "match"}.
          </p>
        </div>
        <div className="w-full">
          <Filters value={filter} onChange={changeFilter} />
        </div>
      </header>

      <AnimatePresence>
        {pending.length > 0 && (
          <motion.button
            type="button"
            onClick={showPending}
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="press fixed left-1/2 top-[calc(var(--nav-h)+12px)] z-30 -translate-x-1/2 bg-hot px-4 py-2 font-bold"
          >
            {pending.length} new ballot{pending.length > 1 ? "s" : ""} ↑
          </motion.button>
        )}
      </AnimatePresence>

      {error && (
        <div role="alert" className="cell mt-6 bg-surface-strong p-4">
          <p className="font-display text-lg font-extrabold">Couldn&apos;t open the ballot box</p>
          <p className="font-mono text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="cell mt-6 grid justify-items-center gap-3 p-8 text-center">
          <p className="font-display text-2xl font-extrabold">
            {filter.kind === "all" && !filter.dish ? "The box is empty. The polls are open." : "No ballots match this filter yet."}
          </p>
          <Link href="/vote" className="press bg-hot px-4 py-2 font-display font-extrabold">
            ✏️ Cast a ballot
          </Link>
        </div>
      )}

      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {rows.map((r, i) => (
          <BallotCard key={r.id} row={r} now={now} highlight={highlight === r.id} priority={i < 4} onOpen={open} />
        ))}
        {loading && Array.from({ length: rows.length ? 5 : 10 }, (_, i) => <SkeletonCard key={`s${i}`} />)}
      </ul>
      <div ref={sentinel} aria-hidden className="h-4" />
      {done && rows.length > 0 && <p className="mt-6 text-center font-mono text-xs text-muted">· end of the box ·</p>}

      {detail && (
        <BallotDetail
          row={detail}
          hasPrev={index > 0}
          hasNext={index >= 0 && (index < rows.length - 1 || !done)}
          onPrev={() => go(-1)}
          onNext={() => go(1)}
          onClose={close}
          onUpdate={(u) => {
            setDetail(u);
            setRows((r) => r.map((x) => (x.id === u.id ? u : x)));
          }}
        />
      )}
    </div>
  );
}
