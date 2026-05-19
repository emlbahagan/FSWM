import { loginAction } from "@/app/(auth)/login/actions";
import Link from "next/link";
import { ArrowLeft, Mail, Lock, Sparkles, Shield, BarChart3, ArrowRight } from "lucide-react";

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
    <main className="flex min-h-screen bg-background text-foreground overflow-hidden">
      {/* Left Brand Panel: Deep visual hero, hidden on mobile */}
      <section className="relative hidden lg:flex lg:w-3/5 flex-col justify-between bg-slate-950 p-12 text-white overflow-hidden border-r border-[var(--line)]">
        {/* Decorative background glow blobs */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />

        {/* Top Header branding */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-600 shadow-md">
            <Sparkles size={20} className="text-white animate-pulse" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">FSWM Portal</span>
            <span className="text-[10px] text-cyan-400 font-mono tracking-wider uppercase block mt-0.5">Faculty Scheduler</span>
          </div>
        </div>

        {/* Center Presentation Pitch */}
        <div className="relative z-10 my-auto max-w-lg space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1 text-xs font-semibold text-cyan-400 backdrop-blur-xs">
              <Sparkles size={12} className="animate-spin" /> Next-Gen Scheduling Heuristics
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
              Intelligent Academic Coordination <br />
              <span className="bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent">Built for Modern Universities</span>
            </h2>
            <p className="text-sm leading-relaxed text-slate-300">
              Facilitate automatic draft generations, resolve complex classroom vectors, track instructor workload policies, and defend against scheduling conflicts in real-time.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="space-y-4 border-t border-slate-800 pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-2 text-cyan-400 shrink-0">
                <Sparkles size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Rule-Based Draft Generator</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Satisfy specializations, classroom allocations, and faculty availabilities automatically in seconds.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-2 text-indigo-400 shrink-0">
                <Shield size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Conflict Guard Protection</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Proactively block double-bookings and policy violations via a strict database assertion schema.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-2 text-purple-400 shrink-0">
                <BarChart3 size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Workload Accounting</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Automate teaching unit totals, overload designations, and administrative coordinators review triggers.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-[11px] text-slate-500 font-mono flex items-center justify-between border-t border-slate-900 pt-4">
          <span>© 2026 FSWM Systems</span>
          <span>Secured with AES-256</span>
        </div>
      </section>

      {/* Right Sign-in Form Panel */}
      <section className="w-full lg:w-2/5 flex flex-col justify-center px-6 py-12 sm:px-12 md:px-20 relative bg-background">
        <div className="w-full max-w-sm mx-auto space-y-8">
          
          {/* Back Navigation */}
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--teal)] hover:-translate-x-1 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to landing page
            </Link>
          </div>

          {/* Form Welcome Header */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome Back</h1>
            <p className="text-xs text-[var(--muted)]">
              Sign in with your authorized academic account to access your workload panel.
            </p>
          </div>

          {/* Error Banner */}
          {hasError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/50 p-4 text-xs flex items-start gap-2.5 animate-bounce">
              <AlertCircle className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-800 dark:text-rose-400">Authentication Failed</p>
                <p className="text-rose-700 dark:text-rose-400/80 mt-0.5">The email or password you entered is incorrect. Please try again.</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form action={loginAction} className="space-y-5">
            <input type="hidden" name="next" value={nextPath} />

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider block">Email Address</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-[var(--muted)]">
                  <Mail size={16} />
                </span>
                <input
                  autoComplete="email"
                  className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] pl-11 pr-4 text-xs font-medium outline-none transition focus:border-[var(--teal)] focus:ring-2 focus:ring-[var(--teal)]/10"
                  defaultValue={defaultEmail}
                  name="email"
                  required
                  placeholder="name@university.edu"
                  type="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider block">Password</label>
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-[var(--muted)]">
                  <Lock size={16} />
                </span>
                <input
                  autoComplete="current-password"
                  className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] pl-11 pr-4 text-xs font-medium outline-none transition focus:border-[var(--teal)] focus:ring-2 focus:ring-[var(--teal)]/10"
                  name="password"
                  required
                  placeholder="••••••••"
                  type="password"
                />
              </div>
            </div>

            <button
              className="inline-flex items-center justify-center gap-1.5 h-11 w-full rounded-xl bg-gradient-to-r from-[var(--teal)] to-[var(--teal-light)] px-4 text-xs font-bold text-white shadow-md hover:scale-[1.01] active:scale-[0.99] transition cursor-pointer"
              type="submit"
            >
              Sign In <ArrowRight size={14} />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

// Help import for error icon
function AlertCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

