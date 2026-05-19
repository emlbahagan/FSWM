import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { DatabaseConfigurationError } from "@/server/db";
import type { SessionPayload } from "@/server/auth/types";

export const SESSION_COOKIE_NAME = "fswm_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;
const SIGNATURE_ALGORITHM = "sha256";

function getAuthSecret() {
  const authSecret = process.env.AUTH_SECRET?.trim();

  if (!authSecret) {
    throw new DatabaseConfigurationError("AUTH_SECRET is required.");
  }

  return authSecret;
}

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string) {
  return createHmac(SIGNATURE_ALGORITHM, getAuthSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function verifySignature(encodedPayload: string, signature: string) {
  const expected = signPayload(encodedPayload);
  const expectedBuffer = Buffer.from(expected, "base64url");
  const actualBuffer = Buffer.from(signature, "base64url");

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function serializeSession(payload: SessionPayload) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseSession(value: string): SessionPayload | null {
  const [encodedPayload, signature] = value.split(".");

  if (!encodedPayload || !signature || !verifySignature(encodedPayload, signature)) {
    return null;
  }

  const payload = JSON.parse(decodeBase64Url(encodedPayload)) as SessionPayload;

  if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function createSession(userId: string) {
  const cookieStore = await cookies();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;

  cookieStore.set(
    SESSION_COOKIE_NAME,
    serializeSession({ exp: expiresAt, sub: userId }),
    getSessionCookieOptions(),
  );
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function readSession() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!cookieValue) {
    return null;
  }

  try {
    return parseSession(cookieValue);
  } catch {
    return null;
  }
}

