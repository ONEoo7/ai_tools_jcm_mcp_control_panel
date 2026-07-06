import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  addProject,
  listProjects,
  removeProject,
  validateProjectPath,
} from "@/lib/jcm/registry";
import { getRepos, matchRepo } from "@/lib/jcm/status";

export const dynamic = "force-dynamic";

export async function GET() {
  const [projects, reposRes] = await Promise.all([listProjects(), getRepos()]);
  const enriched = projects.map((p) => ({
    ...p,
    repo: matchRepo(reposRes.repos, p.path),
  }));
  return NextResponse.json({ projects: enriched });
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
