"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, cn } from "@/components/ui";

type RegisterDescriptor =
  | { via: "cli"; target: string }
  | { via: "mcpjson"; name: string }
  | { via: "claudedesktop"; configPath: string };

interface UiClient {
  name: string;
  method: string;
  config_path: string | null;
  configured: boolean;
  register?: RegisterDescriptor;
}

/**
 * MCP client rows with a one-click Register for any installed-but-unconfigured
 * client. CLI-supported clients (Claude Desktop, Cursor, …) register via
 * `jcodemunch-mcp install <target>`; editors the CLI can't reach (VS Code
 * Copilot, Antigravity) get their mcp.json written directly. Refreshes the
 * server component afterward so the status badge updates.
 */
export function McpClientRows({ clients }: { clients: UiClient[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ name: string; tone: "ok" | "err"; text: string } | null>(
    null,
  );

  const register = async (c: UiClient) => {
    if (!c.register) return;
    setBusy(c.name);
    setMsg(null);
    try {
      const res = await fetch("/api/clients/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(c.register),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg({ name: c.name, tone: "err", text: json.error ?? "Registration failed." });
      } else {
        setMsg({
          name: c.name,
          tone: "ok",
          text:
            (json.backup ? "Registered (backup saved)" : "Registered") +
            ` — restart ${c.name} to connect`,
        });
        router.refresh();
      }
    } catch (e) {
      setMsg({
        name: c.name,
        tone: "err",
        text: e instanceof Error ? e.message : "Registration failed.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {clients.map((c) => (
        <div
          key={c.name}
          className="flex items-start justify-between gap-3 py-2"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted">{c.name}</span>
            {c.config_path ? (
              <code
                className="select-all break-all font-mono text-[10.5px] leading-snug text-faint"
                title="Config file this client reads — click to select, then copy"
              >
                {c.config_path}
              </code>
            ) : (
              <span className="text-[10.5px] text-faint">
                managed by the client CLI — no file path
              </span>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <Badge tone={c.configured ? "ok" : "neutral"}>
                {c.configured ? `via ${c.method}` : "not configured"}
              </Badge>
              {!c.configured && c.register ? (
                <button
                  onClick={() => register(c)}
                  disabled={busy === c.name}
                  className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-fg hover:border-accent/40 disabled:opacity-40"
                >
                  {busy === c.name ? "Registering…" : "Register"}
                </button>
              ) : null}
            </div>
            {msg?.name === c.name ? (
              <span
                className={cn(
                  "text-right text-[11px]",
                  msg.tone === "ok" ? "text-accent" : "text-danger",
                )}
              >
                {msg.text}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </>
  );
}
