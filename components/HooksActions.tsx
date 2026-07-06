"use client";

import { useState } from "react";
import { Card, CardHeader, cn } from "@/components/ui";
import { LogConsole, useLogStream } from "@/components/LogStream";

export function HooksActions() {
  const [dryRun, setDryRun] = useState(true);
  const install = useLogStream("/api/deploy");
  const uninstall = useLogStream("/api/uninstall");

  const running = install.status === "running" || uninstall.status === "running";
  const active =
    install.lines.length || install.status !== "idle" ? install : uninstall;

  const doInstall = () =>
    install.run({
      clients: ["claude-code"],
      claudeMd: "none",
      hooks: true,
      index: false,
      dryRun,
    });

  const doUninstall = () => {
    if (
      !dryRun &&
      !confirm(
        "This runs `jcodemunch-mcp uninstall` and removes jcodemunch entries from your configs, policies, and hooks. Continue?",
      )
    )
      return;
    uninstall.run({ dryRun });
  };

  return (
    <Card>
      <CardHeader
        title="Manage hooks"
        subtitle="Install/refresh the auto-reindex hooks, or remove jcodemunch integration."
        action={
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Dry run
          </label>
        }
      />
      <div className="px-5 py-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={doInstall}
            disabled={running}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-40"
          >
            Install / refresh hooks
          </button>
          <button
            onClick={doUninstall}
            disabled={running}
            className={cn(
              "rounded-md border px-4 py-2 text-sm disabled:opacity-40",
              dryRun
                ? "border-line bg-surface text-fg hover:border-accent/40"
                : "border-danger/40 bg-danger/10 text-danger",
            )}
          >
            Uninstall jcodemunch
          </button>
        </div>
        {!dryRun ? (
          <p className="mt-2 text-xs text-warn">
            Dry run is off — actions below will modify your Claude Code settings.
          </p>
        ) : null}
        {active.lines.length ? (
          <div className="mt-4">
            <LogConsole lines={active.lines} status={active.status} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
