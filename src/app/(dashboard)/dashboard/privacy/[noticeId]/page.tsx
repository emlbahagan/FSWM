import Link from "next/link";
import { ArrowLeft, Save, Send, AlertCircle, CheckCircle2, Clock, Users } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";
import { queryOne } from "@/server/db";
import { updatePrivacyNoticeAction, publishPrivacyNoticeAction } from "@/app/(dashboard)/dashboard/privacy/actions";

export const dynamic = "force-dynamic";

type NoticeDetail = {
  noticeId: string;
  noticeVersion: string;
  title: string;
  content: string;
  isPublished: boolean;
  publishedAt: Date | null;
  publisherName: string | null;
  createdAt: Date;
  acceptanceCount: number;
};

export default async function PrivacyNoticeDetailPage({
  params,
}: {
  params: Promise<{ noticeId: string }>;
}) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.SystemAdmin);

  const { noticeId } = await params;

  const notice = await queryOne<NoticeDetail>(
    `
      SELECT 
        pn.privacy_notice_id as "noticeId",
        pn.notice_version as "noticeVersion",
        pn.title,
        pn.content,
        pn.is_published as "isPublished",
        pn.published_at as "publishedAt",
        u.last_name || ', ' || u.first_name as "publisherName",
        pn.created_at as "createdAt",
        (SELECT count(*)::int FROM privacy_notice_acceptances pna WHERE pna.privacy_notice_id = pn.privacy_notice_id) as "acceptanceCount"
      FROM privacy_notices pn
      LEFT JOIN users u ON pn.published_by = u.user_id
      WHERE pn.privacy_notice_id = $1
    `,
    [noticeId]
  );

  if (!notice) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-12 text-center sm:px-8">
        <AlertCircle size={48} className="mx-auto text-rose-500" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Privacy Notice Not Found</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          The requested privacy notice version does not exist.
        </p>
        <Link
          href="/dashboard/privacy"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--teal)]/90"
        >
          <ArrowLeft size={18} /> Back to Notices
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/privacy"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--panel)] transition hover:bg-background"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{notice.title}</h1>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[var(--teal)]/10 text-[var(--teal)] border border-[var(--teal)]/20">
                {notice.noticeVersion}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Created on {new Date(notice.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Status Badge & Publish Action */}
        <div className="flex items-center gap-3">
          {notice.isPublished ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                <CheckCircle2 size={16} /> Published Active
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                <Clock size={16} /> Draft Status
              </span>
              <form action={publishPrivacyNoticeAction}>
                <input type="hidden" name="noticeId" value={notice.noticeId} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal)]/90"
                >
                  <Send size={18} /> Publish Notice
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {notice.isPublished && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-xs">
            <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Published Details</p>
            <p className="mt-1.5 font-semibold text-foreground">By {notice.publisherName || "System Administrator"}</p>
            <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
              {notice.publishedAt ? new Date(notice.publishedAt).toLocaleString() : "N/A"}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">User Acceptances</p>
              <p className="mt-1 font-bold text-2xl text-[var(--teal)]">{notice.acceptanceCount}</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">Total recorded faculty/staff acknowledgements</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-[var(--teal)]/10 text-[var(--teal)] flex items-center justify-center">
              <Users size={24} />
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
        <form action={updatePrivacyNoticeAction} className="space-y-6">
          <input type="hidden" name="noticeId" value={notice.noticeId} />

          <div className="grid gap-6 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="title" className="block text-sm font-semibold">
                Notice Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                defaultValue={notice.title}
                required
                disabled={notice.isPublished}
                className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm disabled:bg-background/50 disabled:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
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
                defaultValue={notice.noticeVersion}
                required
                disabled={notice.isPublished}
                className="mt-2 w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm disabled:bg-background/50 disabled:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-semibold">
              Notice Content <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              name="content"
              defaultValue={notice.content}
              required
              rows={16}
              disabled={notice.isPublished}
              className="mt-2 w-full font-mono rounded-md border border-[var(--line)] bg-background p-3 text-sm disabled:bg-background/50 disabled:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
            />
          </div>

          {!notice.isPublished && (
            <div className="flex justify-end border-t border-[var(--line)] pt-6">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal)]/90"
              >
                <Save size={18} /> Save Changes
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
