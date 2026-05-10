import cron from "node-cron";
import { db } from "../db/index.js";
import { rateLimitState, validatedNumbers } from "@wapi/db";
import { sql, lt } from "drizzle-orm";
import { logger } from "../utils/logger.js";

export function startScheduler(): void {
  // Gece yarısı UTC → günlük sayaçları sıfırla
  cron.schedule("0 0 * * *", async () => {
    try {
      await db
        .update(rateLimitState)
        .set({ dailyCount: 0, dailyDate: new Date().toISOString().split("T")[0] });

      logger.info("Günlük mesaj sayaçları sıfırlandı");
    } catch (err) {
      logger.error({ err }, "Günlük sıfırlama hatası");
    }
  });

  // Her gün 03:00 UTC → 7 günden eski validated_numbers kayıtlarını temizle
  cron.schedule("0 3 * * *", async () => {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      await db
        .delete(validatedNumbers)
        .where(lt(validatedNumbers.validatedAt, cutoff));

      logger.info("Eski numara cache kayıtları temizlendi");
    } catch (err) {
      logger.error({ err }, "Cache temizleme hatası");
    }
  });

  logger.info("Zamanlanmış görevler başlatıldı");
}
