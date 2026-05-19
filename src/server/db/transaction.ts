import "server-only";

import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { getDatabaseClient } from "@/server/db/client";
import { toDatabaseQueryError } from "@/server/db/errors";

export type TransactionClient = Pick<PoolClient, "query">;

export type TransactionIsolationLevel =
  | "READ COMMITTED"
  | "REPEATABLE READ"
  | "SERIALIZABLE";

export async function withTransaction<T>(
  callback: (client: TransactionClient) => Promise<T>,
  options: { isolationLevel?: TransactionIsolationLevel } = {},
) {
  const client = await getDatabaseClient();
  const beginSql = options.isolationLevel
    ? `BEGIN ISOLATION LEVEL ${options.isolationLevel}`
    : "BEGIN";

  try {
    await client.query(beginSql);
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      throw toDatabaseQueryError(rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function transactionQuery<T extends QueryResultRow = QueryResultRow>(
  client: TransactionClient,
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  try {
    return await client.query<T>(text, [...values]);
  } catch (error) {
    throw toDatabaseQueryError(error, text);
  }
}

