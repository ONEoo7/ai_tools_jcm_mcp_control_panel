import { stream, type StreamEvent } from "./cli";

/**
 * Run a jcodemunch-mcp subcommand and return an HTTP Response whose body streams
 * newline-delimited JSON events ({type,data,code}) as they are produced.
 */
export function streamedResponse(
  args: string[],
  opts: { cwd?: string; preface?: StreamEvent[] } = {},
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: StreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      for (const p of opts.preface ?? []) emit(p);
      await stream(args, emit, { cwd: opts.cwd });
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
