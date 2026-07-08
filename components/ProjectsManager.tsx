"use client";

import { useEffect, useRef, useState } from "react";
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
  indexVersion: number | null;
  indexOutdated: boolean;
}
interface ProjectFileRow {
  group: string;
  label: string;
  path: string;
  present: boolean;
  kind: string;
}

/** Group rows by their `group`, preserving first-seen order. */
function groupByOrder(rows: ProjectFileRow[]): [string, ProjectFileRow[]][] {
  const map = new Map<string, ProjectFileRow[]>();
  for (const r of rows) {
    const arr = map.get(r.group) ?? [];
    arr.push(r);
    map.set(r.group, arr);
  }
  return [...map.entries()];
}

export function ProjectsManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [pathInput, setPathInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [indexOnAdd, setIndexOnAdd] = useState(true);
  const [activeIndex, setActiveIndex] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filesByProject, setFilesByProject] = useState<
    Record<string, ProjectFileRow[] | "loading">
  >({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [currentIndexVersion, setCurrentIndexVersion] = useState<number | null>(null);
  // Projects we've already auto-re-indexed this session (guards against loops).
  const autoReindexed = useRef<Set<string>>(new Set());
  const indexStream = useLogStream("/api/projects/index");

  const loadFiles = async (list: Project[]) => {
    setFilesByProject((prev) => {
      const next = { ...prev };
      for (const p of list) next[p.id] = "loading";
      return next;
    });
    await Promise.all(
      list.map(async (p) => {
        try {
          const res = await fetch(
            `/api/projects/files?path=${encodeURIComponent(p.path)}`,
          );
          const json = await res.json();
          setFilesByProject((prev) => ({ ...prev, [p.id]: json.files ?? [] }));
        } catch {
          setFilesByProject((prev) => ({ ...prev, [p.id]: [] }));
        }
      }),
    );
  };

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/projects");
    const json = await res.json();
    const list: Project[] = json.projects ?? [];
    setProjects(list);
    setCurrentIndexVersion(json.currentIndexVersion ?? null);
    setLoading(false);
    // The index schema was bumped by a jcodemunch update — re-index affected
    // projects automatically (each at most once per session).
    const stale = list.filter(
      (p) => p.indexOutdated && !autoReindexed.current.has(p.id),
    );
    if (stale.length) autoReindex(stale);
  };

  const autoReindex = async (list: Project[]) => {
    for (const p of list) autoReindexed.current.add(p.id);
    for (const p of list) {
      setActiveIndex(p.id);
      await indexStream.run({ id: p.id });
    }
    load();
  };

  // Lazy-load a project's files the first time its section is expanded.
  const toggleFiles = (p: Project) => {
    const willOpen = !expanded[p.id];
    if (willOpen && filesByProject[p.id] === undefined) loadFiles([p]);
    setExpanded((prev) => ({ ...prev, [p.id]: willOpen }));
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
    await load();
    // Kick off indexing right away when enabled (incremental if already indexed).
    if (indexOnAdd && json.project?.id) {
      startIndex(json.project.id);
    }
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
    const proj = projects.find((p) => p.id === id);
    if (res.ok && proj) {
      loadFiles([proj]);
      setExpanded((e) => ({ ...e, [proj.id]: true }));
    }
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
          <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={indexOnAdd}
              onChange={(e) => setIndexOnAdd(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Index on add (build the jcodemunch index right after adding)
          </label>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>
      </Card>

      {notice ? (
        <div className="rounded-md border border-line bg-surface px-4 py-2 text-xs text-muted">
          {notice}
        </div>
      ) : null}

      {projects.some((p) => p.indexOutdated) ? (
        <div className="rounded-md border border-warn/30 bg-warn/5 px-4 py-3 text-xs text-warn">
          <span className="font-semibold">Index schema updated</span> — jcodemunch
          now builds{" "}
          <span className="font-mono">v{currentIndexVersion}</span> indexes.{" "}
          {projects.filter((p) => p.indexOutdated).length} project
          {projects.filter((p) => p.indexOutdated).length === 1 ? "" : "s"} on an
          older schema {indexStream.status === "running" ? "are being" : "will be"}{" "}
          re-indexed automatically so new analysis features work.
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
                  {p.repo && p.indexOutdated ? (
                    <Badge tone="warn">
                      index v{p.indexVersion} → v{currentIndexVersion}
                    </Badge>
                  ) : p.repo && p.indexVersion != null ? (
                    <Badge tone="neutral">index v{p.indexVersion}</Badge>
                  ) : null}
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

            <div className="border-t border-line-soft px-5 py-2">
              <button
                onClick={() => toggleFiles(p)}
                className="flex w-full items-center gap-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wider text-faint hover:text-muted"
              >
                <span className="inline-block w-3 text-accent">
                  {expanded[p.id] ? "▾" : "▸"}
                </span>
                Config &amp; integration files
              </button>
              {expanded[p.id] ? (
                <div className="pb-1">
                  {filesByProject[p.id] === "loading" ||
                  filesByProject[p.id] === undefined ? (
                    <p className="py-1 text-xs text-muted">Loading files…</p>
                  ) : (filesByProject[p.id] as ProjectFileRow[]).length === 0 ? (
                    <p className="py-1 text-xs text-faint">
                      No project files detected.
                    </p>
                  ) : (
                    groupByOrder(filesByProject[p.id] as ProjectFileRow[]).map(
                      ([group, rows]) => (
                        <div key={group} className="mt-3 first:mt-1">
                          <div className="mb-1 text-[13px] font-semibold text-fg">
                            {group}
                          </div>
                          {rows.map((f, i) => (
                            <div
                              key={f.label + i}
                              className="flex items-start justify-between gap-3 border-t border-line-soft py-1.5 first:border-t-0"
                            >
                              <div className="flex min-w-0 flex-col gap-0.5">
                                <span className="text-xs text-muted">{f.label}</span>
                                <code
                                  className="select-all break-all font-mono text-[10.5px] leading-snug text-faint"
                                  title="Click to select, then copy"
                                >
                                  {f.path}
                                </code>
                              </div>
                              <Badge tone={f.present ? "ok" : "neutral"}>
                                {f.present ? "present" : "absent"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ),
                    )
                  )}
                </div>
              ) : null}
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
