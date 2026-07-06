import { Card, CardHeader, Badge, PageHeader } from "@/components/ui";
import { getGuide, getWhatsNew, CONFIG_REFERENCE } from "@/lib/jcm/help";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const [guide, whatsNew] = await Promise.all([getGuide(), getWhatsNew()]);

  const groups = Array.from(new Set(CONFIG_REFERENCE.map((c) => c.group)));

  return (
    <>
      <PageHeader
        title="Help & Reference"
        description="The jcodemunch tool guide, recent releases, and a reference of config keys."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Tool guide"
            subtitle="From jcodemunch-mcp claude-md --generate"
          />
          <pre className="scroll-thin max-h-[32rem] overflow-auto whitespace-pre-wrap px-5 py-4 text-xs leading-relaxed text-muted">
            {guide.markdown || guide.error || "Guide unavailable."}
          </pre>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="What's new" subtitle="Recent releases" />
            <pre className="scroll-thin max-h-64 overflow-auto whitespace-pre-wrap px-5 py-4 text-xs leading-relaxed text-muted">
              {whatsNew.text || whatsNew.error || "No changelog available."}
            </pre>
          </Card>

          <Card>
            <CardHeader
              title="Config reference"
              subtitle="Frequently-used keys for config.jsonc"
            />
            <div className="px-5 py-4">
              {groups.map((g) => (
                <div key={g} className="mb-4 last:mb-0">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
                    {g}
                  </div>
                  <div className="flex flex-col gap-2">
                    {CONFIG_REFERENCE.filter((c) => c.group === g).map((c) => (
                      <div key={c.key} className="flex items-start gap-3">
                        <code className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-accent">
                          {c.key}
                        </code>
                        <span className="text-xs text-muted">{c.desc}</span>
                        <Badge tone="neutral" className="ml-auto shrink-0">
                          {c.defaultValue}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
