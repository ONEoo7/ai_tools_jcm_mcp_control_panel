import { promises as fs } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import { codeIndexDir } from "./paths";

/**
 * The index schema version is the number bumped whenever jcodemunch changes what
 * it stores at index time. A repo whose stored version is below the CLI's current
 * version needs re-indexing to get the new data. We read:
 *  - current: the INDEX_VERSION constant in the installed package.
 *  - per-repo: the `index_version` row in each repo's ~/.code-index/<repo>.db.
 */

async function exists(p: string): Promise<boolean> {
  return fs.access(p).then(() => true).catch(() => false);
}

/** Candidate venv roots (…/jcodemunch-mcp) for uv-tool and pipx installs. */
function venvRoots(): string[] {
  const home = os.homedir();
  const roots: string[] = [];
  if (process.platform === "win32") {
    const appdata = process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
    const localapp = process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");
    roots.push(path.join(appdata, "uv", "tools", "jcodemunch-mcp"));
    roots.push(path.join(localapp, "uv", "tools", "jcodemunch-mcp"));
    roots.push(path.join(home, "pipx", "venvs", "jcodemunch-mcp"));
    roots.push(path.join(localapp, "pipx", "venvs", "jcodemunch-mcp"));
  } else {
    const dataHome = process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share");
    roots.push(path.join(dataHome, "uv", "tools", "jcodemunch-mcp"));
    roots.push(path.join(home, ".local", "pipx", "venvs", "jcodemunch-mcp"));
    roots.push(path.join(home, "pipx", "venvs", "jcodemunch-mcp"));
  }
  return roots;
}

const STORE_TAIL = ["jcodemunch_mcp", "storage", "index_store.py"];

async function findIndexStore(): Promise<string | null> {
  for (const root of venvRoots()) {
    // Windows layout: <root>/Lib/site-packages/…
    const win = path.join(root, "Lib", "site-packages", ...STORE_TAIL);
    if (await exists(win)) return win;
    // Unix layout: <root>/lib/python*/site-packages/…
    try {
      const libDir = path.join(root, "lib");
      for (const py of await fs.readdir(libDir)) {
        const p = path.join(libDir, py, "site-packages", ...STORE_TAIL);
        if (await exists(p)) return p;
      }
    } catch {
      /* no lib dir here */
    }
  }
  return null;
}

/** The INDEX_VERSION the installed jcodemunch produces now. null if not found. */
export async function getCurrentIndexVersion(): Promise<number | null> {
  const file = await findIndexStore();
  if (!file) return null;
  try {
    const text = await fs.readFile(file, "utf8");
    const m = text.match(/INDEX_VERSION\s*=\s*(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  } catch {
    return null;
  }
}

/** Map a repo_id to its on-disk index db (e.g. "ONEoo7/foo" → "ONEoo7-foo.db"). */
export function repoDbPath(repoId: string): string {
  return path.join(codeIndexDir, repoId.replaceAll("/", "-") + ".db");
}

/** The index_version a repo was last built with, or null if unreadable. */
export function readRepoIndexVersion(repoId: string): number | null {
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(repoDbPath(repoId), { readOnly: true });
    const row = db.prepare("select value from meta where key = ?").get("index_version") as
      | { value?: string }
      | undefined;
    const v = row?.value ? parseInt(row.value, 10) : NaN;
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}
