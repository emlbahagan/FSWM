import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";
import { createPrivacyNoticeAction } from "@/app/(dashboard)/dashboard/privacy/actions";

export const dynamic = "force-dynamic";

export default async function NewPrivacyNoticePage() {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.SystemAdmin);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <div className="flex items-center gap-4 border-b border-[var(--line)] pb-5">
        <Link
          href="/dashboard/privacy"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--panel)] transition hover:bg-background"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Privacy Notice</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Draft a new version of the system privacy notice or terms of service.
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
        <form action={createPrivacyNoticeAction} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="title" className="block text-sm font-semibold">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                placeholder="FSWM Data Privacy Notice & Terms of Use"
                className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
              />
            </div>
            <div>
              <label htmlFor="noticeVersion" className="block text-sm font-semibold">
                Version Identifier <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="noticeVersion"
                name="noticeVersion"
                required
                placeholder="v1.0.0"
                className="mt-2 w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-semibold">
              Notice Content (Markdown / Text) <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              name="content"
              required
              rows={12}
              placeholder="Enter the full text of the privacy notice..."
              className="mt-2 w-full font-mono rounded-md border border-[var(--line)] bg-background p-3 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-6">
            <Link
              href="/dashboard/privacy"
              className="rounded-md border border-[var(--line)] bg-background px-4 py-2 text-sm font-semibold transition hover:bg-[var(--line)]/50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal)]/90"
            >
              <Save size={18} />
              Save Draft
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
