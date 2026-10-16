"use client";
import { CANDIDATES, dishArt } from "@/lib/candidates";
import { FILTERS, type LogFilter } from "@/lib/ballots-query";

export function Filters({ value, onChange }: { value: LogFilter; onChange: (f: LogFilter) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="Show" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const on = value.kind === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange({ kind: f.id, dish: f.id === "all" || f.id === "voted" || f.id === "wrong" ? value.dish : null })}
              className={`press px-3 py-1.5 text-sm font-bold ${on ? "bg-hot" : "bg-surface-strong"}`}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2 text-sm font-bold">
        <span className="sr-only">Dish</span>
        <select
          value={value.dish ?? ""}
          onChange={(e) => {
            const dish = e.target.value ? Number(e.target.value) : null;
            onChange({ kind: dish && (value.kind === "abstained" || value.kind === "spoiled") ? "all" : value.kind, dish });
          }}
          className="press bg-surface-strong px-2 py-1.5"
        >
          <option value="">Any dish</option>
          {CANDIDATES.map((c) => (
            <option key={c.id} value={c.id}>
              {dishArt(c.id)} #{c.id} {c.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
