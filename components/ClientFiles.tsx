"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Badge, cn } from "@/components/ui";
import { EnforcementControl } from "@/components/EnforcementControl";
import type { ClientGroup, ClientFileRow } from "@/lib/jcm/clientFiles";
import type { EnforcementMode } from "@/lib/jcm/enforcement";

interface TestState {
  name: string;
  tone: "ok" | "err" | "info";
  text: string;
  detail?: string;
}

export function ClientFiles({
  groups,
  enforcement,
}: {
  groups: ClientGroup[];
  enforcement: EnforcementMode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ name: string; tone: "ok" | "err"; text: string } | null>(
    null,
  );
  const [testingName, setTestingName] = useState<string | null>(null);
  const [test, setTest] = useState<TestState | null>(null);
  const [allowBusy, setAllowBusy] = useState<string | null>(null);

  const alwaysAllow = async (group: ClientGroup) => {
    const isAnti = group.name.toLowerCase().includes("antigravity");
    const label = isAnti ? "Antigravity" : "Claude Code";
    setAllowBusy(group.name);
    setMsg(null);
    try {
      const res = await fetch("/api/clients/allow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client: isAnti ? "antigravity" : "claude-code" }),
      });
      const r = await res.json();
      if (r.ok) {
        const restart = isAnti
          ? "restart Antigravity to apply (ideally apply while it's closed, or it may overwrite the file on exit)."
          : "restart Claude Code to apply.";
        setMsg({
          name: group.name,
          tone: "ok",
          text: r.alreadySet
            ? `All jcodemunch tools already allowed in ${label}.`
            : `All jcodemunch tools allowed in ${label} — ${restart}`,
        });
      } else {
        setMsg({ name: group.name, tone: "err", text: r.error ?? "Could not set always-allow." });
      }
    } catch (e) {
      setMsg({
        name: group.name,
        tone: "err",
        text: e instanceof Error ? e.message : "Could not set always-allow.",
      });
    } finally {
      setAllowBusy(null);
    }
  };

  // VS Code Copilot has no jcodemunch-scoped grant — only the global,
  // all-tools chat.tools.autoApprove switch.
  const copilotAutoApprove = async (group: ClientGroup) => {
    setAllowBusy(group.name);
    setMsg(null);
    try {
      const res = await fetch("/api/clients/allow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client: "copilot" }),
      });
      const r = await res.json();
      if (r.ok) {
        setMsg({
          name: group.name,
          tone: "ok",
          text: r.alreadySet
            ? "chat.tools.autoApprove is already enabled in VS Code."
            : "Enabled chat.tools.autoApprove in VS Code — reload VS Code to apply. Note: this approves ALL Copilot tools, not just jcodemunch.",
        });
      } else {
        setMsg({ name: group.name, tone: "err", text: r.error ?? "Could not update VS Code settings." });
      }
    } catch (e) {
      setMsg({
        name: group.name,
        tone: "err",
        text: e instanceof Error ? e.message : "Could not update VS Code settings.",
      });
    } finally {
      setAllowBusy(null);
    }
  };

  const runTest = async (group: ClientGroup) => {
    setTestingName(group.name);
    setTest({
      name: group.name,
      tone: "info",
      text: "Launching the configured server and running the MCP handshake…",
    });
    try {
      const res = await fetch("/api/clients/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ configPath: group.configPath }),
      });
      const r = await res.json();
      if (r.ok) {
        // serverInfo.version is the MCP *SDK* version, not jcodemunch's release
        // (jcodemunch registers its server without a version, so the SDK fills in
        // its own) — label it as such so it isn't mistaken for the tool version.
        const meta = [
          r.protocolVersion ? `MCP ${r.protocolVersion}` : null,
          r.serverVersion ? `SDK v${r.serverVersion}` : null,
        ].filter(Boolean);
        const detail = [
          r.command ? `${r.source ?? "command"}: ${r.command}` : null,
          ...meta,
          r.durationMs ? `${r.durationMs}ms` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        const warn = r.jcodemunchDetected ? "" : " ⚠ tools don't look like jcodemunch";
        setTest({
          name: group.name,
          tone: r.jcodemunchDetected ? "ok" : "err",
          text: `Connected — ${r.serverName ?? "MCP server"} · ${r.toolCount ?? 0} tools exposed.${warn}`,
          detail: detail || undefined,
        });
      } else {
        const detail = r.command
          ? `${r.source ?? "command"}: ${r.command}${r.durationMs ? ` · ${r.durationMs}ms` : ""}`
          : undefined;
        setTest({ name: group.name, tone: "err", text: r.error ?? "Test failed.", detail });
      }
    } catch (e) {
      setTest({
        name: group.name,
        tone: "err",
        text: e instanceof Error ? e.message : "Test failed.",
      });
    } finally {
      setTestingName(null);
    }
  };

  const register = async (group: ClientGroup) => {
    if (!group.register) return;
    setBusy(group.name);
    setMsg(null);
    try {
      const res = await fetch("/api/clients/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(group.register),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg({ name: group.name, tone: "err", text: json.error ?? "Registration failed." });
      } else {
        setMsg({
          name: group.name,
          tone: "ok",
          text:
            (json.backup ? "Registered (backup saved)" : "Registered") +
            ` — restart ${group.name} to connect`,
        });
        router.refresh();
      }
    } catch (e) {
      setMsg({
        name: group.name,
        tone: "err",
        text: e instanceof Error ? e.message : "Registration failed.",
      });
    } finally {
      setBusy(null);
    }
  };

  const btn =
    "rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-fg hover:border-accent/40 disabled:opacity-40";

  // Badge + action buttons for one client (used in card headers and subsections).
  const actionRow = (group: ClientGroup): ReactNode => (
    <div className="flex items-center gap-2">
      <Badge tone={group.configured ? "ok" : "neutral"}>
        {group.configured ? `via ${group.method}` : "not configured"}
      </Badge>
      {group.configured ? (
        <button
          onClick={() => runTest(group)}
          disabled={testingName === group.name}
          title="Launch this client's configured jcodemunch server and run the MCP handshake"
          className={btn}
        >
          {testingName === group.name ? "Testing…" : "Test"}
        </button>
      ) : null}
      {group.configured &&
      (group.name.toLowerCase() === "claude code" ||
        group.name.toLowerCase().includes("antigravity")) ? (
        <button
          onClick={() => alwaysAllow(group)}
          disabled={allowBusy === group.name}
          title={
            group.name.toLowerCase().includes("antigravity")
              ? "Allow all jcodemunch tools in Antigravity — writes mcp(jcodemunch/*) to ~/.gemini/config/config.json"
              : "Add mcp__jcodemunch to Claude Code's permissions.allow so it never prompts for jcodemunch tools"
          }
          className={btn}
        >
          {allowBusy === group.name ? "Setting…" : "Always allow"}
        </button>
      ) : null}
      {group.configured && group.name.toLowerCase().includes("copilot") ? (
        <button
          onClick={() => copilotAutoApprove(group)}
          disabled={allowBusy === group.name}
          title="Set chat.tools.autoApprove:true in VS Code settings.json — auto-approves ALL Copilot tools (not just jcodemunch)"
          className={btn}
        >
          {allowBusy === group.name ? "Setting…" : "Auto-approve tools"}
        </button>
      ) : null}
      {!group.configured && group.register ? (
        <button onClick={() => register(group)} disabled={busy === group.name} className={btn}>
          {busy === group.name ? "Registering…" : "Register"}
        </button>
      ) : null}
    </div>
  );

  const banners = (group: ClientGroup): ReactNode => (
    <>
      {msg?.name === group.name ? (
        <div
          className={cn(
            "border-b border-line-soft px-5 py-1.5 text-[11px]",
            msg.tone === "ok" ? "text-accent" : "text-danger",
          )}
        >
          {msg.text}
        </div>
      ) : null}
      {test?.name === group.name ? (
        <div className="flex flex-col gap-0.5 border-b border-line-soft px-5 py-1.5">
          <span
            className={cn(
              "text-[11px]",
              test.tone === "ok"
                ? "text-accent"
                : test.tone === "err"
                  ? "text-danger"
                  : "text-faint",
            )}
          >
            {test.text}
          </span>
          {test.detail ? (
            <code className="select-all break-all font-mono text-[10px] leading-snug text-faint">
              {test.detail}
            </code>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const fileRows = (files: ClientFileRow[]): ReactNode => (
    <div className="px-5 py-2">
      {files.map((f, i) => (
        <div
          key={f.label + i}
          className="flex items-start justify-between gap-3 border-t border-line-soft py-2 first:border-t-0"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-fg">{f.label}</span>
            {f.path ? (
              <code
                className="select-all break-all font-mono text-[10.5px] leading-snug text-faint"
                title="Click to select, then copy"
              >
                {f.path}
              </code>
            ) : (
              <span className="text-[10.5px] text-faint">
                managed by the client CLI — no file path
              </span>
            )}
            {f.events && f.events.length ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {f.events.map((e) => (
                  <Badge key={e} tone="accent">
                    {e}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
          <Badge tone={f.present ? "ok" : "neutral"}>{f.present ? "present" : "absent"}</Badge>
        </div>
      ))}
    </div>
  );

  // Tinted header band for a subsection inside the combined Claude card — the
  // accent tick + uppercase label make each one read as its own unit.
  const sectionHeader = (label: string, count: number, action?: ReactNode): ReactNode => (
    <div className="flex items-center justify-between gap-3 bg-surface-2 px-5 py-2">
      <div className="flex items-center gap-2">
        <span className="inline-block h-3.5 w-1 rounded-full bg-accent" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</h3>
        <span className="text-[10px] text-faint">
          · {count} file{count === 1 ? "" : "s"}
        </span>
      </div>
      {action}
    </div>
  );

  const lower = (g: ClientGroup) => g.name.toLowerCase();
  const claudeCode = groups.find((g) => lower(g) === "claude code");
  const claudeDesktop = groups.find((g) => lower(g) === "claude desktop");
  const rest = groups.filter((g) => lower(g) !== "claude code" && lower(g) !== "claude desktop");

  // Claude Code's files split into client-specific (its MCP registration) and
  // global ~/.claude ones (reindex hooks, global CLAUDE.md, global skill) that
  // every Claude Code session shares — CLI and coding-in-Desktop alike.
  const codeFiles = claudeCode ? claudeCode.files.filter((f) => f.kind === "config") : [];
  const globalFiles = claudeCode ? claudeCode.files.filter((f) => f.kind !== "config") : [];

  const desktopHint = (
    <div className="border-t border-line-soft px-5 py-2 text-[11px] text-faint">
      Tool permissions live inside Claude Desktop and can&apos;t be set from here. In Claude Desktop:{" "}
      <span className="text-muted">Settings → Connectors → jcodemunch</span>, then set{" "}
      <span className="text-muted">Always allow</span> — the dropdown flips all read-only tools at
      once.
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {claudeCode || claudeDesktop ? (
        <Card>
          <CardHeader title="Claude" subtitle="Desktop · Code (CLI) · shared global settings" />

          {claudeDesktop ? (
            <div>
              {sectionHeader("Desktop", claudeDesktop.files.length, actionRow(claudeDesktop))}
              {banners(claudeDesktop)}
              {fileRows(claudeDesktop.files)}
              {desktopHint}
            </div>
          ) : null}

          {claudeCode ? (
            <div className={claudeDesktop ? "border-t border-line" : undefined}>
              {sectionHeader("Code (CLI)", codeFiles.length, actionRow(claudeCode))}
              {banners(claudeCode)}
              {fileRows(codeFiles)}
            </div>
          ) : null}

          {claudeCode ? (
            <div className="border-t border-line">
              {sectionHeader("Global", globalFiles.length)}
              <p className="px-5 pt-2 text-[11px] text-faint">
                Shared by every Claude Code session — CLI and coding inside Claude Desktop alike.
              </p>
              {fileRows(globalFiles)}
              <EnforcementControl mode={enforcement} />
            </div>
          ) : null}
        </Card>
      ) : null}

      {rest.map((group) => (
        <Card key={group.name}>
          <CardHeader
            title={group.name}
            subtitle={
              group.shared
                ? "Read by multiple agents"
                : `${group.files.length} file${group.files.length === 1 ? "" : "s"}`
            }
            action={group.shared ? undefined : actionRow(group)}
          />
          {banners(group)}
          {fileRows(group.files)}
        </Card>
      ))}
    </div>
  );
}
