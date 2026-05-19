import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";
import { createUserAction } from "@/app/(dashboard)/dashboard/users/actions";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.SystemAdmin);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <div className="flex items-center gap-4 border-b border-[var(--line)] pb-5">
        <Link
          href="/dashboard/users"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--panel)] transition hover:bg-background"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add New User</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Create a new system account with default active credentials.
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
        <form action={createUserAction} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="block text-sm font-semibold">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                required
                placeholder="John"
                className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-semibold">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                required
                placeholder="Doe"
                className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-semibold">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              placeholder="john.doe@fswm.edu"
              className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold">
              Temporary Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              placeholder="Enter password"
              className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
            />
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              The user will use this password to sign in initially.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-6">
            <Link
              href="/dashboard/users"
              className="rounded-md border border-[var(--line)] bg-background px-4 py-2 text-sm font-semibold transition hover:bg-[var(--line)]/50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal)]/90"
            >
              <UserPlus size={18} />
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
