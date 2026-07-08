"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Badge, Dot, KeyVal, cn } from "@/components/ui";
import { LogConsole, useLogStream } from "@/components/LogStream";

interface DoctorFile {
  label: string;
  path: string;
  exists: boolean;
}

export function EnvironmentCard({
  version,
  binaryPath,
  files,
  latest,
  latestError,
  upgradeAvailable,
  manager,
  upgradeDisplay,
  installNote,
}: {
  version: string | null;
  binaryPath: string | null;
  files: DoctorFile[];
  latest: string | null;
  latestError?: string;
  upgradeAvailable: boolean;
  manager: string;
  upgradeDisplay: string;
  installNote?: string;
}) {
  const router = useRouter();
  const upgrade = useLogStream("/api/upgrade");
  const running = upgrade.status === "running";
  const [dialogOpen, setDialogOpen] = useState(false);

  const confirmUpgrade = async () => {
    setDialogOpen(false);
    await upgrade.run({});
    // Refresh server components so the version row reflects the new state.
    router.refresh();
  };

  return (
    <>
    {dialogOpen ? (
      <UpgradeDialog
        target={upgradeAvailable && latest ? latest : version}
        manager={manager}
        upgradeDisplay={upgradeDisplay}
        onConfirm={confirmUpgrade}
        onCancel={() => setDialogOpen(false)}
      />
    ) : null}
    <Card>
      <CardHeader title="Environment" subtitle="Detected on this machine" />
      <div className="px-5 py-3">
        <KeyVal
          k="Status"
          v={
            <span className="inline-flex items-center gap-1.5">
              <Dot tone="ok" /> Connected
            </span>
          }
        />

        <div className="flex items-center justify-between gap-4 py-1.5">
          <span className="shrink-0 text-xs text-muted">Version</span>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <span className="font-mono text-xs text-fg">{version ?? "—"}</span>
            {latest ? (
              upgradeAvailable ? (
                <Badge tone="warn">latest {latest}</Badge>
              ) : (
                <Badge tone="ok">up to date</Badge>
              )
            ) : latestError ? (
              <Badge tone="neutral" className="max-w-[10rem] truncate">
                latest: n/a
              </Badge>
            ) : null}
            <button
              onClick={() => setDialogOpen(true)}
              disabled={running}
              title={upgradeDisplay}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40",
                upgradeAvailable
                  ? "bg-accent text-accent-fg hover:opacity-90"
                  : "border border-line bg-surface text-muted hover:border-accent/40 hover:text-fg",
              )}
            >
              {running ? "Upgrading…" : upgradeAvailable ? "Upgrade" : "Re-run"}
            </button>
          </div>
        </div>

        <KeyVal
          k="Installed via"
          v={
            <span className="inline-flex items-center gap-2">
              <Badge tone={manager === "unknown" ? "warn" : "info"}>{manager}</Badge>
            </span>
          }
        />
        <KeyVal k="Binary" v={binaryPath ?? "—"} mono />
        {files.map((f) => (
          <KeyVal
            key={f.path}
            k={f.label}
            v={
              <span title={f.exists ? f.path : undefined}>
                {f.exists ? f.path : "—"}
              </span>
            }
            mono
          />
        ))}

        {installNote ? (
          <p className="mt-2 text-[11px] leading-relaxed text-warn">{installNote}</p>
        ) : null}

        {upgrade.lines.length ? (
          <div className="mt-3">
            <LogConsole lines={upgrade.lines} status={upgrade.status} />
          </div>
        ) : null}
      </div>
    </Card>
    </>
  );
}

function UpgradeDialog({
  target,
  manager,
  upgradeDisplay,
  onConfirm,
  onCancel,
}: {
  target: string | null;
  manager: string;
  upgradeDisplay: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-lg border border-line bg-bg-elevated shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-line-soft px-5 py-4">
          <span className="mt-0.5 text-lg text-warn" aria-hidden>
            ⚠
          </span>
          <div>
            <h3 className="text-sm font-semibold text-fg">
              Update jcodemunch-mcp{target ? ` to ${target}` : ""}?
            </h3>
            <p className="mt-0.5 text-xs text-muted">via {manager}</p>
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs font-medium text-warn">
            This will stop all running MCP clients that use jcodemunch-mcp.
          </p>
          <p className="mt-2 text-xs text-muted">
            On Windows a running jcodemunch server locks the files being replaced,
            so Claude Desktop and any other MCP client using it must be fully
            closed — otherwise the update fails and can leave the install broken.
          </p>

          <div className="mt-3 rounded-md border border-line bg-bg px-3 py-2 font-mono text-[11px] text-accent">
            {upgradeDisplay}
          </div>

          <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-muted">
            <li>Save your work, then fully quit Claude Desktop and other MCP clients.</li>
            <li>Click “Clients closed — update” below.</li>
            <li>Reopen your MCP clients once it completes.</li>
          </ol>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="rounded-md border border-line px-3 py-2 text-xs text-muted hover:text-fg"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="rounded-md bg-accent px-3 py-2 text-xs font-medium text-accent-fg hover:opacity-90"
            >
              Clients closed — update
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
