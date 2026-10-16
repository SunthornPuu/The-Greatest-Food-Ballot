"use client";
import { useCallback, useEffect, useState } from "react";
import type { Stroke } from "@/lib/ink";

type History = { past: Stroke[][]; present: Stroke[]; future: Stroke[][] };

/** Ink layer state with undo/redo. Each commit is one undo step. */
export function useStrokes() {
  const [h, setH] = useState<History>({ past: [], present: [], future: [] });

  const commit = useCallback((next: (s: Stroke[]) => Stroke[]) => {
    setH((cur) => {
      const present = next(cur.present);
      if (present === cur.present) return cur;
      return { past: [...cur.past, cur.present].slice(-200), present, future: [] };
    });
  }, []);

  const add = useCallback((s: Stroke) => commit((p) => [...p, s]), [commit]);
  const removeIds = useCallback(
    (ids: Set<string>) => commit((p) => (ids.size ? p.filter((s) => !ids.has(s.id)) : p)),
    [commit],
  );
  const clear = useCallback(() => commit((p) => (p.length ? [] : p)), [commit]);
  const undo = useCallback(
    () =>
      setH((cur) =>
        cur.past.length
          ? { past: cur.past.slice(0, -1), present: cur.past[cur.past.length - 1]!, future: [cur.present, ...cur.future] }
          : cur,
      ),
    [],
  );
  const redo = useCallback(
    () =>
      setH((cur) =>
        cur.future.length
          ? { past: [...cur.past, cur.present], present: cur.future[0]!, future: cur.future.slice(1) }
          : cur,
      ),
    [],
  );

  return {
    strokes: h.present,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
    add,
    removeIds,
    clear,
    undo,
    redo,
  };
}

/** Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z (or Ctrl+Y) redo. Ignored while typing in inputs. */
export function useUndoShortcuts(undo: () => void, redo: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, enabled]);
}
