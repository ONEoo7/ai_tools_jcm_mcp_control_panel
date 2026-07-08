import { PageHeader, EmptyState } from "@/components/ui";
import { HooksActions } from "@/components/HooksActions";
import { ClientFiles } from "@/components/ClientFiles";
import { getInstallStatus } from "@/lib/jcm/status";
import {
  detectExtraClients,
  CLI_REGISTER_TARGETS,
  type DetectedClient,
} from "@/lib/jcm/clients";
import { buildClientFileGroups } from "@/lib/jcm/clientFiles";

export const dynamic = "force-dynamic";

export default async function HooksPage() {
  const [status, extraClients] = await Promise.all([
    getInstallStatus(),
    detectExtraClients(),
  ]);

  if (!status.ok) {
    return (
      <>
        <PageHeader title="Hooks & Integration" />
        <EmptyState
          title="Could not read install status"
          description={status.error ?? "jcodemunch-mcp is not available."}
        />
      </>
    );
  }

  // Merge CLI-reported clients with panel-detected ones (VS Code Copilot,
  // Antigravity, and Claude Desktop when the CLI omits it because it has no
  // config file yet). The CLI is authoritative for `configured`; the panel only
  // adds a Register action. Any not-configured client the CLI can install also
  // gets a Register button via `install <target>`.
  const clientMap = new Map<string, DetectedClient>();
  for (const c of status.clients) {
    const target = CLI_REGISTER_TARGETS[c.name.toLowerCase()];
    clientMap.set(c.name.toLowerCase(), {
      ...c,
      register: !c.configured && target ? { via: "cli", target } : undefined,
    });
  }
  for (const c of extraClients) {
    const key = c.name.toLowerCase();
    const existing = clientMap.get(key);
    // CLI status wins for `configured`; keep whichever register path we have.
    if (existing) clientMap.set(key, { ...existing, register: existing.register ?? c.register });
    else clientMap.set(key, c);
  }
  const clients = [...clientMap.values()];
  const groups = buildClientFileGroups(status, clients);

  return (
    <>
      <PageHeader
        title="Hooks & Integration"
        description="Global, machine-level integration per MCP client — MCP registration, user CLAUDE.md, reindex hooks, and the global skill. Per-project files (project CLAUDE.md, AGENTS.md, rules, .jcodemunch.jsonc) live under each project in Projects."
      />

      {groups.length ? (
        <ClientFiles groups={groups} />
      ) : (
        <EmptyState title="No MCP clients detected" />
      )}

      <div className="mt-4">
        <HooksActions />
      </div>
    </>
  );
}
