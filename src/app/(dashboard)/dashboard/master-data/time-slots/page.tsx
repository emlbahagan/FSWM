import Link from "next/link";
import { ArrowLeft, Clock, Plus, Check, X, Calendar } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";
import { queryRows, queryOne } from "@/server/db";
import { createTimeSlotAction, toggleTermTimeSlotAction } from "@/app/(dashboard)/dashboard/master-data/time-slots/actions";

export const dynamic = "force-dynamic";

type DayOfWeek = {
  dayOfWeekId: string;
  dayName: string;
  dayCode: string;
  sortOrder: number;
};

type TimeSlot = {
  timeSlotId: string;
  startTime: string;
  endTime: string;
  label: string;
};

type TermTimeSlot = {
  dayOfWeekId: string;
  timeSlotId: string;
  isEnabled: boolean;
};

type ActiveTerm = {
  academicTermId: string;
  schoolYear: string;
  termName: string;
};

export default async function TimeSlotsPage() {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const activeTerm = await queryOne<ActiveTerm>(`
    SELECT academic_term_id as "academicTermId", school_year as "schoolYear", term_name as "termName"
    FROM academic_terms WHERE is_active = true LIMIT 1
  `);

  const days = await queryRows<DayOfWeek>(`
    SELECT day_of_week_id as "dayOfWeekId", day_name as "dayName", day_code as "dayCode", sort_order as "sortOrder"
    FROM days_of_week ORDER BY sort_order
  `);

  const timeSlots = await queryRows<TimeSlot>(`
    SELECT time_slot_id as "timeSlotId", start_time as "startTime", end_time as "endTime", label
    FROM time_slots ORDER BY start_time
  `);

  const enabledSlotsMap = new Map<string, boolean>();
  if (activeTerm) {
    const termSlots = await queryRows<TermTimeSlot>(
      `SELECT day_of_week_id as "dayOfWeekId", time_slot_id as "timeSlotId", is_enabled as "isEnabled" FROM term_time_slots WHERE academic_term_id = $1`,
      [activeTerm.academicTermId]
    );
    for (const ts of termSlots) {
      enabledSlotsMap.set(`${ts.dayOfWeekId}-${ts.timeSlotId}`, ts.isEnabled);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/master-data"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--panel)] transition hover:bg-background"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Standard Time Slots</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Configure institutional scheduling intervals and active days matrix.
            </p>
          </div>
        </div>

        {activeTerm && (
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--teal)]/10 px-3 py-1 text-xs font-semibold text-[var(--teal)] border border-[var(--teal)]/20">
            <Calendar size={14} /> Active Term: {activeTerm.schoolYear} - {activeTerm.termName}
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_2.5fr]">
        {/* Add Standard Time Slot Form */}
        <div>
          <div className="sticky top-24 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)]">
                <Clock size={20} />
              </div>
              <h2 className="text-lg font-bold">Add Time Slot</h2>
            </div>

            <form action={createTimeSlotAction} className="mt-6 space-y-5">
              <div>
                <label htmlFor="label" className="block text-sm font-semibold">
                  Slot Label / Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="label"
                  name="label"
                  required
                  placeholder="Morning Period 1 (07:30-09:00)"
                  className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startTime" className="block text-xs font-semibold text-[var(--muted)] uppercase">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    id="startTime"
                    name="startTime"
                    required
                    defaultValue="07:30"
                    className="mt-1 w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-sm focus:border-[var(--teal)] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="endTime" className="block text-xs font-semibold text-[var(--muted)] uppercase">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    id="endTime"
                    name="endTime"
                    required
                    defaultValue="09:00"
                    className="mt-1 w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-sm focus:border-[var(--teal)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal)]/90"
                >
                  <Plus size={18} /> Add Time Slot
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Days x Time Slots Matrix */}
        <div className="space-y-6">
          <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm">
            <div className="border-b border-[var(--line)] bg-background/50 px-6 py-4">
              <h3 className="font-bold text-lg text-foreground">Active Term Schedule Matrix</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Click toggles to enable or disable specific time intervals for classes on each operational day.
              </p>
            </div>

            {activeTerm ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--line)] text-left text-sm font-mono">
                  <thead className="bg-background font-sans font-semibold text-[var(--muted)] text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 sticky left-0 bg-background z-10">Time Slot</th>
                      {days.map((day) => (
                        <th key={day.dayOfWeekId} className="px-4 py-4 text-center min-w-[100px]">
                          {day.dayName.slice(0, 3)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)] text-xs">
                    {timeSlots.map((slot) => (
                      <tr key={slot.timeSlotId} className="hover:bg-background/30 transition">
                        <td className="px-6 py-4 sticky left-0 bg-[var(--panel)] z-10 font-bold text-foreground">
                          <div>
                            <p className="font-sans text-sm">{slot.label}</p>
                            <p className="text-[10px] text-[var(--muted)] font-mono">
                              {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
                            </p>
                          </div>
                        </td>

                        {days.map((day) => {
                          const key = `${day.dayOfWeekId}-${slot.timeSlotId}`;
                          const isEnabled = enabledSlotsMap.get(key) ?? false;

                          return (
                            <td key={day.dayOfWeekId} className="px-4 py-4 text-center">
                              <form action={toggleTermTimeSlotAction}>
                                <input type="hidden" name="academicTermId" value={activeTerm.academicTermId} />
                                <input type="hidden" name="dayOfWeekId" value={day.dayOfWeekId} />
                                <input type="hidden" name="timeSlotId" value={slot.timeSlotId} />
                                <input type="hidden" name="isEnabled" value={isEnabled ? "false" : "true"} />
                                <button
                                  type="submit"
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md border font-semibold shadow-2xs transition ${
                                    isEnabled
                                      ? "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-950/80 dark:border-emerald-800 dark:text-emerald-400"
                                      : "bg-background border-[var(--line)] text-[var(--muted)] hover:bg-[var(--line)]/50"
                                  }`}
                                  title={isEnabled ? "Enabled. Click to Disable" : "Disabled. Click to Enable"}
                                >
                                  {isEnabled ? <Check size={16} /> : <X size={16} />}
                                </button>
                              </form>
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {timeSlots.length === 0 && (
                      <tr>
                        <td colSpan={days.length + 1} className="py-12 text-center font-sans text-sm text-[var(--muted)]">
                          No standard time slots configured yet. Use the form on the left to add slots.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-sm text-[var(--muted)] font-sans">
                No active academic term configured. An active term is required to manage the time slot matrix.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
