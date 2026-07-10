import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEnforcementMode, setEnforcementMode } from "@/lib/jcm/enforcement";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ mode: await getEnforcementMode() });
}

const schema = z.object({ mode: z.enum(["advisory", "strict", "off"]) });

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Request body must be JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid mode." }, { status: 400 });
  }
  const res = await setEnforcementMode(parsed.data.mode);
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
