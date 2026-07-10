import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getTelemetry,
  enableTelemetry,
  clearRepoTelemetry,
} from "@/lib/jcm/telemetry";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const daysRaw = req.nextUrl.searchParams.get("days");
  const days = daysRaw ? Math.max(1, Math.min(365, parseInt(daysRaw, 10) || 30)) : 30;
  return NextResponse.json(await getTelemetry(days));
}

const enableSchema = z.object({ action: z.literal("enable") });

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Request body must be JSON." }, { status: 400 });
  }
  const parsed = enableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }
  const res = await enableTelemetry();
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}

export function DELETE(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get("repo");
  const name = req.nextUrl.searchParams.get("name");
  const matches = [repo, name].filter((s): s is string => !!s);
  if (!matches.length) {
    return NextResponse.json({ ok: false, error: "repo required" }, { status: 400 });
  }
  const res = clearRepoTelemetry(matches);
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
