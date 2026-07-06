import { NextRequest } from "next/server";
import { z } from "zod";
import { getProject } from "@/lib/jcm/registry";
import { streamedResponse } from "@/lib/jcm/streamResponse";

export const dynamic = "force-dynamic";

const schema = z.object({ id: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "id required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const project = await getProject(parsed.data.id);
  if (!project) {
    return new Response(JSON.stringify({ error: "Unknown project" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  return streamedResponse(["index", project.path], {
    cwd: project.path,
    preface: [{ type: "info", data: `Indexing ${project.path}` }],
  });
}
