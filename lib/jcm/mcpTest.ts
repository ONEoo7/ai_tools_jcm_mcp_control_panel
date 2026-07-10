import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveBinary, resolveExec, ensureLocalBinOnPath } from "./cli";

/**
 * Verify that an MCP client is wired to a working jcodemunch server by launching
 * the *exact* command that client is configured to spawn and performing the real
 * MCP stdio handshake against it (`initialize` → `tools/list`). This proves the
 * server the client would boot actually starts and exposes tools — catching a
 * broken binary, wrong path, dead venv, or crash-on-startup. It is read-only: no
 * repo is opened and no repo-mutating tool is called, and the process is killed
 * as soon as the handshake completes.
 *
 * It cannot observe the client's own model *choosing* to call a tool — no local
 * editor (Copilot/Cursor/Windsurf/Antigravity) exposes a scriptable prompt entry
 * a web panel could drive — so this tests the wiring, not the LLM's behavior.
 */

export type CommandSource = "client config" | "resolved binary" | "uvx";

export interface McpTestResult {
  ok: boolean;
  serverName?: string;
  serverVersion?: string;
  protocolVersion?: string;
  toolCount?: number;
  sampleTools?: string[];
  /** True when serverInfo or the tool list clearly identifies jcodemunch. */
  jcodemunchDetected?: boolean;
  /** Display string of the command we actually launched. */
  command?: string;
  /** Where that command came from — the client's own config, or a fallback. */
  source?: CommandSource;
  durationMs?: number;
  error?: string;
}

interface ServerCommand {
  command: string;
  args: string[];
  env?: Record<string, string>;
  source: CommandSource;
}

/** A handful of unmistakably-jcodemunch tool names, for identity confirmation. */
const KNOWN_TOOLS = [
  "search_symbols",
  "list_repos",
  "get_symbol_source",
  "resolve_repo",
  "plan_turn",
  "get_file_outline",
];

