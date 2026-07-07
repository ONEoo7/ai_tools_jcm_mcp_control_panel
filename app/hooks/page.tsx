import { Card, CardHeader, Badge, KeyVal, PageHeader, EmptyState } from "@/components/ui";
import { HooksActions } from "@/components/HooksActions";
import { McpClientRows } from "@/components/McpClientRows";
import { getInstallStatus } from "@/lib/jcm/status";
import {
  detectExtraClients,
  CLI_REGISTER_TARGETS,
  type DetectedClient,
} from "@/lib/jcm/clients";

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

  const hookEvents = status.hooks.claude_settings.events_with_jcm_rules;

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

  return (
    <>
      <PageHeader
        title="Hooks & Integration"
        description="Reindex hooks and agent integrations registered on this machine."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Claude Code hooks"
            subtitle={status.hooks.claude_settings.path}
            action={
              <Badge tone={hookEvents.length ? "ok" : "neutral"}>
                {hookEvents.length ? "installed" : "not installed"}
              </Badge>
            }
          />
          <div className="px-5 py-4">
            {hookEvents.length ? (
              <div className="flex flex-wrap gap-1.5">
                {hookEvents.map((e) => (
                  <Badge key={e} tone="accent">
                    {e}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">
                No jcodemunch hook rules found in settings.json. Install them
                below to enable auto-reindex on Edit/Write.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="MCP clients" subtitle="Where jcodemunch is registered" />
          <div className="px-5 py-3">
            {clients.length ? (
              <McpClientRows clients={clients} />
            ) : (
              <p className="text-xs text-muted">No MCP clients detected.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Policy files" subtitle="CLAUDE.md, rules, AGENTS.md" />
          <div className="px-5 py-3">
            {Object.entries(status.policies).map(([key, p]) => (
              <KeyVal
                key={key}
                k={key.replace(/_/g, " ")}
                v={
                  <Badge tone={p.present ? "ok" : "neutral"}>
                    {p.present ? "present" : "absent"}
                  </Badge>
                }
              />
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Agent skills" subtitle="jcodemunch Claude skill bundle" />
          <div className="px-5 py-3">
            {Object.entries(status.skills).map(([key, p]) => (
              <KeyVal
                key={key}
                k={key}
                v={
                  <Badge tone={p.present ? "ok" : "neutral"}>
                    {p.present ? "present" : "absent"}
                  </Badge>
                }
              />
            ))}
            <KeyVal
              k="copilot hooks"
              v={
                <Badge tone={status.hooks.copilot.present ? "ok" : "neutral"}>
                  {status.hooks.copilot.present ? "present" : "absent"}
                </Badge>
              }
            />
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <HooksActions />
      </div>
    </>
  );
}
