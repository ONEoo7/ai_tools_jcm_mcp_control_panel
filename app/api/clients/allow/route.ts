import { NextResponse } from "next/server";
import { setClaudeCodeAlwaysAllow } from "@/lib/jcm/permissions";

export const dynamic = "force-dynamic";

/** Set jcodemunch to always-allow in Claude Code's global settings.json. */
export async function POST() {
  const res = await setClaudeCodeAlwaysAllow();
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
