import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { rateLimitState } from "@wapi/db";
import { config } from "../config/index.js";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "hourly" | "daily"; retry_after_ms: number };

export async function checkRateLimit(deviceId: string): Promise<RateLimitResult> {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const hourStart = new Date(now);
  hourStart.setMinutes(0, 0, 0);

  let [state] = await db
    .select()
    .from(rateLimitState)
    .where(eq(rateLimitState.deviceId, deviceId));

  if (!state) {
    await db.insert(rateLimitState).values({
      deviceId,
      hourlyCount: 0,
      hourlyWindow: hourStart,
      dailyCount: 0,
      dailyDate: todayStr,
    });

    return { allowed: true };
  }

  // Saatlik pencere sıfırla
  const windowStart = state.hourlyWindow ? new Date(state.hourlyWindow) : null;
  if (!windowStart || now >= new Date(windowStart.getTime() + 60 * 60 * 1000)) {
    state = { ...state, hourlyCount: 0, hourlyWindow: hourStart };
  }

  // Günlük sıfırla
  if (state.dailyDate !== todayStr) {
    state = { ...state, dailyCount: 0, dailyDate: todayStr };
  }

  // Saatlik limit
  if (state.hourlyCount >= config.HOURLY_MSG_LIMIT) {
    const nextHour = new Date(state.hourlyWindow!.getTime() + 60 * 60 * 1000);
    return {
      allowed: false,
      reason: "hourly",
      retry_after_ms: nextHour.getTime() - now.getTime(),
    };
  }

  // Günlük limit
  if (state.dailyCount >= config.DAILY_MSG_LIMIT) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return {
      allowed: false,
      reason: "daily",
      retry_after_ms: tomorrow.getTime() - now.getTime(),
    };
  }

  // Sayaçları artır
  await db
    .update(rateLimitState)
    .set({
      hourlyCount: state.hourlyCount + 1,
      hourlyWindow: state.hourlyWindow ?? hourStart,
      dailyCount: state.dailyCount + 1,
      dailyDate: todayStr,
    })
    .where(eq(rateLimitState.deviceId, deviceId));

  return { allowed: true };
}

// Son gönderim zamanlarını in-memory tut (restart sonrası MIN_GAP garantisi yok, kabul edilebilir)
const lastSentAt = new Map<string, number>();

export function checkMinGap(deviceId: string): boolean {
  const last = lastSentAt.get(deviceId);
  if (!last) return true;
  return Date.now() - last >= config.MIN_MSG_GAP_MS;
}

export function recordSent(deviceId: string): void {
  lastSentAt.set(deviceId, Date.now());
}
