import Link from "next/link";
import { ArrowLeft, Building2, Plus, DoorClosed, Users, Tag, Edit3, Save } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";
import { queryRows } from "@/server/db";
import { createBuildingAction, updateBuildingAction, createRoomAction, updateRoomAction } from "@/app/(dashboard)/dashboard/master-data/buildings/actions";

export const dynamic = "force-dynamic";

type RoomFeature = {
  roomFeatureId: string;
  roomFeatureCode: string;
  roomFeatureName: string;
};

type RoomType = {
  roomTypeId: string;
  roomTypeCode: string;
  roomTypeName: string;
};

type RoomRow = {
  roomId: string;
  roomCode: string;
  roomName: string;
  capacity: number;
  isActive: boolean;
  roomTypeId: string;
  roomTypeName: string;
  features: {
    featureId: string;
    featureCode: string;
    featureName: string;
  }[];
};

type BuildingRow = {
  buildingId: string;
  buildingCode: string;
  buildingName: string;
  isActive: boolean;
  rooms: RoomRow[];
};

export default async function BuildingsPage() {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const roomTypes = await queryRows<RoomType>(`
    SELECT room_type_id as "roomTypeId", room_type_code as "roomTypeCode", room_type_name as "roomTypeName"
    FROM room_types WHERE is_active = true ORDER BY room_type_name
  `);

  const roomFeatures = await queryRows<RoomFeature>(`
    SELECT room_feature_id as "roomFeatureId", room_feature_code as "roomFeatureCode", room_feature_name as "roomFeatureName"
    FROM room_features WHERE is_active = true ORDER BY room_feature_name
  `);

  const rawBuildings = await queryRows<{
    buildingId: string;
    buildingCode: string;
    buildingName: string;
    buildingIsActive: boolean;
    roomId: string | null;
    roomCode: string | null;
    roomName: string | null;
    capacity: number | null;
    roomIsActive: boolean | null;
    roomTypeId: string | null;
    roomTypeName: string | null;
    featuresJson: { featureId: string; featureCode: string; featureName: string }[] | null;
  }>(`
    SELECT 
      b.building_id as "buildingId",
      b.building_code as "buildingCode",
      b.building_name as "buildingName",
      b.is_active as "buildingIsActive",
      r.room_id as "roomId",
      r.room_code as "roomCode",
      r.room_name as "roomName",
      r.capacity,
      r.is_active as "roomIsActive",
      rt.room_type_id as "roomTypeId",
      rt.room_type_name as "roomTypeName",
      (
        SELECT COALESCE(
          json_agg(
            json_build_object(
               'featureId', rf.room_feature_id,
               'featureCode', rf.room_feature_code,
               'featureName', rf.room_feature_name
            )
          ), '[]'::json
        )
        FROM room_feature_assignments rfa
        JOIN room_features rf ON rfa.room_feature_id = rf.room_feature_id
        WHERE rfa.room_id = r.room_id
      ) as "featuresJson"
    FROM buildings b
    LEFT JOIN rooms r ON b.building_id = r.building_id
    LEFT JOIN room_types rt ON r.room_type_id = rt.room_type_id
    ORDER BY b.building_code, r.room_code
  `);

  // Group by building
  const buildingMap = new Map<string, BuildingRow>();
  for (const row of rawBuildings) {
    if (!buildingMap.has(row.buildingId)) {
      buildingMap.set(row.buildingId, {
        buildingId: row.buildingId,
        buildingCode: row.buildingCode,
        buildingName: row.buildingName,
        isActive: row.buildingIsActive,
        rooms: [],
      });
    }

    if (row.roomId && row.roomCode && row.roomName && row.capacity !== null && row.roomIsActive !== null && row.roomTypeId && row.roomTypeName) {
      buildingMap.get(row.buildingId)?.rooms.push({
        roomId: row.roomId,
        roomCode: row.roomCode,
        roomName: row.roomName,
        capacity: row.capacity,
        isActive: row.roomIsActive,
        roomTypeId: row.roomTypeId,
        roomTypeName: row.roomTypeName,
        features: row.featuresJson || [],
      });
    }
  }
  const buildings = Array.from(buildingMap.values());

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="flex items-center gap-4 border-b border-[var(--line)] pb-5">
        <Link
          href="/dashboard/master-data"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--panel)] transition hover:bg-background"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campus Buildings & Rooms</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Manage physical campus structures, lecture halls, capacities, and specialized physical feature tags.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_2.5fr]">
        {/* Create Building Form */}
        <div>
          <div className="sticky top-24 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)]">
                <Building2 size={20} />
              </div>
              <h2 className="text-lg font-bold">Add Building</h2>
            </div>
            <form action={createBuildingAction} className="mt-6 space-y-5">
              <div>
                <label htmlFor="buildingCode" className="block text-sm font-semibold">
                  Building Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="buildingCode"
                  name="buildingCode"
                  required
                  placeholder="MAIN"
                  className="mt-2 w-full font-mono uppercase rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                />
              </div>

              <div>
                <label htmlFor="buildingName" className="block text-sm font-semibold">
                  Building Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="buildingName"
                  name="buildingName"
                  required
                  placeholder="Main Academic Hall"
                  className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal)]/90 cursor-pointer"
                >
                  <Plus size={18} /> Create Building
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Buildings List & Room Management */}
        <div className="space-y-8">
          {buildings.map((bldg) => (
            <div
              key={bldg.buildingId}
              className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm"
            >
              <div className="border-b border-[var(--line)] bg-background/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="rounded bg-[var(--teal)]/10 px-2 py-0.5 font-mono text-xs font-bold text-[var(--teal)] border border-[var(--teal)]/20">
                    {bldg.buildingCode}
                  </span>
                  <span className="text-xs text-[var(--muted)] font-mono">Building ID: {bldg.buildingCode}</span>
                </div>

                <form action={updateBuildingAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="buildingId" value={bldg.buildingId} />
                  <div className="flex items-center gap-1.5 bg-background px-2 py-1 rounded border border-[var(--line)] focus-within:border-[var(--teal)]">
                    <Edit3 size={14} className="text-[var(--muted)]" />
                    <input
                      type="text"
                      name="buildingName"
                      defaultValue={bldg.buildingName}
                      required
                      placeholder="Building Name"
                      className="text-sm font-bold bg-transparent focus:outline-none w-48 text-foreground"
                    />
                  </div>

                  <select
                    name="isActive"
                    defaultValue={bldg.isActive ? "true" : "false"}
                    className="rounded border border-[var(--line)] bg-background px-2.5 py-1 text-xs font-semibold focus:border-[var(--teal)] focus:outline-none"
                  >
                    <option value="true">Active Bldg</option>
                    <option value="false">Inactive Bldg</option>
                  </select>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded bg-[var(--teal)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--teal)]/90 transition shadow-2xs cursor-pointer"
                  >
                    <Save size={14} /> Update Building
                  </button>
                </form>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                  <h4 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
                    <DoorClosed size={16} /> Configured Rooms & Capacities ({bldg.rooms.length})
                  </h4>
                </div>

                <div className="mt-4 space-y-4">
                  {bldg.rooms.map((room) => {
                    const activeFeatureIds = new Set(room.features.map(f => f.featureId));

                    return (
                      <div
                        key={room.roomId}
                        className="rounded-md border border-[var(--line)] bg-background p-4 shadow-xs space-y-3"
                      >
                        <form action={updateRoomAction} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <input type="hidden" name="roomId" value={room.roomId} />
                          
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-mono text-sm font-bold text-[var(--teal)] px-2 py-1 bg-[var(--teal)]/10 rounded border border-[var(--teal)]/20">
                              {room.roomCode}
                            </span>
                            <span className="text-xs font-semibold text-[var(--muted)]">({room.roomTypeName})</span>

                            <div className="flex items-center gap-1.5 bg-[var(--panel)] px-2 py-1 rounded border border-[var(--line)] focus-within:border-[var(--teal)]">
                              <span className="text-xs text-[var(--muted)] font-mono">Name:</span>
                              <input
                                type="text"
                                name="roomName"
                                defaultValue={room.roomName}
                                required
                                placeholder="Room Name"
                                className="text-xs font-semibold bg-transparent focus:outline-none w-44 text-foreground"
                              />
                            </div>

                            <div className="flex items-center gap-1.5 bg-[var(--panel)] px-2 py-1 rounded border border-[var(--line)] focus-within:border-[var(--teal)]">
                              <Users size={12} className="text-[var(--muted)]" />
                              <span className="text-xs text-[var(--muted)] font-mono">Cap:</span>
                              <input
                                type="number"
                                name="capacity"
                                min="1"
                                defaultValue={room.capacity}
                                required
                                className="text-xs font-mono font-semibold bg-transparent focus:outline-none w-16 text-foreground"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              name="isActive"
                              defaultValue={room.isActive ? "true" : "false"}
                              className="rounded border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-xs font-semibold focus:border-[var(--teal)] focus:outline-none"
                            >
                              <option value="true">Active Room</option>
                              <option value="false">Inactive Room</option>
                            </select>
                            
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 rounded bg-[var(--teal)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--teal)]/90 transition shadow-2xs cursor-pointer"
                            >
                              <Save size={14} /> Update Room
                            </button>
                          </div>

                          {/* Editable Features Tag list in update form */}
                          <div className="w-full pt-2 border-t border-[var(--line)] flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-mono text-[var(--muted)] mr-1">Feature Tags:</span>
                            {roomFeatures.map((feat) => (
                              <label
                                key={feat.roomFeatureId}
                                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-mono cursor-pointer transition border ${
                                  activeFeatureIds.has(feat.roomFeatureId)
                                    ? "bg-[var(--teal)]/10 text-[var(--teal)] border-[var(--teal)]/30 font-bold"
                                    : "bg-[var(--panel)] text-[var(--muted)] border-[var(--line)] hover:border-foreground/20"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  name="featureIds"
                                  value={feat.roomFeatureId}
                                  defaultChecked={activeFeatureIds.has(feat.roomFeatureId)}
                                  className="rounded text-[var(--teal)] focus:ring-[var(--teal)] scale-90"
                                />
                                <Tag size={10} /> {feat.roomFeatureName}
                              </label>
                            ))}
                          </div>
                        </form>
                      </div>
                    );
                  })}

                  {bldg.rooms.length === 0 && (
                    <p className="text-xs text-[var(--muted)] italic text-center py-6 border border-dashed border-[var(--line)] rounded-md">
                      No rooms added to this building yet. Use the form below to configure rooms.
                    </p>
                  )}
                </div>

                {/* Add Room Inline Form */}
                <form action={createRoomAction} className="mt-6 border-t border-[var(--line)] pt-5 space-y-4">
                  <input type="hidden" name="buildingId" value={bldg.buildingId} />
                  <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Add New Room to {bldg.buildingName}</p>
                  
                  <div className="grid gap-4 sm:grid-cols-4">
                    <div>
                      <label className="block text-xs text-[var(--muted)] mb-1">Room Code</label>
                      <input
                        type="text"
                        name="roomCode"
                        required
                        placeholder="M101"
                        className="w-full font-mono uppercase rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-[var(--muted)] mb-1">Room Name</label>
                      <input
                        type="text"
                        name="roomName"
                        required
                        placeholder="Room 101 Lecture Hall"
                        className="w-full rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--muted)] mb-1">Capacity</label>
                      <input
                        type="number"
                        name="capacity"
                        min="1"
                        defaultValue="40"
                        required
                        className="w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3 items-end">
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-[var(--muted)] mb-1">Room Type</label>
                      <select
                        name="roomTypeId"
                        required
                        className="w-full rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
                      >
                        {roomTypes.map((rt) => (
                          <option key={rt.roomTypeId} value={rt.roomTypeId}>{rt.roomTypeName} ({rt.roomTypeCode})</option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--teal)] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[var(--teal)]/90 cursor-pointer"
                    >
                      <Plus size={14} /> Add Room
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--muted)] mb-2">Select Room Equipment & Feature Tags (Optional)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {roomFeatures.map((feat) => (
                        <label
                          key={feat.roomFeatureId}
                          className="flex items-center gap-2 rounded border border-[var(--line)] bg-background/50 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-background transition"
                        >
                          <input type="checkbox" name="featureIds" value={feat.roomFeatureId} className="rounded text-[var(--teal)] focus:ring-[var(--teal)]" />
                          <span className="font-mono text-foreground">{feat.roomFeatureName}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </form>
              </div>
            </div>
          ))}

          {buildings.length === 0 && (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-12 text-center text-sm text-[var(--muted)]">
              No campus buildings configured yet. Use the form on the left to add your first building.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
