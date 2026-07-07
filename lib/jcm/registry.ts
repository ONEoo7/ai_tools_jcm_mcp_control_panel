import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { panelDataDir, registryFile, ignoredFile } from "./paths";

const DATA_DIR = () => panelDataDir();
const STORE = () => registryFile();
const IGNORE_STORE = () => ignoredFile();

/** Canonical key for comparing paths across the registry and ignore list. */
const normPath = (s: string) =>
  path.normalize(s.trim()).replace(/[\\/]+$/, "").toLowerCase();

export interface Project {
  id: string;
  path: string;
  label: string;
  addedAt: string;
}

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIR(), { recursive: true });
  try {
    await fs.access(STORE());
  } catch {
    await fs.writeFile(STORE(), "[]\n", "utf8");
  }
}

export async function listProjects(): Promise<Project[]> {
  await ensureStore();
  try {
    const raw = await fs.readFile(STORE(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Project[]) : [];
  } catch {
    return [];
  }
}

function idFor(p: string): string {
  return crypto.createHash("sha1").update(p.toLowerCase()).digest("hex").slice(0, 12);
}

/**
 * Stable id for a project path, independent of how it was discovered. A path
 * added manually and the same path auto-detected from the index hash to the
 * same id, so the two views de-duplicate and their actions target one entry.
 */
export function projectId(rawPath: string): string {
  return idFor(path.normalize(rawPath.trim()));
}

export async function addProject(rawPath: string): Promise<Project> {
  const normalized = path.normalize(rawPath.trim());
  // A deliberate (re-)add overrides a prior removal, so stop ignoring this path.
  await unignorePath(normalized);
  const projects = await listProjects();
  const id = projectId(normalized);
  const existing = projects.find((p) => p.id === id);
  if (existing) return existing;
  const project: Project = {
    id,
    path: normalized,
    label: path.basename(normalized) || normalized,
    addedAt: new Date().toISOString(),
  };
  projects.push(project);
  await fs.writeFile(STORE(), JSON.stringify(projects, null, 2) + "\n", "utf8");
  return project;
}

/**
 * Add several paths at once, skipping any already tracked. Used to auto-adopt
 * indexed repos into the registry; writes the store at most once.
 */
export async function adoptProjects(rawPaths: string[]): Promise<void> {
  if (rawPaths.length === 0) return;
  const projects = await listProjects();
  const have = new Set(projects.map((p) => p.id));
  let changed = false;
  for (const raw of rawPaths) {
    const normalized = path.normalize(raw.trim());
    const id = projectId(normalized);
    if (have.has(id)) continue;
    projects.push({
      id,
      path: normalized,
      label: path.basename(normalized) || normalized,
      addedAt: new Date().toISOString(),
    });
    have.add(id);
    changed = true;
  }
  if (changed) {
    await fs.writeFile(STORE(), JSON.stringify(projects, null, 2) + "\n", "utf8");
  }
}

export async function removeProject(id: string): Promise<void> {
  const projects = await listProjects();
  const target = projects.find((p) => p.id === id);
  const next = projects.filter((p) => p.id !== id);
  await fs.writeFile(STORE(), JSON.stringify(next, null, 2) + "\n", "utf8");
  // Remember the removal so an indexed repo isn't silently re-adopted next load.
  if (target) await ignorePath(target.path);
}

async function ensureIgnoreStore(): Promise<void> {
  await fs.mkdir(DATA_DIR(), { recursive: true });
  try {
    await fs.access(IGNORE_STORE());
  } catch {
    await fs.writeFile(IGNORE_STORE(), "[]\n", "utf8");
  }
}

/** Normalized paths the user removed and does not want auto-adopted. */
export async function listIgnored(): Promise<string[]> {
  await ensureIgnoreStore();
  try {
    const parsed = JSON.parse(await fs.readFile(IGNORE_STORE(), "utf8"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function ignorePath(p: string): Promise<void> {
  const key = normPath(p);
  const cur = await listIgnored();
  if (!cur.includes(key)) {
    await fs.writeFile(IGNORE_STORE(), JSON.stringify([...cur, key], null, 2) + "\n", "utf8");
  }
}

async function unignorePath(p: string): Promise<void> {
  const key = normPath(p);
  const cur = await listIgnored();
  if (cur.includes(key)) {
    await fs.writeFile(
      IGNORE_STORE(),
      JSON.stringify(cur.filter((x) => x !== key), null, 2) + "\n",
      "utf8",
    );
  }
}

export async function getProject(id: string): Promise<Project | null> {
  const projects = await listProjects();
  return projects.find((p) => p.id === id) ?? null;
}

/** Validate that a path exists and is a directory. Returns an error string or null. */
export async function validateProjectPath(rawPath: string): Promise<string | null> {
  const p = rawPath.trim();
  if (!p) return "Path is required.";
  if (!path.isAbsolute(p)) return "Please enter an absolute path.";
  try {
    const stat = await fs.stat(p);
    if (!stat.isDirectory()) return "Path is not a directory.";
  } catch {
    return "Path does not exist or is not accessible.";
  }
  return null;
}
