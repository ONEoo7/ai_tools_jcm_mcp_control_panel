import type { InstallStatus } from "./status";
import type { DetectedClient, RegisterDescriptor } from "./clients";

export type FileKind = "config" | "policy" | "hooks" | "skill" | "rules";

export interface ClientFileRow {
  label: string;
  /** Absolute path, or null when the client is CLI-managed (no file we own). */
  path: string | null;
  present: boolean;
  kind: FileKind;
  /** Hook event names, shown as badges on the hooks row. */
  events?: string[];
}

export interface ClientGroup {
  name: string;
  method: string;
  configured: boolean;
  register?: RegisterDescriptor;
  files: ClientFileRow[];
  /** true for the trailing AGENTS.md pseudo-group (no register / configured badge). */
  shared?: boolean;
}

/**
 * Associate the **global / machine-level** integration files jcodemunch touches
 * with the client they belong to (MCP config, user CLAUDE.md, reindex hooks,
 * global skill). Project-scoped files (project CLAUDE.md, AGENTS.md, cursor /
 * windsurf rules, copilot hooks, project skill, .jcodemunch.jsonc) are shown
 * per-project in the Projects section instead — see lib/jcm/projectFiles.ts.
 * All data comes from `install-status --json` + extra-client detection.
 */
export function buildClientFileGroups(
  status: InstallStatus,
  clients: DetectedClient[],
): ClientGroup[] {
  return clients.map((c) => ({
    name: c.name,
    method: c.method,
    configured: c.configured,
    register: c.register,
    files: filesForClient(c, status),
  }));
}

function filesForClient(c: DetectedClient, status: InstallStatus): ClientFileRow[] {
  const key = c.name.toLowerCase();
  const files: ClientFileRow[] = [];

  const mcpRegistration = (label = "MCP registration"): ClientFileRow => ({
    label,
    path: c.config_path,
    present: c.configured,
    kind: "config",
  });
  const pushPolicy = (policyKey: string, label: string, kind: FileKind = "policy") => {
    const e = status.policies[policyKey];
    if (e) files.push({ label, path: e.path, present: e.present, kind });
  };
  const pushSkill = (skillKey: string, label: string) => {
    const e = status.skills[skillKey];
    if (e) files.push({ label, path: e.path, present: e.present, kind: "skill" });
  };

  if (key === "claude code") {
    files.push(mcpRegistration());
    const cs = status.hooks.claude_settings;
    files.push({
      label: "Reindex hooks",
      path: cs.path || null,
      present: cs.events_with_jcm_rules.length > 0,
      kind: "hooks",
      events: cs.events_with_jcm_rules,
    });
    pushPolicy("claude_md_global", "CLAUDE.md (global)");
    pushSkill("global", "Agent skill (global)");
  } else if (key === "claude desktop") {
    files.push({ label: "MCP config", path: c.config_path, present: c.configured, kind: "config" });
  } else if (key.includes("copilot")) {
    files.push({ label: "MCP config (mcp.json)", path: c.config_path, present: c.configured, kind: "config" });
  } else if (key === "cursor" || key === "windsurf") {
    files.push(mcpRegistration());
  } else if (key.includes("antigravity")) {
    files.push({ label: "MCP config (mcp.json)", path: c.config_path, present: c.configured, kind: "config" });
  } else {
    files.push(mcpRegistration());
  }

  return files;
}
