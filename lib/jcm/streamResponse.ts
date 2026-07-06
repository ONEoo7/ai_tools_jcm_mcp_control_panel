import { stream, streamExec, resolveBinary, type StreamEvent } from "./cli";

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

export interface PlanStep {
  label: string;
  command: string; // "jcodemunch-mcp" runs via the resolved CLI binary; others via PATH
  args: string[];
}

/**
 * Run an ordered list of steps, streaming all output as ndjson. Stops early if a
 * step exits non-zero (or fails to launch). Used by the install-aware upgrade.
 */
export function streamedPlan(
  steps: PlanStep[],
  opts: {
    cwd?: string;
    preface?: StreamEvent[];
    dryRun?: boolean;
    afterAll?: () => void;
  } = {},
): Response {
  const encoder = new TextEncoder();
  const jcmName = (resolveBinary() ?? "jcodemunch-mcp").replace(/.*[\\/]/, "");
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: StreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      for (const p of opts.preface ?? []) emit(p);

      let failed = false;
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        emit({
          type: "info",
          data: `▸ Step ${i + 1}/${steps.length}: ${step.label} — ${step.command} ${step.args.join(" ")}`,
        });
        if (opts.dryRun) {
          emit({ type: "stdout", data: "[dry run] command not executed" });
          continue;
        }
        const isJcm = step.command === "jcodemunch-mcp" || step.command === jcmName;
        const code = isJcm
          ? await stream(step.args, emit, { cwd: opts.cwd })
          : await streamExec(step.command, step.args, emit, { cwd: opts.cwd });
        if (code !== 0) {
          failed = true;
          emit({
            type: "error",
            data: `Step ${i + 1} failed (exit ${code}). Stopping.`,
          });
          break;
        }
      }
      if (!opts.dryRun && !failed) opts.afterAll?.();
      emit({
        type: "exit",
        data: failed ? "failed" : opts.dryRun ? "dry run complete" : "done",
        code: failed ? 1 : 0,
      });
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
