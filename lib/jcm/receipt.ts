import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { run } from "./cli";

export interface ToolSavings {
  tool: string;
  calls: number;
  actual_tokens: number;
  baseline_tokens: number;
  savings_tokens: number;
}

export interface Receipt {
  totals: {
    calls: number;
    actual_tokens: number;
    baseline_tokens: number;
    savings_tokens: number;
  };
  perTool: ToolSavings[];
  model: string;
  savings_usd: number;
  /** Convenience: baseline vs actual reduction as a fraction (0..1). */
  reductionPct: number;
  days: number;
  ok: boolean;
  error?: string;
}

const EMPTY_TOTALS = {
  calls: 0,
  actual_tokens: 0,
  baseline_tokens: 0,
  savings_tokens: 0,
};

/**
 * Read the token-economy ledger via `receipt --export`. The CLI only emits JSON
 * to a file, so we round-trip through a temp file and clean it up.
 */
export async function getReceipt(
  days = 30,
  model: "opus" | "sonnet" | "haiku" = "opus",
): Promise<Receipt> {
  const tmp = path.join(
    os.tmpdir(),
    `jcm-receipt-${crypto.randomBytes(6).toString("hex")}.json`,
  );
  const res = await run(
    ["receipt", "--days", String(days), "--model", model, "--export", tmp],
    { timeout: 60_000 },
  );

  const base: Receipt = {
    totals: { ...EMPTY_TOTALS },
    perTool: [],
    model,
    savings_usd: 0,
    reductionPct: 0,
    days,
    ok: false,
  };

  if (!res.ok && res.notFound) {
    return { ...base, error: res.stderr };
  }

  try {
    const raw = await fs.readFile(tmp, "utf8");
    const json = JSON.parse(raw);
    const totals = { ...EMPTY_TOTALS, ...(json.totals ?? {}) };
    const perTool: ToolSavings[] = Object.entries(json.per_tool ?? {})
      .map(([tool, v]) => ({ tool, ...EMPTY_TOTALS, ...(v as object) }))
      .sort((a, b) => b.savings_tokens - a.savings_tokens);
    const reductionPct =
      totals.baseline_tokens > 0
        ? totals.savings_tokens / totals.baseline_tokens
        : 0;
    return {
      totals,
      perTool,
      model: json.model ?? model,
      savings_usd: json.savings_usd ?? 0,
      reductionPct,
      days,
      ok: true,
    };
  } catch (err) {
    return {
      ...base,
      error:
        res.stderr ||
        `Could not read receipt output. ${err instanceof Error ? err.message : ""}`,
    };
  } finally {
    fs.unlink(tmp).catch(() => {});
  }
}
