import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(
  (
    password: string | Buffer,
    salt: string | Buffer,
    keylen: number,
    options: { N: number; r: number; p: number; maxmem: number },
    callback: (err: Error | null, derivedKey: Buffer) => void
  ) => scrypt(password, salt, keylen, options, callback)
);

const HASH_PREFIX = "scrypt";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

const DEFAULT_N = 16384;
const DEFAULT_R = 8;
const DEFAULT_P = 1;

const HARDENED_N = 32768;
const HARDENED_R = 8;
const HARDENED_P = 1;

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH, {
    N: HARDENED_N,
    r: HARDENED_R,
    p: HARDENED_P,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;

  return [
    HASH_PREFIX,
    HARDENED_N.toString(),
    HARDENED_R.toString(),
    HARDENED_P.toString(),
    KEY_LENGTH.toString(),
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join(":");
}

export async function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) {
    return false;
  }

  const parts = storedHash.split(":");
  let N = DEFAULT_N;
  let r = DEFAULT_R;
  let p = DEFAULT_P;
  let keyLengthValue = "";
  let saltValue = "";
  let hashValue = "";

  if (parts.length === 7) {
    const [prefix, nVal, rVal, pVal, keyLenVal, saltValStr, hashValStr] = parts;
    if (prefix !== HASH_PREFIX) return false;
    N = Number.parseInt(nVal, 10);
    r = Number.parseInt(rVal, 10);
    p = Number.parseInt(pVal, 10);
    keyLengthValue = keyLenVal;
    saltValue = saltValStr;
    hashValue = hashValStr;
  } else if (parts.length === 4) {
    const [prefix, keyLenVal, saltValStr, hashValStr] = parts;
    if (prefix !== HASH_PREFIX) return false;
    keyLengthValue = keyLenVal;
    saltValue = saltValStr;
    hashValue = hashValStr;
  } else {
    return false;
  }

  const keyLength = Number.parseInt(keyLengthValue, 10);

  if (!Number.isFinite(keyLength) || keyLength <= 0) {
    return false;
  }

  const salt = Buffer.from(saltValue, "base64url");
  const storedKey = Buffer.from(hashValue, "base64url");
  const derivedKey = (await scryptAsync(password, salt, keyLength, {
    N,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;

  return (
    storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey)
  );
}
