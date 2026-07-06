"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Badge, cn } from "@/components/ui";
import { LogConsole, useLogStream } from "@/components/LogStream";

interface BootstrapStatus {
  python: string | null;
  uv: string | null;
  jcm: string | null;
}

export function BootstrapInstaller({
  status,
  uvPresent,
  installUvCmd,
  installJcmCmd,
  registerCmd,
}: {
  status: BootstrapStatus;
  uvPresent: boolean;
  installUvCmd: string;
  installJcmCmd: string;
  registerCmd: string;
}) {
  const router = useRouter();
  const [installUv, setInstallUv] = useState(!uvPresent);
  const [registerClaude, setRegisterClaude] = useState(true);
  const [dryRun, setDryRun] = useState(true);
  const stream = useLogStream("/api/bootstrap");
  const running = stream.status === "running";

  const commands = useMemo(() => {
    const lines: string[] = [];
    if (!uvPresent && installUv) lines.push(installUvCmd);
    lines.push(installJcmCmd);
    if (registerClaude) lines.push(registerCmd);
    return lines;
  }, [uvPresent, installUv, registerClaude, installUvCmd, installJcmCmd, registerCmd]);

  const run = async () => {
    if (
      !dryRun &&
      !confirm(
        `Dry run is OFF. This will run on your machine:\n\n${commands.join("\n")}\n\nContinue?`,
      )
    )
      return;
    await stream.run({ installUv, registerClaude, dryRun });
    // The server spliced ~/.local/bin into PATH and cleared its resolve cache
    // after a real install, so re-render the server components to pick up the
    // newly installed tools automatically — no restart needed.
    if (!dryRun) router.refresh();
  };

  return (
    <Card className="border-accent/30">
      <CardHeader
        title="First-time install (no Python required)"
        subtitle="Installs uv (a standalone binary), then uses it to install jcodemunch-mcp."
        action={
          status.jcm ? (
            <Badge tone="ok">already installed</Badge>
          ) : (
            <Badge tone="warn">not installed</Badge>
          )
        }
      />
      <div className="px-5 py-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <Prereq label="Python" present={Boolean(status.python)} optional />
          <Prereq label="uv" present={Boolean(status.uv)} />
          <Prereq label="jcodemunch-mcp" present={Boolean(status.jcm)} />
        </div>

        {status.python ? null : (
          <p className="mb-4 text-xs text-muted">
            No Python detected — that&apos;s fine. uv bundles its own Python, so
            this path installs jcodemunch-mcp without a system Python.
          </p>
        )}

        <div className="mb-4 flex flex-col gap-2">
          <Check
            label={
              uvPresent
                ? "Install uv (already present — will be skipped)"
                : "Install uv (standalone installer from astral.sh)"
            }
            checked={installUv && !uvPresent}
            disabled={uvPresent}
            onChange={setInstallUv}
          />
          <Check
            label="Register with Claude Code (MCP + hooks) after install"
            checked={registerClaude}
            onChange={setRegisterClaude}
          />
        </div>

        <div className="mb-3">
          <div className="mb-1 text-xs font-medium text-muted">
            Commands to run
          </div>
          <div className="rounded-md border border-line bg-bg px-3 py-2 font-mono text-xs">
            {commands.map((c, i) => (
              <div key={i} className="whitespace-pre-wrap text-accent">
                {c}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-3 flex items-center gap-3">
          <button
            onClick={run}
            disabled={running}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-40"
          >
            {running ? "Working…" : dryRun ? "Preview" : "Install"}
          </button>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Dry run (preview only)
          </label>
          {stream.status === "done" ? (
            <Badge tone="ok">completed</Badge>
          ) : stream.status === "failed" ? (
            <Badge tone="danger">failed</Badge>
          ) : null}
        </div>

        {!dryRun ? (
          <p className="mb-3 text-xs text-warn">
            This downloads and runs the official uv installer from astral.sh and
            installs software on this machine.
          </p>
        ) : null}

        {stream.lines.length ? (
          <LogConsole lines={stream.lines} status={stream.status} />
        ) : null}

        {stream.status === "done" && !dryRun ? (
          <p className="mt-3 text-xs text-muted">
            Installed and re-checked automatically — the status badges above
            reflect the new state. If anything still shows as missing, restart
            the panel as a last resort.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function Prereq({
  label,
  present,
  optional,
}: {
  label: string;
  present: boolean;
  optional?: boolean;
}) {
  return (
    <Badge tone={present ? "ok" : optional ? "neutral" : "warn"}>
      {label}: {present ? "found" : optional ? "not needed" : "missing"}
    </Badge>
  );
}

function Check({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 text-sm",
        disabled ? "cursor-not-allowed text-faint" : "cursor-pointer text-fg",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}
