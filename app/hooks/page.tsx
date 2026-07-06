import {
  Card,
  CardHeader,
  Badge,
  KeyVal,
  PageHeader,
  EmptyState,
} from "@/components/ui";
import { HooksActions } from "@/components/HooksActions";
import { getInstallStatus } from "@/lib/jcm/status";

export const dynamic = "force-dynamic";

export default async function HooksPage() {
  const status = await getInstallStatus();

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
            {status.clients.map((c) => (
              <KeyVal
                key={c.name}
                k={c.name}
                v={
                  <Badge tone={c.configured ? "ok" : "neutral"}>
                    {c.configured ? `via ${c.method}` : "not configured"}
                  </Badge>
                }
              />
            ))}
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
