import { resolveBinary, resolveExec, runExec } from "./cli";

export type InstallMethod = "uv" | "pipx" | "pip" | "unknown";

export interface UpgradeStep {
  label: string;
  command: string; // "uv" | "pipx" | "jcodemunch-mcp"
  args: string[];
}

export interface InstallInfo {
  method: InstallMethod;
  /** Human label, e.g. "uv tool", "pipx", "pip". */
  manager: string;
  binaryPath: string | null;
  /** The ordered commands the Upgrade button will run for this method. */
  upgradePlan: UpgradeStep[];
  /** One-line display of the upgrade command(s). */
  upgradeDisplay: string;
  /** Optional caveat surfaced in the UI. */
  note?: string;
}

const JCM = "jcodemunch-mcp";

// Tool managers (uv especially) emit ANSI color codes even without a TTY.
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;
const stripAnsi = (s: string) => s.replace(ANSI, "");

/** Does `uv tool list` report jcodemunch-mcp as a managed tool? */
async function detectUv(): Promise<boolean> {
  if (!resolveExec("uv")) return false;
  const res = await runExec("uv", ["tool", "list"], { timeout: 15_000 });
  if (!res.ok && res.notFound) return false;
  // Tool lines look like "jcodemunch-mcp v1.108.102"; provided-binary lines are
  // indented "- jcodemunch-mcp". Match only the tool line.
  return /^jcodemunch-mcp\s+v/m.test(stripAnsi(res.stdout));
}

async function detectPipx(): Promise<boolean> {
  if (!resolveExec("pipx")) return false;
  const res = await runExec("pipx", ["list", "--short"], { timeout: 15_000 });
  if (!res.ok && res.notFound) return false;
  return /(^|\n)\s*jcodemunch-mcp\b/.test(stripAnsi(res.stdout));
}

async function detectPip(): Promise<boolean> {
  // Prefer `python -m pip` so we probe the interpreter's environment.
  for (const [cmd, args] of [
    ["python", ["-m", "pip", "show", JCM]],
    ["pip", ["show", JCM]],
  ] as const) {
    if (!resolveExec(cmd)) continue;
    const res = await runExec(cmd, [...args], { timeout: 15_000 });
    if (res.ok && /^Name:\s*jcodemunch-mcp/im.test(res.stdout)) return true;
  }
  return false;
}

function planFor(method: InstallMethod): {
  manager: string;
  upgradePlan: UpgradeStep[];
  note?: string;
} {
  switch (method) {
    case "uv":
      return {
        manager: "uv tool",
        upgradePlan: [
          { label: "Upgrade the tool", command: "uv", args: ["tool", "upgrade", JCM] },
          {
            label: "Refresh hooks & config",
            command: JCM,
            args: ["upgrade", "--no-pip", "--yes"],
          },
        ],
      };
    case "pipx":
      return {
        manager: "pipx",
        upgradePlan: [
          { label: "Upgrade the package", command: "pipx", args: ["upgrade", JCM] },
          {
            label: "Refresh hooks & config",
            command: JCM,
            args: ["upgrade", "--no-pip", "--yes"],
          },
        ],
      };
    case "pip":
      return {
        manager: "pip",
        upgradePlan: [
          {
            label: "Upgrade via pip + refresh",
            command: JCM,
            args: ["upgrade", "--yes"],
          },
        ],
      };
    default:
      return {
        manager: "unknown",
        upgradePlan: [
          {
            label: "Built-in upgrade (pip)",
            command: JCM,
            args: ["upgrade", "--yes"],
          },
        ],
        note:
          "Install method not detected — falling back to the CLI's built-in pip upgrade. " +
          "If jcodemunch-mcp was installed with uv or pipx, upgrade it with that tool instead.",
      };
  }
}

function displayFor(plan: UpgradeStep[]): string {
  return plan.map((s) => `${s.command} ${s.args.join(" ")}`).join("  &&  ");
}

/** Detect how jcodemunch-mcp is installed and the right way to upgrade it. */
export async function detectInstall(): Promise<InstallInfo> {
  const binaryPath = resolveBinary();

  let method: InstallMethod = "unknown";
  if (await detectUv()) method = "uv";
  else if (await detectPipx()) method = "pipx";
  else if (await detectPip()) method = "pip";

  const { manager, upgradePlan, note } = planFor(method);
  return {
    method,
    manager,
    binaryPath,
    upgradePlan,
    upgradeDisplay: displayFor(upgradePlan),
    note,
  };
}
