import { changePasswordAction } from "@/app/(auth)/change-password/actions";
import { requireCurrentUser } from "@/server/auth";
import { Sparkles, Shield, Lock, AlertCircle, ShieldAlert } from "lucide-react";

type ChangePasswordPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ChangePasswordPage({ searchParams }: ChangePasswordPageProps) {
  // Validate they are authenticated. If not, requireCurrentUser will automatically bounce to login.
  // Passing allowForceResetPage ensures they don't get bounced out of this page recursively.
  const currentUser = await requireCurrentUser({ allowForceResetPage: true });
  
  const params = await searchParams;
  const errorType = params.error;

  let errorMessage = "";
  if (errorType === "missing") {
    errorMessage = "Please fill in all password fields.";
  } else if (errorType === "length") {
    errorMessage = "Your password must be at least 8 characters long.";
  } else if (errorType === "strength") {
    errorMessage = "For security, your password must contain at least one uppercase letter, one lowercase letter, and one number.";
  } else if (errorType === "match") {
    errorMessage = "The passwords you entered do not match. Please verify and try again.";
  }

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
              <ShieldAlert size={12} className="animate-pulse" /> Mandatory Security Update
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
              Secure Your Academic <br />
              <span className="bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent">Identity & Workload Profile</span>
            </h2>
            <p className="text-sm leading-relaxed text-slate-300">
              Your system administrator created this account with a temporary password. To activate access to your schedules and academic profiles, please set a strong personal password.
            </p>
          </div>

          {/* Security details */}
          <div className="space-y-4 border-t border-slate-800 pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-2 text-cyan-400 shrink-0">
                <Lock size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Strong Entropy Standard</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Passwords must follow university security baselines, ensuring protection against credential reuse.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-2 text-indigo-400 shrink-0">
                <Shield size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">End-to-End Cryptography</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">All passwords are salted and hashed natively using secure cryptographic curves before database entry.</p>
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

      {/* Right Form Panel */}
      <section className="w-full lg:w-2/5 flex flex-col justify-center px-6 py-12 sm:px-12 md:px-20 relative bg-background">
        <div className="w-full max-w-sm mx-auto space-y-8">
          
          {/* Header */}
          <div className="space-y-2">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <ShieldAlert size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mt-4">Reset Temporary Password</h1>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Hi, <strong className="text-foreground font-semibold">{currentUser.firstName}</strong>. Please change your temporary password to activate your account.
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/50 p-4 text-xs flex items-start gap-2.5 animate-pulse">
              <AlertCircle className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-800 dark:text-rose-400">Password Update Required</p>
                <p className="text-rose-700 dark:text-rose-400/80 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form action={changePasswordAction} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider block">New Secure Password</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-[var(--muted)]">
                  <Lock size={16} />
                </span>
                <input
                  className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] pl-11 pr-4 text-xs font-medium outline-none transition focus:border-[var(--teal)] focus:ring-2 focus:ring-[var(--teal)]/10"
                  name="password"
                  required
                  placeholder="••••••••"
                  type="password"
                />
              </div>
              <p className="text-[10px] text-[var(--muted)]">At least 8 chars, 1 uppercase, 1 lowercase, 1 number.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider block">Confirm Password</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-[var(--muted)]">
                  <Lock size={16} />
                </span>
                <input
                  className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] pl-11 pr-4 text-xs font-medium outline-none transition focus:border-[var(--teal)] focus:ring-2 focus:ring-[var(--teal)]/10"
                  name="confirmPassword"
                  required
                  placeholder="••••••••"
                  type="password"
                />
              </div>
            </div>

            <button
              className="h-11 w-full rounded-xl bg-[var(--teal)] text-white text-xs font-bold shadow-md shadow-teal-500/10 transition hover:bg-[var(--teal)]/90 hover:shadow-teal-500/20 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 mt-2"
              type="submit"
            >
              Update Password & Sign In
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
