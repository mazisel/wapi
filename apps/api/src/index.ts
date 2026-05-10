import "dotenv/config";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { buildServer } from "./api/server.js";
import { deviceManager } from "./whatsapp/manager.js";
import { startScheduler } from "./queue/scheduler.js";
import { startAlertWorker } from "./group-monitor/alert-processor.js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./db/index.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  // Veritabanı migration — her başlatmada yeni migration varsa otomatik uygular
  logger.info("Veritabanı migration kontrol ediliyor...");
  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../../../packages/db/migrations"),
  });
  logger.info("Veritabanı hazır");

  const app = await buildServer();

  await deviceManager.initialize();
  startScheduler();
  startAlertWorker();

  await app.listen({ port: config.PORT, host: config.HOST });
  logger.info(`Wapi API ${config.HOST}:${config.PORT} adresinde çalışıyor`);
}

main().catch((err) => {
  logger.fatal({ err }, "Sunucu başlatılamadı");
  process.exit(1);
});
