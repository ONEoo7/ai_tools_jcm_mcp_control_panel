import { promises as fs } from "node:fs";
import path from "node:path";
import { claudeSettingsFile } from "./paths";

/**
 * Claude Code tool-permission automation. Claude Code reads allow/deny rules from
 * ~/.claude/settings.json under `permissions.allow`. The rule `mcp__<server>`
 * allow-lists every tool from that MCP server (jcodemunch registers as the
 * `jcodemunch` server), so Claude Code stops prompting for each jcodemunch call.
 *
 * This only works for Claude Code — Claude Desktop stores connector permissions
 * in its internal Chromium storage (leveldb/IndexedDB), which is binary,
 * app-locked, and unsafe to edit externally; there the in-app
 * Connectors → jcodemunch → "Always allow" control is the supported path.
 */

/**
 * Allow-list rules covering every tool from the `jcodemunch` MCP server.
 * `mcp__jcodemunch__*` is the currently-documented wildcard form; bare
 * `mcp__jcodemunch` is the older server-wide form. We write both so the rule
 * lands regardless of Claude Code version — an unmatched rule is simply ignored.
 */
export const JCM_ALLOW_RULES = ["mcp__jcodemunch__*", "mcp__jcodemunch"];

export interface AllowResult {
  ok: boolean;
  path: string;
  backup?: string;
  /** True when the rule was already present (no change written). */
  alreadySet?: boolean;
  error?: string;
}

/** Add the jcodemunch always-allow rules to Claude Code's global settings. */
export async function setClaudeCodeAlwaysAllow(rules = JCM_ALLOW_RULES): Promise<AllowResult> {
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
        path: file,
        error: "~/.claude/settings.json isn't valid JSON — fix it manually so we don't overwrite it.",
      };
    }
  }
  if (typeof root !== "object" || root === null || Array.isArray(root)) root = {};

  const permsRaw = root.permissions;
  const perms =
    typeof permsRaw === "object" && permsRaw !== null && !Array.isArray(permsRaw)
      ? (permsRaw as Record<string, unknown>)
      : {};
  const allow = Array.isArray(perms.allow) ? (perms.allow as unknown[]) : [];

  const missing = rules.filter((r) => !allow.includes(r));
  if (!missing.length) return { ok: true, path: file, alreadySet: true };

  allow.push(...missing);
  perms.allow = allow;
  root.permissions = perms;

  let backup: string | undefined;
  if (existed) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backup = `${file}.bak-${stamp}`;
    try {
      await fs.copyFile(file, backup);
    } catch {
      backup = undefined; // couldn't back up; still proceed
    }
  }

  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(root, null, 2) + "\n", "utf8");
  } catch (err) {
    return { ok: false, path: file, error: err instanceof Error ? err.message : String(err) };
  }
  return { ok: true, path: file, backup };
}
