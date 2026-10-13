import { Suspense } from "react";

import ProjectDetail from "@/app/project-detail";

export default async function ProjectPage({
  params,
}: PageProps<"/projects/[id]">) {
  const { id } = await params;
  return (
    <Suspense fallback={<main className="startup-screen"><span className="loading-dots">Cargando proyecto</span></main>}>
      <ProjectDetail projectId={id} />
    </Suspense>
  );
}
