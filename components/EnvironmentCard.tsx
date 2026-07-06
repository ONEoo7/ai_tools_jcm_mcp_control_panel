"use client";

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

  const runUpgrade = async () => {
    if (
      !confirm(
        `This upgrades jcodemunch-mcp on this machine via ${manager}:\n\n${upgradeDisplay}\n\nContinue?`,
      )
    )
      return;
    await upgrade.run({});
    // Refresh server components so the version row reflects the new state.
    router.refresh();
  };

  return (
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
              onClick={runUpgrade}
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
  );
}
