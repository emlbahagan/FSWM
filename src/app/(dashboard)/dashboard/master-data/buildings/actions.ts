"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, withTransaction, transactionQuery } from "@/server/db";
import { requireCurrentUser, recordAuditLog } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";

export async function createBuildingAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const buildingCode = formData.get("buildingCode")?.toString().trim().toUpperCase();
  const buildingName = formData.get("buildingName")?.toString().trim();

  if (!buildingCode || !buildingName) {
    throw new Error("Missing building code or name");
  }

  const bldg = await queryOne<{ building_id: string }>(
    `
      INSERT INTO buildings (building_code, building_name, is_active)
      VALUES ($1, $2, true)
      RETURNING building_id
    `,
    [buildingCode, buildingName]
  );

  if (!bldg) {
    throw new Error("Failed to create building or duplicate code");
  }

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "BUILDING_CREATED",
    moduleCode: "MASTER_DATA",
    targetTable: "buildings",
    targetId: bldg.building_id,
    newValueJson: { buildingCode, buildingName, isActive: true },
  });

  revalidatePath("/dashboard/master-data/buildings");
}

export async function updateBuildingAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const buildingId = formData.get("buildingId")?.toString();
  const buildingName = formData.get("buildingName")?.toString().trim();
  const isActive = formData.get("isActive") === "true";

  if (!buildingId || !buildingName) {
    throw new Error("Missing required fields");
  }

  await query(
    `
      UPDATE buildings
      SET building_name = $1, is_active = $2
      WHERE building_id = $3
    `,
    [buildingName, isActive, buildingId]
  );

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "BUILDING_UPDATED",
    moduleCode: "MASTER_DATA",
    targetTable: "buildings",
    targetId: buildingId,
    newValueJson: { buildingName, isActive },
  });

  revalidatePath("/dashboard/master-data/buildings");
}

export async function createRoomAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const buildingId = formData.get("buildingId")?.toString();
  const roomTypeId = formData.get("roomTypeId")?.toString();
  const roomCode = formData.get("roomCode")?.toString().trim().toUpperCase();
  const roomName = formData.get("roomName")?.toString().trim();
  const capacity = parseInt(formData.get("capacity")?.toString() || "0", 10);
  const featureIds = formData.getAll("featureIds").map(id => id.toString());

  if (!buildingId || !roomTypeId || !roomCode || !roomName || capacity <= 0) {
    throw new Error("Missing required fields or invalid capacity");
  }

  await withTransaction(async (client) => {
    const room = await transactionQuery<{ room_id: string }>(
      client,
      `
        INSERT INTO rooms (building_id, room_type_id, room_code, room_name, capacity, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING room_id
      `,
      [buildingId, roomTypeId, roomCode, roomName, capacity]
    );

    if (room.rowCount === 0 || !room.rows[0]) {
      throw new Error("Failed to create room or duplicate room code in building");
    }

    const roomId = room.rows[0].room_id;

    for (const featureId of featureIds) {
      await transactionQuery(
        client,
        `INSERT INTO room_feature_assignments (room_id, room_feature_id) VALUES ($1, $2)`,
        [roomId, featureId]
      );
    }

    await recordAuditLog({
      actorUserId: currentUser.userId,
      actionCode: "ROOM_CREATED",
      moduleCode: "MASTER_DATA",
      targetTable: "rooms",
      targetId: roomId,
      newValueJson: { buildingId, roomTypeId, roomCode, roomName, capacity, featureIds },
    });
  });

  revalidatePath("/dashboard/master-data/buildings");
}

export async function updateRoomAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const roomId = formData.get("roomId")?.toString();
  const roomName = formData.get("roomName")?.toString().trim();
  const capacity = parseInt(formData.get("capacity")?.toString() || "0", 10);
  const isActive = formData.get("isActive") === "true";
  const featureIds = formData.getAll("featureIds").map(id => id.toString());

  if (!roomId || !roomName || capacity <= 0) {
    throw new Error("Missing required fields or invalid capacity");
  }

  await withTransaction(async (client) => {
    await transactionQuery(
      client,
      `
        UPDATE rooms
        SET room_name = $1, capacity = $2, is_active = $3
        WHERE room_id = $4
      `,
      [roomName, capacity, isActive, roomId]
    );

    await transactionQuery(
      client,
      `DELETE FROM room_feature_assignments WHERE room_id = $1`,
      [roomId]
    );

    for (const featureId of featureIds) {
      await transactionQuery(
        client,
        `INSERT INTO room_feature_assignments (room_id, room_feature_id) VALUES ($1, $2)`,
        [roomId, featureId]
      );
    }

    await recordAuditLog({
      actorUserId: currentUser.userId,
      actionCode: "ROOM_UPDATED",
      moduleCode: "MASTER_DATA",
      targetTable: "rooms",
      targetId: roomId,
      newValueJson: { roomName, capacity, isActive, featureIds },
    });
  });

  revalidatePath("/dashboard/master-data/buildings");
}
