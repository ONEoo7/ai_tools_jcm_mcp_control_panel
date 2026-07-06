import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getProject } from "@/lib/jcm/registry";
import { defaultProjectConfigPath } from "@/lib/jcm/paths";
import { projectConfigTemplate } from "@/lib/jcm/templates";

export const dynamic = "force-dynamic";

const schema = z.object({ id: z.string().min(1), overwrite: z.boolean().default(false) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const project = await getProject(parsed.data.id);
  if (!project) return NextResponse.json({ error: "Unknown project" }, { status: 404 });

  const target = defaultProjectConfigPath(project.path);
  const exists = await fs
    .access(target)
    .then(() => true)
    .catch(() => false);

  if (exists && !parsed.data.overwrite) {
    return NextResponse.json(
      { error: "already-exists", path: target },
      { status: 409 },
    );
  }

  try {
    await fs.writeFile(
      target,
      projectConfigTemplate(path.basename(project.path)),
      "utf8",
    );
    return NextResponse.json({ ok: true, path: target });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
