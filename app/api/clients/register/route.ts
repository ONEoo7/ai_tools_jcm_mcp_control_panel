import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  registerViaMcpJson,
  registerViaCli,
  registerClaudeDesktop,
} from "@/lib/jcm/clients";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("via", [
  z.object({ via: z.literal("mcpjson"), name: z.string().min(1) }),
  z.object({ via: z.literal("cli"), target: z.string().min(1) }),
  z.object({ via: z.literal("claudedesktop"), configPath: z.string().min(1) }),
]);

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "via + name/target required" }, { status: 400 });
  }

  const d = parsed.data;
  const result =
    d.via === "mcpjson"
      ? await registerViaMcpJson(d.name)
      : d.via === "cli"
        ? await registerViaCli(d.target)
        : await registerClaudeDesktop(d.configPath);

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
