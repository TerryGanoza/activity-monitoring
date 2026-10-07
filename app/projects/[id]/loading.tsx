export default function Loading() {
  return (
    <main className="startup-screen" role="status" aria-live="polite">
      <span className="brand-mark"><span>B</span></span>
      <span className="loading-dots">Cargando el proyecto...</span>
    </main>
  );
}
