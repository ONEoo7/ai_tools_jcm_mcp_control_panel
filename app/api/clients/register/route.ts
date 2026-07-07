import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registerExtraClient } from "@/lib/jcm/clients";

export const dynamic = "force-dynamic";

const schema = z.object({ name: z.string().min(1) });

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const result = await registerExtraClient(parsed.data.name);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
