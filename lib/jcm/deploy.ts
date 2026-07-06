export interface DeployOptions {
  clients: string[]; // e.g. ["claude-code"], or ["claude-code","cursor"]
  claudeMd: "global" | "project" | "none";
  hooks: boolean;
  index: boolean;
  shareSavings: "on" | "off" | "default";
  dryRun: boolean;
  projectPath?: string; // cwd for project-scoped channels
}

export const DEFAULT_DEPLOY: DeployOptions = {
  clients: ["claude-code"],
  claudeMd: "global",
  hooks: true,
  index: false,
  shareSavings: "default",
  dryRun: true,
};

/**
 * Build the `init` argument vector. We always pass --yes so the server-side
 * spawn never blocks on an interactive prompt, and --dry-run for previews.
 */
export function buildInitArgs(opts: DeployOptions): string[] {
  const args = ["init", "--yes"];
  const clients = opts.clients.length ? opts.clients : ["claude-code"];
  args.push("--client", ...clients);

  if (opts.claudeMd !== "none") args.push("--claude-md", opts.claudeMd);
  if (opts.hooks) args.push("--hooks");
  if (opts.index) args.push("--index");
  if (opts.shareSavings !== "default")
    args.push("--share-savings", opts.shareSavings);
  if (opts.dryRun) args.push("--dry-run");

  return args;
}

/** Human-readable preview of the command that will run. */
export function previewCommand(opts: DeployOptions): string {
  return `jcodemunch-mcp ${buildInitArgs(opts).join(" ")}`;
}
