import Link from "next/link";
import { Search, Filter } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";
import { queryRows } from "@/server/db";

export const dynamic = "force-dynamic";

type AuditLogRow = {
  auditLogId: string;
  actorEmail: string | null;
  actorName: string | null;
  actionCode: string;
  moduleCode: string;
  targetTable: string | null;
  targetId: string | null;
  oldValueJson: unknown | null;
  newValueJson: unknown | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string; action?: string; page?: string }>;
}) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.SystemAdmin);

  const { module, action, page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = 100;
  const offset = (currentPage - 1) * pageSize;

  const queryParams: unknown[] = [];
  let whereClauses = "1=1";

  if (module && module !== "ALL") {
    queryParams.push(module);
    whereClauses += ` AND al.module_code = $${queryParams.length}`;
  }

  if (action && action.trim()) {
    queryParams.push(`%${action.trim().toUpperCase()}%`);
    whereClauses += ` AND al.action_code LIKE $${queryParams.length}`;
  }

  const limitIndex = queryParams.length + 1;
  const offsetIndex = queryParams.length + 2;

  const logsPlusOne = await queryRows<AuditLogRow>(
    `
      SELECT 
        al.audit_log_id as "auditLogId",
        u.email as "actorEmail",
        u.last_name || ', ' || u.first_name as "actorName",
        al.action_code as "actionCode",
        al.module_code as "moduleCode",
        al.target_table as "targetTable",
        al.target_id as "targetId",
        al.old_value_json as "oldValueJson",
        al.new_value_json as "newValueJson",
        al.ip_address as "ipAddress",
        al.user_agent as "userAgent",
        al.created_at as "createdAt"
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_user_id = u.user_id
      WHERE ${whereClauses}
      ORDER BY al.created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `,
    [...queryParams, pageSize + 1, offset]
  );

  const hasNextPage = logsPlusOne.length > pageSize;
  const logs = logsPlusOne.slice(0, pageSize);

  const getPageUrl = (pageNumber: number) => {
    const searchParamsObj = new URLSearchParams();
    if (module && module !== "ALL") {
      searchParamsObj.set("module", module);
    }
    if (action && action.trim()) {
      searchParamsObj.set("action", action);
    }
    searchParamsObj.set("page", pageNumber.toString());
    return `/dashboard/audit?${searchParamsObj.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="border-b border-[var(--line)] pb-5">
        <h1 className="text-2xl font-bold tracking-tight">System Audit Logs</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Immutable audit trail of authentication events and privileged administrative actions.
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
        <form className="flex flex-col sm:flex-row gap-4 items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-[var(--muted)]" />
              <select
                name="module"
                defaultValue={module || "ALL"}
                className="rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-sm focus:border-[var(--teal)] focus:outline-none"
              >
                <option value="ALL">All Modules</option>
                <option value="AUTH">Authentication (AUTH)</option>
                <option value="USERS">Users & Roles (USERS)</option>
                <option value="PRIVACY">Privacy Notices (PRIVACY)</option>
                <option value="MASTER_DATA">Master Data (MASTER_DATA)</option>
                <option value="TERMS">Academic Terms (TERMS)</option>
                <option value="FACULTY">Faculty Profiles (FACULTY)</option>
                <option value="SCHEDULING">Scheduling (SCHEDULING)</option>
              </select>
            </div>

            <div className="relative flex-1 sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                name="action"
                defaultValue={action || ""}
                placeholder="Filter by action code..."
                className="w-full rounded-md border border-[var(--line)] bg-background pl-9 pr-3 py-1.5 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Link
              href="/dashboard/audit"
              className="rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs font-semibold hover:bg-[var(--line)]/50 transition"
            >
              Reset Filters
            </Link>
            <button
              type="submit"
              className="rounded-md bg-[var(--teal)] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[var(--teal)]/90"
            >
              Apply Filter
            </button>
          </div>
        </form>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--line)] text-left text-sm font-mono">
            <thead className="bg-background/50 font-sans font-semibold text-[var(--muted)] text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Actor</th>
                <th className="px-6 py-3.5">Module & Action</th>
                <th className="px-6 py-3.5">Target</th>
                <th className="px-6 py-3.5">Changes / Data Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] text-xs">
              {logs.map((log) => (
                <tr key={log.auditLogId} className="transition hover:bg-background/30 font-mono">
                  <td className="px-6 py-4 whitespace-nowrap text-[var(--muted)]">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-sans font-medium text-foreground">
                    {log.actorName ? `${log.actorName} (${log.actorEmail})` : "System / Anonymous"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 font-sans">
                      <span className="rounded bg-[var(--teal)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--teal)] border border-[var(--teal)]/20">
                        {log.moduleCode}
                      </span>
                      <span className="font-semibold text-foreground">{log.actionCode}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[var(--muted)]">
                    {log.targetTable ? `${log.targetTable} (${log.targetId?.slice(0, 8)}...)` : "-"}
                  </td>
                  <td className="px-6 py-4 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap text-[var(--muted)] hover:whitespace-normal hover:max-w-none transition-all">
                    {log.newValueJson ? JSON.stringify(log.newValueJson) : "-"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center font-sans text-sm text-[var(--muted)]">
                    No audit records match the specified filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="mt-4 flex items-center justify-between px-2">
        <div className="text-xs text-[var(--muted)] font-sans">
          Page {currentPage} (Showing {logs.length} record{logs.length === 1 ? "" : "s"})
        </div>
        <div className="flex gap-2">
          {currentPage > 1 ? (
            <Link
              href={getPageUrl(currentPage - 1)}
              className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-[var(--line)]/50 transition"
            >
              Previous
            </Link>
          ) : (
            <button
              disabled
              className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] opacity-50 cursor-not-allowed"
            >
              Previous
            </button>
          )}

          {hasNextPage ? (
            <Link
              href={getPageUrl(currentPage + 1)}
              className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-[var(--line)]/50 transition"
            >
              Next
            </Link>
          ) : (
            <button
              disabled
              className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] opacity-50 cursor-not-allowed"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
