"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Badge, EmptyState, cn } from "@/components/ui";
import { compactNumber } from "@/lib/format";
import type { RepoInfo } from "@/lib/jcm/status";
import type { TelemetrySnapshot, ToolStat } from "@/lib/jcm/telemetry";

interface Props {
  repos: RepoInfo[];
  telemetry: TelemetrySnapshot;
}

interface Usage {
  calls: number;
  errors: number;
  rankingEvents: number;
  tools: ToolStat[];
}

/**
 * Sum telemetry recorded under either this repo's id or its display name (the
 * `repo` column may hold either), merging the per-tool breakdown by tool name.
 */
function usageFor(repo: RepoInfo, t: TelemetrySnapshot): Usage {
  const keys = new Set([repo.repo_id, repo.display_name].filter(Boolean));
  const buckets = t.byRepo.filter((r) => r.repo && keys.has(r.repo));
  const toolMap = new Map<string, ToolStat>();
  let calls = 0;
  let errors = 0;
  let rankingEvents = 0;
  for (const b of buckets) {
    calls += b.calls;
    errors += b.errors;
    rankingEvents += b.rankingEvents;
    for (const s of b.tools) {
      const cur = toolMap.get(s.tool);
      if (!cur) {
        toolMap.set(s.tool, { ...s });
      } else {
        const total = cur.calls + s.calls;
        // avgMs * calls = total duration, so this weighted mean is exact.
        cur.avgMs = total ? (cur.avgMs * cur.calls + s.avgMs * s.calls) / total : 0;
        cur.calls = total;
        cur.errors += s.errors;
      }
    }
  }
  const tools = [...toolMap.values()].sort((a, b) => b.calls - a.calls);
  return { calls, errors, rankingEvents, tools };
}

export function RepoUsageCard({ repos, telemetry }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const enable = async () => {
    setEnabling(true);
    setMsg(null);
    try {
      const res = await fetch("/api/telemetry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "enable" }),
      });
      const r = await res.json();
      if (r.ok) {
        setMsg({
          tone: "ok",
          text: "Telemetry enabled — restart your MCP clients (Claude, Copilot, …) so they start recording.",
        });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: r.error ?? "Could not enable telemetry." });
      }
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : "Could not enable telemetry." });
    } finally {
      setEnabling(false);
    }
  };

  const clear = async (repo: RepoInfo) => {
    setBusy(repo.repo_id);
    setMsg(null);
    try {
      const qs = new URLSearchParams({ repo: repo.repo_id, name: repo.display_name || "" });
      const res = await fetch(`/api/telemetry?${qs.toString()}`, { method: "DELETE" });
      const r = await res.json();
      if (r.ok) {
        const n = (r.toolCalls ?? 0) + (r.rankingEvents ?? 0);
        setMsg({
          tone: "ok",
          text: n
            ? `Cleared ${r.toolCalls} call${r.toolCalls === 1 ? "" : "s"}${
                r.rankingEvents ? ` + ${r.rankingEvents} ranking event${r.rankingEvents === 1 ? "" : "s"}` : ""
              } for ${repo.display_name}.`
            : `No telemetry to clear for ${repo.display_name}.`,
        });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: r.error ?? "Clear failed." });
      }
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : "Clear failed." });
    } finally {
      setBusy(null);
    }
  };

  const shown = repos.slice(0, 6);
  const attributed = repos.reduce((a, r) => a + usageFor(r, telemetry).calls, 0);
  const unattributed = Math.max(0, telemetry.totals.calls - attributed);

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Indexed repositories"
        subtitle={`${repos.length} indexed`}
        action={
          <div className="flex items-center gap-2">
            {telemetry.enabled ? (
              <Badge tone="ok">telemetry on</Badge>
            ) : (
              <>
                <Badge tone="neutral">telemetry off</Badge>
                <button
                  onClick={enable}
                  disabled={enabling}
                  title="Set perf_telemetry_enabled in config.jsonc so jcodemunch records usage from every client"
                  className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-fg hover:border-accent/40 disabled:opacity-40"
                >
                  {enabling ? "Enabling…" : "Enable"}
                </button>
              </>
            )}
            <Link href="/projects" className="text-xs text-accent hover:underline">
              Manage projects →
            </Link>
          </div>
        }
      />

      {msg ? (
        <div
          className={cn(
            "border-b border-line-soft px-5 py-1.5 text-[11px]",
            msg.tone === "ok" ? "text-accent" : "text-danger",
          )}
        >
          {msg.text}
        </div>
      ) : null}

      {telemetry.enabled && telemetry.totals.calls === 0 ? (
        <div className="border-b border-line-soft px-5 py-1.5 text-[11px] text-faint">
          Telemetry is on but no calls are recorded yet — usage appears here once your clients make
          jcodemunch tool calls (they must be restarted after enabling).
        </div>
      ) : null}

      {repos.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState
            title="No repositories indexed yet"
            description="Add a project and index it to start saving tokens."
          />
        </div>
      ) : (
        <div className="divide-y divide-line-soft">
          {shown.map((r) => {
            const u = usageFor(r, telemetry);
            const canExpand = telemetry.enabled && u.tools.length > 0;
            const isOpen = expanded.has(r.repo_id);
            return (
              <div key={r.repo_id}>
                <div className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-fg">{r.display_name}</div>
                    <div className="truncate text-xs text-faint">{r.source_root}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-muted">
                      {compactNumber(r.symbol_count)} sym · {r.file_count} files
                    </span>
                    {telemetry.enabled ? (
                      canExpand ? (
                        <button
                          onClick={() => toggle(r.repo_id)}
                          className="text-xs tabular-nums text-muted hover:text-fg"
                          title={`${u.calls} tool calls (all clients) in the last ${telemetry.days}d — click for the per-tool breakdown`}
                        >
                          {isOpen ? "▾" : "▸"} {compactNumber(u.calls)} calls
                        </button>
                      ) : (
                        <span className="text-xs tabular-nums text-faint">0 calls</span>
                      )
                    ) : null}
                    <Badge tone={r.freshness === "fresh" ? "ok" : "warn"}>{r.freshness}</Badge>
                    <button
                      onClick={() => clear(r)}
                      disabled={busy === r.repo_id || (telemetry.enabled && u.calls === 0)}
                      title="Clear this repo's recorded jcodemunch usage (telemetry.db)"
                      className="rounded-md border border-line bg-surface px-2 py-1 text-[11px] font-medium text-fg hover:border-danger/40 hover:text-danger disabled:opacity-30"
                    >
                      {busy === r.repo_id ? "Clearing…" : "Clear"}
                    </button>
                  </div>
                </div>
                {isOpen ? (
                  <div className="border-t border-line-soft bg-surface/40 px-5 py-2">
                    <div className="mb-1 text-[10px] uppercase tracking-wide text-faint">
                      Top tools · {telemetry.days}d
                    </div>
                    <div className="flex flex-col gap-1">
                      {u.tools.slice(0, 6).map((s) => (
                        <div
                          key={s.tool}
                          className="flex items-center justify-between gap-3 text-[11px]"
                        >
                          <code className="font-mono text-fg">{s.tool}</code>
                          <span className="tabular-nums text-muted">
                            {compactNumber(s.calls)} calls · {Math.round(s.avgMs)}ms avg
                            {s.errors ? (
                              <span className="text-danger"> · {s.errors} err</span>
                            ) : null}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {unattributed > 0 ? (
            <div className="px-5 py-2 text-[11px] text-faint">
              + {compactNumber(unattributed)} call{unattributed === 1 ? "" : "s"} not attributed to a
              listed repo (repo-less tools or other repos).
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
