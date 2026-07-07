"use client";

import { useCallback, useEffect, useState } from "react";

interface DirEntry {
  name: string;
  path: string;
}
interface BrowseResult {
  path: string | null;
  parent: string | null;
  atDriveList: boolean;
  winDrives: boolean;
  home: string;
  entries: DirEntry[];
}

/**
 * Server-backed folder picker. Navigates the machine's filesystem (via
 * /api/fs/browse) so it can hand back a real absolute path — something the
 * browser's native directory picker deliberately withholds.
 */
export function DirectoryPicker({
  open,
  initialPath,
  onSelect,
  onClose,
}: {
  open: boolean;
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = useCallback(async (target: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const qs = target ? `?path=${encodeURIComponent(target)}` : "";
      const res = await fetch(`/api/fs/browse${qs}`);
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Could not open that folder.");
      else setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open that folder.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) go(initialPath?.trim() ? initialPath : null);
  }, [open, initialPath, go]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Where "Up" goes: real parent, else the drive list on Windows, else nowhere.
  const upTarget: string | null | undefined = !data
    ? undefined
    : data.atDriveList
      ? undefined
      : data.parent != null
        ? data.parent
        : data.winDrives
          ? null
          : undefined;
  const canGoUp = upTarget !== undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-line bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-fg">Select a folder</h3>
            <p className="mt-0.5 truncate font-mono text-xs text-faint">
              {data?.path ?? "This PC"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-muted hover:text-fg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-line-soft px-5 py-2">
          <button
            onClick={() => canGoUp && go(upTarget ?? null)}
            disabled={!canGoUp || loading}
            className="rounded-md border border-line bg-bg px-2.5 py-1 text-xs text-fg hover:border-accent/40 disabled:opacity-40"
          >
            ↑ Up
          </button>
          <button
            onClick={() => data && go(data.home)}
            disabled={loading || !data}
            className="rounded-md border border-line bg-bg px-2.5 py-1 text-xs text-fg hover:border-accent/40 disabled:opacity-40"
          >
            ⌂ Home
          </button>
          {data?.winDrives ? (
            <button
              onClick={() => go(null)}
              disabled={loading}
              className="rounded-md border border-line bg-bg px-2.5 py-1 text-xs text-fg hover:border-accent/40 disabled:opacity-40"
            >
              Drives
            </button>
          ) : null}
        </div>

        <div className="min-h-[14rem] flex-1 overflow-y-auto px-2 py-2">
          {error ? (
            <p className="px-3 py-3 text-xs text-danger">{error}</p>
          ) : loading ? (
            <p className="px-3 py-3 text-xs text-muted">Loading…</p>
          ) : data && data.entries.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted">No sub-folders here.</p>
          ) : (
            <ul>
              {data?.entries.map((e) => (
                <li key={e.path}>
                  <button
                    onClick={() => go(e.path)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-fg hover:bg-surface-2"
                  >
                    <span aria-hidden className="text-muted">
                      {data.atDriveList ? "💽" : "📁"}
                    </span>
                    <span className="truncate">{e.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line-soft px-5 py-3">
          <span className="min-w-0 truncate font-mono text-xs text-muted">
            {data?.path ?? "Open a drive or folder to select it"}
          </span>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-muted hover:text-fg"
            >
              Cancel
            </button>
            <button
              onClick={() => data?.path && onSelect(data.path)}
              disabled={!data?.path}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg disabled:opacity-40"
              title={data?.path ? `Add ${data.path}` : undefined}
            >
              Select this folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
