import "server-only";

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import {
  DatabaseConfigurationError,
  toDatabaseQueryError,
} from "@/server/db/errors";

const DEFAULT_SCHEMA = "fswm";
const DEFAULT_POOL_MAX = 10;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;

let pool: Pool | null = null;

export type QueryParams = readonly unknown[];

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new DatabaseConfigurationError("DATABASE_URL is required.");
  }

  return databaseUrl;
}

function getPoolMax() {
  const value = Number.parseInt(process.env.DB_POOL_MAX ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_POOL_MAX;
}

function getSslConfig() {
  return process.env.DB_SSL === "true"
    ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
      }
    : undefined;
}

export function getDatabasePool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      connectionTimeoutMillis: DEFAULT_CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: DEFAULT_IDLE_TIMEOUT_MS,
      max: getPoolMax(),
      options: `-c search_path=${DEFAULT_SCHEMA},public`,
      ssl: getSslConfig(),
    });
  }

  return pool;
}

export async function getDatabaseClient() {
  try {
    return await getDatabasePool().connect();
  } catch (error) {
    throw toDatabaseQueryError(error);
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: QueryParams = [],
): Promise<QueryResult<T>> {
  try {
    return await getDatabasePool().query<T>(text, [...values]);
  } catch (error) {
    throw toDatabaseQueryError(error, text);
  }
}

export async function queryRows<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: QueryParams = [],
) {
  const result = await query<T>(text, values);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: QueryParams = [],
) {
  const result = await query<T>(text, values);
  return result.rows[0] ?? null;
}

export function releaseDatabaseClient(client: PoolClient) {
  client.release();
}

export async function closeDatabasePool() {
  if (!pool) {
    return;
  }

  const activePool = pool;
  pool = null;
  await activePool.end();
}

