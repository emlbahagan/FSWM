import { ShieldAlert, Plus, Trash2, Calendar, DoorClosed, Clock, User } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";
import { queryRows, queryOne } from "@/server/db";
import { createRoomBlockAction, deleteRoomBlockAction } from "@/app/(dashboard)/dashboard/blocking/actions";

export const dynamic = "force-dynamic";

type ActiveTerm = {
  academicTermId: string;
  schoolYear: string;
  termName: string;
};

type Room = {
  roomId: string;
  roomCode: string;
  roomName: string;
  buildingCode: string;
};

type DayOfWeek = {
  dayOfWeekId: string;
  dayName: string;
  dayCode: string;
};

type TimeSlot = {
  timeSlotId: string;
  label: string;
  startTime: string;
  endTime: string;
};

type BlockRow = {
  blockId: string;
  roomCode: string;
  roomName: string;
  buildingCode: string;
  dayName: string;
  timeLabel: string;
  startTime: string;
  endTime: string;
  reason: string;
  createdBy: string;
  createdAt: string;
};

export default async function RoomBlockingPage() {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const activeTerm = await queryOne<ActiveTerm>(`
    SELECT academic_term_id as "academicTermId", school_year as "schoolYear", term_name as "termName"
    FROM academic_terms WHERE is_active = true LIMIT 1
  `);

  const rooms = await queryRows<Room>(`
    SELECT r.room_id as "roomId", r.room_code as "roomCode", r.room_name as "roomName", COALESCE(b.building_code, 'VIRT') as "buildingCode"
    FROM rooms r
    LEFT JOIN buildings b ON r.building_id = b.building_id
    WHERE r.is_active = true
    ORDER BY b.building_code, r.room_code
  `);

  const days = await queryRows<DayOfWeek>(`
    SELECT day_of_week_id as "dayOfWeekId", day_name as "dayName", day_code as "dayCode"
    FROM days_of_week ORDER BY sort_order
  `);

  const timeSlots = await queryRows<TimeSlot>(`
    SELECT time_slot_id as "timeSlotId", label, start_time as "startTime", end_time as "endTime"
    FROM time_slots ORDER BY start_time
  `);

  let blocks: BlockRow[] = [];
  if (activeTerm) {
    blocks = await queryRows<BlockRow>(
      `
        SELECT 
          rbt.room_blocked_time_id as "blockId",
          r.room_code as "roomCode",
          r.room_name as "roomName",
          COALESCE(b.building_code, 'VIRT') as "buildingCode",
          d.day_name as "dayName",
          ts.label as "timeLabel",
          ts.start_time::text as "startTime",
          ts.end_time::text as "endTime",
          rbt.reason,
          COALESCE(u.first_name || ' ' || u.last_name, 'System') as "createdBy",
          rbt.created_at::text as "createdAt"
        FROM room_blocked_times rbt
        JOIN rooms r ON rbt.room_id = r.room_id
        LEFT JOIN buildings b ON r.building_id = b.building_id
        JOIN days_of_week d ON rbt.day_of_week_id = d.day_of_week_id
        JOIN time_slots ts ON rbt.time_slot_id = ts.time_slot_id
        LEFT JOIN users u ON rbt.created_by = u.user_id
        WHERE rbt.academic_term_id = $1
        ORDER BY d.sort_order, ts.start_time, r.room_code
      `,
      [activeTerm.academicTermId]
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Room Blocking & Restrictions</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Block physical rooms during specific time intervals for maintenance, institutional events, or administrative holds.
          </p>
        </div>

        {activeTerm && (
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--teal)]/10 px-3 py-1 text-xs font-semibold text-[var(--teal)] border border-[var(--teal)]/20">
            <Calendar size={14} /> Active Term: {activeTerm.schoolYear} - {activeTerm.termName}
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_2.5fr]">
        {/* Create Block Form */}
        <div>
          <div className="sticky top-24 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--rose)]/10 text-[var(--rose)]">
                <ShieldAlert size={20} />
              </div>
              <h2 className="text-lg font-bold">Block Room Slot</h2>
            </div>

            {activeTerm ? (
              <form action={createRoomBlockAction} className="mt-6 space-y-5">
                <input type="hidden" name="academicTermId" value={activeTerm.academicTermId} />

                <div>
                  <label htmlFor="roomId" className="block text-sm font-semibold">
                    Target Room <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="roomId"
                    name="roomId"
                    required
                    className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                  >
                    {rooms.map((r) => (
                      <option key={r.roomId} value={r.roomId}>
                        [{r.buildingCode}] {r.roomName} ({r.roomCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="dayOfWeekId" className="block text-sm font-semibold">
                    Day of Week <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="dayOfWeekId"
                    name="dayOfWeekId"
                    required
                    className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                  >
                    {days.map((d) => (
                      <option key={d.dayOfWeekId} value={d.dayOfWeekId}>
                        {d.dayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="timeSlotId" className="block text-sm font-semibold">
                    Time Slot <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="timeSlotId"
                    name="timeSlotId"
                    required
                    className="mt-2 w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                  >
                    {timeSlots.map((ts) => (
                      <option key={ts.timeSlotId} value={ts.timeSlotId}>
                        {ts.label} ({ts.startTime.slice(0, 5)} - {ts.endTime.slice(0, 5)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="reason" className="block text-sm font-semibold">
                    Reason for Hold / Blocking <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="reason"
                    name="reason"
                    required
                    rows={3}
                    placeholder="Scheduled maintenance, faculty assembly, etc."
                    className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[var(--rose)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--rose)]/90"
                  >
                    <Plus size={18} /> Apply Block Hold
                  </button>
                </div>
              </form>
            ) : (
              <p className="mt-6 text-sm text-[var(--muted)]">An active academic term is required to manage room blocks.</p>
            )}
          </div>
        </div>

        {/* Blocked Times List */}
        <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--line)] text-left text-sm">
              <thead className="bg-background/50 font-semibold text-[var(--muted)]">
                <tr>
                  <th className="px-6 py-4">Room</th>
                  <th className="px-6 py-4">Day & Time Interval</th>
                  <th className="px-6 py-4">Hold Reason</th>
                  <th className="px-6 py-4">Created By</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {blocks.map((blk) => (
                  <tr key={blk.blockId} className="transition hover:bg-background/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <DoorClosed size={16} className="text-[var(--teal)]" />
                        <div>
                          <p className="font-bold font-mono text-[var(--teal)]">[{blk.buildingCode}] {blk.roomCode}</p>
                          <p className="text-xs text-[var(--muted)]">{blk.roomName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Clock size={14} className="text-[var(--muted)]" />
                        <span>{blk.dayName}</span>
                      </div>
                      <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
                        {blk.timeLabel} ({blk.startTime.slice(0, 5)} - {blk.endTime.slice(0, 5)})
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                        {blk.reason}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-[var(--muted)] flex items-center gap-1">
                      <User size={12} /> {blk.createdBy}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <form action={deleteRoomBlockAction}>
                        <input type="hidden" name="blockId" value={blk.blockId} />
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center p-1.5 text-[var(--muted)] hover:text-red-500 rounded hover:bg-background transition"
                          title="Remove block hold"
                        >
                          <Trash2 size={16} />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}

                {blocks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-sm text-[var(--muted)]">
                      No blocked slots or holds configured for this term. Rooms are fully available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
