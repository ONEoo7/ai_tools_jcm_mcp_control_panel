"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/components/ui";

export interface LogLine {
  kind: "stdout" | "stderr" | "exit" | "error" | "info";
  text: string;
}

type Status = "idle" | "running" | "done" | "failed";

export function useLogStream(url: string) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (body: unknown) => {
      setLines([]);
      setStatus("running");
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: ac.signal,
        });
        if (!res.body) {
          setStatus("failed");
          setLines((l) => [...l, { kind: "error", text: "No response stream." }]);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let failed = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            if (!part.trim()) continue;
            let line: LogLine;
            try {
              const ev = JSON.parse(part);
              line = { kind: ev.type ?? "info", text: ev.data ?? "" };
              if (ev.type === "error") failed = true;
              if (ev.type === "exit" && ev.code !== 0 && ev.code != null)
                failed = true;
            } catch {
              line = { kind: "stdout", text: part };
            }
            setLines((l) => [...l, line]);
          }
        }
        setStatus(failed ? "failed" : "done");
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setStatus("idle");
          return;
        }
        setLines((l) => [
          ...l,
          { kind: "error", text: String((err as Error).message) },
        ]);
        setStatus("failed");
      }
    },
    [url],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { lines, status, run, cancel };
}

export function LogConsole({
  lines,
  status,
  className,
}: {
  lines: LogLine[];
  status: Status;
  className?: string;
}) {
  const color: Record<LogLine["kind"], string> = {
    stdout: "text-fg",
    stderr: "text-warn",
    error: "text-danger",
    exit: "text-accent",
    info: "text-info",
  };
  return (
    <div
      className={cn(
        "scroll-thin max-h-96 overflow-auto rounded-md border border-line bg-bg px-4 py-3 font-mono text-xs leading-relaxed",
        className,
      )}
    >
      {lines.length === 0 ? (
        <span className="text-faint">
          {status === "running" ? "Starting…" : "Output will appear here."}
        </span>
      ) : (
        lines.map((l, i) => (
          <div key={i} className={cn("whitespace-pre-wrap", color[l.kind])}>
            {l.text}
          </div>
        ))
      )}
      {status === "running" ? (
        <div className="mt-1 text-faint animate-pulse-soft">▍running…</div>
      ) : null}
    </div>
  );
}
