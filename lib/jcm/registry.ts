import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { panelDataDir, registryFile } from "./paths";

const DATA_DIR = () => panelDataDir();
const STORE = () => registryFile();

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

export async function addProject(rawPath: string): Promise<Project> {
  const normalized = path.normalize(rawPath.trim());
  const projects = await listProjects();
  const id = idFor(normalized);
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

export async function removeProject(id: string): Promise<void> {
  const projects = await listProjects();
  const next = projects.filter((p) => p.id !== id);
  await fs.writeFile(STORE(), JSON.stringify(next, null, 2) + "\n", "utf8");
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
