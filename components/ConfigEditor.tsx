"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader, Badge, cn } from "@/components/ui";
import { DirectoryPicker } from "@/components/DirectoryPicker";

interface KnownProject {
  id: string;
  path: string;
  label: string;
}

type Scope = "global" | "project";

interface RawConfig {
  scope: Scope;
  path: string;
  exists: boolean;
  content: string;
  parseError?: string;
}

export function ConfigEditor() {
  const [scope, setScope] = useState<Scope>("global");
  const [projectPath, setProjectPath] = useState("");
  const [raw, setRaw] = useState<RawConfig | null>(null);
  const [effective, setEffective] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null,
  );
  const [showEffective, setShowEffective] = useState(false);
  const [known, setKnown] = useState<KnownProject[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const dirty = raw ? draft !== raw.content : false;

  const load = useCallback(
    async (overridePath?: string) => {
      setMessage(null);
      const p = (overridePath ?? projectPath).trim();
      if (scope === "project" && !p) {
        setRaw(null);
        return;
      }
      setLoading(true);
      const qs = new URLSearchParams({ scope });
      if (scope === "project") qs.set("path", p);
      const res = await fetch(`/api/config?${qs.toString()}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setRaw(null);
      setMessage({ tone: "err", text: json.error ?? "Could not load config." });
      return;
    }
    setRaw(json.raw);
    setDraft(json.raw.content || "");
    setEffective(json.effective?.text ?? "");
  }, [scope, projectPath]);

  useEffect(() => {
    if (scope === "global") load();
  }, [scope, load]);

  // Populate the known-projects dropdown from the tracked project registry.
  useEffect(() => {
    if (scope !== "project") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/projects");
        const json = await res.json();
        if (!cancelled) {
          setKnown(
            (json.projects ?? []).map((p: KnownProject) => ({
              id: p.id,
              path: p.path,
              label: p.label,
            })),
          );
        }
      } catch {
        /* leave the dropdown empty; manual path entry still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const save = async () => {
    if (!raw) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scope,
        path: scope === "project" ? projectPath.trim() : undefined,
        content: draft,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok || !json.ok) {
      setMessage({ tone: "err", text: json.error ?? "Save failed." });
      return;
    }
    setMessage({
      tone: "ok",
      text: json.backup
        ? `Saved. Backup: ${json.backup}`
        : "Saved (no previous file to back up).",
    });
    load();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-md border border-line bg-surface p-0.5">
          {(["global", "project"] as Scope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium capitalize transition-colors",
                scope === s ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="text-xs text-faint">
          {scope === "global"
            ? "~/.code-index/config.jsonc — applies to all repos (user + global)"
            : "<project>/.jcodemunch.jsonc — overrides for one project"}
        </span>
      </div>

      {scope === "project" ? (
        <div className="flex flex-col gap-2">
          {known.length > 0 ? (
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-xs text-muted">Known projects</label>
              <select
                value={known.some((k) => k.path === projectPath) ? projectPath : ""}
                onChange={(e) => {
                  const p = e.target.value;
                  setProjectPath(p);
                  if (p) load(p);
                }}
                className="flex-1 rounded-md border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-accent/50"
              >
                <option value="">Select a project…</option>
                {known.map((k) => (
                  <option key={k.id} value={k.path}>
                    {k.label} — {k.path}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex gap-2">
            <input
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Absolute project path, e.g. D:\\workspace\\my-project"
              spellCheck={false}
              className="flex-1 rounded-md border border-line bg-bg px-3 py-2 font-mono text-sm text-fg outline-none focus:border-accent/50"
            />
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="shrink-0 rounded-md border border-line bg-surface px-4 py-2 text-sm text-fg hover:border-accent/40"
            >
              Browse…
            </button>
            <button
              onClick={() => load()}
              disabled={!projectPath.trim()}
              className="rounded-md border border-line bg-surface px-4 py-2 text-sm text-fg hover:border-accent/40 disabled:opacity-40"
            >
              Load
            </button>
          </div>
        </div>
      ) : null}

      <DirectoryPicker
        open={pickerOpen}
        initialPath={projectPath.trim() || undefined}
        onSelect={(p) => {
          setPickerOpen(false);
          setProjectPath(p);
          load(p);
        }}
        onClose={() => setPickerOpen(false)}
      />

      {loading ? <p className="text-sm text-muted">Loading…</p> : null}

      {raw ? (
        <Card>
          <CardHeader
            title={raw.path}
            subtitle={
              raw.exists ? "Editing existing file" : "File does not exist yet — saving will create it"
            }
            action={
              <div className="flex items-center gap-2">
                {raw.parseError ? (
                  <Badge tone="warn">{raw.parseError}</Badge>
                ) : (
                  <Badge tone="ok">valid JSONC</Badge>
                )}
                {dirty ? <Badge tone="info">unsaved</Badge> : null}
              </div>
            }
          />
          <div className="px-5 py-4">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              rows={20}
              className="scroll-thin w-full rounded-md border border-line bg-bg px-4 py-3 font-mono text-xs leading-relaxed text-fg outline-none focus:border-accent/50"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving || !dirty}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save (backup first)"}
              </button>
              <button
                onClick={() => raw && setDraft(raw.content)}
                disabled={!dirty}
                className="rounded-md border border-line px-4 py-2 text-sm text-muted disabled:opacity-40"
              >
                Revert
              </button>
              {message ? (
                <span
                  className={cn(
                    "text-xs",
                    message.tone === "ok" ? "text-accent" : "text-danger",
                  )}
                >
                  {message.text}
                </span>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {effective ? (
        <Card>
          <CardHeader
            title="Effective configuration"
            subtitle="Resolved values as jcodemunch-mcp sees them"
            action={
              <button
                onClick={() => setShowEffective((v) => !v)}
                className="text-xs text-accent hover:underline"
              >
                {showEffective ? "Hide" : "Show"}
              </button>
            }
          />
          {showEffective ? (
            <pre className="scroll-thin max-h-96 overflow-auto px-5 py-4 font-mono text-xs leading-relaxed text-muted">
              {effective}
            </pre>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
