import {
  Card,
  CardHeader,
  StatCard,
  PageHeader,
  EmptyState,
} from "@/components/ui";
import { StatsControls } from "@/components/StatsControls";
import { getReceipt } from "@/lib/jcm/receipt";
import { compactNumber, fullNumber, usd, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; model?: string }>;
}) {
  const sp = await searchParams;
  const days = Number(sp.days ?? "30");
  const model = (sp.model ?? "opus") as "opus" | "sonnet" | "haiku";
  const receipt = await getReceipt(Number.isFinite(days) ? days : 30, model);

  const maxSaved = Math.max(1, ...receipt.perTool.map((t) => t.savings_tokens));

  return (
    <>
      <PageHeader
        title="Statistics"
        description="Token savings and usage, sourced from the jcodemunch receipt ledger."
      />

      <div className="mb-5">
        <StatsControls />
      </div>

      {receipt.error && receipt.totals.calls === 0 ? (
        <EmptyState
          title="No usage data yet"
          description={
            receipt.error +
            " — run some jcodemunch tools in an agent session, then reload."
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Tokens saved"
              value={compactNumber(receipt.totals.savings_tokens)}
              hint={`${pct(receipt.reductionPct)} vs baseline`}
              accent
            />
            <StatCard
              label="Cost avoided"
              value={usd(receipt.savings_usd)}
              hint={`${model} rates`}
              accent
            />
            <StatCard
              label="Actual tokens"
              value={compactNumber(receipt.totals.actual_tokens)}
              hint={`of ${compactNumber(receipt.totals.baseline_tokens)} baseline`}
            />
            <StatCard
              label="Tool calls"
              value={fullNumber(receipt.totals.calls)}
              hint={days === 0 ? "all-time" : `last ${days} days`}
            />
          </div>

          <Card className="mt-4">
            <CardHeader
              title="Savings by tool"
              subtitle="Tokens saved per tool, highest first"
            />
            {receipt.perTool.length === 0 ? (
              <div className="px-5 py-8">
                <EmptyState title="No per-tool data in this window" />
              </div>
            ) : (
              <div className="px-5 py-4">
                <div className="flex flex-col gap-3">
                  {receipt.perTool.map((t) => (
                    <div key={t.tool} className="flex items-center gap-3">
                      <div className="w-48 shrink-0 truncate font-mono text-xs text-fg">
                        {t.tool}
                      </div>
                      <div className="relative h-5 flex-1 overflow-hidden rounded bg-surface-2">
                        <div
                          className="absolute inset-y-0 left-0 rounded bg-accent/70"
                          style={{
                            width: `${(t.savings_tokens / maxSaved) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="w-28 shrink-0 text-right text-xs tabular-nums text-muted">
                        {compactNumber(t.savings_tokens)} saved
                      </div>
                      <div className="w-16 shrink-0 text-right text-xs tabular-nums text-faint">
                        {fullNumber(t.calls)}×
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <p className="mt-3 text-xs text-faint">
            Savings are estimated by comparing actual token usage against a
            per-tool baseline (what the equivalent native Read/Grep/Glob calls
            would have cost). Dollar figures use {model} rates.
          </p>
        </>
      )}
    </>
  );
}
