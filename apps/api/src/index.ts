import "dotenv/config";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { buildServer } from "./api/server.js";
import { deviceManager } from "./whatsapp/manager.js";
import { startScheduler } from "./queue/scheduler.js";

async function main() {
  const app = await buildServer();

  // Bağlı cihazları yükle
  await deviceManager.initialize();

  // Zamanlanmış görevler
  startScheduler();

  // Sunucuyu başlat
  await app.listen({ port: config.PORT, host: config.HOST });
  logger.info(`Wapi API ${config.HOST}:${config.PORT} adresinde çalışıyor`);
}

main().catch((err) => {
  logger.fatal({ err }, "Sunucu başlatılamadı");
  process.exit(1);
});