/** Strip // and block comments so JSONC config files parse with JSON.parse. */
function stripJsonComments(s: string): string {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Pull the jcodemunch server entry ({command, args, env}) out of a client config
 * file. Handles both schemas: Claude Desktop's `mcpServers` and VS Code /
 * Antigravity's `servers`. Matches the entry whose key or body mentions
 * jcodemunch so a hand-renamed key still resolves.
 */
async function parseConfigCommand(configPath: string): Promise<ServerCommand | null> {
  let text: string;
  try {
    text = await fs.readFile(configPath, "utf8");
  } catch {
    return null;
  }
  let root: unknown;
  try {
    root = JSON.parse(stripJsonComments(text));
  } catch {
    return null;
  }
  if (typeof root !== "object" || root === null) return null;
  const r = root as Record<string, unknown>;
  const servers = (r.mcpServers ?? r.servers) as Record<string, unknown> | undefined;
  if (!servers || typeof servers !== "object") return null;

  let entry: Record<string, unknown> | null = null;
  for (const [k, v] of Object.entries(servers)) {
    if (/jcodemunch/i.test(k) && v && typeof v === "object") {
      entry = v as Record<string, unknown>;
      break;
    }
  }
  if (!entry) {
    for (const v of Object.values(servers)) {
      if (v && typeof v === "object" && /jcodemunch/i.test(JSON.stringify(v))) {
        entry = v as Record<string, unknown>;
        break;
      }
    }
  }
  if (!entry || typeof entry.command !== "string") return null;

  const args = Array.isArray(entry.args) ? entry.args.map(String) : [];
  const env =
    entry.env && typeof entry.env === "object" && !Array.isArray(entry.env)
      ? (entry.env as Record<string, string>)
      : undefined;
  return { command: entry.command, args, env, source: "client config" };
}

/** For CLI-managed clients (no parseable config), test the resolved server. */
function fallbackCommand(): ServerCommand | null {
  const bin = resolveBinary();
  if (bin) return { command: bin, args: ["serve"], source: "resolved binary" };
  const uvx = resolveExec("uvx");
  if (uvx) return { command: uvx, args: ["jcodemunch-mcp"], source: "uvx" };
  return null;
}

async function resolveServerCommand(configPath: string | null): Promise<ServerCommand | null> {
  if (configPath) {
    const fromConfig = await parseConfigCommand(configPath);
    if (fromConfig) return fromConfig;
  }
  return fallbackCommand();
}

interface JsonRpcMsg {
  jsonrpc?: string;
  id?: number | string;
  result?: Record<string, unknown>;
  error?: { message?: string; [k: string]: unknown };
  method?: string;
}

/**
 * Launch the client's jcodemunch server command and run the MCP handshake.
 * Resolves to a structured result (never rejects) so the caller can render it.
 */
export async function testClientServer(
  configPath: string | null,
  timeoutMs = 15_000,
): Promise<McpTestResult> {
  const started = Date.now();
  const cmd = await resolveServerCommand(configPath);
  if (!cmd) {
    return {
      ok: false,
      error:
        "No jcodemunch server command found in the client config, and no jcodemunch-mcp binary on PATH.",
    };
  }

  // uv shims live in ~/.local/bin, which the running panel may not have on PATH.
  ensureLocalBinOnPath();

  // Windows spawn (shell:false) needs an absolute path for a bare command name;
  // resolve it, and only fall back to a shell for .cmd/.bat shims.
  let command = cmd.command;
  let useShell = false;
  if (!path.isAbsolute(command) && !/[\\/]/.test(command)) {
    const resolved = resolveExec(command);
    if (resolved) command = resolved;
    else useShell = process.platform === "win32";
  }
  if (/\.(cmd|bat)$/i.test(command)) useShell = true;

  const display = [cmd.command, ...cmd.args].join(" ");
  const env = { ...process.env, ...(cmd.env ?? {}) };

  let child: ReturnType<typeof spawn>;
  try {
    child = spawn(command, cmd.args, { env, windowsHide: true, shell: useShell });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      command: display,
      source: cmd.source,
      durationMs: Date.now() - started,
    };
  }

  return new Promise<McpTestResult>((resolve) => {
    let settled = false;
    let stderr = "";
    let buf = "";
    let serverInfo: Record<string, unknown> | null = null;
    let protocolVersion: string | undefined;

    let timer: ReturnType<typeof setTimeout>;
    const finish = (r: McpTestResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill();
      } catch {
        /* already gone */
      }
      resolve({ ...r, command: display, source: cmd.source, durationMs: Date.now() - started });
    };
    timer = setTimeout(
      () =>
        finish({
          ok: false,
          error:
            `Timed out after ${timeoutMs}ms waiting for the MCP handshake.` +
            (stderr ? ` Server stderr: ${stderr.trim().slice(0, 300)}` : ""),
        }),
      timeoutMs,
    );

    const send = (msg: object) => {
      try {
        child.stdin?.write(JSON.stringify(msg) + "\n");
      } catch {
        /* stdin closed */
      }
    };

    const handle = (msg: JsonRpcMsg) => {
      if (msg.id === 1) {
        if (msg.error) {
          finish({
            ok: false,
            error: `initialize failed: ${msg.error.message ?? JSON.stringify(msg.error)}`,
          });
          return;
        }
        serverInfo = (msg.result?.serverInfo as Record<string, unknown>) ?? null;
        protocolVersion = msg.result?.protocolVersion as string | undefined;
        send({ jsonrpc: "2.0", method: "notifications/initialized" });
        send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
      } else if (msg.id === 2) {
        if (msg.error) {
          finish({
            ok: false,
            error: `tools/list failed: ${msg.error.message ?? JSON.stringify(msg.error)}`,
          });
          return;
        }
        const rawTools = msg.result?.tools;
        const tools = Array.isArray(rawTools) ? rawTools : [];
        const names = tools
          .map((t) => (t as { name?: unknown })?.name)
          .filter((n): n is string => typeof n === "string");
        const name = typeof serverInfo?.name === "string" ? serverInfo.name : "";
        finish({
          ok: true,
          serverName: name || undefined,
          serverVersion:
            typeof serverInfo?.version === "string" ? serverInfo.version : undefined,
          protocolVersion,
          toolCount: names.length,
          sampleTools: names.slice(0, 5),
          jcodemunchDetected:
            /jcodemunch/i.test(name) || names.some((n) => KNOWN_TOOLS.includes(n)),
        });
      }
    };

    child.on("error", (err: NodeJS.ErrnoException) => {
      finish({
        ok: false,
        error:
          err?.code === "ENOENT"
            ? `Command not found: ${cmd.command}`
            : err.message || String(err),
      });
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("close", (code) => {
      finish({
        ok: false,
        error:
          `Server exited (code ${code}) before completing the handshake.` +
          (stderr ? ` stderr: ${stderr.trim().slice(0, 300)}` : ""),
      });
    });
    child.stdout?.on("data", (d) => {
      buf += d.toString();
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg: JsonRpcMsg | null = null;
        try {
          msg = JSON.parse(line) as JsonRpcMsg;
        } catch {
          continue; // non-JSON log line on stdout — ignore
        }
        if (msg && (msg.id === 1 || msg.id === 2)) handle(msg);
      }
    });

    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "jcm-control-panel", version: "1.0.0" },
      },
    });
  });
}
