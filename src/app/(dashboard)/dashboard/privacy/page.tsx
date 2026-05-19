import Link from "next/link";
import { Plus, CheckCircle2, Clock, Trash2, Send } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";
import { queryRows } from "@/server/db";
import { publishPrivacyNoticeAction, deletePrivacyNoticeAction } from "@/app/(dashboard)/dashboard/privacy/actions";

export const dynamic = "force-dynamic";

type PrivacyNoticeRow = {
  noticeId: string;
  noticeVersion: string;
  title: string;
  isPublished: boolean;
  publishedAt: Date | null;
  publisherEmail: string | null;
  publisherName: string | null;
  createdAt: Date;
};

export default async function PrivacyNoticesPage() {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.SystemAdmin);

  const notices = await queryRows<PrivacyNoticeRow>(`
    SELECT 
      pn.privacy_notice_id as "noticeId",
      pn.notice_version as "noticeVersion",
      pn.title,
      pn.is_published as "isPublished",
      pn.published_at as "publishedAt",
      u.email as "publisherEmail",
      u.last_name || ', ' || u.first_name as "publisherName",
      pn.created_at as "createdAt"
    FROM privacy_notices pn
    LEFT JOIN users u ON pn.published_by = u.user_id
    ORDER BY pn.is_published DESC, pn.created_at DESC
  `);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Privacy Notice Management</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Create, version, and publish system privacy notices and terms.
          </p>
        </div>
        <Link
          href="/dashboard/privacy/new"
          className="inline-flex items-center gap-2 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal)]/90"
        >
          <Plus size={18} />
          Create New Notice
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--line)] text-left text-sm">
            <thead className="bg-background/50 font-semibold text-[var(--muted)]">
              <tr>
                <th className="px-6 py-4">Version</th>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Published Details</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {notices.map((notice) => (
                <tr key={notice.noticeId} className="transition hover:bg-background/30">
                  <td className="px-6 py-4 font-mono font-semibold">{notice.noticeVersion}</td>
                  <td className="px-6 py-4 font-medium">{notice.title}</td>
                  <td className="px-6 py-4">
                    {notice.isPublished ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                        <CheckCircle2 size={14} /> Active / Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                        <Clock size={14} /> Draft
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-[var(--muted)]">
                    {notice.isPublished && notice.publishedAt ? (
                      <div>
                        <p className="font-medium text-foreground">{notice.publisherName || notice.publisherEmail}</p>
                        <p className="mt-0.5 font-mono">{new Date(notice.publishedAt).toLocaleDateString()}</p>
                      </div>
                    ) : (
                      <span className="italic">Not published</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/dashboard/privacy/${notice.noticeId}`}
                        className="rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs font-semibold hover:bg-[var(--line)]/50 transition"
                      >
                        {notice.isPublished ? "View" : "Edit"}
                      </Link>

                      {!notice.isPublished && (
                        <>
                          <form action={publishPrivacyNoticeAction}>
                            <input type="hidden" name="noticeId" value={notice.noticeId} />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--teal)] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[var(--teal)]/90"
                              title="Publish this version"
                            >
                              <Send size={14} /> Publish
                            </button>
                          </form>
                          <form action={deletePrivacyNoticeAction}>
                            <input type="hidden" name="noticeId" value={notice.noticeId} />
                            <button
                              type="submit"
                              className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--muted)] hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 transition"
                              title="Delete Draft"
                            >
                              <Trash2 size={16} />
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {notices.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-[var(--muted)]">
                    No privacy notices created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
