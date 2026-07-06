import { run } from "./cli";

export interface RepoInfo {
  repo_id: string;
  display_name: string;
  source_root: string;
  file_count: number;
  symbol_count: number;
  languages: Record<string, number>;
  indexed_at: string | null;
  freshness: string;
  watcher_state: string;
  lock_holder: string | null;
}

export async function getRepos(): Promise<{ repos: RepoInfo[]; error?: string }> {
  const res = await run(["list-repos", "--json"], { timeout: 30_000 });
  if (!res.ok && res.notFound) return { repos: [], error: res.stderr };
  try {
    const parsed = JSON.parse(res.stdout);
    return { repos: Array.isArray(parsed) ? parsed : [] };
  } catch {
    return { repos: [], error: res.stderr || "Could not parse list-repos output." };
  }
}

/** Find the indexed repo whose source_root matches a project path (case-insensitive). */
export function matchRepo(repos: RepoInfo[], projectPath: string): RepoInfo | null {
  const norm = (s: string) => s.replace(/[\\/]+$/, "").toLowerCase();
  const target = norm(projectPath);
  return repos.find((r) => norm(r.source_root) === target) ?? null;
}

export interface ClientStatus {
  name: string;
  method: string;
  config_path: string | null;
  configured: boolean;
}

export interface PolicyEntry {
  path: string;
  present: boolean;
}

export interface InstallStatus {
  clients: ClientStatus[];
  policies: Record<string, PolicyEntry>;
  hooks: {
    claude_settings: { path: string; events_with_jcm_rules: string[] };
    copilot: { path: string; present: boolean };
  };
  skills: Record<string, PolicyEntry>;
  ok: boolean;
  error?: string;
}

const EMPTY_STATUS: InstallStatus = {
  clients: [],
  policies: {},
  hooks: {
    claude_settings: { path: "", events_with_jcm_rules: [] },
    copilot: { path: "", present: false },
  },
  skills: {},
  ok: false,
};

/**
 * Read install state. Project-relative entries (project CLAUDE.md, cursor rules,
 * copilot hooks) resolve against `cwd`, so pass a project path when inspecting one.
 */
export async function getInstallStatus(cwd?: string): Promise<InstallStatus> {
  const res = await run(["install-status", "--json"], { cwd, timeout: 30_000 });
  if (!res.ok && res.notFound) return { ...EMPTY_STATUS, error: res.stderr };
  try {
    const json = JSON.parse(res.stdout);
    return { ...EMPTY_STATUS, ...json, ok: true };
  } catch {
    return {
      ...EMPTY_STATUS,
      error: res.stderr || "Could not parse install-status output.",
    };
  }
}
