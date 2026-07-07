import os from "node:os";
import path from "node:path";

/**
 * OS-aware locations for jcodemunch-mcp and Claude Code.
 * Confirmed on this machine (win32):
 *   - global config dir: ~/.code-index/
 *   - global config file: ~/.code-index/config.jsonc
 *   - per-repo index db : ~/.code-index/local-<repo>.db
 *   - live session      : ~/.code-index/_session_live.json
 *   - Claude settings   : ~/.claude/settings.json
 *   - Claude global CLAUDE.md: ~/.claude/CLAUDE.md
 */

export const home = os.homedir();

/** Where uv (and uv tool shims) install binaries by default: ~/.local/bin. */
export const localBinDir = path.join(home, ".local", "bin");

export function exeName(base: string): string {
  return process.platform === "win32" ? `${base}.exe` : base;
}

/** Expected uv path after the standalone installer runs (~/.local/bin/uv[.exe]). */
export function expectedUvPath(): string {
  return path.join(localBinDir, exeName("uv"));
}

/** Expected jcodemunch-mcp path after `uv tool install` (~/.local/bin/…). */
export function expectedJcmPath(): string {
  return path.join(localBinDir, exeName("jcodemunch-mcp"));
}

export const codeIndexDir = path.join(home, ".code-index");
export const globalConfigFile = path.join(codeIndexDir, "config.jsonc");
export const sessionLiveFile = path.join(codeIndexDir, "_session_live.json");

export const claudeDir = path.join(home, ".claude");
export const claudeSettingsFile = path.join(claudeDir, "settings.json");
export const claudeGlobalMd = path.join(claudeDir, "CLAUDE.md");
export const claudeProjectsDir = path.join(claudeDir, "projects");

/** The panel's own private data directory (project registry, cached reports). */
export function panelDataDir(): string {
  return path.join(process.cwd(), "data");
}
export function registryFile(): string {
  return path.join(panelDataDir(), "registry.json");
}
/** Paths the user removed from tracking — kept so auto-detected repos stay removed. */
export function ignoredFile(): string {
  return path.join(panelDataDir(), "ignored.json");
}

/** Candidate filenames for a *project-level* jcodemunch config, most-preferred first. */
export const projectConfigCandidates = [
  ".jcodemunch.jsonc",
  ".jcodemunch.json",
  ".code-index/config.jsonc",
];

export function projectConfigCandidatePaths(projectPath: string): string[] {
  return projectConfigCandidates.map((c) => path.join(projectPath, c));
}

/** Preferred path to write a new project config to. */
export function defaultProjectConfigPath(projectPath: string): string {
  return path.join(projectPath, projectConfigCandidates[0]);
}
