import { Suspense } from "react";

import Dashboard from "./dashboard";

export default function Home() {
  return (
    <Suspense fallback={<main className="startup-screen"><span className="loading-dots">Preparando tu espacio de trabajo</span></main>}>
      <Dashboard />
    </Suspense>
  );
}
