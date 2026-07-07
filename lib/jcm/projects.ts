import path from "node:path";
import {
  listProjects,
  getProject,
  projectId,
  listIgnored,
  adoptProjects,
  type Project,
} from "./registry";
import { getRepos, matchRepo, type RepoInfo } from "./status";

export interface EnrichedProject {
  id: string;
  path: string;
  label: string;
  /** Non-null when jcodemunch has this path indexed; null means tracked but not indexed. */
  repo: RepoInfo | null;
}

const norm = (s: string) =>
  path.normalize(s.trim()).replace(/[\\/]+$/, "").toLowerCase();

/**
 * The Projects view. Auto-adopts every indexed repo the user hasn't removed
 * into the registry, so the panel tracks the same repos the dashboard lists and
 * each becomes a first-class entry the user can remove. A removed repo is on the
 * ignore list and is skipped here, so removal sticks. Each returned project
 * carries its index state (repo present => indexed, null => not indexed).
 */
export async function syncAndListProjects(): Promise<EnrichedProject[]> {
  const [registered, reposRes, ignored] = await Promise.all([
    listProjects(),
    getRepos(),
    listIgnored(),
  ]);
  const repos = reposRes.repos;

  const known = new Set(registered.map((p) => norm(p.path)));
  const ignoredSet = new Set(ignored);
  const toAdopt = repos
    .map((r) => r.source_root)
    .filter((root) => !known.has(norm(root)) && !ignoredSet.has(norm(root)));

  if (toAdopt.length) await adoptProjects(toAdopt);

  const finalProjects = toAdopt.length ? await listProjects() : registered;
  return finalProjects.map((p) => ({
    id: p.id,
    path: p.path,
    label: p.label,
    repo: matchRepo(repos, p.path),
  }));
}

/**
 * Resolve an id to a project, whether it is already tracked or only exists as an
 * indexed repo. Keeps the index/scaffold actions working even in the window
 * before a repo has been adopted into the registry.
 */
export async function resolveProject(id: string): Promise<Project | null> {
  const registered = await getProject(id);
  if (registered) return registered;

  const reposRes = await getRepos();
  const repo = reposRes.repos.find((r) => projectId(r.source_root) === id);
  if (!repo) return null;
  return {
    id,
    path: repo.source_root,
    label: repo.display_name || repo.source_root,
    addedAt: repo.indexed_at ?? "",
  };
}
