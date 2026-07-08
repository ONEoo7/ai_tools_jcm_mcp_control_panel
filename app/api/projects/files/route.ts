import { NextRequest, NextResponse } from "next/server";
import { getProjectFiles } from "@/lib/jcm/projectFiles";
import { validateProjectPath } from "@/lib/jcm/registry";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }
  const err = await validateProjectPath(path);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const files = await getProjectFiles(path);
  return NextResponse.json({ files });
}
