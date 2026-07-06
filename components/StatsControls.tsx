"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/components/ui";

const WINDOWS = [
  { label: "7d", value: "7" },
  { label: "30d", value: "30" },
  { label: "90d", value: "90" },
  { label: "All", value: "0" },
];
const MODELS = ["opus", "sonnet", "haiku"];

export function StatsControls() {
  const router = useRouter();
  const params = useSearchParams();
  const days = params.get("days") ?? "30";
  const model = params.get("model") ?? "opus";

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.push(`/stats?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="inline-flex rounded-md border border-line bg-surface p-0.5">
        {WINDOWS.map((w) => (
          <button
            key={w.value}
            onClick={() => set("days", w.value)}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              days === w.value
                ? "bg-accent text-accent-fg"
                : "text-muted hover:text-fg",
            )}
          >
            {w.label}
          </button>
        ))}
      </div>
      <div className="inline-flex rounded-md border border-line bg-surface p-0.5">
        {MODELS.map((m) => (
          <button
            key={m}
            onClick={() => set("model", m)}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium capitalize transition-colors",
              model === m ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <a
        href={`/api/report?days=${days}&model=${model}`}
        className="ml-auto rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-fg hover:border-accent/40"
      >
        ↓ Export XLSX
      </a>
    </div>
  );
}
