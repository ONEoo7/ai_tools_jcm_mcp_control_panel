import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ClientStatus } from "./status";
import { resolveBinary } from "./cli";

/**
 * MCP clients the jcodemunch-mcp CLI's `install-status` doesn't report yet
 * (it only knows Claude Code / Claude Desktop). These are detected panel-side
 * from each client's standard MCP config file so they still surface in the UI.
 */
interface ExtraClientDef {
  name: string;
  /** MCP config candidates, first existing wins. VS Code family: {"servers": {…}}. */
  configPaths: string[];
  /** Any of these existing means the client is installed on this machine. */
  installMarkers: string[];
  method: string;
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

function clientDefs(): ExtraClientDef[] {
  const base = appConfigBase();
  const home = os.homedir();
  const localApp = process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");

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

/**
 * Detect additional MCP clients installed on this machine and whether
 * jcodemunch is registered with each. Only returns clients that are actually
 * installed, so the list doesn't fill with editors the user doesn't have.
 */
export async function detectExtraClients(): Promise<ClientStatus[]> {
  const out: ClientStatus[] = [];
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

/** Strip // and /* *​/ comments so JSONC config files parse with JSON.parse. */
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
export async function registerExtraClient(name: string): Promise<RegisterResult> {
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
