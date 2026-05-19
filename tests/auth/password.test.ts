import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { scrypt } from "crypto";

describe("Auth Password Utilities", () => {
  it("should hash and verify a password correctly using hardened params", async () => {
    const password = "my_secure_password";
    const hashed = await hashPassword(password);
    
    expect(hashed).toBeDefined();
    expect(hashed).not.toBe(password);
    
    const isMatch = await verifyPassword(password, hashed);
    expect(isMatch).toBe(true);
    
    const isMatchWrong = await verifyPassword("wrong_password", hashed);
    expect(isMatchWrong).toBe(false);
  });

  it("should verify a legacy 4-part format hash correctly", async () => {
    const password = "legacy_password";
    const salt = Buffer.from("legacy_salt_12345");
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
    const legacyHash = `scrypt:64:${salt.toString("base64url")}:${derivedKey.toString("base64url")}`;
    
    const isMatch = await verifyPassword(password, legacyHash);
    expect(isMatch).toBe(true);
    
    const isMatchWrong = await verifyPassword("wrong_password", legacyHash);
    expect(isMatchWrong).toBe(false);
  });
});
