import Link from "next/link";
import { StatCard, PageHeader, EmptyState } from "@/components/ui";
import { doctor } from "@/lib/jcm/discovery";
import { getRepos } from "@/lib/jcm/status";
import { getTelemetry } from "@/lib/jcm/telemetry";
import { getLatestVersion, isUpgradeAvailable } from "@/lib/jcm/version";
import { detectInstall } from "@/lib/jcm/install";
import { EnvironmentCard } from "@/components/EnvironmentCard";
import { RepoUsageCard } from "@/components/RepoUsageCard";
import { compactNumber, pct, fullNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [env, reposRes, telemetry, latestRes, install] = await Promise.all([
    doctor(),
    getRepos(),
    getTelemetry(30),
    getLatestVersion(),
    detectInstall(),
  ]);

  if (env.status === "broken") {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Deploy, configure, and observe jcodemunch-mcp on this machine."
        />
        <div className="rounded-lg border border-warn/30 bg-warn/5 px-6 py-6">
          <h2 className="text-sm font-semibold text-warn">
            jcodemunch-mcp is installed but not working
          </h2>
          <p className="mt-2 text-xs text-muted">
            The binary is present at{" "}
            <code className="select-all font-mono text-faint">{env.binaryPath}</code>{" "}
            but fails to run:
          </p>
          <pre className="scroll-thin mt-2 max-h-24 overflow-auto rounded border border-line bg-bg px-3 py-2 font-mono text-[11px] text-danger">
            {env.detail}
          </pre>
          <p className="mt-3 text-xs text-muted">
            This usually means a <span className="text-fg">uv tool upgrade was
            interrupted while jcodemunch&apos;s MCP server was running</span> (its
            files were locked, so the reinstall couldn&apos;t finish). To repair,
            run the reinstall while jcodemunch is <span className="text-fg">not</span>{" "}
            running:
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted">
            <li>Fully quit Claude Desktop (and any MCP client using jcodemunch).</li>
            <li>
              In a terminal, run:{" "}
              <code className="select-all rounded bg-surface-2 px-1.5 py-0.5 font-mono text-accent">
                uv tool install jcodemunch-mcp --force
              </code>
            </li>
            <li>Reopen Claude Desktop, then reload this page.</li>
          </ol>
          <p className="mt-3 text-[11px] text-faint">
            Tip: avoid upgrading from the panel while this session is connected to
            jcodemunch — the running server locks its own files on Windows.
          </p>
        </div>
      </>
    );
  }

  if (!env.installed) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Deploy, configure, and observe jcodemunch-mcp on this machine."
        />
        <EmptyState
          title="jcodemunch-mcp is not detected on this machine"
          description="No Python? No problem. The guided install can set up uv (a standalone binary) and use it to install jcodemunch-mcp — then register it with Claude Code."
          action={
            <Link
              href="/deploy"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90"
            >
              Install jcodemunch-mcp →
            </Link>
          }
        />
      </>
    );
  }

  const repos = reposRes.repos;
  const totalSymbols = repos.reduce((a, r) => a + r.symbol_count, 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Deploy, configure, and observe jcodemunch-mcp on this machine."
        action={
          <a
            href="/api/report"
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg hover:border-accent/40"
          >
            ↓ Export XLSX
          </a>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Tool calls · 30d"
          value={fullNumber(telemetry.totals.calls)}
          hint={telemetry.enabled ? "all clients" : "enable telemetry to record"}
          accent
        />
        <StatCard
          label="Retrieval events · 30d"
          value={fullNumber(telemetry.totals.rankingEvents)}
          hint="search / plan queries"
        />
        <StatCard
          label="Indexed repos"
          value={repos.length}
          hint={`${compactNumber(totalSymbols)} symbols`}
        />
        <StatCard
          label="Errored calls · 30d"
          value={fullNumber(telemetry.totals.errors)}
          hint={
            telemetry.totals.calls > 0
              ? `${pct(telemetry.totals.errors / telemetry.totals.calls)} of calls`
              : "—"
          }
        />
      </div>

      <p className="mt-2 text-[11px] text-faint">
        All figures come from client-agnostic telemetry (~/.code-index/telemetry.db) — every MCP
        client, not just Claude.
        {telemetry.enabled
          ? " Restart a client after enabling for it to start recording."
          : " Telemetry is off; enable it on the repositories card to start recording."}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <EnvironmentCard
            version={env.version}
            binaryPath={env.binaryPath}
            files={env.files}
            latest={latestRes.latest}
            latestError={latestRes.error}
            upgradeAvailable={isUpgradeAvailable(env.version, latestRes.latest)}
            manager={install.manager}
            upgradeDisplay={install.upgradeDisplay}
            installNote={install.note}
          />
        </div>

        <RepoUsageCard repos={repos} telemetry={telemetry} />
      </div>

      {telemetry.error ? (
        <p className="mt-4 text-xs text-warn">Telemetry unavailable: {telemetry.error}</p>
      ) : null}
    </>
  );
}
