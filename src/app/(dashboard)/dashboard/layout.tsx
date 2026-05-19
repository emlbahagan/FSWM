import Link from "next/link";
import { logoutAction } from "@/app/(dashboard)/actions";
import { requireCurrentUser } from "@/server/auth";
import { requireAnyRole, hasAnyRole, RoleCode } from "@/server/rbac";
import { Sidebar, type NavItem } from "@/app/(dashboard)/_components/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  Users, 
  ShieldAlert, 
  Database, 
  CalendarDays, 
  GraduationCap, 
  BookOpen, 
  CheckSquare, 
  CalendarCheck,
  Calendar
} from "lucide-react";

export const dynamic = "force-dynamic";

const DASHBOARD_ROLES = [
  RoleCode.SystemAdmin,
  RoleCode.Registrar,
  RoleCode.DepartmentHead,
  RoleCode.Faculty,
  RoleCode.AdminPersonnel,
] as const;

type NavConfig = NavItem & { roles: readonly RoleCode[] };

const NAV_ITEMS: NavConfig[] = [
  // System Admin
  { label: "Users", href: "/dashboard/users", icon: <Users size={20} />, roles: [RoleCode.SystemAdmin] },
  { label: "Privacy Notices", href: "/dashboard/privacy", icon: <ShieldAlert size={20} />, roles: [RoleCode.SystemAdmin] },
  { label: "Audit Logs", href: "/dashboard/audit", icon: <ShieldAlert size={20} />, roles: [RoleCode.SystemAdmin] },
  { label: "Unlock Requests", href: "/dashboard/unlocks", icon: <CheckSquare size={20} />, roles: [RoleCode.SystemAdmin] },
  
  // Registrar
  { label: "Master Data", href: "/dashboard/master-data", icon: <Database size={20} />, roles: [RoleCode.Registrar] },
  { label: "Term Setup", href: "/dashboard/terms", icon: <CalendarDays size={20} />, roles: [RoleCode.Registrar] },
  { label: "Room Blocking", href: "/dashboard/blocking", icon: <ShieldAlert size={20} />, roles: [RoleCode.Registrar] },
  { label: "Faculty Profiles", href: "/dashboard/faculty", icon: <GraduationCap size={20} />, roles: [RoleCode.Registrar, RoleCode.DepartmentHead] },
  { label: "Subject Offerings", href: "/dashboard/offerings", icon: <BookOpen size={20} />, roles: [RoleCode.Registrar] },
  { label: "Schedule Editor", href: "/dashboard/schedules/edit", icon: <Calendar size={20} />, roles: [RoleCode.Registrar] },
  
  // Department Head
  { label: "Approvals", href: "/dashboard/approval", icon: <CheckSquare size={20} />, roles: [RoleCode.DepartmentHead] },
  
  // Faculty & Scheduling Availability
  { label: "Availability", href: "/dashboard/availability", icon: <CalendarCheck size={20} />, roles: [RoleCode.Faculty, RoleCode.Registrar] },
  { label: "Schedules", href: "/dashboard/schedules/view", icon: <Calendar size={20} />, roles: [RoleCode.Faculty, RoleCode.DepartmentHead, RoleCode.Registrar] },
];

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireCurrentUser();
  requireAnyRole(user, DASHBOARD_ROLES, { anyScope: true });
  const displayName = `${user.firstName} ${user.lastName}`;

  const allowedItems = NAV_ITEMS.filter((item) => hasAnyRole(user, item.roles, { anyScope: true })).map((item) => ({
    href: item.href,
    icon: item.icon,
    label: item.label,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 flex-none border-b border-[var(--line)] bg-[var(--panel)]">
        <div className="flex w-full flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--teal)]">
              FSWM
            </p>
            <h1 className="mt-1 text-xl font-semibold">
              <Link href="/dashboard" className="hover:text-[var(--teal)] transition-colors">
                Dashboard
              </Link>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-[var(--muted)]">{user.email}</p>
            </div>
            <ThemeToggle />
            <form action={logoutAction}>
              <button
                className="h-10 rounded-md border border-[var(--line)] px-3 text-sm font-medium transition hover:bg-background cursor-pointer"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar items={allowedItems} />
        <main className="flex-1 overflow-y-auto">
          <nav className="border-b border-[var(--line)] bg-[var(--panel)] sm:hidden">
            <div className="flex gap-2 overflow-x-auto px-3 py-3">
              {allowedItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex shrink-0 items-center gap-2 rounded-md border border-[var(--line)] bg-background px-3 py-2 text-xs font-semibold text-[var(--muted)]"
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
          {children}
        </main>
      </div>
    </div>
  );
}
