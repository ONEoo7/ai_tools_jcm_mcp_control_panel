import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { testClientServer } from "@/lib/jcm/mcpTest";

export const dynamic = "force-dynamic";

const schema = z.object({
  configPath: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Request body must be JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }
  const result = await testClientServer(parsed.data.configPath ?? null);
  return NextResponse.json(result);
}
