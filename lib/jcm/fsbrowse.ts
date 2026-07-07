import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface DirEntry {
  name: string;
  path: string;
}

export interface BrowseResult {
  /** Absolute path currently listed, or null when showing the Windows drive list. */
  path: string | null;
  /** Real parent directory to go up to, or null at a filesystem/drive root. */
  parent: string | null;
  /** True when the listing is the set of Windows drives rather than a directory. */
  atDriveList: boolean;
  /** True on Windows — the client offers a "Drives" shortcut and up-from-root goes there. */
  winDrives: boolean;
  /** User home directory, for a "Home" shortcut. */
  home: string;
  /** Immediate sub-directories (or drives when atDriveList), name-sorted. */
  entries: DirEntry[];
}

/** Probe A:–Z: and return the drives that respond. Windows only. */
async function listDrives(): Promise<DirEntry[]> {
  const drives: DirEntry[] = [];
  for (let c = 65; c <= 90; c++) {
    const root = `${String.fromCharCode(c)}:\\`;
    try {
      await fs.access(root);
      drives.push({ name: root, path: root });
    } catch {
      /* drive letter not mounted */
    }
  }
  return drives;
}

/**
 * List the sub-directories of a path for the folder picker. With no path it
 * shows the drive list on Windows, or the filesystem root elsewhere. Read-only:
 * returns directory names only, never file contents. Throws on a missing or
 * unreadable path so the caller can surface the error.
 */
export async function browseDir(input?: string | null): Promise<BrowseResult> {
  const home = os.homedir();
  const win = process.platform === "win32";

  if (!input || !input.trim()) {
    if (win) {
      return {
        path: null,
        parent: null,
        atDriveList: true,
        winDrives: true,
        home,
        entries: await listDrives(),
      };
    }
    input = "/";
  }

  const abs = path.resolve(input.trim());
  const dirents = await fs.readdir(abs, { withFileTypes: true });

  const entries: DirEntry[] = [];
  for (const d of dirents) {
    let isDir = d.isDirectory();
    if (!isDir && d.isSymbolicLink()) {
      try {
        isDir = (await fs.stat(path.join(abs, d.name))).isDirectory();
      } catch {
        isDir = false; // broken or inaccessible symlink
      }
    }
    if (isDir) entries.push({ name: d.name, path: path.join(abs, d.name) });
  }
  entries.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  const parentPath = path.dirname(abs);
  const parent = parentPath === abs ? null : parentPath;

  return { path: abs, parent, atDriveList: false, winDrives: win, home, entries };
}
