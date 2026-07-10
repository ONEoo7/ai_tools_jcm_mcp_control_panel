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
  | { via: "mcpjson"; name: string }
  | { via: "claudedesktop"; configPath: string };

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
  /**
   * The JSON object that holds server entries in this client's config schema:
   *  - "servers"    → VS Code family: { "servers": { name: {type,command,args} } }
   *  - "mcpServers" → Codeium/Gemini/Windsurf family (Antigravity): { "mcpServers": { name: {command,args} } }
   * Defaults to "servers".
   */
  mcpKey?: "servers" | "mcpServers";
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

  // Claude Desktop is handled separately (resolveClaudeDesktop) because the
  // Microsoft Store build virtualizes its config into a per-package folder.
  return [
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
      // Antigravity is Codeium/Gemini-derived: it reads mcp_config.json with an
      // `mcpServers` key under ~/.gemini (NOT the VS Code User/mcp.json + `servers`).
      // Antigravity 2.0 unified config wins; the older per-app path is a fallback.
      name: "Antigravity (Google)",
      configPaths: [
        path.join(home, ".gemini", "config", "mcp_config.json"),
        path.join(home, ".gemini", "antigravity", "mcp_config.json"),
      ],
      installMarkers: [
        path.join(home, ".gemini", "antigravity"),
        path.join(base, "Antigravity", "User"),
        path.join(localApp, "Programs", "Antigravity"),
      ],
      method: "mcp_config.json",
      mcpKey: "mcpServers",
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

async function readdirSafe(p: string): Promise<string[]> {
  try {
    return await fs.readdir(p);
  } catch {
    return [];
  }
}

export interface ClaudeDesktopInfo {
  installed: boolean;
  /** Where the app actually reads/writes claude_desktop_config.json. */
  configPath: string;
  /** true = Microsoft Store (MSIX) build with a virtualized config dir. */
  isStore: boolean;
}

/**
 * Resolve Claude Desktop, handling the Microsoft Store (MSIX) build whose
 * %APPDATA% is virtualized to
 *   %LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude\claude_desktop_config.json
 * The jcodemunch CLI targets the non-Store %APPDATA%\Roaming\Claude path, which
 * a Store install never reads — so we detect and write the right file directly.
 */
export async function resolveClaudeDesktop(): Promise<ClaudeDesktopInfo> {
  const base = appConfigBase();
  const home = os.homedir();
  const local = process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");

  if (process.platform === "win32") {
    const pkgs = await readdirSafe(path.join(local, "Packages"));
    const claudePkg = pkgs.find((p) => /^Claude_/i.test(p));
    if (claudePkg) {
      return {
        installed: true,
        isStore: true,
        configPath: path.join(
          local,
          "Packages",
          claudePkg,
          "LocalCache",
          "Roaming",
          "Claude",
          "claude_desktop_config.json",
        ),
      };
    }
  }

  // Classic (non-Store) install.
  const classicConfig =
    process.platform === "darwin"
      ? path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
      : path.join(base, "Claude", "claude_desktop_config.json");
  const appMarkers =
    process.platform === "win32"
      ? [
          path.join(local, "Claude", "Claude.exe"),
          path.join(local, "AnthropicClaude", "Claude.exe"),
          path.join(local, "Programs", "Claude", "Claude.exe"),
        ]
      : ["/Applications/Claude.app"];
  const installed =
    (await firstExisting([classicConfig])) !== null ||
    (await firstExisting(appMarkers)) !== null;
  return { installed, isStore: false, configPath: classicConfig };
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

  // Claude Desktop (Store or classic) — resolved to the config the app actually
  // reads, and registered by writing that file directly.
  const cd = await resolveClaudeDesktop();
  if (cd.installed) {
    let configured = false;
    try {
      configured = /jcodemunch/i.test(await fs.readFile(cd.configPath, "utf8"));
    } catch {
      /* config not created yet — not configured */
    }
    out.push({
      name: "Claude Desktop",
      method: cd.isStore ? "store config" : "config",
      config_path: cd.configPath,
      configured,
      register: { via: "claudedesktop", configPath: cd.configPath },
    });
  }

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
  // Write to the config file the client already has; else the preferred candidate.
  const target = (await firstExisting(def.configPaths)) ?? def.configPaths[0];
  const key = def.mcpKey ?? "servers";

  const bin = resolveBinary();
  const cmd = bin
    ? { command: bin, args: ["serve"] }
    : { command: "uvx", args: ["jcodemunch-mcp"] };
  // VS Code's `servers` schema tags entries with type:"stdio"; the Codeium/Gemini
  // `mcpServers` schema takes bare command/args.
  const serverEntry = key === "servers" ? { type: "stdio", ...cmd } : cmd;

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
  const existing = root[key];
  const servers =
    typeof existing === "object" && existing !== null && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  servers["jcodemunch"] = serverEntry;
  root[key] = servers;

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
 * Register jcodemunch in Claude Desktop's own config (the `{"mcpServers": {…}}`
 * schema). Writes the exact file the app reads — including the Microsoft Store
 * build's virtualized path — additively, backing up any existing config first.
 * The user must restart Claude Desktop for it to take effect.
 */
export async function registerClaudeDesktop(configPath: string): Promise<RegisterResult> {
  const bin = resolveBinary();
  const serverEntry = bin
    ? { command: bin, args: ["serve"] }
    : { command: "uvx", args: ["jcodemunch-mcp"] };

  let root: Record<string, unknown> = {};
  let existed = false;
  try {
    const text = await fs.readFile(configPath, "utf8");
    existed = true;
    if (text.trim()) {
      try {
        root = JSON.parse(stripJsonComments(text));
      } catch {
        return {
          ok: false,
          error: `${path.basename(configPath)} isn't valid JSON — edit it manually so registration doesn't overwrite it.`,
        };
      }
    }
  } catch {
    /* file doesn't exist yet — we'll create it */
  }

  if (typeof root !== "object" || root === null || Array.isArray(root)) root = {};
  const servers =
    typeof root.mcpServers === "object" &&
    root.mcpServers !== null &&
    !Array.isArray(root.mcpServers)
      ? (root.mcpServers as Record<string, unknown>)
      : {};
  servers["jcodemunch"] = serverEntry;
  root.mcpServers = servers;

  let backup: string | undefined;
  if (existed) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backup = `${configPath}.bak-${stamp}`;
    try {
      await fs.copyFile(configPath, backup);
    } catch {
      backup = undefined;
    }
  }

  try {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(root, null, 2) + "\n", "utf8");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  return { ok: true, path: configPath, backup };
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
