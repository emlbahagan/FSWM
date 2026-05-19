import "server-only";

import { queryOne } from "@/server/db/client";
import { getPublicDatabaseErrorMessage } from "@/server/db/errors";

type HealthRow = {
  database_time: Date;
  schema_name: string;
};

export type DatabaseHealth = {
  checkedAt: string;
  databaseTime?: string;
  error?: string;
  latencyMs: number;
  ok: boolean;
  schema?: string;
};

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const startedAt = Date.now();

  try {
    const row = await queryOne<HealthRow>(
      "SELECT now() AS database_time, current_schema() AS schema_name",
    );

    return {
      checkedAt: new Date().toISOString(),
      databaseTime: row?.database_time?.toISOString(),
      latencyMs: Date.now() - startedAt,
      ok: true,
      schema: row?.schema_name,
    };
  } catch (error) {
    return {
      checkedAt: new Date().toISOString(),
      error: getPublicDatabaseErrorMessage(error),
      latencyMs: Date.now() - startedAt,
      ok: false,
    };
  }
}

