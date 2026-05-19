import { loginAction } from "@/app/(auth)/login/actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type LoginPageProps = {
  searchParams: Promise<{
    email?: string;
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const hasError = params.error === "invalid";
  const nextPath = params.next ?? "";
  const defaultEmail = params.email ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--teal)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to landing page
          </Link>
        </div>

        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--teal)]">
            Faculty Scheduling and Workload Management
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Sign in</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Use an active staff or faculty account to access protected modules.
          </p>
        </div>

        {hasError ? (
          <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            The email or password is incorrect.
          </div>
        ) : null}

        <form action={loginAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={nextPath} />

          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              autoComplete="email"
              className="mt-2 h-11 w-full rounded-md border border-[var(--line)] bg-background px-3 text-sm outline-none transition focus:border-[var(--teal)]"
              defaultValue={defaultEmail}
              name="email"
              required
              type="email"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input
              autoComplete="current-password"
              className="mt-2 h-11 w-full rounded-md border border-[var(--line)] bg-background px-3 text-sm outline-none transition focus:border-[var(--teal)]"
              name="password"
              required
              type="password"
            />
          </label>

          <button
            className="h-11 w-full rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
            type="submit"
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
