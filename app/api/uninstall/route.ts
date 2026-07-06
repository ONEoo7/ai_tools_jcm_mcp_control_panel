import { NextRequest } from "next/server";
import { z } from "zod";
import { streamedResponse } from "@/lib/jcm/streamResponse";

export const dynamic = "force-dynamic";

const schema = z.object({
  target: z.string().optional(),
  dryRun: z.boolean().default(true),
  projectPath: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "invalid payload" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const { target, dryRun, projectPath } = parsed.data;
  const args = ["uninstall"];
  if (target) args.push(target);
  args.push("--yes");
  if (dryRun) args.push("--dry-run");

  return streamedResponse(args, {
    cwd: projectPath,
    preface: [
      {
        type: "info",
        data: `${dryRun ? "[DRY RUN] " : ""}jcodemunch-mcp ${args.join(" ")}`,
      },
    ],
  });
}
