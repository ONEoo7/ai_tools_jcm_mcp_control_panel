import { PageHeader, SectionTitle } from "@/components/ui";
import { DeployWizard } from "@/components/DeployWizard";
import { BootstrapInstaller } from "@/components/BootstrapInstaller";
import { doctor } from "@/lib/jcm/discovery";
import { getBootstrapDisplay } from "@/lib/jcm/bootstrap";

export const dynamic = "force-dynamic";

export default async function DeployPage() {
  const [env, bootstrap] = await Promise.all([
    doctor(),
    Promise.resolve(getBootstrapDisplay()),
  ]);

  return (
    <>
      <PageHeader
        title="Deploy"
        description="Install jcodemunch-mcp on a new machine, then register MCP clients, the CLAUDE.md policy, and auto-reindex hooks."
      />

      {/* Step 1 — get the CLI onto the machine (Python-free). Shown first when
          it's missing; kept available (collapsed feel) once installed. */}
      <div className="mb-6">
        <SectionTitle className="mb-2">
          Step 1 · Install the CLI
        </SectionTitle>
        <BootstrapInstaller
          status={bootstrap.status}
          uvPresent={bootstrap.uvPresent}
          installUvCmd={bootstrap.installUvCmd}
          installJcmCmd={bootstrap.installJcmCmd}
          registerCmd={bootstrap.registerCmd}
        />
      </div>

      <SectionTitle className="mb-2">
        Step 2 · Configure & register
      </SectionTitle>
      {!env.installed ? (
        <p className="mb-3 text-xs text-warn">
          The jcodemunch-mcp CLI isn&apos;t detected yet — run Step 1 first. The
          wizard below drives <span className="font-mono">jcodemunch-mcp init</span>,
          which requires the CLI to be present.
        </p>
      ) : null}
      <DeployWizard />
    </>
  );
}
