import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { validatedNumbers } from "@wapi/db";
import { toJid } from "../utils/phone.js";
import { deviceManager } from "../whatsapp/manager.js";
import {
  NUMBER_CACHE_POSITIVE_TTL_MS,
  NUMBER_CACHE_NEGATIVE_TTL_MS,
} from "../config/constants.js";

// Negatif sonuçlar için kısa süreli in-memory cache
const negativeCache = new Map<string, number>();

export async function isRegisteredOnWhatsApp(
  phone: string,
  deviceId: string
): Promise<boolean> {
  const jid = toJid(phone);

  // Negatif cache kontrolü
  const negativeExpiry = negativeCache.get(jid);
  if (negativeExpiry && Date.now() < negativeExpiry) {
    return false;
  }

  // DB cache kontrolü
  const [cached] = await db
    .select()
    .from(validatedNumbers)
    .where(eq(validatedNumbers.jid, jid));

  if (cached) {
    const age = Date.now() - new Date(cached.validatedAt).getTime();
    const ttl = cached.isRegistered
      ? NUMBER_CACHE_POSITIVE_TTL_MS
      : NUMBER_CACHE_NEGATIVE_TTL_MS;

    if (age < ttl) {
      return cached.isRegistered;
    }
  }

  // Baileys ile kontrol
  const socket = deviceManager.getSocket(deviceId);
  if (!socket) {
    throw new Error(`Cihaz bağlı değil: ${deviceId}`);
  }

  const results = await socket.onWhatsApp(jid);
  const result = Array.isArray(results) ? results[0] : results;
  const isRegistered = (result as any)?.exists ?? false;

  // DB cache güncelle
  await db
    .insert(validatedNumbers)
    .values({ jid, isRegistered, validatedAt: new Date() })
    .onConflictDoUpdate({
      target: validatedNumbers.jid,
      set: { isRegistered, validatedAt: new Date() },
    });

  if (!isRegistered) {
    negativeCache.set(jid, Date.now() + NUMBER_CACHE_NEGATIVE_TTL_MS);
  }

  return isRegistered;
}
