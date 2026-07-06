import { detectInstall } from "@/lib/jcm/install";
import { streamedPlan } from "@/lib/jcm/streamResponse";

export const dynamic = "force-dynamic";

/**
 * Upgrade jcodemunch-mcp using the method it was actually installed with
 * (uv tool / pipx / pip), streaming each step as ndjson. Mutating — the client
 * confirms before calling.
 */
export async function POST() {
  const info = await detectInstall();
  return streamedPlan(info.upgradePlan, {
    preface: [
      { type: "info", data: `Detected install method: ${info.manager}` },
      ...(info.note ? [{ type: "info" as const, data: info.note }] : []),
    ],
  });
}
