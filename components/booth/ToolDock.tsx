"use client";
import { Eraser, Hand, Maximize, PenLine, Redo2, Trash2, Undo2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { PEN_COLORS, PEN_SIZES } from "@/lib/ink";

export type ToolKind = "pen" | "eraser" | "pan";

type Props = {
  kind: ToolKind;
  color: string;
  size: number;
  canUndo: boolean;
  canRedo: boolean;
  hasInk: boolean;
  disabled: boolean;
  onKind: (k: ToolKind) => void;
  onColor: (c: string) => void;
  onSize: (s: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onFit: () => void;
};

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`press grid size-11 shrink-0 place-items-center ${active ? "bg-hot text-ink" : "bg-surface-strong"}`}
    >
      {children}
    </button>
  );
}

export function ToolDock(p: Props) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3500);
    return () => clearTimeout(t);
  }, [confirming]);

  return (
    <div role="toolbar" aria-label="Drawing tools" className="flex flex-wrap items-center gap-2">
      <ToolButton label="Pen" active={p.kind === "pen"} disabled={p.disabled} onClick={() => p.onKind("pen")}>
        <PenLine size={20} />
      </ToolButton>
      <ToolButton label="Eraser (removes whole strokes)" active={p.kind === "eraser"} disabled={p.disabled} onClick={() => p.onKind("eraser")}>
        <Eraser size={20} />
      </ToolButton>
      <ToolButton label="Pan (or hold Space)" active={p.kind === "pan"} onClick={() => p.onKind("pan")}>
        <Hand size={20} />
      </ToolButton>

      <span className="mx-1 h-8 w-[3px] bg-line" aria-hidden />

      <div role="radiogroup" aria-label="Pen color" className="flex gap-1.5">
        {PEN_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={p.color === c.value}
            aria-label={c.label}
            title={c.label}
            disabled={p.disabled}
            onClick={() => {
              p.onColor(c.value);
              p.onKind("pen");
            }}
            className={`size-9 rounded-full border-3 border-line ${p.color === c.value && p.kind === "pen" ? "ring-3 ring-hot ring-offset-2 ring-offset-bg" : ""}`}
            style={{ background: c.value }}
          />
        ))}
      </div>

      <div role="radiogroup" aria-label="Pen width" className="flex gap-1.5">
        {PEN_SIZES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={p.size === s.value}
            aria-label={`${s.label} pen`}
            title={`${s.label} pen`}
            disabled={p.disabled}
            onClick={() => {
              p.onSize(s.value);
              p.onKind("pen");
            }}
            className={`press grid size-9 place-items-center ${p.size === s.value ? "bg-hot" : "bg-surface-strong"}`}
          >
            <span className="rounded-full bg-ink" style={{ width: 5 + i * 5, height: 5 + i * 5 }} />
          </button>
        ))}
      </div>

      <span className="mx-1 h-8 w-[3px] bg-line" aria-hidden />

      <ToolButton label="Undo (Ctrl+Z)" disabled={p.disabled || !p.canUndo} onClick={p.onUndo}>
        <Undo2 size={20} />
      </ToolButton>
      <ToolButton label="Redo (Shift+Ctrl+Z)" disabled={p.disabled || !p.canRedo} onClick={p.onRedo}>
        <Redo2 size={20} />
      </ToolButton>
      <ToolButton label="Fit ballot to screen" onClick={p.onFit}>
        <Maximize size={20} />
      </ToolButton>

      <div className="relative">
        <ToolButton label="Clear all ink" disabled={p.disabled || !p.hasInk} onClick={() => setConfirming((c) => !c)}>
          <Trash2 size={20} />
        </ToolButton>
        {confirming && (
          <div
            role="dialog"
            aria-label="Confirm clear"
            className="cell absolute bottom-full right-0 z-30 mb-2 flex w-max items-center gap-2 p-2 lg:bottom-auto lg:top-full lg:mt-2 lg:mb-0"
          >
            <span className="text-sm font-semibold">Clear all ink?</span>
            <button
              type="button"
              autoFocus
              className="press bg-stamp-void px-2 py-1 text-sm font-bold text-white"
              onClick={() => {
                p.onClear();
                setConfirming(false);
              }}
            >
              Clear
            </button>
            <button type="button" className="press bg-surface-strong px-2 py-1 text-sm font-bold" onClick={() => setConfirming(false)}>
              Keep
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
