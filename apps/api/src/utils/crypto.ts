import { createHash, createHmac, randomBytes } from "crypto";
import { nanoid } from "nanoid";

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const random = randomBytes(32).toString("hex");
  const raw = `wapi_${random}`;
  return {
    raw,
    hash: hashApiKey(raw),
    prefix: raw.slice(0, 13),
  };
}

export function generateId(): string {
  return nanoid(21);
}

export function generateQrToken(): string {
  return randomBytes(32).toString("hex");
}

export function generateHmacSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}
