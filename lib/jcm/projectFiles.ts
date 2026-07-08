import { promises as fs } from "node:fs";
import { getInstallStatus, type PolicyEntry } from "./status";
import { resolveConfigPath } from "./config";

export type ProjectFileKind = "config" | "policy" | "hooks" | "skill" | "rules";

export interface ProjectFileRow {
  /** Sub-section this file belongs to: "jcodemunch", "Claude", "GitHub Copilot", … */
  group: string;
  label: string;
  path: string;
  present: boolean;
  kind: ProjectFileKind;
}

async function exists(p: string): Promise<boolean> {
  return fs
    .access(p)
    .then(() => true)
    .catch(() => false);
}

/**
 * Project-scoped integration files for a single project. `install-status`
 * resolves project-relative entries against its cwd, so we run it with
 * cwd = the project path. Also reports the project's jcodemunch config file.
 */
export async function getProjectFiles(projectPath: string): Promise<ProjectFileRow[]> {
  const rows: ProjectFileRow[] = [];

  // jcodemunch project config (.jcodemunch.jsonc / first existing candidate).
  const cfg = await resolveConfigPath("project", projectPath);
  rows.push({
    group: "jcodemunch",
    label: ".jcodemunch.jsonc",
    path: cfg,
    present: await exists(cfg),
    kind: "config",
  });

  const status = await getInstallStatus(projectPath);
  if (status.ok) {
    const p = status.policies;
    const push = (
      entry: PolicyEntry | undefined,
      group: string,
      label: string,
      kind: ProjectFileKind,
    ) => {
      if (entry) rows.push({ group, label, path: entry.path, present: entry.present, kind });
    };
    // Claude (Code): project policy + agent skill.
    push(p["claude_md_project"], "Claude", "CLAUDE.md", "policy");
    push(status.skills?.["project"], "Claude", "Agent skill", "skill");
    // GitHub Copilot: project reindex hooks.
    if (status.hooks?.copilot?.path) {
      rows.push({
        group: "GitHub Copilot",
        label: "Reindex hooks (hooks.json)",
        path: status.hooks.copilot.path,
        present: status.hooks.copilot.present,
        kind: "hooks",
      });
    }
    // Editors with rules files.
    push(p["cursor_rules"], "Cursor", "Rules (jcodemunch.mdc)", "rules");
    push(p["windsurf_rules"], "Windsurf", "Rules (.windsurfrules)", "rules");
    // Shared policy read by multiple agents.
    push(p["agents_md"], "Shared", "AGENTS.md", "policy");
  }

  return rows;
}
