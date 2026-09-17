export function LoadingScreen({ label = "Loading your studio…" }: { label?: string }) {
  return (
    <div className="studio-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="studio-loading-ring" aria-hidden="true" />
      <strong>{label}</strong>
      <span>Getting everything ready for you.</span>
    </div>
  );
}
