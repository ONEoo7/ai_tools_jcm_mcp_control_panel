"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, cn } from "@/components/ui";

interface ExtraClient {
  name: string;
  method: string;
  config_path: string | null;
  configured: boolean;
}

/**
 * Rows for panel-detected MCP clients (VS Code Copilot, Antigravity) with a
 * one-click Register that writes the jcodemunch server entry into the editor's
 * mcp.json, then refreshes the server component to reflect the new status.
 */
export function ExtraClientRows({ clients }: { clients: ExtraClient[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ name: string; tone: "ok" | "err"; text: string } | null>(
    null,
  );

  const register = async (name: string) => {
    setBusy(name);
    setMsg(null);
    try {
      const res = await fetch("/api/clients/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg({ name, tone: "err", text: json.error ?? "Registration failed." });
      } else {
        setMsg({
          name,
          tone: "ok",
          text: json.backup ? "Registered · backup saved" : "Registered",
        });
        router.refresh();
      }
    } catch (e) {
      setMsg({
        name,
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
        <div key={c.name} className="flex items-center justify-between gap-3 py-1.5">
          <span
            className="min-w-0 truncate text-xs text-muted"
            title={c.config_path ?? undefined}
          >
            {c.name}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {msg?.name === c.name ? (
              <span
                className={cn(
                  "text-[11px]",
                  msg.tone === "ok" ? "text-accent" : "text-danger",
                )}
              >
                {msg.text}
              </span>
            ) : null}
            <Badge tone={c.configured ? "ok" : "neutral"}>
              {c.configured ? `via ${c.method}` : "not configured"}
            </Badge>
            {!c.configured ? (
              <button
                onClick={() => register(c.name)}
                disabled={busy === c.name}
                title={c.config_path ? `Write jcodemunch server to ${c.config_path}` : undefined}
                className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-fg hover:border-accent/40 disabled:opacity-40"
              >
                {busy === c.name ? "Registering…" : "Register"}
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </>
  );
}
