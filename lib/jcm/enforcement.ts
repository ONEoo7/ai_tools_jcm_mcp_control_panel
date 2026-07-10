import { promises as fs } from "node:fs";
import path from "node:path";
import { claudeSettingsFile } from "./paths";

/**
 * jcodemunch's PreToolUse hook enforcement tier, controlled by the
 * `JCODEMUNCH_ENFORCE` env var which Claude Code passes to the hook subprocess
 * from `~/.claude/settings.json`'s `env` block:
 *  - "advisory" (default): warn but allow native Read/Grep.
 *  - "strict": deny a native Read/Grep an indexed-repo jcodemunch route can serve
 *    (targeted reads, tiny files, and non-indexed paths still pass).
 *  - "off": silent.
 * Applies to Claude Code, including coding inside Claude Desktop; plain Desktop
 * chat has no native file tools and is unaffected.
 */

export type EnforcementMode = "advisory" | "strict" | "off";

const ENV_KEY = "JCODEMUNCH_ENFORCE";

/** Map any raw JCODEMUNCH_ENFORCE value to a mode, mirroring the hook's own logic. */
export function normalizeMode(raw: unknown): EnforcementMode {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (["strict", "deny", "block", "hard"].includes(v)) return "strict";
  if (["off", "0", "false", "no", "none", "silent"].includes(v)) return "off";
  return "advisory";
}

export async function getEnforcementMode(): Promise<EnforcementMode> {
  try {
    const text = await fs.readFile(claudeSettingsFile, "utf8");
    const root = JSON.parse(text) as { env?: Record<string, unknown> };
    return normalizeMode(root?.env?.[ENV_KEY]);
  } catch {
    return "advisory";
  }
}

export interface EnforcementResult {
  ok: boolean;
  mode: EnforcementMode;
  path: string;
  backup?: string;
  error?: string;
}

/** Persist the enforcement mode into ~/.claude/settings.json `env` (with backup). */
export async function setEnforcementMode(mode: EnforcementMode): Promise<EnforcementResult> {
  const file = claudeSettingsFile;

  let text = "";
  let existed = true;
  try {
    text = await fs.readFile(file, "utf8");
  } catch {
    existed = false;
  }

  let root: Record<string, unknown> = {};
  if (text.trim()) {
    try {
      root = JSON.parse(text);
    } catch {
      return {
        ok: false,
        mode,
        path: file,
        error: "~/.claude/settings.json isn't valid JSON — fix it manually so we don't overwrite it.",
      };
    }
  }
  if (typeof root !== "object" || root === null || Array.isArray(root)) root = {};

  const envRaw = root.env;
  const env =
    typeof envRaw === "object" && envRaw !== null && !Array.isArray(envRaw)
      ? (envRaw as Record<string, unknown>)
      : {};
  env[ENV_KEY] = mode;
  root.env = env;

  let backup: string | undefined;
  if (existed) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backup = `${file}.bak-${stamp}`;
    try {
      await fs.copyFile(file, backup);
    } catch {
      backup = undefined;
    }
  }

  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(root, null, 2) + "\n", "utf8");
  } catch (err) {
    return { ok: false, mode, path: file, error: err instanceof Error ? err.message : String(err) };
  }
  return { ok: true, mode, path: file, backup };
}
