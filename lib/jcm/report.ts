import ExcelJS from "exceljs";
import type { Receipt } from "./receipt";
import type { RepoInfo } from "./status";

const ACCENT = "FF16351F";
const HEADER_FILL = "FF141B24";
const HEADER_FONT = "FF4ADE80";

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
    cell.alignment = { vertical: "middle" };
  });
}

/**
 * Build an XLSX workbook summarising jcodemunch usage & savings.
 * Sheets: Summary, Per-Tool Savings, Indexed Repos.
 */
export async function buildReport(
  receipt: Receipt,
  repos: RepoInfo[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "jCodeMunch Control Panel";
  wb.created = new Date();

  // ---- Summary ----
  const summary = wb.addWorksheet("Summary");
  summary.columns = [
    { header: "Metric", key: "metric", width: 34 },
    { header: "Value", key: "value", width: 28 },
  ];
  styleHeader(summary.getRow(1));
  const rows: [string, string | number][] = [
    ["Window (days)", receipt.days === 0 ? "all-time" : receipt.days],
    ["Model rate", receipt.model],
    ["Total tool calls", receipt.totals.calls],
    ["Actual tokens used", receipt.totals.actual_tokens],
    ["Baseline tokens (without jCodeMunch)", receipt.totals.baseline_tokens],
    ["Tokens saved", receipt.totals.savings_tokens],
    ["Reduction", `${(receipt.reductionPct * 100).toFixed(1)}%`],
    ["Estimated cost avoided (USD)", Number(receipt.savings_usd.toFixed(4))],
  ];
  rows.forEach((r) => summary.addRow({ metric: r[0], value: r[1] }));
  summary.getColumn("metric").eachCell((c) => (c.alignment = { vertical: "middle" }));
  // Emphasise the savings rows
  [6, 8].forEach((rn) => {
    const row = summary.getRow(rn + 1);
    row.getCell("value").font = { bold: true, color: { argb: HEADER_FONT } };
  });

  // ---- Per-Tool Savings ----
  const perTool = wb.addWorksheet("Per-Tool Savings");
  perTool.columns = [
    { header: "Tool", key: "tool", width: 30 },
    { header: "Calls", key: "calls", width: 12 },
    { header: "Actual Tokens", key: "actual", width: 16 },
    { header: "Baseline Tokens", key: "baseline", width: 18 },
    { header: "Tokens Saved", key: "saved", width: 16 },
    { header: "Reduction", key: "reduction", width: 12 },
  ];
  styleHeader(perTool.getRow(1));
  for (const t of receipt.perTool) {
    perTool.addRow({
      tool: t.tool,
      calls: t.calls,
      actual: t.actual_tokens,
      baseline: t.baseline_tokens,
      saved: t.savings_tokens,
      reduction:
        t.baseline_tokens > 0
          ? `${((t.savings_tokens / t.baseline_tokens) * 100).toFixed(0)}%`
          : "—",
    });
  }
  perTool.autoFilter = { from: "A1", to: "F1" };

  // ---- Indexed Repos ----
  const reposSheet = wb.addWorksheet("Indexed Repos");
  reposSheet.columns = [
    { header: "Repository", key: "name", width: 30 },
    { header: "Source Root", key: "root", width: 48 },
    { header: "Files", key: "files", width: 10 },
    { header: "Symbols", key: "symbols", width: 12 },
    { header: "Freshness", key: "fresh", width: 12 },
    { header: "Indexed At", key: "indexed", width: 26 },
  ];
  styleHeader(reposSheet.getRow(1));
  for (const r of repos) {
    reposSheet.addRow({
      name: r.display_name,
      root: r.source_root,
      files: r.file_count,
      symbols: r.symbol_count,
      fresh: r.freshness,
      indexed: r.indexed_at ?? "—",
    });
  }

  void ACCENT;
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
