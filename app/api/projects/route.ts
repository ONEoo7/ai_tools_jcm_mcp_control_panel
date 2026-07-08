import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  addProject,
  removeProject,
  validateProjectPath,
} from "@/lib/jcm/registry";
import { syncAndListProjects } from "@/lib/jcm/projects";
import { getCurrentIndexVersion } from "@/lib/jcm/indexVersion";

export const dynamic = "force-dynamic";

export async function GET() {
  const [projects, currentIndexVersion] = await Promise.all([
    syncAndListProjects(),
    getCurrentIndexVersion(),
  ]);
  return NextResponse.json({ projects, currentIndexVersion });
}

const addSchema = z.object({ path: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = addSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  const err = await validateProjectPath(parsed.data.path);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const project = await addProject(parsed.data.path);
  return NextResponse.json({ project });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await removeProject(id);
  return NextResponse.json({ ok: true });
}
