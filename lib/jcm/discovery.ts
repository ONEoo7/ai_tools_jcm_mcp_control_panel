import { promises as fs } from "node:fs";
import { run, resolveBinary } from "./cli";
import { globalConfigFile, codeIndexDir } from "./paths";

export interface DoctorFile {
  label: string;
  path: string;
  exists: boolean;
}

export interface Doctor {
  binaryPath: string | null;
  version: string | null;
  installed: boolean;
  /** "ok" = works; "broken" = binary present but fails to run; "missing" = not found. */
  status: "ok" | "broken" | "missing";
  /** Short reason when status is "broken" (e.g. the failing error line). */
  detail?: string;
  files: DoctorFile[];
  errors: string[];
}

/** Pull the most informative single line out of a CLI failure. */
function summarizeError(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const named = lines.find((l) => /Error|Exception|not found|denied|failed/i.test(l));
  return (named ?? lines[lines.length - 1] ?? "unknown error").slice(0, 200);
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
  let detail: string | undefined;
  let status: Doctor["status"] = "missing";
  if (binaryPath) {
    const res = await run(["--version"], { timeout: 15_000 });
    version = parseVersion(res.stdout || res.stderr);
    if (version) {
      status = "ok";
    } else {
      // Binary is on disk but won't run — a broken/half-upgraded install.
      status = "broken";
      detail = summarizeError(res.stderr || res.stdout || "jcodemunch-mcp --version failed");
      errors.push(`jcodemunch-mcp is installed but not working: ${detail}`);
    }
  } else {
    errors.push(
      "jcodemunch-mcp not found on PATH. Install it, or set JCM_BIN to its full path.",
    );
  }

  const files: DoctorFile[] = await Promise.all(
    [
      { label: "Global config", path: globalConfigFile },
      { label: "Config dir", path: codeIndexDir },
    ].map(async (f) => ({ ...f, exists: await exists(f.path) })),
  );

  return {
    binaryPath,
    version,
    installed: status === "ok",
    status,
    detail,
    files,
    errors,
  };
}
