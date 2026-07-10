"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Badge, cn } from "@/components/ui";
import type { ClientGroup } from "@/lib/jcm/clientFiles";

interface TestState {
  name: string;
  tone: "ok" | "err" | "info";
  text: string;
  detail?: string;
}

export function ClientFiles({ groups }: { groups: ClientGroup[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ name: string; tone: "ok" | "err"; text: string } | null>(
    null,
  );
  const [testingName, setTestingName] = useState<string | null>(null);
  const [test, setTest] = useState<TestState | null>(null);

  const runTest = async (group: ClientGroup) => {
    setTestingName(group.name);
    setTest({ name: group.name, tone: "info", text: "Launching the configured server and running the MCP handshake…" });
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

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {groups.map((group) => (
        <Card key={group.name} className={group.shared ? "lg:col-span-2" : undefined}>
          <CardHeader
            title={group.name}
            subtitle={
              group.shared
                ? "Read by multiple agents"
                : `${group.files.length} file${group.files.length === 1 ? "" : "s"}`
            }
            action={
              group.shared ? undefined : (
                <div className="flex items-center gap-2">
                  <Badge tone={group.configured ? "ok" : "neutral"}>
                    {group.configured ? `via ${group.method}` : "not configured"}
                  </Badge>
                  {group.configured ? (
                    <button
                      onClick={() => runTest(group)}
                      disabled={testingName === group.name}
                      title="Launch this client's configured jcodemunch server and run the MCP handshake"
                      className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-fg hover:border-accent/40 disabled:opacity-40"
                    >
                      {testingName === group.name ? "Testing…" : "Test"}
                    </button>
                  ) : null}
                  {!group.configured && group.register ? (
                    <button
                      onClick={() => register(group)}
                      disabled={busy === group.name}
                      className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-fg hover:border-accent/40 disabled:opacity-40"
                    >
                      {busy === group.name ? "Registering…" : "Register"}
                    </button>
                  ) : null}
                </div>
              )
            }
          />
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
          <div className="px-5 py-2">
            {group.files.map((f, i) => (
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
                <Badge tone={f.present ? "ok" : "neutral"}>
                  {f.present ? "present" : "absent"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
