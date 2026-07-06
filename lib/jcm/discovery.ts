import { promises as fs } from "node:fs";
import { run, resolveBinary } from "./cli";
import {
  globalConfigFile,
  claudeSettingsFile,
  claudeGlobalMd,
  codeIndexDir,
} from "./paths";

export interface DoctorFile {
  label: string;
  path: string;
  exists: boolean;
}

export interface Doctor {
  binaryPath: string | null;
  version: string | null;
  installed: boolean;
  files: DoctorFile[];
  errors: string[];
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Parse "jcodemunch-mcp 1.108.102" -> "1.108.102". */
function parseVersion(stdout: string): string | null {
  const m = stdout.match(/(\d+\.\d+\.\d+[^\s]*)/);
  return m ? m[1] : null;
}

/**
 * Environment probe. Never throws — the UI shows whatever it can and flags
 * what's missing so the panel degrades gracefully on a fresh machine.
 */
export async function doctor(): Promise<Doctor> {
  const errors: string[] = [];
  const binaryPath = resolveBinary();

  let version: string | null = null;
  if (binaryPath) {
    const res = await run(["--version"], { timeout: 15_000 });
    if (res.ok || res.stdout) version = parseVersion(res.stdout || res.stderr);
    if (res.notFound) errors.push("Could not launch jcodemunch-mcp.");
  } else {
    errors.push(
      "jcodemunch-mcp not found on PATH. Install it, or set JCM_BIN to its full path.",
    );
  }

  const files: DoctorFile[] = await Promise.all(
    [
      { label: "Global config", path: globalConfigFile },
      { label: "Config dir", path: codeIndexDir },
      { label: "Claude settings", path: claudeSettingsFile },
      { label: "Global CLAUDE.md", path: claudeGlobalMd },
    ].map(async (f) => ({ ...f, exists: await exists(f.path) })),
  );

  return {
    binaryPath,
    version,
    installed: Boolean(binaryPath && version),
    files,
    errors,
  };
}
