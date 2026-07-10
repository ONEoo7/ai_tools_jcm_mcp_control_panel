"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/components/ui";
import type { EnforcementMode } from "@/lib/jcm/enforcement";

const MODES: { mode: EnforcementMode; label: string; desc: string }[] = [
  {
    mode: "advisory",
    label: "Advisory",
    desc: "Nudge only — warns but still allows native Read/Grep. (default)",
  },
  {
    mode: "strict",
    label: "Strict",
    desc: "Deny a native Read/Grep that an indexed-repo jcodemunch route can serve, forcing search_symbols / get_file_outline / search_text. Targeted reads (offset/limit), tiny files, and non-indexed paths still pass.",
  },
  { mode: "off", label: "Off", desc: "No nudge, no deny — fully silent." },
];

export function EnforcementControl({ mode: initial }: { mode: EnforcementMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<EnforcementMode>(initial);
  const [busy, setBusy] = useState<EnforcementMode | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const choose = async (m: EnforcementMode) => {
    if (m === mode || busy) return;
    setBusy(m);
    setMsg(null);
    try {
      const res = await fetch("/api/enforcement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: m }),
      });
      const r = await res.json();
      if (r.ok) {
        setMode(m);
        setMsg({
          tone: "ok",
          text: `Enforcement set to ${m} — takes effect in your next Claude Code session.`,
        });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: r.error ?? "Could not update enforcement." });
      }
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : "Could not update enforcement." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="border-t border-line-soft px-5 py-3">
      <h4 className="text-[13px] font-semibold text-fg">Tool enforcement</h4>
      <p className="mb-2 text-[11px] text-faint">
        How hard the PreToolUse hook steers the agent from Read/Grep to jcodemunch on indexed repos.
      </p>
      <div>
        <div className="flex flex-col gap-2">
          {MODES.map((o) => {
            const active = mode === o.mode;
            return (
              <button
                key={o.mode}
                onClick={() => choose(o.mode)}
                disabled={busy !== null}
                className={cn(
                  "flex items-start gap-3 rounded-md border px-3 py-2 text-left transition",
                  active
                    ? "border-accent/50 bg-accent/5"
                    : "border-line bg-surface hover:border-accent/30",
                  busy !== null && "opacity-60",
                )}
              >
                <span
                  className={cn(
                    "mt-1 h-3.5 w-3.5 shrink-0 rounded-full border",
                    active ? "border-accent bg-accent" : "border-line",
                  )}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm text-fg">
                    {o.label}
                    {active ? " · active" : ""}
                    {busy === o.mode ? " · saving…" : ""}
                  </span>
                  <span className="text-[11px] leading-snug text-faint">{o.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
        {msg ? (
          <p className={cn("mt-2 text-[11px]", msg.tone === "ok" ? "text-accent" : "text-danger")}>
            {msg.text}
          </p>
        ) : null}
        <p className="mt-2 text-[11px] text-faint">
          Writes <code className="font-mono">env.JCODEMUNCH_ENFORCE</code> to ~/.claude/settings.json.
          Applies to Claude Code (including coding in Claude Desktop); plain Desktop chat has no
          native file tools and is unaffected.
        </p>
      </div>
    </div>
  );
}
