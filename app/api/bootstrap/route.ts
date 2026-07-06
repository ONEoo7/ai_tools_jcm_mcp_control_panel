import { NextRequest } from "next/server";
import { z } from "zod";
import { getBootstrapPlan } from "@/lib/jcm/bootstrap";
import { streamedPlan } from "@/lib/jcm/streamResponse";
import { refreshResolution } from "@/lib/jcm/cli";

export const dynamic = "force-dynamic";

const schema = z.object({
  installUv: z.boolean().default(true),
  registerClaude: z.boolean().default(true),
  dryRun: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "invalid payload" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const { installUv, registerClaude, dryRun } = parsed.data;
  const { steps, uvPresent } = getBootstrapPlan({ installUv, registerClaude });

  return streamedPlan(steps, {
    dryRun,
    preface: [
      {
        type: "info",
        data: `${dryRun ? "[DRY RUN] " : ""}First-time install — no Python required.`,
      },
      {
        type: "info",
        data: uvPresent
          ? "uv already present; will use it."
          : "uv not found; it will be installed first.",
      },
    ],
    // After a real install, splice ~/.local/bin into PATH and clear cached
    // lookups so the panel finds the freshly installed uv / jcodemunch-mcp on
    // the next request — no restart needed.
    afterAll: refreshResolution,
  });
}
