import "server-only";

type PgErrorShape = {
  code?: string;
  constraint?: string;
  detail?: string;
  message?: string;
  schema?: string;
  table?: string;
};

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

export class DatabaseQueryError extends Error {
  readonly code?: string;
  readonly constraint?: string;
  readonly detail?: string;
  readonly query?: string;
  readonly schema?: string;
  readonly table?: string;

  constructor(
    message: string,
    options: {
      cause?: unknown;
      code?: string;
      constraint?: string;
      detail?: string;
      query?: string;
      schema?: string;
      table?: string;
    } = {},
  ) {
    super(message);
    this.name = "DatabaseQueryError";
    this.code = options.code;
    this.constraint = options.constraint;
    this.detail = options.detail;
    this.query = options.query;
    this.schema = options.schema;
    this.table = options.table;
    (this as Error & { cause?: unknown }).cause = options.cause;
  }
}

export function toDatabaseQueryError(error: unknown, query?: string) {
  if (error instanceof DatabaseConfigurationError) {
    return error;
  }

  if (error instanceof DatabaseQueryError) {
    return error;
  }

  const pgError = error as PgErrorShape;

  return new DatabaseQueryError(pgError.message ?? "Database query failed.", {
    cause: error,
    code: pgError.code,
    constraint: pgError.constraint,
    detail: pgError.detail,
    query,
    schema: pgError.schema,
    table: pgError.table,
  });
}

export function getPublicDatabaseErrorMessage(error: unknown) {
  if (error instanceof DatabaseConfigurationError) {
    return "Database connection is not configured.";
  }

  if (error instanceof DatabaseQueryError) {
    return error.message;
  }

  return "Database operation failed.";
}

