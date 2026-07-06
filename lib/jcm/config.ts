import { promises as fs } from "node:fs";
import {
  parse as parseJsoncRaw,
  modify,
  applyEdits,
  type ParseError,
} from "jsonc-parser";
import { run } from "./cli";
import {
  globalConfigFile,
  projectConfigCandidatePaths,
  defaultProjectConfigPath,
} from "./paths";

export type Scope = "global" | "project";

export interface RawConfig {
  scope: Scope;
  path: string;
  exists: boolean;
  content: string;
  /** Parsed value (comments/whitespace stripped); null if unparseable. */
  parsed: unknown;
  parseError?: string;
}

/** Locate the config file path for a scope. */
export async function resolveConfigPath(
  scope: Scope,
  projectPath?: string,
): Promise<string> {
  if (scope === "global") return globalConfigFile;
  if (!projectPath) throw new Error("projectPath is required for project scope");
  for (const candidate of projectConfigCandidatePaths(projectPath)) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      /* keep looking */
    }
  }
  return defaultProjectConfigPath(projectPath);
}

export function parseJsonc(content: string): { value: unknown; error?: string } {
  const errors: ParseError[] = [];
  try {
    const value = parseJsoncRaw(content, errors, {
      allowTrailingComma: true,
      disallowComments: false,
    });
    if (errors.length) {
      return { value, error: `${errors.length} parse issue(s) in JSONC.` };
    }
    return { value };
  } catch (err) {
    return { value: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function readRawConfig(
  scope: Scope,
  projectPath?: string,
): Promise<RawConfig> {
  const filePath = await resolveConfigPath(scope, projectPath);
  let content = "";
  let exists = true;
  try {
    content = await fs.readFile(filePath, "utf8");
  } catch {
    exists = false;
  }
  const { value, error } = exists
    ? parseJsonc(content)
    : { value: {}, error: undefined };
  return { scope, path: filePath, exists, content, parsed: value, parseError: error };
}

async function backup(filePath: string): Promise<string | null> {
  try {
    await fs.access(filePath);
  } catch {
    return null; // nothing to back up
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const bak = `${filePath}.${stamp}.bak`;
  await fs.copyFile(filePath, bak);
  return bak;
}

export interface WriteResult {
  ok: boolean;
  path: string;
  backup: string | null;
  error?: string;
}

/** Replace the whole config file, after validating it parses as JSONC. */
export async function writeRawConfig(
  scope: Scope,
  content: string,
  projectPath?: string,
): Promise<WriteResult> {
  const filePath = await resolveConfigPath(scope, projectPath);
  const { error } = parseJsonc(content);
  if (error) {
    return { ok: false, path: filePath, backup: null, error };
  }
  const bak = await backup(filePath);
  try {
    await fs.mkdir(filePath.replace(/[\\/][^\\/]*$/, ""), { recursive: true });
    await fs.writeFile(filePath, content, "utf8");
    return { ok: true, path: filePath, backup: bak };
  } catch (err) {
    return {
      ok: false,
      path: filePath,
      backup: bak,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Comment-preserving single-key edit using jsonc-parser. */
export async function setConfigKey(
  scope: Scope,
  keyPath: (string | number)[],
  value: unknown,
  projectPath?: string,
): Promise<WriteResult> {
  const raw = await readRawConfig(scope, projectPath);
  const edits = modify(raw.content || "{}", keyPath, value, {
    formattingOptions: { insertSpaces: true, tabSize: 2 },
  });
  const next = applyEdits(raw.content || "{}", edits);
  return writeRawConfig(scope, next, projectPath);
}

/** The effective, resolved configuration as printed by `jcodemunch-mcp config`. */
export async function getEffectiveConfig(
  cwd?: string,
): Promise<{ text: string; error?: string }> {
  const res = await run(["config"], { cwd, timeout: 30_000 });
  if (!res.ok && res.notFound) return { text: "", error: res.stderr };
  return { text: res.stdout || res.stderr };
}
