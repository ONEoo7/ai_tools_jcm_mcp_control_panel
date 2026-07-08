"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, Badge, EmptyState, cn } from "@/components/ui";
import { LogConsole, useLogStream } from "@/components/LogStream";
import { DirectoryPicker } from "@/components/DirectoryPicker";

interface RepoInfo {
  file_count: number;
  symbol_count: number;
  freshness: string;
  indexed_at: string | null;
}
interface Project {
  id: string;
  path: string;
  label: string;
  repo: RepoInfo | null;
}

export function ProjectsManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [pathInput, setPathInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const indexStream = useLogStream("/api/projects/index");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/projects");
    const json = await res.json();
    setProjects(json.projects ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (explicitPath?: string) => {
    const target = (explicitPath ?? pathInput).trim();
    if (!target) return;
    setError(null);
    setBusy(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: target }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not add project.");
      return;
    }
    setPathInput("");
    load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
    load();
  };

  const scaffold = async (id: string, overwrite = false) => {
    setNotice(null);
    const res = await fetch("/api/projects/scaffold", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, overwrite }),
    });
    const json = await res.json();
    if (res.status === 409) {
      if (confirm(`A config already exists at:\n${json.path}\n\nOverwrite it?`)) {
        return scaffold(id, true);
      }
      return;
    }
    setNotice(res.ok ? `Wrote ${json.path}` : `Failed: ${json.error}`);
  };

  const startIndex = async (id: string) => {
    setActiveIndex(id);
    // Wait for the index stream to finish, then refresh the list so the
    // freshness badge and symbol/file counts update without a page reload.
    await indexStream.run({ id });
    load();
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Add a project"
          subtitle="Enter the absolute path to a project folder to configure & index."
        />
        <div className="flex flex-col gap-2 px-5 py-4">
          <div className="flex gap-2">
            <input
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && pathInput.trim() && add()}
              placeholder="D:\\workspace\\my-project"
              spellCheck={false}
              className="flex-1 rounded-md border border-line bg-bg px-3 py-2 font-mono text-sm text-fg outline-none focus:border-accent/50"
            />
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={busy}
              className="shrink-0 rounded-md border border-line bg-surface px-4 py-2 text-sm text-fg hover:border-accent/40 disabled:opacity-40"
            >
              Browse…
            </button>
            <button
              onClick={() => add()}
              disabled={busy || !pathInput.trim()}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-40"
            >
              {busy ? "Adding…" : "Add"}
            </button>
          </div>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>
      </Card>

      {notice ? (
        <div className="rounded-md border border-line bg-surface px-4 py-2 text-xs text-muted">
          {notice}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading projects…</p>
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects added yet"
          description="Add a project path above to index it and manage its jcodemunch config."
        />
      ) : (
        projects.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-fg">{p.label}</span>
                  {p.repo ? (
                    <Badge tone={p.repo.freshness === "fresh" ? "ok" : "warn"}>
                      indexed · {p.repo.freshness}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">not indexed</Badge>
                  )}
                </div>
                <div className="mt-0.5 truncate font-mono text-xs text-faint">
                  {p.path}
                </div>
                {p.repo ? (
                  <div className="mt-1 text-xs text-muted">
                    {p.repo.symbol_count.toLocaleString()} symbols ·{" "}
                    {p.repo.file_count} files
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <button
                  onClick={() => startIndex(p.id)}
                  disabled={indexStream.status === "running"}
                  className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-fg hover:border-accent/40 disabled:opacity-40"
                >
                  {p.repo ? "Re-index" : "Index"}
                </button>
                <button
                  onClick={() => scaffold(p.id)}
                  className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-fg hover:border-accent/40"
                >
                  Scaffold config
                </button>
                <button
                  onClick={() => remove(p.id)}
                  title="Stop tracking this project here. Its jcodemunch index is left untouched; it won't be re-added automatically."
                  className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-muted hover:border-danger/40 hover:text-danger"
                >
                  Remove
                </button>
              </div>
            </div>
            {activeIndex === p.id ? (
              <div
                className={cn(
                  "border-t border-line-soft px-5 py-4",
                  indexStream.lines.length === 0 && indexStream.status === "idle"
                    ? "hidden"
                    : "",
                )}
              >
                <LogConsole
                  lines={indexStream.lines}
                  status={indexStream.status}
                />
              </div>
            ) : null}
          </Card>
        ))
      )}

      <DirectoryPicker
        open={pickerOpen}
        initialPath={pathInput.trim() || undefined}
        onSelect={(p) => {
          setPickerOpen(false);
          setPathInput(p);
          add(p);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
