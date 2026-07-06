import { PageHeader } from "@/components/ui";
import { ConfigEditor } from "@/components/ConfigEditor";

export const dynamic = "force-dynamic";

export default function ConfigPage() {
  return (
    <>
      <PageHeader
        title="Configuration"
        description="Observe and edit global and per-project jcodemunch config. Writes create a timestamped backup first."
      />
      <ConfigEditor />
    </>
  );
}
