import { resolveExec, resolveBinary } from "./cli";
import { expectedUvPath, expectedJcmPath } from "./paths";
import type { PlanStep } from "./streamResponse";

export interface BootstrapStatus {
  python: string | null;
  uv: string | null;
  jcm: string | null;
}

/** Detect the prerequisites relevant to a first-time (Python-free) install. */
export function getBootstrapStatus(): BootstrapStatus {
  return {
    python: resolveExec("python") || resolveExec("py") || resolveExec("python3"),
    uv: resolveExec("uv"),
    jcm: resolveBinary(),
  };
}

export interface BootstrapOptions {
  installUv: boolean;
  registerClaude: boolean;
}

const UV_INSTALL_WIN: PlanStep = {
  label: "Install uv (standalone)",
  command: "powershell",
  args: [
    "-ExecutionPolicy",
    "ByPass",
    "-NoProfile",
    "-Command",
    "irm https://astral.sh/uv/install.ps1 | iex",
  ],
};

const UV_INSTALL_UNIX: PlanStep = {
  label: "Install uv (standalone)",
  command: "sh",
  args: ["-c", "curl -LsSf https://astral.sh/uv/install.sh | sh"],
};

/**
 * Build the executable bootstrap plan. Uses absolute paths for uv and the
 * jcodemunch-mcp shim so later steps work even before PATH is refreshed
 * (the standalone uv installer and `uv tool install` both target ~/.local/bin).
 */
export function getBootstrapPlan(opts: BootstrapOptions): {
  steps: PlanStep[];
  uvPresent: boolean;
} {
  const uvOnPath = resolveExec("uv");
  const uvPresent = Boolean(uvOnPath);
  const uvBin = uvOnPath ?? expectedUvPath();
  const jcmBin = resolveBinary() ?? expectedJcmPath();

  const steps: PlanStep[] = [];
  if (!uvPresent && opts.installUv) {
    steps.push(process.platform === "win32" ? UV_INSTALL_WIN : UV_INSTALL_UNIX);
  }
  steps.push({
    label: "Install jcodemunch-mcp via uv",
    command: uvBin,
    args: ["tool", "install", "jcodemunch-mcp"],
  });
  if (opts.registerClaude) {
    steps.push({
      label: "Register with Claude Code",
      command: jcmBin,
      args: ["init", "--client", "claude-code", "--claude-md", "global", "--hooks", "--yes"],
    });
  }
  return { steps, uvPresent };
}

/** Human-friendly command strings for the UI preview (uses short names). */
export interface BootstrapDisplay {
  status: BootstrapStatus;
  uvPresent: boolean;
  installUvCmd: string;
  installJcmCmd: string;
  registerCmd: string;
}

export function getBootstrapDisplay(): BootstrapDisplay {
  const status = getBootstrapStatus();
  const installUvCmd =
    process.platform === "win32"
      ? `powershell -ExecutionPolicy ByPass -Command "irm https://astral.sh/uv/install.ps1 | iex"`
      : `curl -LsSf https://astral.sh/uv/install.sh | sh`;
  return {
    status,
    uvPresent: Boolean(status.uv),
    installUvCmd,
    installJcmCmd: "uv tool install jcodemunch-mcp",
    registerCmd:
      "jcodemunch-mcp init --client claude-code --claude-md global --hooks --yes",
  };
}
