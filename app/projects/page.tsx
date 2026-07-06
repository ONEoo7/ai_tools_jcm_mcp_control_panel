import { PageHeader } from "@/components/ui";
import { ProjectsManager } from "@/components/ProjectsManager";

export const dynamic = "force-dynamic";

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Add project paths manually, then index them and manage their jcodemunch config."
      />
      <ProjectsManager />
    </>
  );
}
