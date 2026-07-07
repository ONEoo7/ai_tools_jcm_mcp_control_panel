import { NextRequest, NextResponse } from "next/server";
import { browseDir } from "@/lib/jcm/fsbrowse";

export const dynamic = "force-dynamic";

/** List sub-directories for the folder picker. Read-only directory enumeration. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("path");
  try {
    return NextResponse.json(await browseDir(p));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
