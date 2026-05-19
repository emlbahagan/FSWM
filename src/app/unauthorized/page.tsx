export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--rose)]">
          Unauthorized
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Access denied</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Your account does not have permission to open this module.
        </p>
      </section>
    </main>
  );
}

