import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [salt, storedKey] = passwordHash.split(":");
  if (!salt || !storedKey) return false;

  const derivedKey = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  const storedBuffer = Buffer.from(storedKey, "hex");
  if (storedBuffer.length !== derivedKey.length) return false;

  return timingSafeEqual(storedBuffer, derivedKey);
}
