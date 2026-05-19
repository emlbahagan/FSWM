export default function DashboardLoading() {
  return (
    <div className="flex h-full min-h-[50vh] w-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-[var(--muted)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent"></div>
        <p className="text-sm font-medium animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
