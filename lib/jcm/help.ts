import { run } from "./cli";

export async function getGuide(): Promise<{ markdown: string; error?: string }> {
  const res = await run(["claude-md", "--generate", "--format", "full"], {
    timeout: 20_000,
  });
  if (!res.ok && res.notFound) return { markdown: "", error: res.stderr };
  return { markdown: res.stdout || res.stderr };
}

export async function getWhatsNew(
  cwd?: string,
): Promise<{ text: string; error?: string }> {
  const res = await run(["whatsnew", "--max-entries", "5"], {
    cwd,
    timeout: 20_000,
  });
  if (!res.ok && res.notFound) return { text: "", error: res.stderr };
  return { text: res.stdout || res.stderr };
}

/** Curated reference of the most useful config keys (from `jcodemunch-mcp config`). */
export interface ConfigRef {
  key: string;
  group: string;
  desc: string;
  defaultValue: string;
}

export const CONFIG_REFERENCE: ConfigRef[] = [
  { key: "max_folder_files", group: "Indexing", desc: "Max files scanned when indexing a folder.", defaultValue: "2000" },
  { key: "max_index_files", group: "Indexing", desc: "Hard cap on files kept in an index.", defaultValue: "10000" },
  { key: "staleness_days", group: "Indexing", desc: "Age after which an index is considered stale.", defaultValue: "7" },
  { key: "max_results", group: "Indexing", desc: "Max results returned by search tools.", defaultValue: "500" },
  { key: "extra_ignore_patterns", group: "Indexing", desc: "Additional glob patterns to skip.", defaultValue: "(none)" },
  { key: "extra_extensions", group: "Indexing", desc: "Extra file extensions to index.", defaultValue: "(none)" },
  { key: "disabled_tools", group: "Tools", desc: "Tools to hide from the exposed MCP tool list.", defaultValue: "[]" },
  { key: "tool_profile", group: "Tools", desc: "Which tool bundle to expose (full/standard/core).", defaultValue: "full" },
  { key: "compact_schemas", group: "Tools", desc: "Emit compact tool schemas to save tokens.", defaultValue: "disabled" },
  { key: "adaptive_tiering", group: "Tools", desc: "Narrow tools by model tier automatically.", defaultValue: "disabled" },
  { key: "languages", group: "Languages", desc: "Languages enabled for indexing.", defaultValue: "76 items" },
  { key: "use_ai_summaries", group: "Summarizer", desc: "Use an LLM to summarise symbols.", defaultValue: "true" },
  { key: "summarizer_provider", group: "Summarizer", desc: "LLM provider (auto-detected from API keys).", defaultValue: "auto" },
  { key: "allow_remote_summarizer", group: "Summarizer", desc: "Permit calls to a remote summariser.", defaultValue: "false" },
  { key: "transport", group: "Transport", desc: "MCP transport (stdio or http).", defaultValue: "stdio" },
  { key: "watch", group: "Watcher", desc: "Auto-reindex folders on file changes.", defaultValue: "false" },
  { key: "watch_debounce_ms", group: "Watcher", desc: "Debounce window for the file watcher.", defaultValue: "2000" },
  { key: "freshness_mode", group: "Watcher", desc: "How aggressively to treat indexes as stale.", defaultValue: "relaxed" },
  { key: "log_level", group: "Logging", desc: "Server log verbosity.", defaultValue: "WARNING" },
  { key: "redact_source_root", group: "Privacy", desc: "Redact absolute paths in output/telemetry.", defaultValue: "false" },
  { key: "share_savings", group: "Privacy", desc: "Share anonymous token-savings stats.", defaultValue: "enabled" },
];
