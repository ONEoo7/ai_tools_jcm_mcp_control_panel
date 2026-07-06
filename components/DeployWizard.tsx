"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader, Badge, cn } from "@/components/ui";
import { LogConsole, useLogStream } from "@/components/LogStream";

const CLIENTS = ["claude-code", "claude-desktop", "cursor", "windsurf", "continue"];

interface Options {
  clients: string[];
  claudeMd: "global" | "project" | "none";
  hooks: boolean;
  index: boolean;
  shareSavings: "on" | "off" | "default";
  dryRun: boolean;
  projectPath: string;
}

function buildPreview(o: Options): string {
  const a = ["init", "--yes"];
  a.push("--client", ...(o.clients.length ? o.clients : ["claude-code"]));
  if (o.claudeMd !== "none") a.push("--claude-md", o.claudeMd);
  if (o.hooks) a.push("--hooks");
  if (o.index) a.push("--index");
  if (o.shareSavings !== "default") a.push("--share-savings", o.shareSavings);
  if (o.dryRun) a.push("--dry-run");
  return "jcodemunch-mcp " + a.join(" ");
}

export function DeployWizard() {
  const [o, setO] = useState<Options>({
    clients: ["claude-code"],
    claudeMd: "global",
    hooks: true,
    index: false,
    shareSavings: "default",
    dryRun: true,
    projectPath: "",
  });
  const stream = useLogStream("/api/deploy");
  const preview = useMemo(() => buildPreview(o), [o]);
  const running = stream.status === "running";

  const toggleClient = (c: string) =>
    setO((s) => ({
      ...s,
      clients: s.clients.includes(c)
        ? s.clients.filter((x) => x !== c)
        : [...s.clients, c],
    }));

  const run = () => {
    if (
      !o.dryRun &&
      !confirm(
        "Dry run is OFF. This will modify MCP client configs, CLAUDE.md, and hooks on this machine. Continue?",
      )
    )
      return;
    stream.run({
      clients: o.clients,
      claudeMd: o.claudeMd,
      hooks: o.hooks,
      index: o.index,
      shareSavings: o.shareSavings,
      dryRun: o.dryRun,
      projectPath: o.projectPath.trim() || undefined,
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader title="Install options" subtitle="Configure the guided setup" />
        <div className="flex flex-col gap-4 px-5 py-4">
          <div>
            <label className="text-xs font-medium text-muted">MCP clients</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CLIENTS.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleClient(c)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    o.clients.includes(c)
                      ? "border-accent/40 bg-accent-soft text-accent"
                      : "border-line bg-surface text-muted hover:text-fg",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted">
              CLAUDE.md policy
            </label>
            <div className="mt-2 inline-flex rounded-md border border-line bg-surface p-0.5">
              {(["global", "project", "none"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setO((s) => ({ ...s, claudeMd: v }))}
                  className={cn(
                    "rounded px-3 py-1 text-xs capitalize",
                    o.claudeMd === v
                      ? "bg-accent text-accent-fg"
                      : "text-muted hover:text-fg",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Check
              label="Install auto-reindex hooks"
              checked={o.hooks}
              onChange={(v) => setO((s) => ({ ...s, hooks: v }))}
            />
            <Check
              label="Index current/target project after setup"
              checked={o.index}
              onChange={(v) => setO((s) => ({ ...s, index: v }))}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted">
              Project path (optional — for project-scoped policy/index)
            </label>
            <input
              value={o.projectPath}
              onChange={(e) => setO((s) => ({ ...s, projectPath: e.target.value }))}
              placeholder="Defaults to the panel's working directory"
              spellCheck={false}
              className="mt-2 w-full rounded-md border border-line bg-bg px-3 py-2 font-mono text-xs text-fg outline-none focus:border-accent/50"
            />
          </div>

          <div className="rounded-md border border-line-soft bg-surface-2 px-3 py-2.5">
            <Check
              label="Dry run (preview only — no changes)"
              checked={o.dryRun}
              onChange={(v) => setO((s) => ({ ...s, dryRun: v }))}
            />
          </div>
        </div>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader
          title="Run"
          subtitle="Streamed output from jcodemunch-mcp init"
          action={
            o.dryRun ? (
              <Badge tone="info">dry run</Badge>
            ) : (
              <Badge tone="danger">live</Badge>
            )
          }
        />
        <div className="px-5 py-4">
          <div className="mb-3 rounded-md border border-line bg-bg px-3 py-2 font-mono text-xs text-accent">
            {preview}
          </div>
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={run}
              disabled={running}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-40"
            >
              {running ? "Running…" : o.dryRun ? "Preview" : "Deploy"}
            </button>
            {running ? (
              <button
                onClick={stream.cancel}
                className="rounded-md border border-line px-3 py-2 text-sm text-muted"
              >
                Cancel
              </button>
            ) : null}
            {stream.status === "done" ? (
              <Badge tone="ok">completed</Badge>
            ) : stream.status === "failed" ? (
              <Badge tone="danger">failed</Badge>
            ) : null}
          </div>
          <LogConsole lines={stream.lines} status={stream.status} />
        </div>
      </Card>
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}
