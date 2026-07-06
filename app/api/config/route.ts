import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  readRawConfig,
  writeRawConfig,
  getEffectiveConfig,
  type Scope,
} from "@/lib/jcm/config";
import { validateProjectPath } from "@/lib/jcm/registry";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const scope = (req.nextUrl.searchParams.get("scope") ?? "global") as Scope;
  const projectPath = req.nextUrl.searchParams.get("path") ?? undefined;

  if (scope === "project") {
    if (!projectPath)
      return NextResponse.json({ error: "path required for project scope" }, { status: 400 });
    const err = await validateProjectPath(projectPath);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  const raw = await readRawConfig(scope, projectPath);
  const effective =
    scope === "global"
      ? await getEffectiveConfig()
      : await getEffectiveConfig(projectPath);
  return NextResponse.json({ raw, effective });
}

const putSchema = z.object({
  scope: z.enum(["global", "project"]),
  path: z.string().optional(),
  content: z.string(),
});

export async function PUT(req: NextRequest) {
  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  const { scope, path, content } = parsed.data;
  if (scope === "project" && !path) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }
  const result = await writeRawConfig(scope, content, path);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
