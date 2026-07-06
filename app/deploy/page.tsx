import { PageHeader, Card } from "@/components/ui";
import { DeployWizard } from "@/components/DeployWizard";
import { doctor } from "@/lib/jcm/discovery";

export const dynamic = "force-dynamic";

export default async function DeployPage() {
  const env = await doctor();
  return (
    <>
      <PageHeader
        title="Deploy"
        description="Guided setup of jcodemunch-mcp on this machine: register MCP clients, install the CLAUDE.md policy, and add auto-reindex hooks."
      />

      {!env.installed ? (
        <Card className="mb-4 border-warn/30 bg-warn/5 px-5 py-4">
          <p className="text-sm text-warn">
            The jcodemunch-mcp CLI was not detected on PATH. Install it first
            (e.g. <span className="font-mono">pip install jcodemunch-mcp</span>),
            or set the <span className="font-mono">JCM_BIN</span> environment
            variable to its full path. The wizard below drives{" "}
            <span className="font-mono">jcodemunch-mcp init</span>, which requires
            the CLI to be present.
          </p>
        </Card>
      ) : null}

      <DeployWizard />
    </>
  );
}
