import { NextRequest } from "next/server";
import { getReceipt } from "@/lib/jcm/receipt";
import { getRepos } from "@/lib/jcm/status";
import { buildReport } from "@/lib/jcm/report";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const days = Number(params.get("days") ?? "30");
  const model = (params.get("model") ?? "opus") as "opus" | "sonnet" | "haiku";

  const [receipt, reposRes] = await Promise.all([
    getReceipt(Number.isFinite(days) ? days : 30, model),
    getRepos(),
  ]);

  if (receipt.error && receipt.totals.calls === 0) {
    return new Response(
      JSON.stringify({ error: receipt.error }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  const buffer = await buildReport(receipt, reposRes.repos);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `jcodemunch-usage-${days === 0 ? "all-time" : days + "d"}-${stamp}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
