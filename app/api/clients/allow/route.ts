import { NextRequest, NextResponse } from "next/server";
import {
  setClaudeCodeAlwaysAllow,
  setAntigravityAllowAll,
  setCopilotAutoApprove,
} from "@/lib/jcm/permissions";

export const dynamic = "force-dynamic";

/**
 * Auto-allow jcodemunch tools for a client. Body `{ client }`:
 *  - "antigravity" → wildcard grant in ~/.gemini/config/config.json
 *  - "copilot" → chat.tools.autoApprove (GLOBAL, all-tools) in VS Code settings.json
 *  - "claude-code" (default) → permissions.allow in ~/.claude/settings.json
 */
export async function POST(req: NextRequest) {
  let client = "claude-code";
  try {
    const body = await req.json();
    if (body && typeof body.client === "string") client = body.client;
  } catch {
    /* no body → default claude-code */
  }
  const res =
    client === "antigravity"
      ? await setAntigravityAllowAll()
      : client === "copilot"
        ? await setCopilotAutoApprove()
        : await setClaudeCodeAlwaysAllow();
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
