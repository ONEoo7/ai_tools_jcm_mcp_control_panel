import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse as parseJsonc, modify, applyEdits } from "jsonc-parser";
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

/** Antigravity's config path (Codeium/Gemini). */
function antigravityConfigFile(): string {
  return path.join(os.homedir(), ".gemini", "config", "config.json");
}

/**
 * Auto-approve every jcodemunch tool in Antigravity. Antigravity records per-tool
 * approvals in ~/.gemini/config/config.json under
 * `userSettings.globalPermissionGrants.allow` as `mcp(<server>/<tool>)` strings;
 * the wildcard `mcp(jcodemunch/*)` (a form the app itself uses, e.g.
 * `mcp(chrome_devtools/*)`) grants all tools of the server at once.
 *
 * Antigravity persists this file itself, so apply it while Antigravity is closed
 * (or restart right after) — otherwise it may rewrite the file from memory on
 * exit and drop the entry.
 */
export async function setAntigravityAllowAll(): Promise<AllowResult> {
  const file = antigravityConfigFile();
  const GRANT = "mcp(jcodemunch/*)";

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
        error: "~/.gemini/config/config.json isn't valid JSON — fix it manually so we don't overwrite it.",
      };
    }
  }
  if (typeof root !== "object" || root === null || Array.isArray(root)) root = {};

  const asObj = (v: unknown): Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

  const userSettings = asObj(root.userSettings);
  const grants = asObj(userSettings.globalPermissionGrants);
  const allow = Array.isArray(grants.allow) ? (grants.allow as unknown[]) : [];

  if (allow.includes(GRANT)) return { ok: true, path: file, alreadySet: true };

  allow.push(GRANT);
  grants.allow = allow;
  userSettings.globalPermissionGrants = grants;
  root.userSettings = userSettings;

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
    return { ok: false, path: file, error: err instanceof Error ? err.message : String(err) };
  }
  return { ok: true, path: file, backup };
}

/** VS Code (stable, then Insiders) user settings.json. */
function vscodeSettingsCandidates(): string[] {
  const appdata = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
  return [
    path.join(appdata, "Code", "User", "settings.json"),
    path.join(appdata, "Code - Insiders", "User", "settings.json"),
  ];
}

/**
 * Enable VS Code Copilot's auto-approve for tool calls by setting
 * `chat.tools.autoApprove: true` in the user settings.json. IMPORTANT: this is a
 * GLOBAL, all-tools switch (every MCP server + built-in tools), not jcodemunch-
 * scoped — VS Code has no per-server config grant; per-tool "always allow" lives
 * in its internal state db. Edited comment-preserving via jsonc-parser (VS Code
 * settings are JSONC), with a backup. Takes effect on VS Code reload.
 */
export async function setCopilotAutoApprove(): Promise<AllowResult> {
  const candidates = vscodeSettingsCandidates();
  let file = candidates[0];
  for (const c of candidates) {
    try {
      await fs.access(c);
      file = c;
      break;
    } catch {
      /* not this one */
    }
  }

  let text = "";
  let existed = true;
  try {
    text = await fs.readFile(file, "utf8");
  } catch {
    existed = false;
  }

  if (text.trim()) {
    const parsed = parseJsonc(text) as Record<string, unknown> | undefined;
    if (parsed && parsed["chat.tools.autoApprove"] === true) {
      return { ok: true, path: file, alreadySet: true };
    }
  }

  // Flat dotted key — the path is a single literal segment, not nested objects.
  const edits = modify(text || "{}", ["chat.tools.autoApprove"], true, {
    formattingOptions: { insertSpaces: true, tabSize: 2 },
  });
  const next = applyEdits(text || "{}", edits);

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
    await fs.writeFile(file, next, "utf8");
  } catch (err) {
    return { ok: false, path: file, error: err instanceof Error ? err.message : String(err) };
  }
  return { ok: true, path: file, backup };
}
