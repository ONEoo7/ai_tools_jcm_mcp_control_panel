import { NextRequest } from "next/server";
import { z } from "zod";
import { buildInitArgs, previewCommand, type DeployOptions } from "@/lib/jcm/deploy";
import { streamedResponse } from "@/lib/jcm/streamResponse";

export const dynamic = "force-dynamic";

const schema = z.object({
  clients: z.array(z.string()).default(["claude-code"]),
  claudeMd: z.enum(["global", "project", "none"]).default("global"),
  hooks: z.boolean().default(true),
  index: z.boolean().default(false),
  shareSavings: z.enum(["on", "off", "default"]).default("default"),
  dryRun: z.boolean().default(true),
  projectPath: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let opts: DeployOptions;
  try {
    opts = schema.parse(await req.json());
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const args = buildInitArgs(opts);
  return streamedResponse(args, {
    cwd: opts.projectPath,
    preface: [
      {
        type: "info",
        data: `${opts.dryRun ? "[DRY RUN] " : ""}${previewCommand(opts)}`,
      },
      ...(opts.projectPath
        ? [{ type: "info" as const, data: `cwd: ${opts.projectPath}` }]
        : []),
    ],
  });
}
