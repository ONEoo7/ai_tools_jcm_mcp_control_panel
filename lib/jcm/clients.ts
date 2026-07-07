import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ClientStatus } from "./status";
import { resolveBinary, run } from "./cli";

/**
 * How a not-configured client can be registered from the panel:
 *  - "cli":     the jcodemunch-mcp CLI supports it (`install <target>`).
 *  - "mcpjson": the CLI can't, so the panel writes the editor's mcp.json.
 */
export type RegisterDescriptor =
  | { via: "cli"; target: string }
  | { via: "mcpjson"; name: string };

export interface DetectedClient extends ClientStatus {
  register?: RegisterDescriptor;
}

interface ExtraClientDef {
  name: string;
  /** MCP config candidates, first existing wins. */
  configPaths: string[];
  /** Any of these existing means the client is installed on this machine. */
  installMarkers: string[];
  /** Short display label for the "via …" badge. */
  method: string;
  register: RegisterDescriptor;
}

/** Per-user application-config base for the current OS. */
function appConfigBase(): string {
  const home = os.homedir();
  if (process.platform === "win32") {
    return process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
  }
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support");
  }
  return process.env.XDG_CONFIG_HOME ?? path.join(home, ".config");
}

/**
 * MCP clients the CLI's `install-status` may not report — either because the CLI
 * doesn't know them (VS Code Copilot, Antigravity) or because it omits an
 * installed-but-unconfigured client that has no config file yet (Claude Desktop
 * on a fresh machine). Detected panel-side from app-install markers so they
 * still surface with a Register action.
 */
function clientDefs(): ExtraClientDef[] {
  const base = appConfigBase();
  const home = os.homedir();
  const localApp = process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");

  return [
    {
      name: "Claude Desktop",
      configPaths: [path.join(base, "Claude", "claude_desktop_config.json")],
      installMarkers: [
        path.join(base, "Claude"),
        path.join(localApp, "Programs", "Claude"),
        "/Applications/Claude.app",
      ],
      method: "cli",
      register: { via: "cli", target: "claude-desktop" },
    },
    {
      name: "GitHub Copilot (VS Code)",
      configPaths: [
        path.join(base, "Code", "User", "mcp.json"),
        path.join(base, "Code - Insiders", "User", "mcp.json"),
      ],
      installMarkers: [
        path.join(base, "Code", "User"),
        path.join(base, "Code - Insiders", "User"),
      ],
      method: "mcp.json",
      register: { via: "mcpjson", name: "GitHub Copilot (VS Code)" },
    },
    {
      name: "Antigravity (Google)",
      configPaths: [path.join(base, "Antigravity", "User", "mcp.json")],
      installMarkers: [
        path.join(base, "Antigravity", "User"),
        path.join(home, ".antigravity"),
        path.join(localApp, "Programs", "Antigravity"),
      ],
      method: "mcp.json",
      register: { via: "mcpjson", name: "Antigravity (Google)" },
    },
  ];
}

async function firstExisting(paths: string[]): Promise<string | null> {
  for (const p of paths) {
    try {
      await fs.access(p);
      return p;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

/** CLI client display-name → `install` target, for register buttons on clients
 * the CLI already reports. */
export const CLI_REGISTER_TARGETS: Record<string, string> = {
  "claude code": "claude-code",
  "claude desktop": "claude-desktop",
  cursor: "cursor",
  windsurf: "windsurf",
  continue: "continue",
};

/**
 * Detect additional MCP clients installed on this machine and whether
 * jcodemunch is registered with each. Only returns installed clients, each
 * carrying how it can be registered.
 */
export async function detectExtraClients(): Promise<DetectedClient[]> {
  const out: DetectedClient[] = [];
  for (const def of clientDefs()) {
    const installed = await firstExisting(def.installMarkers);
    if (!installed) continue;

    const cfg = await firstExisting(def.configPaths);
    let configured = false;
    if (cfg) {
      try {
        // A jcodemunch server entry is unambiguous; substring match tolerates
        // the JSONC comments VS Code allows in mcp.json.
        configured = /jcodemunch/i.test(await fs.readFile(cfg, "utf8"));
      } catch {
        /* unreadable — treat as not configured */
      }
    }

    out.push({
      name: def.name,
      method: def.method,
      config_path: cfg ?? def.configPaths[0],
      configured,
      register: def.register,
    });
  }
  return out;
}

export interface RegisterResult {
  ok: boolean;
  path?: string;
  backup?: string;
  error?: string;
}

/** Strip // and block comments so JSONC config files parse with JSON.parse. */
function stripJsonComments(s: string): string {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Register jcodemunch as an MCP server in an editor's mcp.json (VS Code /
 * Antigravity `{"servers": {…}}` schema). Additive — preserves other servers —
 * and backs up any existing file first. Refuses to touch a file that isn't
 * valid JSON rather than clobbering hand-edited config.
 */
export async function registerViaMcpJson(name: string): Promise<RegisterResult> {
  const def = clientDefs().find((d) => d.name === name);
  if (!def) return { ok: false, error: "Unknown client." };
  const target = def.configPaths[0];

  const bin = resolveBinary();
  const serverEntry = bin
    ? { type: "stdio", command: bin, args: ["serve"] }
    : { type: "stdio", command: "uvx", args: ["jcodemunch-mcp"] };

  let root: Record<string, unknown> = {};
  let existed = false;
  try {
    const text = await fs.readFile(target, "utf8");
    existed = true;
    if (text.trim()) {
      try {
        root = JSON.parse(stripJsonComments(text));
      } catch {
        return {
          ok: false,
          error: `${path.basename(target)} isn't valid JSON — edit it manually so registration doesn't overwrite it.`,
        };
      }
    }
  } catch {
    /* file doesn't exist yet — we'll create it */
  }

  if (typeof root !== "object" || root === null || Array.isArray(root)) root = {};
  const servers =
    typeof root.servers === "object" && root.servers !== null && !Array.isArray(root.servers)
      ? (root.servers as Record<string, unknown>)
      : {};
  servers["jcodemunch"] = serverEntry;
  root.servers = servers;

  let backup: string | undefined;
  if (existed) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backup = `${target}.bak-${stamp}`;
    try {
      await fs.copyFile(target, backup);
    } catch {
      backup = undefined; // couldn't back up; still proceed
    }
  }

  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, JSON.stringify(root, null, 2) + "\n", "utf8");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  return { ok: true, path: target, backup };
}

/**
 * Register a CLI-supported client. Uses `init --client <target> --yes --minimal`:
 * `--minimal` writes only the MCP server registration (no CLAUDE.md/audit/hooks
 * side effects), `--yes` runs non-interactively. A backup is created by the CLI.
 */
export async function registerViaCli(target: string): Promise<RegisterResult> {
  const valid = new Set(Object.values(CLI_REGISTER_TARGETS));
  if (!valid.has(target)) return { ok: false, error: `Unsupported target: ${target}` };
  const res = await run(["init", "--client", target, "--yes", "--minimal"], {
    timeout: 120_000,
  });
  if (res.ok) return { ok: true };
  return {
    ok: false,
    error: (res.stderr || res.stdout || "registration failed").trim().slice(0, 500),
  };
}
