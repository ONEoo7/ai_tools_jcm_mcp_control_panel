import { spawn, spawnSync } from "node:child_process";

/** Name of the CLI binary; overridable via env for non-standard installs. */
export const BIN_NAME = process.env.JCM_BIN || "jcodemunch-mcp";

const DEFAULT_TIMEOUT = 120_000;

let cachedBin: string | null | undefined;
const execCache = new Map<string, string | null>();

function whereIs(name: string): string | null {
  const finder = process.platform === "win32" ? "where" : "which";
  try {
    const res = spawnSync(finder, [name], { encoding: "utf8" });
    const first = (res.stdout || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)[0];
    return first || null;
  } catch {
    return null;
  }
}

/** Resolve the absolute path to the jcodemunch-mcp executable (cached). */
export function resolveBinary(): string | null {
  if (cachedBin !== undefined) return cachedBin;
  if (process.env.JCM_BIN && /[\\/]/.test(process.env.JCM_BIN)) {
    cachedBin = process.env.JCM_BIN;
    return cachedBin;
  }
  cachedBin = whereIs(BIN_NAME);
  return cachedBin;
}

/** Resolve an arbitrary executable name (uv, pipx, pip, …) to a path (cached). */
export function resolveExec(name: string): string | null {
  if (/[\\/]/.test(name)) return name;
  if (execCache.has(name)) return execCache.get(name) ?? null;
  const resolved = whereIs(name);
  execCache.set(name, resolved);
  return resolved;
}

export interface RunResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  /** True when the binary itself could not be found/launched. */
  notFound?: boolean;
}

function bufferSpawn(
  bin: string,
  args: string[],
  opts: { cwd?: string; timeout?: number } = {},
): Promise<RunResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(bin, args, {
      cwd: opts.cwd,
      windowsHide: true,
      env: process.env,
    });
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        resolve({
          ok: false,
          code: null,
          stdout,
          stderr: stderr + `\n[timed out after ${opts.timeout ?? DEFAULT_TIMEOUT}ms]`,
        });
      }
    }, opts.timeout ?? DEFAULT_TIMEOUT);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, code: null, stdout, stderr: String(err), notFound: true });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

/** Run a jcodemunch-mcp subcommand and buffer the full output. */
export function run(
  args: string[],
  opts: { cwd?: string; timeout?: number } = {},
): Promise<RunResult> {
  const bin = resolveBinary();
  if (!bin) {
    return Promise.resolve({
      ok: false,
      code: null,
      stdout: "",
      stderr: `jcodemunch-mcp executable not found on PATH (set JCM_BIN to override).`,
      notFound: true,
    });
  }
  return bufferSpawn(bin, args, opts);
}

/** Run an arbitrary executable (uv, pipx, pip, …) and buffer the output. */
export function runExec(
  command: string,
  args: string[],
  opts: { cwd?: string; timeout?: number } = {},
): Promise<RunResult> {
  const bin = resolveExec(command);
  if (!bin) {
    return Promise.resolve({
      ok: false,
      code: null,
      stdout: "",
      stderr: `${command} not found on PATH.`,
      notFound: true,
    });
  }
  return bufferSpawn(bin, args, opts);
}

export interface StreamEvent {
  type: "stdout" | "stderr" | "exit" | "error" | "info";
  data: string;
  code?: number | null;
}

function spawnStream(
  bin: string,
  args: string[],
  onEvent: (e: StreamEvent) => void,
  opts: { cwd?: string } = {},
): Promise<number | null> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: opts.cwd,
      windowsHide: true,
      env: process.env,
    });
    const emitLines = (type: "stdout" | "stderr") => (buf: Buffer) => {
      const text = buf.toString();
      for (const line of text.split(/\r?\n/)) {
        if (line.length) onEvent({ type, data: line });
      }
    };
    child.stdout.on("data", emitLines("stdout"));
    child.stderr.on("data", emitLines("stderr"));
    child.on("error", (err) => {
      onEvent({ type: "error", data: String(err) });
      resolve(null);
    });
    child.on("close", (code) => {
      onEvent({ type: "exit", data: `exited with code ${code}`, code });
      resolve(code);
    });
  });
}

/** Stream a jcodemunch-mcp subcommand, one event per output line. */
export function stream(
  args: string[],
  onEvent: (e: StreamEvent) => void,
  opts: { cwd?: string } = {},
): Promise<number | null> {
  const bin = resolveBinary();
  if (!bin) {
    onEvent({
      type: "error",
      data: "jcodemunch-mcp executable not found on PATH (set JCM_BIN to override).",
    });
    return Promise.resolve(null);
  }
  return spawnStream(bin, args, onEvent, opts);
}

/** Stream an arbitrary executable (uv, pipx, pip, …) resolved from PATH. */
export function streamExec(
  command: string,
  args: string[],
  onEvent: (e: StreamEvent) => void,
  opts: { cwd?: string } = {},
): Promise<number | null> {
  const bin = resolveExec(command);
  if (!bin) {
    onEvent({ type: "error", data: `${command} not found on PATH.` });
    return Promise.resolve(null);
  }
  return spawnStream(bin, args, onEvent, opts);
}
